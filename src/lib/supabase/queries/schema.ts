export const DB_TABLES = {
  courses: "courses",
  genEdBuckets: "gen_ed_buckets",
  genEdBucketCourses: "gen_ed_bucket_courses",
  majorCertificateMappings: "major_certificate_mappings",
  plans: "plans",
  planPrograms: "plan_programs",
  programRequirementBlocks: "program_requirement_blocks",
  programRequirementCourses: "program_requirement_courses",
  programs: "programs",
  studentCourseHistory: "student_course_history",
  studentPlannedCourses: "student_planned_courses",
  studentPrograms: "student_programs",
  studentTermPlan: "student_term_plan",
  students: "students",
  terms: "terms",
  notificationPreferences: "notification_preferences",
} as const;

export const STUDENT_COLUMNS = {
  id: "id",
  authUserId: "auth_user_id",
  email: "email",
  firstName: "first_name",
  lastName: "last_name",
  hasCompletedOnboarding: "has_completed_onboarding",
  expectedGraduationSemester: "expected_graduation_semester",
  expectedGraduationYear: "expected_graduation_year",
} as const;

export const PLANNED_COURSE_STATUS = {
  planned: "PLANNED",
} as const;

export const PROGRAM_TYPES = {
  major: "MAJOR",
  certificate: "CERTIFICATE",
  minor: "MINOR",
  graduate: "GRADUATE",
} as const;
