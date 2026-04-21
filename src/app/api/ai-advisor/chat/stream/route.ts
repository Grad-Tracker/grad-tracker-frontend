import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuthUser } from "@/lib/auth-helpers.server";
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
  CATALOG_TOOL_DEFINITIONS,
  TOOL_NAMES,
} from "@/lib/ai-advisor/tools";
import { serverListStudentPlans } from "@/lib/ai-advisor/plan-mutations";
import type { AdvisorToolName } from "@/lib/ai-advisor/tools";
import type {
  AdvisorChatHistoryItem,
  AdvisorChatRequest,
  AdvisorSideEffect,
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
    activePlanId: (candidate.activePlanId ?? null) as number | null,
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

  const { user, supabase, errorResponse } = await requireAuthUser();
  if (errorResponse) return errorResponse;

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI advisor is not configured." },
      { status: 503 }
    );
  }

  // Resolve the active plan name for the system prompt.
  let activePlanName: string | null = null;
  if (parsedBody.activePlanId !== null && parsedBody.activePlanId !== undefined) {
    try {
      const plans = await serverListStudentPlans(supabase, profile.studentId);
      activePlanName = plans.find((p) => p.id === parsedBody!.activePlanId)?.name ?? null;
    } catch {
      // Non-fatal — plan name is context-only.
    }
  }

  const requestBody = parsedBody;
  const activeToolDefinitions = profile.hasCompletedOnboarding
    ? CLAUDE_TOOL_DEFINITIONS
    : CATALOG_TOOL_DEFINITIONS;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: AdvisorStreamEvent) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller may already be closed.
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
          activePlanName,
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
        const sideEffects: AdvisorSideEffect[] = [];

        const messages: Anthropic.Messages.MessageParam[] = [
          ...requestBody.history.slice(-8).map((item) => ({
            role: item.role as "user" | "assistant",
            content: item.text,
          })),
          { role: "user" as const, content: requestBody.message },
        ];

        const maxTurns = 20;
        let completedWithResponse = false;

        for (let turn = 0; turn < maxTurns; turn++) {
          if (request.signal.aborted) break;

          const messageStream = client.messages.stream({
            model,
            max_tokens: 5000,
            system: systemPromptWithJsonInstruction,
            tools: activeToolDefinitions,
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
            if (sideEffects.length > 0) {
              response.sideEffects = sideEffects;
            }
            send({ type: "done", response });
            completedWithResponse = true;
            break;
          }

          messages.push({ role: "assistant", content: finalMessage.content });
          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

          for (const toolUse of toolUseBlocks) {
            if (request.signal.aborted) break;

            send({ type: "status", text: `Looking up ${toolUse.name.replaceAll("_", " ")}...` });

            try {
              const toolInput = (toolUse.input ?? {}) as Record<string, unknown>;
              const toolName = toolUse.name as AdvisorToolName;

              // For plan write tools, always override planId with the active plan from the
              // frontend — Claude may hallucinate a planId by inferring it from the plan's
              // name (e.g., "Plan 2" → planId: 2) rather than using the real database ID.
              if (
                (toolName === TOOL_NAMES.addCourseToPlan ||
                  toolName === TOOL_NAMES.removeCourseFromPlan ||
                  toolName === TOOL_NAMES.moveCourseInPlan ||
                  toolName === TOOL_NAMES.renamePlan ||
                  toolName === TOOL_NAMES.clearPlanTerm) &&
                requestBody.activePlanId != null
              ) {
                toolInput.planId = requestBody.activePlanId;
              } else if (
                // Inject activePlanId for plan-scoped read tools when not explicitly provided.
                requestBody.activePlanId !== undefined &&
                requestBody.activePlanId !== null &&
                (toolName === TOOL_NAMES.getPlanSnapshot ||
                  toolName === TOOL_NAMES.getDegreeProgress ||
                  toolName === TOOL_NAMES.getRemainingRequirements ||
                  toolName === TOOL_NAMES.recommendNextSemester ||
                  toolName === TOOL_NAMES.checkGraduationReadiness ||
                  toolName === TOOL_NAMES.validatePlan ||
                  toolName === TOOL_NAMES.projectGraduationDate ||
                  toolName === TOOL_NAMES.checkTermCreditLoad ||
                  toolName === TOOL_NAMES.identifyPlanGaps ||
                  toolName === TOOL_NAMES.getUnfulfillableRequirements ||
                  toolName === TOOL_NAMES.suggestTermBalance ||
                  toolName === TOOL_NAMES.generateAdvisingSummary) &&
                !toolInput.planId
              ) {
                toolInput.planId = requestBody.activePlanId;
              }

              const data = await executeToolByName(toolset, toolName, toolInput);
              usedCitations.add(`tool:${toolUse.name}`);

              // Capture plan creation side effects.
              if (
                toolName === TOOL_NAMES.createPlan &&
                data &&
                typeof data === "object"
              ) {
                const result = data as Record<string, unknown>;
                if (typeof result.planId === "number" && typeof result.name === "string") {
                  sideEffects.push({
                    type: "plan_created",
                    planId: result.planId,
                    planName: result.name,
                  });
                }
              }

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
                content: JSON.stringify({ ok: false, error: errorMessage }),
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
          if (sideEffects.length > 0) fallback.sideEffects = sideEffects;
          send({ type: "done", response: fallback });
        }
      } catch (error) {
        console.error("AI advisor stream error:", error);
        send({ type: "error", message: "Unable to process request." });
        // Yield a tick so the error event flushes before we close the stream.
        await new Promise<void>((r) => setTimeout(r, 0));
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
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
