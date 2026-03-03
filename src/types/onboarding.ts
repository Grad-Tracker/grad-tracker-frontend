export interface Program {
  id: number;
  name: string;
  catalog_year: string;
  program_type: "MAJOR" | "CERTIFICATE" | "MINOR" | "GRADUATE";
}

export interface RequirementBlock {
  id: number;
  program_id: number;
  name: string;
  rule: "ALL_OF" | "ANY_OF" | "N_OF" | "CREDITS_OF";
  n_required: number | null;
  credits_required: number | null;
  courses: CourseRow[];
}

export interface CourseRow {
  id: number;
  subject: string;
  number: string;
  title: string;
  credits: number;
}

export interface OnboardingState {
  currentStep: number;
  selectedMajor: number | null;
  selectedCertificates: number[];
  selectedClasses: number[];
  expectedGradSemester: string | null;
  expectedGradYear: number | null;
}

export interface StepChangeDetails {
  step: number;
}
