export interface Major {
  id: string;
  name: string;
  code: string;
  description: string;
  totalCredits: number;
}

export interface Certificate {
  id: string;
  name: string;
  code: string;
  description: string;
  totalCredits: number;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  department: string;
}

export interface OnboardingState {
  currentStep: number;
  selectedMajor: string | null;
  selectedCertificates: string[];
  selectedClasses: string[];
}

export interface StepChangeDetails {
  step: number;
}
