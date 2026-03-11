import { createClient } from "@/lib/supabase/client";
import type {
  Term,
  Season,
  Plan,
  PlanWithMeta,
  PlannedCourseWithDetails,
  RequirementBlockWithCourses,
} from "@/types/planner";
import type { Course } from "@/types/course";
import type { GenEdBucketWithCourses, ScheduledSemester } from "@/types/auto-generate";
import { DB_TABLES, PLANNED_COURSE_STATUS } from "./schema";

// ── Plan CRUD ────────────────────────────────────────────

export async function fetchPlans(studentId: number): Promise<PlanWithMeta[]> {
  const supabase = createClient();

  const { data: plans, error } = await supabase
    .from(DB_TABLES.plans)
    .select("id, student_id, name, description, created_at, updated_at")
    .eq("student_id", studentId)
    .order("created_at");

  if (error) throw error;
  if (!plans?.length) return [];

  const planIds = plans.map((p: any) => p.id);

  const [programsRes, termsRes, coursesRes] = await Promise.all([
    supabase
      .from(DB_TABLES.planPrograms)
      .select("plan_id, program_id, programs:program_id (program_type)")
      .in("plan_id", planIds),
    supabase
      .from(DB_TABLES.studentTermPlan)
      .select("plan_id")
      .eq("student_id", studentId)
      .in("plan_id", planIds),
    supabase
      .from(DB_TABLES.studentPlannedCourses)
      .select("plan_id, courses:course_id (credits)")
      .eq("student_id", studentId)
      .in("plan_id", planIds),
  ]);

  if (programsRes.error) throw programsRes.error;
  if (termsRes.error) throw termsRes.error;
  if (coursesRes.error) throw coursesRes.error;

  return plans.map((plan: any) => {
    const planPrograms = (programsRes.data ?? []).filter(
      (pp: any) => pp.plan_id === plan.id
    );
    const programIds = planPrograms.map((pp: any) => pp.program_id);
    const hasGraduateProgram = planPrograms.some(
      (pp: any) => pp.programs?.program_type === "GRADUATE"
    );

    const termCount = (termsRes.data ?? []).filter(
      (t: any) => t.plan_id === plan.id
    ).length;

    const planCourses = (coursesRes.data ?? []).filter(
      (c: any) => c.plan_id === plan.id
    );
    const courseCount = planCourses.length;
    const totalCredits = planCourses.reduce(
      (sum: number, c: any) => sum + (Number(c.courses?.credits) || 0),
      0
    );

    return {
      ...plan,
      program_ids: programIds,
      term_count: termCount,
      course_count: courseCount,
      total_credits: totalCredits,
      has_graduate_program: hasGraduateProgram,
    } as PlanWithMeta;
  });
}

export async function createPlan(
  studentId: number,
  name: string,
  description: string | null,
  programIds: number[]
): Promise<Plan> {
  const supabase = createClient();

  const { data: plan, error } = await supabase
    .from(DB_TABLES.plans)
    .insert({ student_id: studentId, name, description })
    .select("id, student_id, name, description, created_at, updated_at")
    .single();

  if (error) throw error;

  if (programIds.length > 0) {
    const rows = programIds.map((pid) => ({
      plan_id: plan.id,
      program_id: pid,
    }));
    const { error: ppError } = await supabase
      .from(DB_TABLES.planPrograms)
      .insert(rows);
    if (ppError) throw ppError;
  }

  return plan as Plan;
}

export async function updatePlan(
  planId: number,
  updates: { name?: string; description?: string | null }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from(DB_TABLES.plans)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", planId);

  if (error) throw error;
}

export async function deletePlan(planId: number): Promise<void> {
  const supabase = createClient();

  // Cascade will handle plan_programs, but we need to clean student_term_plan
  // and student_planned_courses manually since they reference plan_id
  const { error: pcError } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .delete()
    .eq("plan_id", planId);
  if (pcError) throw pcError;

  const { error: tpError } = await supabase
    .from(DB_TABLES.studentTermPlan)
    .delete()
    .eq("plan_id", planId);
  if (tpError) throw tpError;

  const { error } = await supabase
    .from(DB_TABLES.plans)
    .delete()
    .eq("id", planId);
  if (error) throw error;
}

export async function fetchPlanPrograms(
  planId: number
): Promise<number[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.planPrograms)
    .select("program_id")
    .eq("plan_id", planId);

  if (error) throw error;
  return (data ?? []).map((r: any) => r.program_id);
}

