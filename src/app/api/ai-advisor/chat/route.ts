import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth-helpers.server";
import { resolveStudentProfile } from "@/lib/ai-advisor/data";
import {
  createAdvisorToolDependencies,
  generateAdvisorResponse,
} from "@/lib/ai-advisor/tools";
import type {
  AdvisorChatHistoryItem,
  AdvisorChatRequest,
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

  if (!profile.hasCompletedOnboarding) {
    return NextResponse.json(
      { error: "Onboarding not completed." },
      { status: 409 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI advisor is not configured." },
      { status: 503 }
    );
  }

  try {
    const response = await generateAdvisorResponse({
      message: parsedBody.message,
      history: parsedBody.history,
      activePlanId: parsedBody.activePlanId ?? null,
      profile,
      dependencies: createAdvisorToolDependencies({
        supabase,
        studentId: profile.studentId,
        profile,
      }),
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("AI advisor error:", error);
    return NextResponse.json(
      { error: "Unable to process request." },
      { status: 500 }
    );
  }
}
