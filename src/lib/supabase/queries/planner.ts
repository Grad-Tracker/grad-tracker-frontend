import { createClient } from "@/lib/supabase/client";
import type { Term, Season, PlannedCourseWithDetails, RequirementBlockWithCourses } from "@/types/planner";
import type { Course } from "@/types/course";
import { DB_TABLES, PLANNED_COURSE_STATUS } from "./schema";

/**
 * Fetch all terms that a student has added to their plan.
 */
export async function fetchStudentTerms(studentId: number): Promise<Term[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.studentTermPlan)
    .select("term_id, terms:term_id (id, season, year)")
    .eq("student_id", studentId);

  if (error) throw error;
  return (data ?? []).map((row: any) => row.terms as Term);
}

/**
 * Fetch all planned courses for a student, joined with course details.
 */
export async function fetchPlannedCourses(studentId: number): Promise<PlannedCourseWithDetails[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .select(`
      student_id,
      term_id,
      course_id,
      status,
      courses:course_id (id, subject, number, title, credits)
    `)
    .eq("student_id", studentId);

  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    student_id: row.student_id,
    term_id: row.term_id,
    course_id: row.course_id,
    status: row.status,
    course: row.courses as Course,
  }));
}

/**
 * Fetch available courses from the student's program requirements.
 */
export async function fetchAvailableCourses(
  studentId: number
): Promise<RequirementBlockWithCourses[]> {
  const supabase = createClient();

  const { data: studentPrograms, error: spError } = await supabase
    .from(DB_TABLES.studentPrograms)
    .select("program_id")
    .eq("student_id", studentId);

  if (spError) throw spError;
  if (!studentPrograms?.length) return [];

  const programIds = studentPrograms.map((sp: any) => sp.program_id);

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

/**
 * Get or create a term record.
 */
export async function getOrCreateTerm(season: Season, year: number): Promise<Term> {
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

/**
 * Add a term to the student's plan.
 */
export async function addTermPlan(studentId: number, termId: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from(DB_TABLES.studentTermPlan)
    .insert({ student_id: studentId, term_id: termId });

  if (error) throw error;
}

/**
 * Remove a term from the student's plan and its planned courses.
 */
export async function removeTermPlan(studentId: number, termId: number): Promise<void> {
  const supabase = createClient();

  const { error: coursesError } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .delete()
    .eq("student_id", studentId)
    .eq("term_id", termId);

  if (coursesError) throw coursesError;

  const { error: termError } = await supabase
    .from(DB_TABLES.studentTermPlan)
    .delete()
    .eq("student_id", studentId)
    .eq("term_id", termId);

  if (termError) throw termError;
}

/**
 * Add a course to a specific term.
 */
export async function addPlannedCourse(
  studentId: number,
  termId: number,
  courseId: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .insert({
      student_id: studentId,
      term_id: termId,
      course_id: courseId,
      status: PLANNED_COURSE_STATUS.planned,
    });

  if (error) throw error;
}

/**
 * Remove a planned course from a term.
 */
export async function removePlannedCourse(
  studentId: number,
  termId: number,
  courseId: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .delete()
    .eq("student_id", studentId)
    .eq("term_id", termId)
    .eq("course_id", courseId);

  if (error) throw error;
}

/**
 * Move a course from one term to another.
 */
export async function movePlannedCourse(
  studentId: number,
  courseId: number,
  fromTermId: number,
  toTermId: number
): Promise<void> {
  const supabase = createClient();

  const { error: deleteError } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .delete()
    .eq("student_id", studentId)
    .eq("term_id", fromTermId)
    .eq("course_id", courseId);

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .insert({
      student_id: studentId,
      term_id: toTermId,
      course_id: courseId,
      status: PLANNED_COURSE_STATUS.planned,
    });

  if (insertError) throw insertError;
}

/**
 * Fetch completed course IDs for a student.
 */
export async function fetchCompletedCourseIds(studentId: number): Promise<Set<number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .select("course_id")
    .eq("student_id", studentId);

  if (error) throw error;
  return new Set((data ?? []).map((r: any) => Number(r.course_id)));
}
