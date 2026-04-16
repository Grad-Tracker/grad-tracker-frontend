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
import {
  DB_TABLES,
  DB_VIEWS,
  PLANNED_COURSE_STATUS,
  type PlanMetaViewRow,
  type PlanTermViewRow,
  type PlanCourseViewRow,
  type ProgramBlockCourseViewRow,
  type GenEdBucketCourseViewRow,
} from "./schema";

function parseNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseProgramIds(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    // Supports Postgres-style arrays: "{1,2,3}"
    const raw = trimmed.startsWith("{") && trimmed.endsWith("}")
      ? trimmed.slice(1, -1)
      : trimmed;
    if (!raw) return [];
    return raw
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((v) => Number.isFinite(v));
  }
  return [];
}

function parseText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSeason(value: unknown): Season | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "fall" || normalized === "fa") return "Fall";
  if (normalized === "spring" || normalized === "sp") return "Spring";
  if (normalized === "summer" || normalized === "su") return "Summer";
  return null;
}

type ViewCourseLike = {
  course_id?: unknown;
  id?: unknown;
  subject?: unknown;
  number?: unknown;
  title?: unknown;
  credits?: unknown;
};

function parseCourseLike(value: unknown): Course | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as ViewCourseLike;
  const id = parseNumber(row.course_id ?? row.id, NaN);
  const subject = parseText(row.subject);
  const number = parseText(row.number);
  const title = parseText(row.title);
  if (!Number.isFinite(id) || !subject || !number || !title) return null;

  return {
    id,
    subject,
    number,
    title,
    credits: parseNumber(row.credits, 0),
  };
}

function parseCourseArray(value: unknown): Course[] {
  if (!Array.isArray(value)) return [];
  const deduped = new Map<number, Course>();
  for (const item of value) {
    const course = parseCourseLike(item);
    if (!course) continue;
    deduped.set(course.id, course);
  }
  return Array.from(deduped.values());
}

// ── Plan CRUD ────────────────────────────────────────────

