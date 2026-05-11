import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth-helpers.server";
import { resolveStudentProfile } from "@/lib/ai-advisor/data";
import { serverListStudentPlans } from "@/lib/ai-advisor/plan-mutations";

export async function GET() {
  const { user, supabase, errorResponse } = await requireAuthUser();
  if (errorResponse) return errorResponse;

  const profile = await resolveStudentProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  try {
    const plans = await serverListStudentPlans(supabase, profile.studentId);
    return NextResponse.json({ plans });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to list plans:", error);
    return NextResponse.json(
      { error: "Failed to list plans.", details: message },
      { status: 500 }
    );
  }
}