export async function setPlanPrograms(
  planId: number,
  programIds: number[]
): Promise<void> {
  const supabase = createClient();

  const { error: delError } = await supabase
    .from(DB_TABLES.planPrograms)
    .delete()
    .eq("plan_id", planId);
  if (delError) throw delError;

  if (programIds.length > 0) {
    const rows = programIds.map((pid) => ({
      plan_id: planId,
      program_id: pid,
    }));
    const { error: insError } = await supabase
      .from(DB_TABLES.planPrograms)
      .insert(rows);
    if (insError) throw insError;
  }
}

// ── Term & course queries (plan-scoped) ──────────────────

export async function fetchStudentTerms(
  studentId: number,
  planId: number
): Promise<Term[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.studentTermPlan)
    .select("term_id, terms:term_id (id, season, year)")
    .eq("student_id", studentId)
    .eq("plan_id", planId);

  if (error) throw error;
  return (data ?? []).map((row: any) => row.terms as Term);
}

export async function fetchPlannedCourses(
  studentId: number,
  planId: number
): Promise<PlannedCourseWithDetails[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .select(`
      student_id,
      term_id,
      course_id,
      status,
      plan_id,
      courses:course_id (id, subject, number, title, credits)
    `)
    .eq("student_id", studentId)
    .eq("plan_id", planId);

  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    student_id: row.student_id,
    term_id: row.term_id,
    course_id: row.course_id,
    status: row.status,
    plan_id: row.plan_id,
    course: row.courses as Course,
  }));
}

export async function fetchAvailableCourses(
  studentId: number,
  planId: number
): Promise<RequirementBlockWithCourses[]> {
  const supabase = createClient();

  const { data: planProgs, error: ppError } = await supabase
    .from(DB_TABLES.planPrograms)
    .select("program_id")
    .eq("plan_id", planId);

  if (ppError) throw ppError;
  if (!planProgs?.length) return [];

  const programIds = planProgs.map((pp: any) => pp.program_id);

  const { data: blocks, error: blocksError } = await supabase
    .from(DB_TABLES.programRequirementBlocks)
    .select("id, program_id, name, rule, n_required, credits_required")
    .in("program_id", programIds)
    .order("name");

  if (blocksError) throw blocksError;
  if (!blocks?.length) return [];

  const blockIds = blocks.map((b: any) => b.id);

  const { data: mappings, error: mappingsError } = await supabase
    .from(DB_TABLES.programRequirementCourses)
    .select("block_id, course_id")
    .in("block_id", blockIds);

  if (mappingsError) throw mappingsError;

  const courseIds = [...new Set((mappings ?? []).map((m: any) => m.course_id))];
  if (courseIds.length === 0) {
    return blocks.map((b: any) => ({ ...b, courses: [] }));
  }

  const { data: courses, error: coursesError } = await supabase
    .from(DB_TABLES.courses)
    .select("id, subject, number, title, credits")
    .in("id", courseIds)
    .order("subject")
    .order("number");

  if (coursesError) throw coursesError;

  const courseMap = new Map<number, Course>();
  for (const c of courses ?? []) {
    courseMap.set(c.id, c as Course);
  }

  return blocks.map((block: any) => {
    const blockCourseIds = (mappings ?? [])
      .filter((m: any) => m.block_id === block.id)
      .map((m: any) => m.course_id);

    const blockCourses = blockCourseIds
      .map((id: number) => courseMap.get(id))
      .filter((c: Course | undefined): c is Course => c !== undefined);

    return {
      id: block.id,
      program_id: block.program_id,
      name: block.name,
      rule: block.rule,
      n_required: block.n_required,
      credits_required: block.credits_required,
      courses: blockCourses,
    } as RequirementBlockWithCourses;
  });
}

export async function getOrCreateTerm(
  season: Season,
  year: number
): Promise<Term> {
  const supabase = createClient();

  const { data: existing, error: selectError } = await supabase
    .from(DB_TABLES.terms)
    .select("id, season, year")
    .eq("season", season)
    .eq("year", year)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing as Term;

  const { data: created, error: insertError } = await supabase
    .from(DB_TABLES.terms)
    .insert({ season, year })
    .select("id, season, year")
    .single();

  if (insertError) throw insertError;
  return created as Term;
}

