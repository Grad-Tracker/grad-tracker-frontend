import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { resolveStudentProfile } from "@/lib/ai-advisor/data";
import { buildSystemPrompt, PROMPT_VERSION } from "@/lib/ai-advisor/prompt";
import {
  createAdvisorToolDependencies,
  createAdvisorTools,
  executeToolByName,
  normalizeAdvisorResponse,
  tryParseJson,
  makeFallbackResponse,
  CLAUDE_TOOL_DEFINITIONS,
  TOOL_NAMES,
} from "@/lib/ai-advisor/tools";
import type { AdvisorToolName } from "@/lib/ai-advisor/tools";
import type {
  AdvisorChatHistoryItem,
  AdvisorChatRequest,
  AdvisorStreamEvent,
} from "@/types/ai-advisor";

function isHistoryItem(value: unknown): value is AdvisorChatHistoryItem {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.role !== "user" && candidate.role !== "assistant") return false;
  return typeof candidate.text === "string";
}

function parseRequestBody(body: unknown): AdvisorChatRequest | null {
  if (!body || typeof body !== "object") return null;
  const candidate = body as Record<string, unknown>;

  if (typeof candidate.message !== "string" || candidate.message.trim().length === 0 || candidate.message.length > 10_000) {
    return null;
  }

  if (!Array.isArray(candidate.history) || candidate.history.length > 100 || !candidate.history.every(isHistoryItem)) {
    return null;
  }

  if (
    candidate.activePlanId !== undefined &&
    candidate.activePlanId !== null &&
    typeof candidate.activePlanId !== "number"
  ) {
    return null;
  }

  return {
    message: candidate.message.trim(),
    history: candidate.history,
    activePlanId: (candidate.activePlanId as number | null | undefined) ?? null,
  };
}

export async function POST(request: Request) {
  let parsedBody: AdvisorChatRequest | null = null;
  try {
    const body = await request.json();
    parsedBody = parseRequestBody(body);
  } catch {
    parsedBody = null;
  }

  if (!parsedBody) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  let profile;
  try {
    profile = await resolveStudentProfile(supabase, user.id);
  } catch (error) {
    console.error("Failed to load student profile:", error);
    return NextResponse.json(
      { error: "Unable to load student profile." },
      { status: 500 }
    );
  }

  if (!profile) {
    return NextResponse.json(
      { error: "Student profile not found." },
      { status: 409 }
    );
  }

  if (!profile.hasCompletedOnboarding) {
    return NextResponse.json(
      { error: "Onboarding not completed." },
      { status: 409 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI advisor is not configured." },
      { status: 503 }
    );
  }

  const requestBody = parsedBody;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: AdvisorStreamEvent) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller may already be closed
        }
      }

      try {
        const client = new Anthropic({ apiKey });
        const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

        const systemPrompt = buildSystemPrompt({
          promptVersion: PROMPT_VERSION,
          studentName: profile.fullName,
          primaryProgram: profile.primaryProgram?.name ?? null,
          catalogYear: profile.primaryProgram?.catalogYear ?? null,
          expectedGraduation: profile.expectedGraduation,
          hasCompletedOnboarding: profile.hasCompletedOnboarding,
        });

        const systemPromptWithJsonInstruction = `${systemPrompt}\n\nReturn strict JSON with keys: answer, recommendations, risks, missingData, citations.`;

        const dependencies = createAdvisorToolDependencies({
          supabase,
          studentId: profile.studentId,
          profile,
        });
        const toolset = createAdvisorTools(dependencies);
        const usedCitations = new Set<string>();
        const missingData: string[] = [];

        const messages: Anthropic.Messages.MessageParam[] = [
          ...requestBody.history.slice(-8).map((item) => ({
            role: item.role as "user" | "assistant",
            content: item.text,
          })),
          { role: "user" as const, content: requestBody.message },
        ];

        const maxTurns = 4;
        let completedWithResponse = false;

        for (let turn = 0; turn < maxTurns; turn++) {
          // Check if request was aborted
          if (request.signal.aborted) {
            break;
          }

          const messageStream = client.messages.stream({
            model,
            max_tokens: 1024,
            system: systemPromptWithJsonInstruction,
            tools: CLAUDE_TOOL_DEFINITIONS,
            messages,
          }, { signal: request.signal });

          let turnHasToolUse = false;

          messageStream.on("contentBlock", (block) => {
            if (block.type === "tool_use") turnHasToolUse = true;
          });

          messageStream.on("text", (text) => {
            if (!turnHasToolUse) {
              send({ type: "delta", text });
            }
          });

          const finalMessage = await messageStream.finalMessage();

          const toolUseBlocks = finalMessage.content.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
          );

          if (toolUseBlocks.length === 0) {
            const textContent = finalMessage.content
              .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
              .map((b) => b.text)
              .join("");
            const parsed = normalizeAdvisorResponse(tryParseJson(textContent));
            const response = parsed ?? makeFallbackResponse(textContent || "I could not parse a response.");
            response.citations = Array.from(new Set([...response.citations, ...usedCitations]));
            response.missingData = Array.from(new Set([...response.missingData, ...missingData]));
            send({ type: "done", response });
            completedWithResponse = true;
            break;
          }

          // Tool turn -- execute tools and continue
          messages.push({ role: "assistant", content: finalMessage.content });
          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

          for (const toolUse of toolUseBlocks) {
            // Short-circuit if aborted
            if (request.signal.aborted) {
              break;
            }

            send({ type: "status", text: `Looking up ${toolUse.name.replaceAll("_", " ")}...` });
            try {
              const toolInput = (toolUse.input ?? {}) as Record<string, unknown>;
              const toolName = toolUse.name as AdvisorToolName;

              // Inject activePlanId for tools that support planId parameter
              if (
                requestBody.activePlanId !== undefined &&
                requestBody.activePlanId !== null &&
                (toolName === TOOL_NAMES.getPlanSnapshot ||
                  toolName === TOOL_NAMES.getDegreeProgress ||
                  toolName === TOOL_NAMES.getRemainingRequirements ||
                  toolName === TOOL_NAMES.recommendNextSemester) &&
                !toolInput.planId
              ) {
                toolInput.planId = requestBody.activePlanId;
              }

              const data = await executeToolByName(toolset, toolName, toolInput);
              usedCitations.add(`tool:${toolUse.name}`);
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify({ ok: true, data }),
              });
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : "Tool failed";
              missingData.push(`${toolUse.name}: ${errorMessage}`);
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify({
                  ok: false,
                  error: errorMessage,
                }),
              });
            }
          }

          messages.push({ role: "user", content: toolResults });
        }

        if (!completedWithResponse) {
          const fallback = makeFallbackResponse(
            "I could not complete tool execution safely in time. Please try again."
          );
          fallback.citations = Array.from(usedCitations);
          fallback.missingData = Array.from(new Set(missingData));
          send({ type: "done", response: fallback });
        }
      } catch (error) {
        console.error("AI advisor stream error:", error);
        send({ type: "error", message: "Unable to process request." });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}