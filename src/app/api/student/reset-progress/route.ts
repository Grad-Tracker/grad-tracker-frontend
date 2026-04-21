import { NextResponse } from "next/server";

import { requireAuthUser } from "@/lib/auth-helpers.server";
import { DB_TABLES, STUDENT_COLUMNS } from "@/lib/supabase/queries/schema";

export async function POST() {
  const { user, supabase, errorResponse } = await requireAuthUser();
  if (errorResponse) return errorResponse;

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

  const studentId = Number(student.id);

  const historyResult = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .delete()
    .eq("student_id", studentId);
  if (historyResult.error) {
    return NextResponse.json({ error: historyResult.error.message }, { status: 500 });
  }

  const plannedResult = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .delete()
    .eq("student_id", studentId);
  if (plannedResult.error) {
    return NextResponse.json({ error: plannedResult.error.message }, { status: 500 });
  }

  const programsResult = await supabase
    .from(DB_TABLES.studentPrograms)
    .delete()
    .eq("student_id", studentId);
  if (programsResult.error) {
    return NextResponse.json({ error: programsResult.error.message }, { status: 500 });
  }

  const studentUpdateResult = await supabase
    .from(DB_TABLES.students)
    .update({ has_completed_onboarding: false })
    .eq(STUDENT_COLUMNS.id, studentId);
  if (studentUpdateResult.error) {
    return NextResponse.json({ error: studentUpdateResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
