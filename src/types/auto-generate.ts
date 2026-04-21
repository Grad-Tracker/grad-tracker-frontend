import type { Season, BreadthPackage } from "./planner";
import type { Course } from "./course";

export interface AutoGenerateOptions {
  mode: "new" | "fill";
  planId?: number;           // for fill mode
  planName?: string;         // for new mode
  includeSummers: boolean;
  startSeason: Season;
  startYear: number;
  breadthPackage?: BreadthPackage | null;
  targetCredits?: number;
}

export interface ScheduledSemester {
  season: Season;
  year: number;
  courses: Course[];
  totalCredits: number;
}

// ── Schedule result (includes unscheduled courses) ──────

export interface ScheduleResult {
  semesters: ScheduledSemester[];
  unscheduledCourseIds: number[];
}

// ── Validation types ────────────────────────────────────

export type ValidationSeverity = "error" | "warning" | "info";

export const VALIDATION_ISSUE_CODES = {
  availabilityViolation: "AVAILABILITY_VIOLATION",
  blockExcludedNonPlannable: "BLOCK_EXCLUDED_NON_PLANNABLE",
  blockUnsatisfied: "BLOCK_UNSATISFIED",
  courseNotScheduled: "COURSE_NOT_SCHEDULED",
  creditCapExceeded: "CREDIT_CAP_EXCEEDED",
  genEdUnsatisfied: "GENED_UNSATISFIED",
  highCreditAverage: "HIGH_CREDIT_AVERAGE",
  horizonUnachievable: "HORIZON_UNACHIEVABLE",
  lowCreditAverage: "LOW_CREDIT_AVERAGE",
  prereqViolation: "PREREQ_VIOLATION",
} as const;

export type ValidationIssueCode =
  (typeof VALIDATION_ISSUE_CODES)[keyof typeof VALIDATION_ISSUE_CODES]
  | (string & {});

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: ValidationIssueCode;
  message: string;
  courseId?: number;
  semester?: string;
}

export interface BlockSatisfactionStatus {
  blockId: number;
  blockName: string;
  rule: string;
  satisfied: boolean;
  requiredCredits: number | null;
  scheduledCredits: number;
  missingCredits: number;
}

export interface GenEdSatisfactionStatus {
  bucketId: number;
  bucketName: string;
  satisfied: boolean;
  requiredCredits: number;
  coveredCredits: number;
  missingCredits: number;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  blockStatuses: BlockSatisfactionStatus[];
  genEdStatuses: GenEdSatisfactionStatus[];
  unscheduledCourses: Course[];
}

// ── Final result ────────────────────────────────────────

export interface AutoGenerateResult {
  planId: number;
  semesters: ScheduledSemester[];
  totalCourses: number;
  totalCredits: number;
  validation: ValidationResult;
  targetHorizon?: {
    season: Season;
    year: number;
    terms: number;
  };
  tailEliminationSucceeded?: boolean;
}

export interface GenEdBucketWithCourses {
  id: number;
  code: string;
  name: string;
  credits_required: number;
  courses: Course[];
}
