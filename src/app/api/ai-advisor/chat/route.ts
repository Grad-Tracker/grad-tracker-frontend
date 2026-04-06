import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  if (typeof candidate.message !== "string" || candidate.message.trim().length === 0) {
    return null;
  }

  if (!Array.isArray(candidate.history) || !candidate.history.every(isHistoryItem)) {
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
    const message = error instanceof Error ? error.message : "Unknown profile error";
    return NextResponse.json(
      { error: `Failed to load student profile: ${message}` },
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
    const message =
      error instanceof Error ? error.message : "Unexpected AI advisor failure";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
