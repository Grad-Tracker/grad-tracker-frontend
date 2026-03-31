export interface ViewStudentProfileRow {
  student_id: number;
  auth_user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  has_completed_onboarding: boolean | null;
  expected_graduation_semester: string | null;
  expected_graduation_year: number | null;
  breadth_package_id: string | null;
}

export interface ViewStudentMajorProgramRow {
  student_id: number;
  program_id: number;
  program_name: string;
  catalog_year: string;
  program_type: "MAJOR" | "CERTIFICATE" | "MINOR" | "GRADUATE";
}

export interface ViewStudentPrimaryMajorProgramRow {
  student_id: number;
  program_id: number;
  program_name: string;
  catalog_year: string;
  program_type: "MAJOR" | "CERTIFICATE" | "MINOR" | "GRADUATE";
}

export interface ViewStudentCourseProgressRow {
  student_id: number;
  course_id: number;
  plan_id: number | null;
  term_id: number | null;
  completed: boolean;
  grade: string | null;
  progress_status: string;
}

export interface ViewProgramBlockCourseItem {
  course_id: number;
  subject: string | null;
  number: string | null;
  title: string | null;
  credits: number | null;
}

export interface ViewProgramBlockCoursesRow {
  block_id: number;
  program_id: number;
  program_name: string;
  block_name: string;
  rule: "ALL_OF" | "ANY_OF" | "N_OF" | "CREDITS_OF";
  n_required: number | null;
  credits_required: number | null;
  course_ids: number[] | null;
  courses: ViewProgramBlockCourseItem[] | null;
}

export interface ViewGenEdBucketCourseItem {
  course_id: number;
  subject: string | null;
  number: string | null;
  title: string | null;
  credits: number | null;
}

export interface ViewGenEdBucketCoursesRow {
  bucket_id: number;
  bucket_code: string;
  bucket_name: string;
  bucket_credits_required: number;
  course_ids: number[] | null;
  courses: ViewGenEdBucketCourseItem[] | null;
}

export interface ViewPlanMetaRow {
  plan_id: number;
  student_id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  program_ids: number[] | null;
  term_count: number;
  course_count: number;
  total_credits: number | null;
  has_graduate_program: boolean;
}

export interface ViewPlanTermRow {
  student_id: number;
  plan_id: number;
  term_id: number;
  season: "Fall" | "Spring" | "Summer";
  year: number;
}

export interface ViewPlanCourseRow {
  student_id: number;
  plan_id: number;
  term_id: number;
  course_id: number;
  status: string;
  subject: string;
  number: string;
  title: string;
  credits: number;
}

export interface ViewProgramCatalogRow {
  program_id: number;
  program_name: string;
  catalog_year: string | null;
  program_type: "MAJOR" | "CERTIFICATE" | "MINOR" | "GRADUATE" | null;
}

export interface ViewCourseCatalogRow {
  course_id: number;
  subject: string;
  number: string;
  title: string;
  credits: number;
  description: string | null;
  prereq_text: string | null;
  is_active: boolean;
}

export interface ViewProgramRequirementCourseItem {
  course_id: number;
  subject: string | null;
  number: string | null;
  title: string | null;
  credits: number | null;
  description: string | null;
  prereq_text: string | null;
}

export interface ViewProgramRequirementCrossListingItem {
  course_id: number;
  cross_subject: string;
  cross_number: string;
  crosslisted_course_id: number | null;
}

export interface ViewProgramRequirementNodeItem {
  set_id: number;
  node_id: number;
  node_type: string;
  parent_id: number | null;
  sort_order: number;
  atom_type: string | null;
  required_course_id: number | null;
}

export interface ViewProgramRequirementDetailRow {
  program_id: number;
  program_name: string;
  catalog_year: string | null;
  program_type: "MAJOR" | "CERTIFICATE" | "MINOR" | "GRADUATE" | null;
  block_id: number;
  block_name: string;
  rule: "ALL_OF" | "ANY_OF" | "N_OF" | "CREDITS_OF";
  n_required: number | null;
  credits_required: number | null;
  course_ids: number[] | null;
  courses: ViewProgramRequirementCourseItem[] | null;
  cross_listings: ViewProgramRequirementCrossListingItem[] | null;
  req_nodes: ViewProgramRequirementNodeItem[] | null;
}

export interface ViewStudentCourseHistoryDetailRow {
  student_id: number;
  term_id: number;
  course_id: number;
  completed: boolean;
  grade: string | null;
  subject: string;
  number: string;
  title: string;
  credits: number;
  description: string | null;
  prereq_text: string | null;
}

export interface ViewTermChronologicalRow {
  term_id: number;
  season: string;
  year: number;
  season_rank: number;
  chronological_rank: number;
}
