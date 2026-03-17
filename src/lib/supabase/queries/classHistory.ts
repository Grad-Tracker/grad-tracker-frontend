import { createClient } from "@/lib/supabase/client";
import { DB_TABLES, PROGRAM_TYPES } from "./schema";
import type { CourseRow } from "@/types/onboarding";

// --- Types ---

export interface StudentCourseHistoryRow {
  course_id: number;
  term_id: number;
  completed: boolean;
  course: CourseRow;
}

export interface MajorWithRequirements {
  majorName: string;
  blocks: {
    id: number;
    name: string;
    courses: CourseRow[];
  }[];
}

// --- Queries ---

/** Get the lowest-ID term to use as default for inserts (term_id is NOT NULL). */
export async function fetchDefaultTermId(): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.terms)
    .select("id")
    .order("id", { ascending: true })
    .limit(1)
    .single();
  if (error) throw error;
  return data.id;
}

/** Fetch student's major and its requirement blocks with courses. Returns null if no major. */
export async function fetchMajorRequirementCourses(
  studentId: number
): Promise<MajorWithRequirements | null> {
  const supabase = createClient();

  // Step 1: Get all program_ids for this student
  const { data: studentPrograms, error: spErr } = await supabase
    .from(DB_TABLES.studentPrograms)
    .select("program_id")
    .eq("student_id", studentId);

  if (spErr) throw spErr;
  if (!studentPrograms?.length) return null;

  const programIds = studentPrograms.map((sp: { program_id: number }) => sp.program_id);

  // Step 2: Find which of those programs is a MAJOR
  const { data: majorProgram, error: progErr } = await supabase
    .from(DB_TABLES.programs)
    .select("id, name")
    .in("id", programIds)
    .eq("program_type", PROGRAM_TYPES.major)
    .maybeSingle();

  if (progErr) throw progErr;
  if (!majorProgram) return null;

  const program = majorProgram as { id: number; name: string };

  // Get requirement blocks for this program
  const { data: blocks, error: blocksErr } = await supabase
    .from(DB_TABLES.programRequirementBlocks)
    .select("id, name")
    .eq("program_id", program.id);

  if (blocksErr) throw blocksErr;
  if (!blocks?.length) return { majorName: program.name, blocks: [] };

  const blockIds = blocks.map((b: { id: number }) => b.id);

  // Get courses for all blocks
  const { data: reqCourses, error: rcErr } = await supabase
    .from(DB_TABLES.programRequirementCourses)
    .select("block_id, course_id, courses:course_id (id, subject, number, title, credits)")
    .in("block_id", blockIds);

  if (rcErr) throw rcErr;

  // Group courses by block
  const blockMap = new Map<number, CourseRow[]>();
  for (const rc of reqCourses ?? []) {
    const course = rc.courses as unknown as CourseRow;
    if (!course) continue;
    const existing = blockMap.get(rc.block_id) ?? [];
    existing.push(course);
    blockMap.set(rc.block_id, existing);
  }

  return {
    majorName: program.name,
    blocks: blocks.map((b: { id: number; name: string }) => ({
      id: b.id,
      name: b.name,
      courses: blockMap.get(b.id) ?? [],
    })),
  };
}

/** Fetch all course history rows for a student, joined with course details. */
export async function fetchStudentCourseHistory(
  studentId: number
): Promise<StudentCourseHistoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .select(
      "course_id, term_id, completed, courses:course_id (id, subject, number, title, credits)"
    )
    .eq("student_id", studentId);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    course_id: row.course_id,
    term_id: row.term_id,
    completed: row.completed,
    course: row.courses as CourseRow,
  }));
}

/** Insert a course into student_course_history. Plain INSERT (no upsert).
 *  Silently ignores duplicate inserts (Postgres error 23505). */
export async function insertCourseHistory(
  studentId: number,
  courseId: number,
  termId: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from(DB_TABLES.studentCourseHistory).insert({
    student_id: studentId,
    course_id: courseId,
    term_id: termId,
    completed: true,
  });
  if (error) {
    // Ignore unique constraint violation (course already in history)
    if (error.code === "23505") return;
    throw error;
  }
}

/** Delete a course from student_course_history by all 3 PK columns. */
export async function deleteCourseHistory(
  studentId: number,
  courseId: number,
  termId: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .delete()
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .eq("term_id", termId);
  if (error) throw error;
}

/** Search courses by subject+number or title. Min 2 chars. Max 20 results. */
export async function searchCourses(query: string): Promise<CourseRow[]> {
  if (query.length < 2) return [];
  const supabase = createClient();
  const pattern = `%${query}%`;

  const { data, error } = await supabase
    .from(DB_TABLES.courses)
    .select("id, subject, number, title, credits")
    .or(`title.ilike.${pattern},subject.ilike.${pattern},number.ilike.${pattern}`)
    .limit(20);

  if (error) throw error;
  return (data ?? []) as CourseRow[];
}

/** Insert a manually-entered course into the courses table. Returns the new row. */
export async function insertManualCourse(
  subject: string,
  number: string,
  title: string,
  credits: number
): Promise<CourseRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.courses)
    .insert({ subject, number, title, credits })
    .select("id, subject, number, title, credits")
    .single();
  if (error) throw error;
  return data as CourseRow;
}