export async function addTermPlan(
  studentId: number,
  termId: number,
  planId: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from(DB_TABLES.studentTermPlan)
    .insert({ student_id: studentId, term_id: termId, plan_id: planId });

  if (error) throw error;
}

export async function removeTermPlan(
  studentId: number,
  termId: number,
  planId: number
): Promise<void> {
  const supabase = createClient();

  const { error: coursesError } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .delete()
    .eq("student_id", studentId)
    .eq("term_id", termId)
    .eq("plan_id", planId);

  if (coursesError) throw coursesError;

  const { error: termError } = await supabase
    .from(DB_TABLES.studentTermPlan)
    .delete()
    .eq("student_id", studentId)
    .eq("term_id", termId)
    .eq("plan_id", planId);

  if (termError) throw termError;
}

export async function addPlannedCourse(
  studentId: number,
  termId: number,
  courseId: number,
  planId: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .insert({
      student_id: studentId,
      term_id: termId,
      course_id: courseId,
      plan_id: planId,
      status: PLANNED_COURSE_STATUS.planned,
    });

  if (error) throw error;
}

export async function removePlannedCourse(
  studentId: number,
  termId: number,
  courseId: number,
  planId: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .delete()
    .eq("student_id", studentId)
    .eq("term_id", termId)
    .eq("course_id", courseId)
    .eq("plan_id", planId);

  if (error) throw error;
}

export async function movePlannedCourse(
  studentId: number,
  courseId: number,
  fromTermId: number,
  toTermId: number,
  planId: number
): Promise<void> {
  const supabase = createClient();

  const { error: deleteError } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .delete()
    .eq("student_id", studentId)
    .eq("term_id", fromTermId)
    .eq("course_id", courseId)
    .eq("plan_id", planId);

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .insert({
      student_id: studentId,
      term_id: toTermId,
      course_id: courseId,
      plan_id: planId,
      status: PLANNED_COURSE_STATUS.planned,
    });

  if (insertError) throw insertError;
}

export async function fetchCompletedCourseIds(
  studentId: number
): Promise<Set<number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .select("course_id")
    .eq("student_id", studentId);

  if (error) throw error;
  return new Set((data ?? []).map((r: any) => Number(r.course_id)));
}

// ── Auto-generate helpers ────────────────────────────────

export interface CourseOffering {
  course_id: number;
  term_code: string;
}

export async function fetchCourseOfferings(
  courseIds: number[]
): Promise<CourseOffering[]> {
  if (courseIds.length === 0) return [];
  const supabase = createClient();

  const { data, error } = await supabase
    .from("course_offerings")
    .select("course_id, term_code")
    .in("course_id", courseIds);

  if (error) throw error;
  return (data ?? []) as CourseOffering[];
}

/**
 * Fetch cross-listing equivalences for a set of course IDs.
 * Returns a map: courseId → Set of equivalent course IDs.
 */
export async function fetchCrossListings(
  courseIds: number[]
): Promise<Map<number, Set<number>>> {
  const result = new Map<number, Set<number>>();
  if (courseIds.length === 0) return result;

  const supabase = createClient();
  const courseIdSet = new Set(courseIds);

  // Get cross-listings where the course_id is in our set
  const { data, error } = await supabase
    .from("course_crosslistings")
    .select("course_id, cross_subject, cross_number")
    .in("course_id", courseIds);

  if (error) throw error;
  if (!data?.length) return result;

  // We need to resolve cross_subject + cross_number → course ID
  const crossKeys = data.map((r: any) => `${r.cross_subject}-${r.cross_number}`);
  const uniqueKeys = [...new Set(crossKeys)];

  // Fetch course IDs for the cross-listed courses
  // Build OR conditions for subject+number pairs
  const subjects = [...new Set(data.map((r: any) => r.cross_subject))];
  const { data: crossCourses, error: crossErr } = await supabase
    .from("courses")
    .select("id, subject, number")
    .in("subject", subjects);

  if (crossErr) throw crossErr;

  // Build lookup: "SUBJECT-NUMBER" → courseId
  const keyToId = new Map<string, number>();
  for (const c of crossCourses ?? []) {
    keyToId.set(`${c.subject}-${c.number}`, c.id);
  }

  // Build the equivalence map
  for (const row of data) {
    const crossId = keyToId.get(`${row.cross_subject}-${row.cross_number}`);
    if (crossId === undefined) continue;

    if (!result.has(row.course_id)) result.set(row.course_id, new Set());
    result.get(row.course_id)!.add(crossId);

    if (!result.has(crossId)) result.set(crossId, new Set());
    result.get(crossId)!.add(row.course_id);
  }

  return result;
}

