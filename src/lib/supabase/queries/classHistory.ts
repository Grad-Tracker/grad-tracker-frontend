import { createClient } from "@/lib/supabase/client";
import { DB_TABLES, DB_VIEWS } from "./schema";
import type {
  ViewCourseCatalogRow,
  ViewProgramBlockCoursesRow,
  ViewStudentCourseHistoryDetailRow,
  ViewStudentPrimaryMajorProgramRow,
} from "./view-types";
import type { CourseRow } from "@/types/onboarding";
import { viewItemToCourse, safeLogActivity, formatActivityCourseLabel } from "./helpers";

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

/** Get the earliest chronological term to use as default for inserts. */
export async function fetchDefaultTermId(): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_VIEWS.termsChronological)
    .select("term_id")
    .order("chronological_rank", { ascending: true })
    .limit(1)
    .single();

  if (error) throw error;
  return Number(data.term_id);
}

/** Fetch student's primary major and its requirement blocks with courses. */
export async function fetchMajorRequirementCourses(
  studentId: number
): Promise<MajorWithRequirements | null> {
  const supabase = createClient();

  const { data: majorProgram, error: majorError } = await supabase
    .from(DB_VIEWS.studentPrimaryMajorProgram)
    .select("student_id, program_id, program_name")
    .eq("student_id", studentId)
    .maybeSingle();

  if (majorError) throw majorError;
  if (!majorProgram) return null;

  const major = majorProgram as ViewStudentPrimaryMajorProgramRow;

  const { data: blocks, error: blocksError } = await supabase
    .from(DB_VIEWS.programBlockCourses)
    .select("block_id, block_name, courses")
    .eq("program_id", major.program_id)
    .order("block_name");

  if (blocksError) throw blocksError;

  return {
    majorName: major.program_name,
    blocks: ((blocks as ViewProgramBlockCoursesRow[] | null) ?? []).map((block) => ({
      id: Number(block.block_id),
      name: block.block_name,
      courses: (block.courses ?? []).map(viewItemToCourse),
    })),
  };
}

/** Fetch all course history rows for a student, joined with course details. */
export async function fetchStudentCourseHistory(
  studentId: number
): Promise<StudentCourseHistoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_VIEWS.studentCourseHistoryDetail)
    .select("course_id, term_id, completed, subject, number, title, credits")
    .eq("student_id", studentId);

  if (error) throw error;

  return ((data as ViewStudentCourseHistoryDetailRow[] | null) ?? []).map((row) => ({
    course_id: Number(row.course_id),
    term_id: Number(row.term_id),
    completed: Boolean(row.completed),
    course: {
      id: Number(row.course_id),
      subject: row.subject,
      number: row.number,
      title: row.title,
      credits: Number(row.credits ?? 0),
    },
  }));
}

/** Insert a course into student_course_history. Plain INSERT (no upsert).
 *  Silently ignores duplicate inserts (Postgres error 23505). */
export async function insertCourseHistory(
  studentId: number,
  courseId: number,
  termId: number,
  courseLabel?: string
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

  const activityCourseLabel = formatActivityCourseLabel(courseLabel);
  await safeLogActivity(
    studentId,
    "course_added",
    `Added ${activityCourseLabel} to completed history`,
    {
      course_id: courseId,
      term_id: termId,
      source: "class_history",
      course_label: activityCourseLabel,
    }
  );
}

/** Delete a course from student_course_history by all 3 PK columns. */
export async function deleteCourseHistory(
  studentId: number,
  courseId: number,
  termId: number,
  courseLabel?: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .delete()
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .eq("term_id", termId);
  if (error) throw error;

  const activityCourseLabel = formatActivityCourseLabel(courseLabel);
  await safeLogActivity(
    studentId,
    "course_removed",
    `Removed ${activityCourseLabel} from completed history`,
    {
      course_id: courseId,
      term_id: termId,
      source: "class_history",
      course_label: activityCourseLabel,
    }
  );
}

/** Search active course catalog by subject+number or title. Min 2 chars. Max 20 results. */
export async function searchCourses(query: string): Promise<CourseRow[]> {
  if (query.length < 2) return [];
  const supabase = createClient();
  const escaped = query.replaceAll(/[%_]/g, "\\$&");
  const pattern = `%${escaped}%`;

  const { data, error } = await supabase
    .from(DB_VIEWS.courseCatalog)
    .select("course_id, subject, number, title, credits")
    .or(`title.ilike.${pattern},subject.ilike.${pattern},number.ilike.${pattern}`)
    .limit(20);

  if (error) throw error;

  return ((data as ViewCourseCatalogRow[] | null) ?? []).map((course) => ({
    id: Number(course.course_id),
    subject: course.subject,
    number: course.number,
    title: course.title,
    credits: Number(course.credits ?? 0),
  }));
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
