import type { PlannedCourseWithDetails, Term } from "./planner";

export interface ComparablePlanDetail {
  planId: number;
  planName: string;
  description: string | null;
  ownerLabel: string;
  programNames: string[];
  terms: Term[];
  plannedCourses: PlannedCourseWithDetails[];
  totalPlannedCredits: number;
  completedCredits: number;
}

export interface SharedPlanSummary {
  shareToken: string;
  planId: number;
  planName: string;
  description: string | null;
  studentFirstName: string;
  programNames: string[];
  termCount: number;
  totalPlannedCredits: number;
  updatedAt: string | null;
}

export interface OwnPlanSummary {
  planId: number;
  planName: string;
  description: string | null;
  programNames: string[];
  totalPlannedCredits: number;
  termCount: number;
}

export interface SharedPlanDetail extends ComparablePlanDetail {
  shareToken: string;
  studentFirstName: string;
  expiresAt: string | null;
}
