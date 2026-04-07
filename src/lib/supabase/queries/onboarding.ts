import { createClient } from "@/lib/supabase/client";
import type { Program, RequirementBlock, CourseRow } from "@/types/onboarding";
import { DB_TABLES, DB_VIEWS, PROGRAM_TYPES, STUDENT_COLUMNS } from "./schema";
import type {
  ViewCourseCatalogRow,
  ViewProgramBlockCoursesRow,
  ViewProgramCatalogRow,
  ViewStudentMajorProgramRow,
  ViewStudentProfileRow,
} from "./view-types";
import { mapViewBlockToCourseBlock, safeLogActivity } from "./helpers";

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

export async function fetchStudentProfileByAuthUserId(
  authUserId: string
): Promise<ViewStudentProfileRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_VIEWS.studentProfile)
    .select(
      "student_id, auth_user_id, email, first_name, last_name, full_name, has_completed_onboarding, expected_graduation_semester, expected_graduation_year, breadth_package_id"
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) throw error;
  return (data as ViewStudentProfileRow | null) ?? null;
}

export async function fetchStudentMajorProgram(
  studentId: number
): Promise<ViewStudentMajorProgramRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_VIEWS.studentPrimaryMajorProgram)
    .select("student_id, program_id, program_name, catalog_year, program_type")
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw error;
  return (data as ViewStudentMajorProgramRow | null) ?? null;
}

/**
 * Fetch programs by type (MAJOR, CERTIFICATE, MINOR).
 */
export async function fetchPrograms(
  type: Program["program_type"]
): Promise<Program[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_VIEWS.programCatalog)
    .select("program_id, program_name, catalog_year, program_type")
    .eq("program_type", type)
    .order("program_name");

  if (error) throw error;
  return ((data as ViewProgramCatalogRow[] | null) ?? []).map((row) => ({
    id: Number(row.program_id),
    name: row.program_name,
    catalog_year: row.catalog_year ?? "",
    program_type: row.program_type ?? type,
  }));
}

/**
 * Fetch requirement blocks with their courses for a given program.
 * Returns blocks grouped with nested course arrays.
 */
export async function fetchProgramRequirements(
  programId: number
): Promise<RequirementBlock[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from(DB_VIEWS.programBlockCourses)
    .select(
      "block_id, program_id, block_name, rule, n_required, credits_required, courses"
    )
    .eq("program_id", programId)
    .order("block_name");

  if (error) throw error;
  if (!data?.length) return [];

  return (data as ViewProgramBlockCoursesRow[]).map(mapViewBlockToCourseBlock);
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
    .from(DB_VIEWS.programCatalog)
    .select("program_id, program_name, catalog_year, program_type")
    .in("program_id", certIds)
    .order("program_name");

  if (error) throw error;
  return ((data as ViewProgramCatalogRow[] | null) ?? []).map((row) => ({
    id: Number(row.program_id),
    name: row.program_name,
    catalog_year: row.catalog_year ?? "",
    program_type: row.program_type ?? PROGRAM_TYPES.certificate,
  }));
}

/**
 * Save all onboarding selections to the database.
 * - Clears existing selections first (so onboarding is re-runnable)
 * - Uses upsert to be idempotent (safe on retries / double-clicks)
 * - Updates onboarding flag LAST
 * - Best-effort rollback cleanup on failure to avoid partial state
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

  const cleanupSelections = async () => {
    const { error: delProgramsErr } = await supabase
      .from(DB_TABLES.studentPrograms)
      .delete()
      .eq("student_id", studentId);

    if (delProgramsErr) throw delProgramsErr;

    const { error: delCoursesErr } = await supabase
      .from(DB_TABLES.studentCourseHistory)
      .delete()
      .eq("student_id", studentId);

    if (delCoursesErr) throw delCoursesErr;
  };

  const programRows = [majorId, ...certificateIds].map((programId) => ({
    student_id: studentId,
    program_id: programId,
  }));

  const courseRows =
    courseIds.length > 0
      ? courseIds.map((courseId) => ({
          student_id: studentId,
          course_id: courseId,
          completed: true,
        }))
      : [];

  const updatePayload: Record<string, unknown> = {
    has_completed_onboarding: true,
  };
  if (expectedGradSemester !== undefined) {
    updatePayload.expected_graduation_semester = expectedGradSemester;
  }
  if (expectedGradYear !== undefined) {
    updatePayload.expected_graduation_year = expectedGradYear;
  }

  try {
    // 1) delete existing selections
    await cleanupSelections();

    // 2) upsert new selections
    const { error: programsError } = await supabase
      .from(DB_TABLES.studentPrograms)
      .upsert(programRows, {
        onConflict: "student_id,program_id",
        ignoreDuplicates: false,
      });

    if (programsError) throw programsError;

    if (courseRows.length > 0) {
      const { error: coursesError } = await supabase
        .from(DB_TABLES.studentCourseHistory)
        .upsert(courseRows, {
          onConflict: "student_id,course_id",
          ignoreDuplicates: false,
        });

      if (coursesError) throw coursesError;
    }

    // 3) update student flags LAST
    const { error: updateError } = await supabase
      .from(DB_TABLES.students)
      .update(updatePayload)
      .eq(STUDENT_COLUMNS.id, studentId);

    if (updateError) throw updateError;

    await safeLogActivity(studentId, "onboarding_completed", "Completed onboarding setup", {
      major_id: majorId,
      certificate_ids: certificateIds,
      course_ids: courseIds,
      expected_graduation_semester: expectedGradSemester ?? null,
      expected_graduation_year: expectedGradYear ?? null,
    });
  } catch (err) {
    // Best-effort rollback: remove partial rows so we don't leave inconsistent state
    try {
      await cleanupSelections();
    } catch (cleanupErr) {
      console.error("Onboarding rollback cleanup failed:", cleanupErr);
    }
    throw err;
  }
}

/**
 * Check if the authenticated user has completed onboarding.
 */
export async function checkOnboardingStatus(
  authUserId: string
): Promise<boolean> {
  const profile = await fetchStudentProfileByAuthUserId(authUserId);
  return profile?.has_completed_onboarding ?? false;
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
    .from(DB_VIEWS.courseCatalog)
    .select("course_id, subject, number, title, credits")
    .in("course_id", courseIds)
    .order("subject")
    .order("number");

  if (error) throw error;
  return ((data as ViewCourseCatalogRow[] | null) ?? []).map((row) => ({
    id: Number(row.course_id),
    subject: row.subject,
    number: row.number,
    title: row.title,
    credits: Number(row.credits ?? 0),
  }));
}
