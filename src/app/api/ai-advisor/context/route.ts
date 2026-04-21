import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth-helpers.server";
import { resolveStudentProfile, getDegreeProgress } from "@/lib/ai-advisor/data";

export async function GET() {
  const { user, supabase, errorResponse } = await requireAuthUser();
  if (errorResponse) return errorResponse;

  let profile;
  try {
    profile = await resolveStudentProfile(supabase, user.id);
  } catch {
    return NextResponse.json({ error: "Failed to load profile." }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  let progress;
  try {
    progress = await getDegreeProgress(supabase, profile.studentId);
  } catch {
    return NextResponse.json({ error: "Failed to load progress." }, { status: 500 });
  }

  return NextResponse.json({
    studentName: profile.fullName,
    primaryProgram: profile.primaryProgram?.name ?? null,
    catalogYear: profile.primaryProgram?.catalogYear ?? null,
    expectedGraduation: profile.expectedGraduation,
    progress: {
      overall: progress.overall,
      blocks: progress.blocks,
    },
  });
}
