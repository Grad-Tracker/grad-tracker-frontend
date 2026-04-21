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
  studentActivityLog: "student_activity_log",
  studentPlannedCourses: "student_planned_courses",
  studentPrograms: "student_programs",
  studentTermPlan: "student_term_plan",
  students: "students",
  terms: "terms",
  notificationPreferences: "notification_preferences",
  staff: "staff",
  aiConversations: "ai_conversations",
  aiMessages: "ai_messages",
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

export interface PlanMetaViewRow {
  plan_id: number | string;
  id?: number | string;
  student_id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  program_ids: number[] | string | null;
  term_count: number | null;
  course_count: number | null;
  total_credits: number | null;
  has_graduate_program: boolean | null;
}

export interface PlanTermViewRow {
  student_id?: number | null;
  plan_id?: number | null;
  term_id?: number | null;
  season: string | null;
  year: number | null;
}

export interface PlanCourseViewRow {
  student_id: number | null;
  term_id: number | null;
  course_id: number | null;
  status: string | null;
  plan_id: number | null;
  subject?: string | null;
  number?: string | null;
  title?: string | null;
  credits?: number | null;
  course_subject?: string | null;
  course_number?: string | null;
  course_title?: string | null;
  course_credits?: number | null;
  courses?: {
    id?: number | null;
    subject?: string | null;
    number?: string | null;
    title?: string | null;
    credits?: number | null;
  } | null;
}

export interface ProgramBlockCourseViewRow {
  block_id?: number | null;
  program_id: number | null;
  block_name?: string | null;
  program_name?: string | null;
  rule: string | null;
  n_required: number | null;
  credits_required: number | null;
  course_ids?: unknown;
  courses?: unknown;
  is_plannable?: boolean | null;
  planner_exclusion_reason?: string | null;
}

export interface GenEdBucketCourseViewRow {
  bucket_id?: number | null;
  bucket_code?: string | null;
  bucket_name?: string | null;
  bucket_credits_required?: number | null;
  code?: string | null;
  name?: string | null;
  credits_required?: number | null;
  course_ids?: unknown;
  courses?: unknown;
}

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
