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
import { DB_TABLES, DB_VIEWS, PLANNED_COURSE_STATUS, STUDENT_COLUMNS } from "./schema";
import { logStudentActivity } from "./activity";
import type {
  ViewGenEdBucketCourseItem,
  ViewGenEdBucketCoursesRow,
  ViewPlanCourseRow,
  ViewPlanMetaRow,

  ViewProgramBlockCourseItem,
  ViewProgramBlockCoursesRow,
  ViewStudentCourseProgressRow,
} from "./view-types";

function toCourseFromBlockItem(item: ViewProgramBlockCourseItem): Course {
  return {
    id: Number(item.course_id),
    subject: String(item.subject ?? ""),
    number: String(item.number ?? ""),
    title: String(item.title ?? ""),
    credits: Number(item.credits ?? 0),
  };
}

function toCourseFromGenEdItem(item: ViewGenEdBucketCourseItem): Course {
  return {
    id: Number(item.course_id),
    subject: String(item.subject ?? ""),
    number: String(item.number ?? ""),
    title: String(item.title ?? ""),
    credits: Number(item.credits ?? 0),
  };
}

async function safeLogActivity(
  studentId: number,
  activityType: Parameters<typeof logStudentActivity>[1],
  message: string,
  metadata: Record<string, unknown>
) {
  try {
    await logStudentActivity(studentId, activityType, message, metadata);
  } catch (error) {
    console.error("Failed to log student activity:", error);
  }
}

function formatActivityCourseLabel(courseLabel?: string): string {
  const normalized = courseLabel?.trim();
  return normalized && normalized.length > 0 ? normalized : "a course";
}

// ── Plan CRUD ────────────────────────────────────────────

