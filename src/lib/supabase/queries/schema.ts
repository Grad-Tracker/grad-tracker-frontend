export const DB_TABLES = {
  advisors: "advisors",
  courses: "courses",
  genEdBuckets: "gen_ed_buckets",
  genEdBucketCourses: "gen_ed_bucket_courses",
  majorCertificateMappings: "major_certificate_mappings",
  plans: "plans",
  planPrograms: "plan_programs",
  programAdvisors: "program_advisors",
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
  staff: "staff",
} as const;

export const DB_VIEWS = {
  studentProfile: "v_student_profile",
  studentMajorProgram: "v_student_major_program",
  studentPrimaryMajorProgram: "v_student_primary_major_program",
  studentCourseProgress: "v_student_course_progress",
  studentCourseHistoryDetail: "v_student_course_history_detail",
  programBlockCourses: "v_program_block_courses",
  programCatalog: "v_program_catalog",
  programRequirementDetail: "v_program_requirement_detail",
  genEdBucketCourses: "v_gened_bucket_courses",
  courseCatalog: "v_course_catalog",
  planMeta: "v_plan_meta",
  planTerms: "v_plan_terms",
  planCourses: "v_plan_courses",
  termsChronological: "v_terms_chronological",
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
  breadthPackageId: "breadth_package_id",
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