export async function fetchPlans(studentId: number): Promise<PlanWithMeta[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from(DB_VIEWS.planMeta)
    .select(`
      plan_id,
      student_id,
      name,
      description,
      created_at,
      updated_at,
      program_ids,
      term_count,
      course_count,
      total_credits,
      has_graduate_program
    `)
    .eq("student_id", studentId)
    .order("created_at");

  if (error) throw error;
  if (!data?.length) return [];

  return (data as PlanMetaViewRow[]).map((row) => ({
    id: parseNumber(row.plan_id ?? row.id, 0),
    student_id: parseNumber(row.student_id, studentId),
    name: row.name ?? "Untitled Plan",
    description: row.description ?? null,
    created_at: row.created_at ?? new Date(0).toISOString(),
    updated_at: row.updated_at ?? new Date(0).toISOString(),
    program_ids: parseProgramIds(row.program_ids),
    term_count: parseNumber(row.term_count, 0),
    course_count: parseNumber(row.course_count, 0),
    total_credits: parseNumber(row.total_credits, 0),
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
  void studentId;
  const { data, error } = await supabase
    .from(DB_VIEWS.planTerms)
    .select("term_id, season, year")
    .eq("plan_id", planId);

  if (error) throw error;

  return (data as PlanTermViewRow[] ?? [])
    .map((row) => {
      const termId = row.term_id;
      const season = normalizeSeason(row.season);
      const year = row.year;
      if (termId == null || season == null || year == null) return null;
      return {
        id: parseNumber(termId, 0),
        season,
        year: parseNumber(year, 0),
      } as Term;
    })
    .filter((row): row is Term => row !== null);
}

export async function fetchPlannedCourses(
  studentId: number,
  planId: number
): Promise<PlannedCourseWithDetails[]> {
  const supabase = createClient();
  void studentId;
  const { data, error } = await supabase
    .from(DB_VIEWS.planCourses)
    .select(`
      student_id,
      term_id,
      course_id,
      status,
      plan_id,
      subject,
      number,
      title,
      credits
    `)
    .eq("plan_id", planId);

  if (error) throw error;

  return (data as PlanCourseViewRow[] ?? [])
    .map((row) => {
      const courseId = row.course_id;
      const termId = row.term_id;
      const plan = row.plan_id;
      const student = row.student_id;
      if (courseId == null || termId == null || plan == null || student == null) {
        return null;
      }

      const nested = row.courses ?? null;
      const subject = nested?.subject ?? row.subject ?? row.course_subject ?? null;
      const number = nested?.number ?? row.number ?? row.course_number ?? null;
      const title = nested?.title ?? row.title ?? row.course_title ?? null;
      const credits = nested?.credits ?? row.credits ?? row.course_credits ?? 0;

      if (!subject || !number || !title) return null;

      return {
        student_id: parseNumber(student, 0),
        term_id: parseNumber(termId, 0),
        course_id: parseNumber(courseId, 0),
        status: row.status ?? PLANNED_COURSE_STATUS.planned,
        plan_id: parseNumber(plan, 0),
        course: {
          id: parseNumber(nested?.id ?? courseId, 0),
          subject,
          number,
          title,
          credits: parseNumber(credits, 0),
        },
      } as PlannedCourseWithDetails;
    })
    .filter((row): row is PlannedCourseWithDetails => row !== null);
}

export async function fetchAvailableCourses(
  studentId: number,
  planId: number,
  options: { includeNonPlannable?: boolean } = {}
): Promise<RequirementBlockWithCourses[]> {
  const supabase = createClient();
  void studentId;

  const includeNonPlannable = options.includeNonPlannable ?? false;

  const { data: planPrograms, error: planProgramsError } = await supabase
    .from(DB_TABLES.planPrograms)
    .select("program_id")
    .eq("plan_id", planId);

  if (planProgramsError) throw planProgramsError;
  if (!planPrograms?.length) return [];

  const programIds = (planPrograms ?? [])
    .map((row: { program_id: unknown }) => parseNumber(row.program_id, NaN))
    .filter((id) => Number.isFinite(id));

  if (programIds.length === 0) return [];

  let query = supabase
    .from(DB_VIEWS.programBlockCourses)
    .select(`
      block_id,
      program_id,
      program_name,
      block_name,
      rule,
      n_required,
      credits_required,
      course_ids,
      courses,
      is_plannable,
      planner_exclusion_reason
    `)
    .in("program_id", programIds)
    .order("block_name", { ascending: true });

  if (!includeNonPlannable) {
    query = query.eq("is_plannable", true);
  }

  const { data, error } = await query;

  if (error) throw error;
  if (!data?.length) return [];

  const byBlock = new Map<number, RequirementBlockWithCourses>();

  for (const row of data as ProgramBlockCourseViewRow[]) {
    const blockId = row.block_id;
    if (blockId == null || row.program_id == null || !row.rule) continue;

    const resolvedBlockId = parseNumber(blockId, 0);
    if (!byBlock.has(resolvedBlockId)) {
      const parsedCourses = parseCourseArray(row.courses);
      byBlock.set(resolvedBlockId, {
        id: resolvedBlockId,
        program_id: parseNumber(row.program_id, 0),
        name: row.block_name ?? "Untitled Requirement Block",
        rule: row.rule,
        n_required: row.n_required == null ? null : parseNumber(row.n_required, 0),
        credits_required:
          row.credits_required == null ? null : parseNumber(row.credits_required, 0),
        is_plannable: row.is_plannable ?? true,
        planner_exclusion_reason: row.planner_exclusion_reason ?? null,
        courses: parsedCourses,
      });
      continue;
    }

    const block = byBlock.get(resolvedBlockId)!;
    const parsedCourses = parseCourseArray(row.courses);
    if (parsedCourses.length === 0) continue;

    const existingIds = new Set(block.courses.map((course) => course.id));
    for (const course of parsedCourses) {
      if (existingIds.has(course.id)) continue;
      block.courses.push(course);
      existingIds.add(course.id);
    }
  }

  return Array.from(byBlock.values());
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

  const { data, error } = await supabase
    .from(DB_VIEWS.genEdBucketCourses)
    .select(`
      bucket_id,
      bucket_code,
      bucket_name,
      bucket_credits_required,
      course_ids,
      courses
    `)
    .order("bucket_code", { ascending: true });

  if (error) throw error;
  if (!data?.length) return [];

  return (data as GenEdBucketCourseViewRow[])
    .map((row) => {
      if (row.bucket_id == null) return null;
      const code = row.bucket_code ?? row.code ?? null;
      const name = row.bucket_name ?? row.name ?? null;
      if (!code || !name) return null;

      return {
        id: parseNumber(row.bucket_id, 0),
        code,
        name,
        credits_required: parseNumber(
          row.bucket_credits_required ?? row.credits_required,
          0
        ),
        courses: parseCourseArray(row.courses),
      } as GenEdBucketWithCourses;
    })
    .filter((row): row is GenEdBucketWithCourses => row !== null);
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
