import { createClient } from "@/lib/supabase/client";
import type { Program, RequirementBlock, CourseRow } from "@/types/onboarding";
import { DB_TABLES, PROGRAM_TYPES, STUDENT_COLUMNS } from "./schema";

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  const firstName = parts.shift() ?? "";
  const lastName = parts.join(" ");
  return { firstName, lastName };
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== "object") return false;
  const message = String((error as { message?: unknown }).message ?? "");
  return message.includes(columnName) && message.includes("column");
}

/**
 * Fetch programs by type (MAJOR, CERTIFICATE, MINOR).
 */
export async function fetchPrograms(
  type: Program["program_type"]
): Promise<Program[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.programs)
    .select("id, name, catalog_year, program_type")
    .eq("program_type", type)
    .order("name");

  if (error) throw error;
  return data as Program[];
}

/**
 * Fetch requirement blocks with their courses for a given program.
 * Returns blocks grouped with nested course arrays.
 */
export async function fetchProgramRequirements(
  programId: number
): Promise<RequirementBlock[]> {
  const supabase = createClient();

  // Fetch blocks for the program
  const { data: blocks, error: blocksError } = await supabase
    .from(DB_TABLES.programRequirementBlocks)
    .select("id, program_id, name, rule, n_required, credits_required")
    .eq("program_id", programId)
    .order("name");

  if (blocksError) throw blocksError;
  if (!blocks || blocks.length === 0) return [];

  const blockIds = blocks.map((b) => b.id);

  // Fetch course mappings for all blocks
  const { data: mappings, error: mappingsError } = await supabase
    .from(DB_TABLES.programRequirementCourses)
    .select("block_id, course_id")
    .in("block_id", blockIds);

  if (mappingsError) throw mappingsError;

  const courseIds = [...new Set((mappings ?? []).map((m) => m.course_id))];

  if (courseIds.length === 0) {
    return blocks.map((b) => ({ ...b, courses: [] } as RequirementBlock));
  }

  // Fetch course details
  const { data: courses, error: coursesError } = await supabase
    .from(DB_TABLES.courses)
    .select("id, subject, number, title, credits")
    .in("id", courseIds)
    .order("subject")
    .order("number");

  if (coursesError) throw coursesError;

  const courseMap = new Map<number, CourseRow>();
  for (const c of courses ?? []) {
    courseMap.set(c.id, c as CourseRow);
  }

  // Assemble blocks with their courses
  return blocks.map((block) => {
    const blockCourseIds = (mappings ?? [])
      .filter((m) => m.block_id === block.id)
      .map((m) => m.course_id);

    const blockCourses = blockCourseIds
      .map((id) => courseMap.get(id))
      .filter((c): c is CourseRow => c !== undefined);

    return { ...block, courses: blockCourses } as RequirementBlock;
  });
}

/**
 * Find or create a student record linked to the authenticated user.
 */
