import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/supabase/queries/schema";

type SupabaseLike = {
  from: (table: string) => any;
};

/**
 * Confirm that the advisor (identified by staffId) has at least one assigned
 * program that the given student is enrolled in. Redirects to /admin/students
 * if not.
 */
export async function requireAdvisorCanViewStudent(
  supabase: SupabaseLike,
  staffId: number,
  studentId: number
): Promise<void> {
  // First: fetch the program_ids assigned to this advisor.
  let programIds: number[] = [];

  const { data: assignments, error: assignError } = await supabase
    .from(DB_TABLES.programAdvisors)
    .select("program_id")
    .eq("staff_id", staffId);

  if (!assignError && assignments && assignments.length > 0) {
    programIds = assignments
      .map((row: any) => Number(row.program_id))
      .filter((id: number) => !Number.isNaN(id));
  } else {
    // Fall back to legacy advisor_id column (matches existing helper pattern)
    const { data: legacy } = await supabase
      .from(DB_TABLES.programAdvisors)
      .select("program_id")
      .eq("advisor_id", staffId);
    if (legacy && legacy.length > 0) {
      programIds = legacy
        .map((row: any) => Number(row.program_id))
        .filter((id: number) => !Number.isNaN(id));
    }
  }

  if (programIds.length === 0) {
    redirect("/admin/students");
  }

  // Second: confirm this student is enrolled in at least one of those programs.
  const { data: overlap, error: overlapError } = await supabase
    .from(DB_TABLES.studentPrograms)
    .select("student_id, program_id")
    .eq("student_id", studentId)
    .in("program_id", programIds)
    .limit(1);

  if (overlapError || !overlap || overlap.length === 0) {
    redirect("/admin/students");
  }
}