export async function fetchGenEdBucketsWithCourses(): Promise<GenEdBucketWithCourses[]> {
  const supabase = createClient();

  const { data: buckets, error: bucketsErr } = await supabase
    .from(DB_TABLES.genEdBuckets)
    .select("id, code, name, credits_required");

  if (bucketsErr) throw bucketsErr;
  if (!buckets?.length) return [];

  const bucketIds = buckets.map((b: any) => b.id);

  const { data: mappings, error: mappingsErr } = await supabase
    .from(DB_TABLES.genEdBucketCourses)
    .select("bucket_id, course_id")
    .in("bucket_id", bucketIds);

  if (mappingsErr) throw mappingsErr;

  const courseIds = [...new Set((mappings ?? []).map((m: any) => m.course_id))];
  if (courseIds.length === 0) {
    return buckets.map((b: any) => ({ ...b, courses: [] }));
  }

  const { data: courses, error: coursesErr } = await supabase
    .from(DB_TABLES.courses)
    .select("id, subject, number, title, credits")
    .in("id", courseIds);

  if (coursesErr) throw coursesErr;

  const courseMap = new Map<number, Course>();
  for (const c of courses ?? []) {
    courseMap.set(c.id, c as Course);
  }

  return buckets.map((bucket: any) => {
    const bucketCourseIds = (mappings ?? [])
      .filter((m: any) => m.bucket_id === bucket.id)
      .map((m: any) => m.course_id);

    const bucketCourses = bucketCourseIds
      .map((id: number) => courseMap.get(id))
      .filter((c: Course | undefined): c is Course => c !== undefined);

    return {
      id: bucket.id,
      code: bucket.code,
      name: bucket.name,
      credits_required: bucket.credits_required,
      courses: bucketCourses,
    } as GenEdBucketWithCourses;
  });
}

export async function batchSavePlanCourses(
  studentId: number,
  planId: number,
  semesters: ScheduledSemester[]
): Promise<void> {
  const supabase = createClient();

  // 1. Get or create all unique terms
  const termMap = new Map<string, Term>();
  for (const sem of semesters) {
    const key = `${sem.season}-${sem.year}`;
    if (!termMap.has(key)) {
      const term = await getOrCreateTerm(sem.season, sem.year);
      termMap.set(key, term);
    }
  }

  // 2. Fetch existing term_plan rows for this plan to avoid duplicates
  const { data: existingTermPlans } = await supabase
    .from(DB_TABLES.studentTermPlan)
    .select("term_id")
    .eq("student_id", studentId)
    .eq("plan_id", planId);

  const existingTermIds = new Set(
    (existingTermPlans ?? []).map((r: any) => r.term_id)
  );

  // 3. Batch insert student_term_plan rows for new terms
  const newTermPlanRows = [...termMap.values()]
    .filter((t) => !existingTermIds.has(t.id))
    .map((t) => ({
      student_id: studentId,
      term_id: t.id,
      plan_id: planId,
    }));

  if (newTermPlanRows.length > 0) {
    const { error: tpError } = await supabase
      .from(DB_TABLES.studentTermPlan)
      .insert(newTermPlanRows);
    if (tpError) throw tpError;
  }

  // 4. Fetch existing planned courses to avoid duplicates
  const { data: existingPlanned } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .select("course_id")
    .eq("student_id", studentId)
    .eq("plan_id", planId);

  const existingCourseIds = new Set(
    (existingPlanned ?? []).map((r: any) => r.course_id)
  );

  // 5. Batch insert student_planned_courses
  const courseRows: {
    student_id: number;
    term_id: number;
    course_id: number;
    plan_id: number;
    status: string;
  }[] = [];

  for (const sem of semesters) {
    const key = `${sem.season}-${sem.year}`;
    const term = termMap.get(key)!;
    for (const course of sem.courses) {
      if (!existingCourseIds.has(course.id)) {
        courseRows.push({
          student_id: studentId,
          term_id: term.id,
          course_id: course.id,
          plan_id: planId,
          status: PLANNED_COURSE_STATUS.planned,
        });
      }
    }
  }

  if (courseRows.length > 0) {
    const { error: pcError } = await supabase
      .from(DB_TABLES.studentPlannedCourses)
      .insert(courseRows);
    if (pcError) throw pcError;
  }
}
