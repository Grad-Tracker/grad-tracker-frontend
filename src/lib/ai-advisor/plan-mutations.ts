import "server-only";

import { DB_TABLES, PLANNED_COURSE_STATUS } from "@/lib/supabase/queries/schema";
import type { SupabaseTableClient } from "@/lib/ai-advisor/data";
import type { AdvisorPlanSummary } from "@/types/ai-advisor";

export async function serverGetOrCreateTerm(
  supabase: SupabaseTableClient,
  season: string,
  year: number
): Promise<number> {
  const { data: existing, error: selectError } = await supabase
    .from(DB_TABLES.terms)
    .select("id")
    .eq("season", season)
    .eq("year", year)
    .maybeSingle();

  if (selectError) throw new Error(`Failed to query terms: ${selectError.message}`);
  if (existing) return Number(existing.id);

  const { data: created, error: insertError } = await supabase
    .from(DB_TABLES.terms)
    .insert({ season, year })
    .select("id")
    .single();

  if (insertError || !created) {
    throw new Error(`Failed to create term: ${insertError?.message ?? "no data"}`);
  }
  return Number(created.id);
}

export async function serverVerifyPlanOwnership(
  supabase: SupabaseTableClient,
  planId: number,
  studentId: number
): Promise<boolean> {
  const { data, error } = await supabase
    .from(DB_TABLES.plans)
    .select("id")
    .eq("id", planId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw new Error(`Failed to verify plan ownership: ${error.message}`);
  return data !== null;
}

export async function serverCreatePlan(
  supabase: SupabaseTableClient,
  studentId: number,
  name: string,
  programIds: number[]
): Promise<{ planId: number }> {
  // Verify that all provided programIds actually belong to this student.
  if (programIds.length > 0) {
    const { data: enrolledRows, error: enrollErr } = await supabase
      .from(DB_TABLES.studentPrograms)
      .select("program_id")
      .eq("student_id", studentId)
      .in("program_id", programIds);

    if (enrollErr) throw new Error(`Failed to verify program enrollment: ${enrollErr.message}`);

    const enrolledIds = new Set((enrolledRows ?? []).map((r: { program_id: number | string }) => Number(r.program_id)));
    const allEnrolled = programIds.every((id) => enrolledIds.has(id));
    if (!allEnrolled) {
      throw new Error("One or more program IDs do not belong to this student.");
    }
  }

  const trimmedName = name.trim().slice(0, 100) || "My Plan";

  const { data: plan, error: planError } = await supabase
    .from(DB_TABLES.plans)
    .insert({ student_id: studentId, name: trimmedName })
    .select("id")
    .single();

  if (planError || !plan) {
    throw new Error(`Failed to create plan: ${planError?.message ?? "no data"}`);
  }

  const planId = Number(plan.id);

  if (programIds.length > 0) {
    const rows = programIds.map((pid) => ({ plan_id: planId, program_id: pid }));
    const { error: ppError } = await supabase.from(DB_TABLES.planPrograms).insert(rows);
    if (ppError) throw new Error(`Failed to link programs to plan: ${ppError.message}`);
  }

  return { planId };
}

export async function serverAddCourseToPlan(
  supabase: SupabaseTableClient,
  studentId: number,
  planId: number,
  courseId: number,
  season: string,
  year: number
): Promise<{ alreadyPlanned: boolean }> {
  // Ownership check.
  const owned = await serverVerifyPlanOwnership(supabase, planId, studentId);
  if (!owned) throw new Error("Plan does not belong to this student.");

  const termId = await serverGetOrCreateTerm(supabase, season, year);

  // Check for duplicate in the specific requested term.
  const { data: existing, error: dupError } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .select("course_id")
    .eq("student_id", studentId)
    .eq("plan_id", planId)
    .eq("course_id", courseId)
    .eq("term_id", termId)
    .maybeSingle();

  if (dupError) throw new Error(`Failed to check for duplicate: ${dupError.message}`);
  if (existing) return { alreadyPlanned: true };

  // Ensure the term is linked to this plan.
  const { data: existingTermPlan, error: tpCheckErr } = await supabase
    .from(DB_TABLES.studentTermPlan)
    .select("term_id")
    .eq("student_id", studentId)
    .eq("plan_id", planId)
    .eq("term_id", termId)
    .maybeSingle();

  if (tpCheckErr) throw new Error(`Failed to check term plan: ${tpCheckErr.message}`);

  if (!existingTermPlan) {
    const { error: tpInsertErr } = await supabase
      .from(DB_TABLES.studentTermPlan)
      .insert({ student_id: studentId, term_id: termId, plan_id: planId });
    if (tpInsertErr) throw new Error(`Failed to link term to plan: ${tpInsertErr.message}`);
  }

  const { error: pcError } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .insert({
      student_id: studentId,
      term_id: termId,
      course_id: courseId,
      plan_id: planId,
      status: PLANNED_COURSE_STATUS.planned,
    });

  if (pcError) throw new Error(`Failed to add course to plan: ${pcError.message}`);

  return { alreadyPlanned: false };
}

export async function serverMoveCourseInPlan(
  supabase: SupabaseTableClient,
  studentId: number,
  planId: number,
  courseId: number,
  toSeason: string,
  toYear: number
): Promise<{ moved: boolean }> {
  // Ownership check.
  const owned = await serverVerifyPlanOwnership(supabase, planId, studentId);
  if (!owned) throw new Error("Plan does not belong to this student.");

  // Confirm the course is actually in this plan.
  const { data: existing, error: findErr } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .select("id, term_id")
    .eq("student_id", studentId)
    .eq("plan_id", planId)
    .eq("course_id", courseId)
    .limit(1);

  if (findErr) throw new Error(`Failed to find course in plan: ${findErr.message}`);
  if (!existing || existing.length === 0) return { moved: false };

  const toTermId = await serverGetOrCreateTerm(supabase, toSeason, toYear);

  // If already in target term, nothing to do.
  const alreadyThere = (existing as { term_id: number | null }[]).every(
    (row) => Number(row.term_id) === toTermId
  );
  if (alreadyThere) return { moved: true };

  // Check for a duplicate entry in the target term.
  const { data: dupCheck, error: dupErr } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .select("id")
    .eq("student_id", studentId)
    .eq("plan_id", planId)
    .eq("course_id", courseId)
    .eq("term_id", toTermId)
    .maybeSingle();

  if (dupErr) throw new Error(`Failed to check for duplicate: ${dupErr.message}`);

  if (dupCheck) {
    // Entry already exists in target term — remove the other term entries instead.
    const { error: delErr } = await supabase
      .from(DB_TABLES.studentPlannedCourses)
      .delete()
      .eq("student_id", studentId)
      .eq("plan_id", planId)
      .eq("course_id", courseId)
      .neq("term_id", toTermId);
    if (delErr) throw new Error(`Failed to consolidate course term: ${delErr.message}`);
  } else {
    // Update all existing entries to the new term.
    const { error: updateErr } = await supabase
      .from(DB_TABLES.studentPlannedCourses)
      .update({ term_id: toTermId })
      .eq("student_id", studentId)
      .eq("plan_id", planId)
      .eq("course_id", courseId);

    if (updateErr) throw new Error(`Failed to move course: ${updateErr.message}`);
  }

  // Ensure target term is linked to this plan.
  const { data: existingTermPlan, error: tpCheckErr } = await supabase
    .from(DB_TABLES.studentTermPlan)
    .select("term_id")
    .eq("student_id", studentId)
    .eq("plan_id", planId)
    .eq("term_id", toTermId)
    .maybeSingle();

  if (tpCheckErr) throw new Error(`Failed to check term plan: ${tpCheckErr.message}`);

  if (!existingTermPlan) {
    const { error: tpInsertErr } = await supabase
      .from(DB_TABLES.studentTermPlan)
      .insert({ student_id: studentId, term_id: toTermId, plan_id: planId });
    if (tpInsertErr) throw new Error(`Failed to link term to plan: ${tpInsertErr.message}`);
  }

  return { moved: true };
}

export async function serverRemoveCourseFromPlan(
  supabase: SupabaseTableClient,
  studentId: number,
  planId: number,
  courseId: number
): Promise<{ removed: boolean }> {
  // Ownership check.
  const owned = await serverVerifyPlanOwnership(supabase, planId, studentId);
  if (!owned) throw new Error("Plan does not belong to this student.");

  const { data, error } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .delete()
    .eq("student_id", studentId)
    .eq("plan_id", planId)
    .eq("course_id", courseId)
    .select("course_id");

  if (error) throw new Error(`Failed to remove course from plan: ${error.message}`);

  return { removed: (data ?? []).length > 0 };
}

export async function serverAddCourseToHistory(
  supabase: SupabaseTableClient,
  studentId: number,
  courseId: number,
  season: string,
  year: number,
  grade?: string | null,
  completed = true
): Promise<{ added: boolean; alreadyExists: boolean }> {
  const termId = await serverGetOrCreateTerm(supabase, season, year);

  const row: Record<string, unknown> = {
    student_id: studentId,
    course_id: courseId,
    term_id: termId,
    completed,
  };
  if (grade != null && grade.trim()) row.grade = grade.trim().toUpperCase();

  const { error } = await supabase.from(DB_TABLES.studentCourseHistory).insert(row);

  if (error) {
    if (error.code === "23505") return { added: false, alreadyExists: true };
    throw new Error(`Failed to add course to history: ${error.message}`);
  }

  return { added: true, alreadyExists: false };
}

export async function serverRenamePlan(
  supabase: SupabaseTableClient,
  studentId: number,
  planId: number,
  newName: string
): Promise<{ renamed: boolean }> {
  const owned = await serverVerifyPlanOwnership(supabase, planId, studentId);
  if (!owned) throw new Error("Plan does not belong to this student.");

  const trimmed = newName.trim().slice(0, 100);
  if (!trimmed) throw new Error("Plan name cannot be empty.");

  const { error } = await supabase
    .from(DB_TABLES.plans)
    .update({ name: trimmed })
    .eq("id", planId)
    .eq("student_id", studentId);

  if (error) throw new Error(`Failed to rename plan: ${error.message}`);
  return { renamed: true };
}

export async function serverClearPlanTerm(
  supabase: SupabaseTableClient,
  studentId: number,
  planId: number,
  season: string,
  year: number
): Promise<{ cleared: boolean; coursesRemoved: number }> {
  const owned = await serverVerifyPlanOwnership(supabase, planId, studentId);
  if (!owned) throw new Error("Plan does not belong to this student.");

  // Find the term ID.
  const { data: termRow, error: termErr } = await supabase
    .from(DB_TABLES.terms)
    .select("id")
    .eq("season", season)
    .eq("year", year)
    .maybeSingle();

  if (termErr) throw new Error(`Failed to look up term: ${termErr.message}`);
  if (!termRow) return { cleared: false, coursesRemoved: 0 };

  const termId = Number(termRow.id);

  const { data: removed, error: delErr } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .delete()
    .eq("student_id", studentId)
    .eq("plan_id", planId)
    .eq("term_id", termId)
    .select("course_id");

  if (delErr) throw new Error(`Failed to clear term: ${delErr.message}`);

  return { cleared: true, coursesRemoved: (removed ?? []).length };
}

export async function serverDuplicatePlan(
  supabase: SupabaseTableClient,
  studentId: number,
  sourcePlanId: number,
  newName: string
): Promise<{ planId: number; coursesCloned: number }> {
  const owned = await serverVerifyPlanOwnership(supabase, sourcePlanId, studentId);
  if (!owned) throw new Error("Plan does not belong to this student.");

  const trimmedName = newName.trim().slice(0, 100) || "Copy of plan";

  // Read source plan programs.
  const { data: ppRows, error: ppErr } = await supabase
    .from(DB_TABLES.planPrograms)
    .select("program_id")
    .eq("plan_id", sourcePlanId);
  if (ppErr) throw new Error(`Failed to read plan programs: ${ppErr.message}`);

  const programIds = (ppRows ?? []).map((r: { program_id: number | string }) => Number(r.program_id));

  // Create new plan.
  const { data: newPlan, error: planErr } = await supabase
    .from(DB_TABLES.plans)
    .insert({ student_id: studentId, name: trimmedName })
    .select("id")
    .single();
  if (planErr || !newPlan) throw new Error(`Failed to create duplicate plan: ${planErr?.message ?? "no data"}`);
  const newPlanId = Number(newPlan.id);

  // Link programs.
  if (programIds.length > 0) {
    const rows = programIds.map((pid: number) => ({ plan_id: newPlanId, program_id: pid }));
    const { error: linkErr } = await supabase.from(DB_TABLES.planPrograms).insert(rows);
    if (linkErr) throw new Error(`Failed to link programs: ${linkErr.message}`);
  }

  // Copy planned courses (preserving term_id; terms are shared across plans).
  const { data: sourceRows, error: srcErr } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .select("course_id, term_id, status")
    .eq("student_id", studentId)
    .eq("plan_id", sourcePlanId);
  if (srcErr) throw new Error(`Failed to read source courses: ${srcErr.message}`);

  const sourceItems = sourceRows ?? [];
  if (sourceItems.length > 0) {
    const copyRows = sourceItems.map((r: { course_id: number; term_id: number; status: string }) => ({
      student_id: studentId,
      plan_id: newPlanId,
      course_id: r.course_id,
      term_id: r.term_id,
      status: r.status,
    }));
    const { error: insertErr } = await supabase.from(DB_TABLES.studentPlannedCourses).insert(copyRows);
    if (insertErr) throw new Error(`Failed to clone courses: ${insertErr.message}`);

    // Ensure student_term_plan links exist for the new plan.
    const termIds = Array.from(new Set(sourceItems.map((r: { term_id: number }) => Number(r.term_id))));
    for (const termId of termIds) {
      const { data: tpExisting, error: tpChkErr } = await supabase
        .from(DB_TABLES.studentTermPlan)
        .select("term_id")
        .eq("student_id", studentId)
        .eq("plan_id", newPlanId)
        .eq("term_id", termId)
        .maybeSingle();
      if (tpChkErr) throw new Error(`Failed to check term plan: ${tpChkErr.message}`);
      if (!tpExisting) {
        const { error: tpInsErr } = await supabase
          .from(DB_TABLES.studentTermPlan)
          .insert({ student_id: studentId, plan_id: newPlanId, term_id: termId });
        if (tpInsErr) throw new Error(`Failed to link term: ${tpInsErr.message}`);
      }
    }
  }

  return { planId: newPlanId, coursesCloned: sourceItems.length };
}

export async function serverDeletePlan(
  supabase: SupabaseTableClient,
  studentId: number,
  planId: number
): Promise<{ deleted: boolean }> {
  const owned = await serverVerifyPlanOwnership(supabase, planId, studentId);
  if (!owned) throw new Error("Plan does not belong to this student.");

  // Delete in dependency order.
  await supabase.from(DB_TABLES.studentPlannedCourses).delete().eq("student_id", studentId).eq("plan_id", planId);
  await supabase.from(DB_TABLES.studentTermPlan).delete().eq("student_id", studentId).eq("plan_id", planId);
  await supabase.from(DB_TABLES.planPrograms).delete().eq("plan_id", planId);

  const { error } = await supabase.from(DB_TABLES.plans).delete().eq("id", planId).eq("student_id", studentId);
  if (error) throw new Error(`Failed to delete plan: ${error.message}`);

  return { deleted: true };
}

export async function serverRemoveStudentProgram(
  supabase: SupabaseTableClient,
  studentId: number,
  programId: number
): Promise<{ removed: boolean; programId: number; plansUnlinked: number }> {
  // Verify the student is actually enrolled in this program.
  const { data: existing, error: checkErr } = await supabase
    .from(DB_TABLES.studentPrograms)
    .select("student_id")
    .eq("student_id", studentId)
    .eq("program_id", programId)
    .maybeSingle();

  if (checkErr) throw new Error(`Failed to verify program enrollment: ${checkErr.message}`);
  if (!existing) throw new Error("You are not enrolled in that program, or it does not exist.");

  // Find all plans belonging to this student that are linked to this program.
  const { data: studentPlans, error: plansErr } = await supabase
    .from(DB_TABLES.plans)
    .select("id")
    .eq("student_id", studentId);

  if (plansErr) throw new Error(`Failed to query student plans: ${plansErr.message}`);

  const planIds = (studentPlans ?? []).map((p: { id: number }) => Number(p.id));
  let plansUnlinked = 0;

  if (planIds.length > 0) {
    // Remove plan_programs rows linking any of the student's plans to this program.
    const { data: unlinked, error: unlinkErr } = await supabase
      .from(DB_TABLES.planPrograms)
      .delete()
      .in("plan_id", planIds)
      .eq("program_id", programId)
      .select("plan_id");

    if (unlinkErr) throw new Error(`Failed to unlink plans from program: ${unlinkErr.message}`);
    plansUnlinked = (unlinked ?? []).length;
  }

  // Remove the enrollment record.
  const { error } = await supabase
    .from(DB_TABLES.studentPrograms)
    .delete()
    .eq("student_id", studentId)
    .eq("program_id", programId);

  if (error) throw new Error(`Failed to remove program: ${error.message}`);

  return { removed: true, programId, plansUnlinked };
}

export async function serverListStudentPlans(
  supabase: SupabaseTableClient,
  studentId: number
): Promise<AdvisorPlanSummary[]> {
  const { data, error } = await supabase
    .from(DB_TABLES.plans)
    .select("id, name, updated_at")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to list plans: ${error.message}`);

  return (data ?? []).map((row: { id: number | string; name: string; updated_at: string }) => ({
    id: Number(row.id),
    name: row.name,
    updatedAt: row.updated_at,
  }));
}

export async function serverGetStudentProgramCount(
  supabase: SupabaseTableClient,
  studentId: number
): Promise<number> {
  const { count, error } = await supabase
    .from(DB_TABLES.studentPrograms)
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId);

  if (error) throw new Error(`Failed to count student programs: ${error.message}`);
  return count ?? 0;
}

export async function serverGetEnrolledProgramById(
  supabase: SupabaseTableClient,
  studentId: number,
  programId: number
): Promise<{ id: number; name: string; programType: string } | null> {
  const { data, error } = await supabase
    .from(DB_TABLES.studentPrograms)
    .select("program_id, programs(id, name, program_type)")
    .eq("student_id", studentId)
    .eq("program_id", programId)
    .maybeSingle();

  if (error) throw new Error(`Failed to look up enrolled program: ${error.message}`);
  if (!data) return null;

  const prog = data.programs as { id: number; name: string; program_type: string } | null;
  if (!prog) return null;

  return {
    id: Number(prog.id),
    name: String(prog.name ?? ""),
    programType: String(prog.program_type ?? ""),
  };
}

export async function serverAddStudentProgram(
  supabase: SupabaseTableClient,
  studentId: number,
  programId: number
): Promise<{ added: boolean; alreadyEnrolled: boolean; programId: number }> {
  // Validate the program exists.
  const { data: prog, error: progErr } = await supabase
    .from(DB_TABLES.programs)
    .select("id")
    .eq("id", programId)
    .maybeSingle();

  if (progErr) throw new Error(`Failed to look up program: ${progErr.message}`);
  if (!prog) throw new Error(`Program ID ${programId} does not exist in the catalog.`);

  // Insert enrollment.
  const { error } = await supabase
    .from(DB_TABLES.studentPrograms)
    .insert({ student_id: studentId, program_id: programId });

  if (error) {
    if (error.code === "23505") return { added: false, alreadyEnrolled: true, programId };
    throw new Error(`Failed to add program: ${error.message}`);
  }

  return { added: true, alreadyEnrolled: false, programId };
}

export async function serverRemoveCourseFromHistory(
  supabase: SupabaseTableClient,
  studentId: number,
  courseId: number
): Promise<{ removed: boolean }> {
  const { error } = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .delete()
    .eq("student_id", studentId)
    .eq("course_id", courseId);

  if (error) throw new Error(`Failed to remove course from history: ${error.message}`);
  return { removed: true };
}

export async function serverUpdateCourseHistory(
  supabase: SupabaseTableClient,
  studentId: number,
  courseId: number,
  updates: { grade?: string | null; completed?: boolean }
): Promise<{ updated: boolean }> {
  const patch: Record<string, unknown> = {};
  if (updates.grade !== undefined) {
    patch.grade = updates.grade ? updates.grade.trim().toUpperCase() : null;
  }
  if (updates.completed !== undefined) {
    patch.completed = updates.completed;
  }
  if (Object.keys(patch).length === 0) return { updated: false };

  const { error } = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .update(patch)
    .eq("student_id", studentId)
    .eq("course_id", courseId);

  if (error) throw new Error(`Failed to update course history: ${error.message}`);
  return { updated: true };
}
