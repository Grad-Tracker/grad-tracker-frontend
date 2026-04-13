import { NextResponse } from "next/server";

import { requireAuthUser } from "@/lib/auth-helpers.server";
import { DB_TABLES, STUDENT_COLUMNS } from "@/lib/supabase/queries/schema";

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireAuthUser();
  if (errorResponse) return errorResponse;

  const body = await request.json().catch(() => null);
  const programId = Number(body?.programId);

  if (Number.isNaN(programId)) {
    return NextResponse.json({ error: "Invalid program id." }, { status: 400 });
  }

  const { data: student, error: studentError } = await supabase
    .from(DB_TABLES.students)
    .select("id")
    .eq(STUDENT_COLUMNS.authUserId, user.id)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }

  if (!student) {
    return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
  }

  const { error } = await supabase.rpc("change_student_major", {
    p_student_id: Number(student.id),
    p_program_id: programId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
