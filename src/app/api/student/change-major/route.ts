import { NextResponse } from "next/server";

import { requireAuthUser } from "@/lib/auth-helpers.server";
import { DB_TABLES, STUDENT_COLUMNS } from "@/lib/supabase/queries/schema";

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireAuthUser();
  if (errorResponse) return errorResponse;

  const body = await request.json().catch(() => null);
  const programId = Number(body?.programId);

  if (!Number.isSafeInteger(programId) || programId <= 0) {
    return NextResponse.json({ error: "Invalid program id." }, { status: 400 });
  }

  const { data: student, error: studentError } = await supabase
    .from(DB_TABLES.students)
    .select("id")
    .eq(STUDENT_COLUMNS.authUserId, user.id)
    .maybeSingle();

  if (studentError) {
    console.error("Failed to fetch student for change-major", {
      userId: user.id,
      error: studentError,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!student) {
    return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
  }

  const { error } = await supabase.rpc("change_student_major", {
    p_program_id: programId,
  });

  if (error) {
    console.error("Failed to change student major", {
      userId: user.id,
      studentId: Number(student.id),
      programId,
      error,
    });
    return NextResponse.json({ error: "Unable to change major" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
