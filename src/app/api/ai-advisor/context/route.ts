import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveStudentProfile, getDegreeProgress } from "@/lib/ai-advisor/data";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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
