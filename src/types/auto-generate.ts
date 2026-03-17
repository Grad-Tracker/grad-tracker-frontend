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

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
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
}

export interface GenEdBucketWithCourses {
  id: number;
  code: string;
  name: string;
  credits_required: number;
  courses: Course[];
}