export async function fetchPlans(studentId: number): Promise<PlanWithMeta[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from(DB_VIEWS.planMeta)
    .select(
      "plan_id, student_id, name, description, created_at, updated_at, program_ids, term_count, course_count, total_credits, has_graduate_program"
    )
    .eq("student_id", studentId)
    .order("created_at");

  if (error) throw error;
  if (!data?.length) return [];

  return (data as ViewPlanMetaRow[]).map((row) => ({
    id: Number((row as any).plan_id ?? (row as any).id),
    student_id: Number(row.student_id),
    name: row.name,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
    program_ids: (row.program_ids ?? []).map(Number),
    term_count: Number(row.term_count ?? 0),
    course_count: Number(row.course_count ?? 0),
    total_credits: Number(row.total_credits ?? 0),
    has_graduate_program: Boolean(row.has_graduate_program),
  }));
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

  await safeLogActivity(studentId, "plan_created", `Created plan ${name}`, {
    plan_id: Number(plan.id),
    program_ids: programIds,
  });

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
  planId: number,
  signal?: AbortSignal
): Promise<Term[]> {
  const supabase = createClient();
  let query = supabase
    .from(DB_VIEWS.planTerms)
    .select("term_id, season, year")
    .eq("student_id", studentId)
    .eq("plan_id", planId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;

  if (error) throw error;
  return (data as any[] | null | undefined ?? []).map((row) => {
    if (row?.terms) return row.terms as Term;
    return {
      id: Number(row.term_id),
      season: row.season,
      year: Number(row.year),
    } as Term;
  });
}

export async function fetchPlannedCourses(
  studentId: number,
  planId: number,
  signal?: AbortSignal
): Promise<PlannedCourseWithDetails[]> {
  const supabase = createClient();
  let query = supabase
    .from(DB_VIEWS.planCourses)
    .select("student_id, term_id, course_id, status, plan_id, subject, number, title, credits")
    .eq("student_id", studentId)
    .eq("plan_id", planId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;

  if (error) throw error;
  return (data as any[] | null | undefined ?? []).map((row) => {
    if (row?.courses) {
      return {
        student_id: row.student_id,
        term_id: row.term_id,
        course_id: row.course_id,
        status: row.status,
        plan_id: row.plan_id,
        course: row.courses as Course,
      } as PlannedCourseWithDetails;
    }

    return {
      student_id: Number(row.student_id),
      term_id: Number(row.term_id),
      course_id: Number(row.course_id),
      status: row.status,
      plan_id: Number(row.plan_id),
      course: {
        id: Number(row.course_id),
        subject: row.subject,
        number: row.number,
        title: row.title,
        credits: Number(row.credits ?? 0),
      },
    } as PlannedCourseWithDetails;
  });
}

export async function fetchAvailableCourses(
  studentId: number,
  planId: number,
  signal?: AbortSignal
): Promise<RequirementBlockWithCourses[]> {
  const supabase = createClient();

  let metaBuilder = supabase
    .from(DB_VIEWS.planMeta)
    .select("program_ids")
    .eq("student_id", studentId)
    .eq("plan_id", planId);
  if (signal) metaBuilder = metaBuilder.abortSignal(signal);
  const { data: planMeta, error: ppError } = await metaBuilder.single();

  if (ppError) throw ppError;
  const programIds = (planMeta?.program_ids ?? []).map(Number);
  if (!programIds.length) return [];

  let blocksQuery = supabase
    .from(DB_VIEWS.programBlockCourses)
    .select(
      "block_id, program_id, block_name, rule, n_required, credits_required, courses"
    )
    .in("program_id", programIds)
    .order("block_name");
  if (signal) blocksQuery = blocksQuery.abortSignal(signal);
  const { data: blocks, error: blocksError } = await blocksQuery;

  if (blocksError) throw blocksError;
  if (!blocks?.length) return [];

  return (blocks as ViewProgramBlockCoursesRow[]).map((block) => {
    const blockCourses = (block.courses ?? []).map(toCourseFromBlockItem);
    return {
      id: Number(block.block_id),
      program_id: Number(block.program_id),
      name: block.block_name,
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
  planId: number,
  courseLabel?: string
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

  const activityCourseLabel = formatActivityCourseLabel(courseLabel);
  await safeLogActivity(
    studentId,
    "course_added",
    `Added ${activityCourseLabel} to a semester plan`,
    {
      course_id: courseId,
      term_id: termId,
      plan_id: planId,
      source: "planner",
      course_label: activityCourseLabel,
    }
  );
}

export async function removePlannedCourse(
  studentId: number,
  termId: number,
  courseId: number,
  planId: number,
  courseLabel?: string
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

  const activityCourseLabel = formatActivityCourseLabel(courseLabel);
  await safeLogActivity(
    studentId,
    "course_removed",
    `Removed ${activityCourseLabel} from a semester plan`,
    {
      course_id: courseId,
      term_id: termId,
      plan_id: planId,
      source: "planner",
      course_label: activityCourseLabel,
    }
  );
}

export async function movePlannedCourse(
  studentId: number,
  courseId: number,
  fromTermId: number,
  toTermId: number,
  planId: number,
  courseLabel?: string
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

  const activityCourseLabel = formatActivityCourseLabel(courseLabel);
  await safeLogActivity(
    studentId,
    "plan_updated",
    `Moved ${activityCourseLabel} to a different semester`,
    {
      course_id: courseId,
      from_term_id: fromTermId,
      to_term_id: toTermId,
      plan_id: planId,
      course_label: activityCourseLabel,
    }
  );
}

export async function fetchCompletedCourseIds(
  studentId: number,
  signal?: AbortSignal
): Promise<Set<number>> {
  const supabase = createClient();
  let query = supabase
    .from(DB_VIEWS.studentCourseProgress)
    .select("course_id, completed, progress_status")
    .eq("student_id", studentId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;

  if (error) throw error;
  return new Set(
    ((data as ViewStudentCourseProgressRow[] | null | undefined) ?? [])
      .filter(
        (r) =>
          r.completed == null ||
          r.completed === true ||
          String(r.progress_status ?? "").toUpperCase() === "COMPLETED"
      )
      .map((r) => Number(r.course_id))
  );
}

export async function fetchStudentCourseProgress(
  studentId: number
): Promise<ViewStudentCourseProgressRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_VIEWS.studentCourseProgress)
    .select("student_id, course_id, plan_id, term_id, completed, grade, progress_status")
    .eq("student_id", studentId);

  if (error) throw error;
  return (data as ViewStudentCourseProgressRow[] | null | undefined) ?? [];
}

export async function fetchBreadthPackageId(
  studentId: number
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_VIEWS.studentProfile)
    .select("breadth_package_id")
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw error;
  return data?.breadth_package_id ?? null;
}

export async function updateBreadthPackageId(
  studentId: number,
  packageId: string | null
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from(DB_TABLES.students)
    .update({ [STUDENT_COLUMNS.breadthPackageId]: packageId })
    .eq(STUDENT_COLUMNS.id, studentId);

  if (error) throw error;
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

  const { data, error } = await supabase
    .from(DB_VIEWS.genEdBucketCourses)
    .select(
      "bucket_id, bucket_code, bucket_name, bucket_credits_required, courses"
    )
    .order("bucket_id");

  if (error) throw error;
  if (!data?.length) return [];

  return (data as ViewGenEdBucketCoursesRow[]).map((bucket) => {
    return {
      id: Number(bucket.bucket_id),
      code: bucket.bucket_code,
      name: bucket.bucket_name,
      credits_required: Number(bucket.bucket_credits_required ?? 0),
      courses: (bucket.courses ?? []).map(toCourseFromGenEdItem),
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