export async function getOrCreateStudent(
  authUserId: string,
  email: string,
  fullName: string
): Promise<{ id: number }> {
  const supabase = createClient();

  // Try to find existing student
  const { data: existing, error: selectError } = await supabase
    .from(DB_TABLES.students)
    .select("id")
    .eq(STUDENT_COLUMNS.authUserId, authUserId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return { id: existing.id };

  const { firstName, lastName } = splitFullName(fullName);

  // Create new student (new schema: first_name / last_name)
  const { data: created, error: insertError } = await supabase
    .from(DB_TABLES.students)
    .insert({
      [STUDENT_COLUMNS.authUserId]: authUserId,
      [STUDENT_COLUMNS.email]: email,
      [STUDENT_COLUMNS.firstName]: firstName,
      [STUDENT_COLUMNS.lastName]: lastName,
    })
    .select("id")
    .single();

  if (!insertError) return { id: created.id };

  // Fallback for legacy schema that still uses `name`.
  if (
    isMissingColumnError(insertError, STUDENT_COLUMNS.firstName) ||
    isMissingColumnError(insertError, STUDENT_COLUMNS.lastName)
  ) {
    const { data: legacyCreated, error: legacyInsertError } = await supabase
      .from(DB_TABLES.students)
      .insert({
        [STUDENT_COLUMNS.authUserId]: authUserId,
        [STUDENT_COLUMNS.email]: email,
        name: fullName,
      })
      .select("id")
      .single();

    if (legacyInsertError) throw legacyInsertError;
    return { id: legacyCreated.id };
  }

  throw insertError;
}

/**
 * Fetch certificates associated with a major via the junction table.
 * Falls back to all certificates if no mappings exist yet.
 */
export async function fetchCertificatesForMajor(
  majorId: number
): Promise<Program[]> {
  const supabase = createClient();

  const { data: mappings, error: mappingsError } = await supabase
    .from(DB_TABLES.majorCertificateMappings)
    .select("certificate_id")
    .eq("major_id", majorId);

  if (mappingsError) throw mappingsError;

  // Fallback: if no mappings exist, return all certificates
  if (!mappings || mappings.length === 0) {
    return fetchPrograms(PROGRAM_TYPES.certificate);
  }

  const certIds = mappings.map((m) => m.certificate_id);
  const { data, error } = await supabase
    .from(DB_TABLES.programs)
    .select("id, name, catalog_year, program_type")
    .in("id", certIds)
    .order("name");

  if (error) throw error;
  return data as Program[];
}

/**
 * Save all onboarding selections to the database.
 */
export async function saveOnboardingSelections(
  studentId: number,
  majorId: number,
  certificateIds: number[],
  courseIds: number[],
  expectedGradSemester?: string | null,
  expectedGradYear?: number | null
): Promise<void> {
  const supabase = createClient();

  // Insert selected programs (major + certificates)
  const programRows = [majorId, ...certificateIds].map((programId) => ({
    student_id: studentId,
    program_id: programId,
  }));

  const { error: programsError } = await supabase
    .from(DB_TABLES.studentPrograms)
    .insert(programRows);

  if (programsError) throw programsError;

  // Insert completed courses
  if (courseIds.length > 0) {
    const courseRows = courseIds.map((courseId) => ({
      student_id: studentId,
      course_id: courseId,
      completed: true,
    }));

    const { error: coursesError } = await supabase
      .from(DB_TABLES.studentCourseHistory)
      .insert(courseRows);

    if (coursesError) throw coursesError;
  }

  // Mark onboarding as completed + save graduation info
  const updatePayload: Record<string, unknown> = {
    has_completed_onboarding: true,
  };
  if (expectedGradSemester !== undefined) {
    updatePayload.expected_graduation_semester = expectedGradSemester;
  }
  if (expectedGradYear !== undefined) {
    updatePayload.expected_graduation_year = expectedGradYear;
  }

  const { error: updateError } = await supabase
    .from(DB_TABLES.students)
    .update(updatePayload)
    .eq(STUDENT_COLUMNS.id, studentId);

  if (updateError) throw updateError;
}

/**
 * Check if the authenticated user has completed onboarding.
 */
export async function checkOnboardingStatus(
  authUserId: string
): Promise<boolean> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from(DB_TABLES.students)
    .select("has_completed_onboarding")
    .eq(STUDENT_COLUMNS.authUserId, authUserId)
    .maybeSingle();

  if (error) throw error;
  // No student record yet means onboarding not completed
  if (!data) return false;
  return data.has_completed_onboarding ?? false;
}

/**
 * Resolve course details for an array of course IDs.
 */
export async function fetchCoursesByIds(
  courseIds: number[]
): Promise<CourseRow[]> {
  if (courseIds.length === 0) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.courses)
    .select("id, subject, number, title, credits")
    .in("id", courseIds)
    .order("subject")
    .order("number");

  if (error) throw error;
  return data as CourseRow[];
}
