import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import {
  evaluatePrereqsForCourses,
  fetchPrereqDefinitions,
  type PrereqEvaluationMap,
  type PrereqDefinitionMap,
} from "@/lib/prereq";
import { buildSystemPrompt, PROMPT_VERSION } from "@/lib/ai-advisor/prompt";
import {
  getDegreeProgress,
  getPlanSnapshot,
  getProgramRequirements,
  getRemainingRequirements,
  resolveCourseIdsByCodes,
  searchCourses,
  getCourseHistory,
  getCoursesByIds,
  getCourseDetails,
  getGenEdOptions,
  getDirectDependentCourseIds,
  getAvailablePrograms,
  type AdvisorCourseDetail,
  type AdvisorProgramSummary,
  type AdvisorCourseHistoryEntry,
  type AdvisorCourseSearchResult,
  type AdvisorDegreeProgress,
  type AdvisorGenEdBucket,
  type AdvisorPlanSnapshot,
  type AdvisorRemainingRequirements,
  type AdvisorRequirementBlock,
  type AdvisorStudentProfile,
  type GetCourseHistoryOptions,
  type SupabaseTableClient,
} from "@/lib/ai-advisor/data";
import {
  serverCreatePlan,
  serverAddCourseToPlan,
  serverRemoveCourseFromPlan,
  serverMoveCourseInPlan,
  serverListStudentPlans,
  serverRenamePlan,
  serverClearPlanTerm,
  serverAddCourseToHistory,
  serverDuplicatePlan,
  serverDeletePlan,
  serverRemoveStudentProgram,
  serverGetStudentProgramCount,
  serverGetEnrolledProgramById,
  serverAddStudentProgram,
  serverRemoveCourseFromHistory,
  serverUpdateCourseHistory,
} from "@/lib/ai-advisor/plan-mutations";
import type {
  AdvisorChatHistoryItem,
  AdvisorChatResponse,
  AdvisorConfidence,
  AdvisorPlanSummary,
  AdvisorRecommendation,
  AdvisorSideEffect,
} from "@/types/ai-advisor";

export const TOOL_NAMES = {
  getStudentProfile: "get_student_profile",
  getPlanSnapshot: "get_plan_snapshot",
  getDegreeProgress: "get_degree_progress",
  getRemainingRequirements: "get_remaining_requirements",
  checkCoursePrereqs: "check_course_prereqs",
  recommendNextSemester: "recommend_next_semester",
  createPlan: "create_plan",
  addCourseToPlan: "add_course_to_plan",
  removeCourseFromPlan: "remove_course_from_plan",
  moveCourseInPlan: "move_course_in_plan",
  searchCourses: "search_courses",
  checkGraduationReadiness: "check_graduation_readiness",
  getCoursePrerequisites: "get_course_prerequisites",
  getCourseHistory: "get_course_history",
  listPlans: "list_plans",
  validatePlan: "validate_plan",
  getProgramRequirements: "get_program_requirements",
  findCoursesSatisfyingBlock: "find_courses_satisfying_block",
  getFullPrereqChain: "get_full_prereq_chain",
  projectGraduationDate: "project_graduation_date",
  checkTermCreditLoad: "check_term_credit_load",
  identifyPlanGaps: "identify_plan_gaps",
  getCourseDetails: "get_course_details",
  renamePlan: "rename_plan",
  clearPlanTerm: "clear_plan_term",
  addCourseToHistory: "add_course_to_history",
  getPlanWarnings: "get_plan_warnings",
  findPrereqBottlenecks: "find_prereq_bottlenecks",
  checkRegistrationEligibility: "check_registration_eligibility",
  estimateCreditsPerTermNeeded: "estimate_credits_per_term_needed",
  getGenEdOptions: "get_gen_ed_options",
  findCoursesUnlockedBy: "find_courses_unlocked_by",
  duplicatePlan: "duplicate_plan",
  deletePlan: "delete_plan",
  getUnfulfillableRequirements: "get_unfulfillable_requirements",
  suggestTermBalance: "suggest_term_balance",
  findShortestPrereqPath: "find_shortest_prereq_path",
  findCommonRequirements: "find_common_requirements",
  checkMinorCompletion: "check_minor_completion",
  checkDoubleMajorOverlap: "check_double_major_overlap",
  generateAdvisingSummary: "generate_advising_summary",
  findCompatibleMinors: "find_compatible_minors",
  suggestCourseSubstitutions: "suggest_course_substitutions",
  removeStudentProgram: "remove_student_program",
  addStudentProgram: "add_student_program",
  removeCourseFromHistory: "remove_course_from_history",
  updateCourseHistory: "update_course_history",
} as const;

export type AdvisorToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

type CheckCoursePrereqsInput = {
  courseIds?: number[];
  courseCodes?: string[];
};

type GetPlanScopedInput = {
  planId?: number | null;
};

type GetRemainingRequirementsInput = {
  planId?: number | null;
  limit?: number;
};

type RecommendNextSemesterInput = {
  targetCredits?: number;
  planId?: number | null;
};

type CreatePlanInput = {
  name: string;
  programIds?: number[];
};

type AddCourseToPlanInput = {
  planId: number;
  courseCode: string;
  season: string;
  year: number;
};

type RemoveCourseFromPlanInput = {
  planId: number;
  courseCode: string;
};

type MoveCourseInPlanInput = {
  planId: number;
  courseCode: string;
  toSeason: string;
  toYear: number;
};

type SearchCoursesInput = {
  query: string;
  subject?: string;
  limit?: number;
};

type CheckGraduationReadinessInput = {
  planId?: number | null;
  targetGradSemester?: string | null;
  targetGradYear?: number | null;
};

type GetCoursePrerequisitesInput = {
  courseCodes: string[];
};

type GetCourseHistoryInput = {
  subject?: string;
  completedOnly?: boolean;
  minLevel?: number;
};

type ValidatePlanInput = {
  planId?: number | null;
};

type GetProgramRequirementsInput = {
  programIds?: number[];
};

type FindCoursesSatisfyingBlockInput = {
  blockName: string;
  programIds?: number[];
};

type GetFullPrereqChainInput = {
  courseCodes: string[];
};

type ProjectGraduationDateInput = {
  planId?: number | null;
  creditsPerTerm?: number;
  startSeason?: string;
  startYear?: number;
};

type CheckTermCreditLoadInput = {
  planId?: number | null;
  season?: string;
  year?: number;
  maxCredits?: number;
};

type IdentifyPlanGapsInput = {
  planId?: number | null;
};

type GetCourseDetailsInput = {
  courseCodes: string[];
};

type RenamePlanInput = {
  planId: number;
  newName: string;
};

type ClearPlanTermInput = {
  planId: number;
  season: string;
  year: number;
};

type AddCourseToHistoryInput = {
  courseCode: string;
  season: string;
  year: number;
  grade?: string | null;
  completed?: boolean;
};

type GetPlanWarningsInput = {
  planId?: number | null;
  maxCredits?: number;
};

type FindPrereqBottlenecksInput = {
  planId?: number | null;
  topN?: number;
};

type CheckRegistrationEligibilityInput = {
  planId?: number | null;
  season?: string;
  year?: number;
};

type EstimateCreditsPerTermNeededInput = {
  planId?: number | null;
  targetSeason?: string;
  targetYear?: number;
};

type GetGenEdOptionsInput = {
  bucketName?: string;
  bucketId?: number;
};

type FindCoursesUnlockedByInput = {
  courseCodes: string[];
};

type DuplicatePlanInput = {
  sourcePlanId: number;
  newName: string;
};

type DeletePlanInput = {
  planId: number;
  confirm: boolean;
};

type GetUnfulfillableRequirementsInput = {
  planId?: number | null;
};

type SuggestTermBalanceInput = {
  planId?: number | null;
  /** Deviation threshold (fraction of average) before a term is flagged. Default 0.4 (40%). */
  threshold?: number;
};

type FindShortestPrereqPathInput = {
  courseCode: string;
};

type FindCommonRequirementsInput = {
  programIds?: number[];
};

type CheckMinorCompletionInput = {
  programId: number;
};

type CheckDoubleMajorOverlapInput = {
  programId1: number;
  programId2: number;
};

type GenerateAdvisingSummaryInput = {
  planId?: number | null;
};

type FindCompatibleMinorsInput = {
  topN?: number;
};

type SuggestCourseSubstitutionsInput = {
  courseCode: string;
  programIds?: number[];
};

type RemoveStudentProgramInput = {
  programId: number;
  confirm: boolean;
};

type AddStudentProgramInput = {
  programId: number;
  confirm: boolean;
};

type RemoveCourseFromHistoryInput = {
  courseCode: string;
  confirm: boolean;
};

type UpdateCourseHistoryInput = {
  courseCode: string;
  grade?: string | null;
  completed?: boolean;
};

export interface AdvisorToolDependencies {
  getStudentProfile: () => Promise<AdvisorStudentProfile>;
  getPlanSnapshot: (planId?: number | null) => Promise<AdvisorPlanSnapshot | null>;
  getDegreeProgress: (planId?: number | null) => Promise<AdvisorDegreeProgress>;
  getRemainingRequirements: (
    planId?: number | null,
    limit?: number
  ) => Promise<AdvisorRemainingRequirements>;
  resolveCourseIdsByCodes: (
    courseCodes: string[]
  ) => Promise<{ resolvedIds: number[]; unresolvedCodes: string[]; resolvedCodes: string[] }>;
  evaluatePrereqs: (courseIds: number[]) => Promise<PrereqEvaluationMap>;
  createPlan: (name: string, programIds: number[]) => Promise<{ planId: number }>;
  addCourseToPlan: (
    planId: number,
    courseId: number,
    season: string,
    year: number
  ) => Promise<{ alreadyPlanned: boolean }>;
  removeCourseFromPlan: (planId: number, courseId: number) => Promise<{ removed: boolean }>;
  moveCourseInPlan: (
    planId: number,
    courseId: number,
    toSeason: string,
    toYear: number
  ) => Promise<{ moved: boolean }>;
  searchCourses: (
    query: string,
    subject?: string | null,
    limit?: number
  ) => Promise<AdvisorCourseSearchResult[]>;
  getCoursePrerequisites: (courseIds: number[]) => Promise<PrereqDefinitionMap>;
  getCourseHistory: (options?: GetCourseHistoryOptions) => Promise<AdvisorCourseHistoryEntry[]>;
  listPlans: () => Promise<AdvisorPlanSummary[]>;
  getProgramRequirements: (programIds: number[]) => Promise<AdvisorRequirementBlock[]>;
  getCoursesByIds: (courseIds: number[]) => Promise<Map<number, AdvisorCourseSearchResult>>;
  getCourseDetails: (courseIds: number[]) => Promise<Map<number, AdvisorCourseDetail>>;
  renamePlan: (planId: number, newName: string) => Promise<{ renamed: boolean }>;
  clearPlanTerm: (planId: number, season: string, year: number) => Promise<{ cleared: boolean; coursesRemoved: number }>;
  addCourseToHistory: (
    courseId: number,
    season: string,
    year: number,
    grade?: string | null,
    completed?: boolean
  ) => Promise<{ added: boolean; alreadyExists: boolean }>;
  getGenEdOptions: (bucketFilter?: string | null, bucketId?: number | null) => Promise<AdvisorGenEdBucket[]>;
  getDirectDependents: (courseIds: number[]) => Promise<Map<number, number[]>>;
  duplicatePlan: (sourcePlanId: number, newName: string) => Promise<{ planId: number; coursesCloned: number }>;
  deletePlan: (planId: number) => Promise<{ deleted: boolean }>;
  getAvailablePrograms: (programType?: string | null) => Promise<AdvisorProgramSummary[]>;
  removeStudentProgram: (programId: number) => Promise<{ removed: boolean; programId: number; plansUnlinked: number }>;
  getStudentProgramCount: () => Promise<number>;
  getEnrolledProgramById: (programId: number) => Promise<{ id: number; name: string; programType: string } | null>;
  addStudentProgram: (programId: number) => Promise<{ added: boolean; alreadyEnrolled: boolean; programId: number }>;
  removeCourseFromHistory: (courseId: number) => Promise<{ removed: boolean }>;
  updateCourseHistory: (courseId: number, grade?: string | null, completed?: boolean) => Promise<{ updated: boolean }>;
}

export interface AdvisorDependencyContext {
  supabase: SupabaseTableClient;
  studentId: number;
  profile: AdvisorStudentProfile;
}

export function createAdvisorToolDependencies(
  context: AdvisorDependencyContext
): AdvisorToolDependencies {
  return {
    getStudentProfile: async () => context.profile,
    getPlanSnapshot: async (planId?: number | null) =>
      getPlanSnapshot(context.supabase, context.studentId, planId),
    getDegreeProgress: async (planId?: number | null) =>
      getDegreeProgress(context.supabase, context.studentId, planId),
    getRemainingRequirements: async (planId?: number | null, limit?: number) =>
      getRemainingRequirements(context.supabase, context.studentId, planId, limit),
    resolveCourseIdsByCodes: async (courseCodes: string[]) =>
      resolveCourseIdsByCodes(context.supabase, courseCodes),
    evaluatePrereqs: async (courseIds: number[]) =>
      evaluatePrereqsForCourses(courseIds, context.studentId, context.supabase),
    createPlan: async (name: string, programIds: number[]) =>
      serverCreatePlan(context.supabase, context.studentId, name, programIds),
    addCourseToPlan: async (planId: number, courseId: number, season: string, year: number) =>
      serverAddCourseToPlan(context.supabase, context.studentId, planId, courseId, season, year),
    removeCourseFromPlan: async (planId: number, courseId: number) =>
      serverRemoveCourseFromPlan(context.supabase, context.studentId, planId, courseId),
    moveCourseInPlan: async (planId: number, courseId: number, toSeason: string, toYear: number) =>
      serverMoveCourseInPlan(context.supabase, context.studentId, planId, courseId, toSeason, toYear),
    searchCourses: async (query: string, subject?: string | null, limit?: number) =>
      searchCourses(context.supabase, query, subject, limit),
    getCoursePrerequisites: async (courseIds: number[]) =>
      fetchPrereqDefinitions(courseIds, context.supabase),
    getCourseHistory: async (options?: GetCourseHistoryOptions) =>
      getCourseHistory(context.supabase, context.studentId, options),
    listPlans: async () => serverListStudentPlans(context.supabase, context.studentId),
    getProgramRequirements: async (programIds: number[]) =>
      getProgramRequirements(context.supabase, programIds),
    getCoursesByIds: async (courseIds: number[]) =>
      getCoursesByIds(context.supabase, courseIds),
    getCourseDetails: async (courseIds: number[]) =>
      getCourseDetails(context.supabase, courseIds),
    renamePlan: async (planId: number, newName: string) =>
      serverRenamePlan(context.supabase, context.studentId, planId, newName),
    clearPlanTerm: async (planId: number, season: string, year: number) =>
      serverClearPlanTerm(context.supabase, context.studentId, planId, season, year),
    addCourseToHistory: async (
      courseId: number,
      season: string,
      year: number,
      grade?: string | null,
      completed = true
    ) => serverAddCourseToHistory(context.supabase, context.studentId, courseId, season, year, grade, completed),
    getGenEdOptions: async (bucketFilter?: string | null, bucketId?: number | null) =>
      getGenEdOptions(context.supabase, bucketFilter, bucketId),
    getDirectDependents: async (courseIds: number[]) =>
      getDirectDependentCourseIds(context.supabase, courseIds),
    duplicatePlan: async (sourcePlanId: number, newName: string) =>
      serverDuplicatePlan(context.supabase, context.studentId, sourcePlanId, newName),
    deletePlan: async (planId: number) =>
      serverDeletePlan(context.supabase, context.studentId, planId),
    getAvailablePrograms: async (programType?: string | null) =>
      getAvailablePrograms(context.supabase, programType),
    removeStudentProgram: async (programId: number) =>
      serverRemoveStudentProgram(context.supabase, context.studentId, programId),
    getStudentProgramCount: async () =>
      serverGetStudentProgramCount(context.supabase, context.studentId),
    getEnrolledProgramById: async (programId: number) =>
      serverGetEnrolledProgramById(context.supabase, context.studentId, programId),
    addStudentProgram: async (programId: number) =>
      serverAddStudentProgram(context.supabase, context.studentId, programId),
    removeCourseFromHistory: async (courseId: number) =>
      serverRemoveCourseFromHistory(context.supabase, context.studentId, courseId),
    updateCourseHistory: async (courseId: number, grade?: string | null, completed?: boolean) =>
      serverUpdateCourseHistory(context.supabase, context.studentId, courseId, { grade, completed }),
  };
}

function normalizeCourseCode(raw: string): string {
  return raw.trim().toUpperCase().replaceAll(/\s+/g, " ").replaceAll("-", " ");
}

function extractCourseCodes(message: string): string[] {
  const matches = message.matchAll(/([A-Za-z]{2,6})[\s-]+([0-9]{2,4}[A-Za-z]?)/g);
  const codes = new Set<string>();
  for (const match of matches) {
    const subject = String(match[1] ?? "").toUpperCase();
    const number = String(match[2] ?? "").toUpperCase();
    if (!subject || !number) continue;
    codes.add(`${subject} ${number}`);
  }
  return Array.from(codes);
}

function scoreRequirementPriority(blockName: string): number {
  const name = blockName.toLowerCase();
  if (name.includes("core") || name.includes("required")) return 3;
  if (name.includes("elective")) return 2;
  return 1;
}

function recommendationConfidence(unlocked: boolean, priority: number): AdvisorConfidence {
  if (!unlocked) return "low";
  if (priority >= 3) return "high";
  return "medium";
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function tryParseJson(text: string): unknown {
  const raw = text.trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    // Continue with fallback parsing.
  }

  const fenceOpen = raw.indexOf("```");
  if (fenceOpen >= 0) {
    let contentStart = raw.indexOf("\n", fenceOpen);
    if (contentStart < 0) contentStart = fenceOpen + 3;
    else contentStart += 1;
    const fenceClose = raw.indexOf("```", contentStart);
    if (fenceClose >= 0) {
      try {
        return JSON.parse(raw.slice(contentStart, fenceClose).trim());
      } catch {
        // Continue with fallback parsing.
      }
    }
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const maybe = raw.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(maybe);
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeAdvisorResponse(payload: unknown): AdvisorChatResponse | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const answer = typeof obj.answer === "string" ? obj.answer.trim() : "";
  if (!answer) return null;

  const recommendations: AdvisorRecommendation[] = Array.isArray(obj.recommendations)
    ? obj.recommendations
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const candidate = item as Record<string, unknown>;
          const courseCode = typeof candidate.courseCode === "string" ? candidate.courseCode.trim() : "";
          const reason = typeof candidate.reason === "string" ? candidate.reason.trim() : "";
          const confidence =
            candidate.confidence === "high" ||
            candidate.confidence === "medium" ||
            candidate.confidence === "low"
              ? candidate.confidence
              : null;
          if (!courseCode || !reason || !confidence) return null;
          return { courseCode, reason, confidence } as AdvisorRecommendation;
        })
        .filter((value): value is AdvisorRecommendation => value !== null)
    : [];

  const risks = Array.isArray(obj.risks)
    ? obj.risks.map(String).filter(Boolean)
    : [];
  const missingData = Array.isArray(obj.missingData)
    ? obj.missingData.map(String).filter(Boolean)
    : [];
  const citations = Array.isArray(obj.citations)
    ? obj.citations.map(String).filter(Boolean)
    : [];

  return {
    answer,
    recommendations,
    risks: dedupeStrings(risks),
    missingData: dedupeStrings(missingData),
    citations: dedupeStrings(citations),
  };
}

function makeFallbackResponse(answer: string): AdvisorChatResponse {
  return {
    answer,
    recommendations: [],
    risks: [],
    missingData: [],
    citations: [],
  };
}

function classifyIntent(message: string): "next_semester" | "remaining" | "prereq" | "progress" | "unknown" {
  const lower = message.toLowerCase();
  if (
    lower.includes("next semester") ||
    lower.includes("what should i take") ||
    lower.includes("recommend") ||
    lower.includes("schedule")
  ) {
    return "next_semester";
  }
  if (lower.includes("remaining requirement") || lower.includes("remaining classes") || lower.includes("remaining courses")) {
    return "remaining";
  }
  if (lower.includes("prereq") || lower.includes("can i take")) {
    return "prereq";
  }
  if (
    lower.includes("on track") ||
    lower.includes("how many credits") ||
    lower.includes("graduate") ||
    lower.includes("progress")
  ) {
    return "progress";
  }
  return "unknown";
}

type ToolExecutionResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export interface AdvisorToolset {
  get_student_profile: () => Promise<{
    studentId: number;
    name: string;
    email: string | null;
    hasCompletedOnboarding: boolean;
    expectedGraduation: string | null;
    programs: Array<{ id: number; name: string; programType: string; catalogYear: string | null }>;
  }>;
  get_plan_snapshot: (input?: GetPlanScopedInput) => Promise<AdvisorPlanSnapshot | null>;
  get_degree_progress: (input?: GetPlanScopedInput) => Promise<AdvisorDegreeProgress>;
  get_remaining_requirements: (
    input?: GetRemainingRequirementsInput
  ) => Promise<AdvisorRemainingRequirements>;
  check_course_prereqs: (input: CheckCoursePrereqsInput) => Promise<{
    results: Array<{
      courseId: number;
      courseCode: string;
      unlocked: boolean;
      summary: string[];
    }>;
    unresolvedCourseCodes: string[];
  }>;
  recommend_next_semester: (input?: RecommendNextSemesterInput) => Promise<{
    targetCredits: number;
    totalRecommendedCredits: number;
    recommendations: Array<{
      courseId: number;
      courseCode: string;
      title: string;
      credits: number;
      reason: string;
      confidence: AdvisorConfidence;
      risk: string | null;
    }>;
    risks: string[];
  }>;
  create_plan: (input: CreatePlanInput) => Promise<{
    planId?: number;
    name?: string;
    message?: string;
    success?: boolean;
    error?: string;
  }>;
  add_course_to_plan: (input: AddCourseToPlanInput) => Promise<{
    success: boolean;
    alreadyPlanned?: boolean;
    courseCode?: string;
    term?: string;
    error?: string;
  }>;
  remove_course_from_plan: (input: RemoveCourseFromPlanInput) => Promise<{
    success: boolean;
    removed?: boolean;
    courseCode?: string;
    error?: string;
  }>;
  move_course_in_plan: (input: MoveCourseInPlanInput) => Promise<{
    success: boolean;
    moved?: boolean;
    courseCode?: string;
    toTerm?: string;
    error?: string;
  }>;
  search_courses: (input: SearchCoursesInput) => Promise<{
    results: AdvisorCourseSearchResult[];
    total: number;
  }>;
  check_graduation_readiness: (input?: CheckGraduationReadinessInput) => Promise<{
    onTrack: boolean;
    remainingCredits: number;
    futurePlannedCredits: number;
    creditDeficit: number;
    expectedGraduation: string | null;
    lastPlannedTerm: string | null;
    risks: string[];
  }>;
  get_course_prerequisites: (input: GetCoursePrerequisitesInput) => Promise<{
    results: Array<{
      courseCode: string;
      hasPrereqs: boolean;
      items: string[];
    }>;
    unresolvedCourseCodes: string[];
  }>;
  get_course_history: (input?: GetCourseHistoryInput) => Promise<{
    total: number;
    completedCount: number;
    totalCredits: number;
    courses: AdvisorCourseHistoryEntry[];
  }>;
  list_plans: () => Promise<AdvisorPlanSummary[]>;
  validate_plan: (input?: ValidatePlanInput) => Promise<{
    planId: number | null;
    valid: boolean;
    issues: Array<{
      type: "prereq_order" | "credit_overload" | "requirement_gap" | "past_due_term";
      severity: "error" | "warning";
      message: string;
    }>;
    summary: string;
  }>;
  get_program_requirements: (input?: GetProgramRequirementsInput) => Promise<{
    programIds: number[];
    blocks: AdvisorRequirementBlock[];
    totalCourses: number;
  }>;
  find_courses_satisfying_block: (input: FindCoursesSatisfyingBlockInput) => Promise<{
    blockName: string;
    matchedBlocks: AdvisorRequirementBlock[];
    totalCourses: number;
    notFound: boolean;
  }>;
  get_full_prereq_chain: (input: GetFullPrereqChainInput) => Promise<{
    chains: Array<{
      targetCourseCode: string;
      targetCourseId: number | null;
      found: boolean;
      nodes: Array<{
        courseId: number;
        courseCode: string;
        title: string;
        credits: number;
        depth: number;
        directPrereqIds: number[];
      }>;
      maxDepth: number;
      alreadyCompleted: number[];
    }>;
    unresolvedCourseCodes: string[];
  }>;
  project_graduation_date: (input?: ProjectGraduationDateInput) => Promise<{
    projectedSeason: string;
    projectedYear: number;
    remainingCredits: number;
    alreadyScheduledCredits: number;
    creditsStillNeeded: number;
    termsNeeded: number;
    creditsPerTerm: number;
    warnings: string[];
  }>;
  check_term_credit_load: (input?: CheckTermCreditLoadInput) => Promise<{
    terms: Array<{
      season: string;
      year: number;
      totalCredits: number;
      courseCount: number;
      overloaded: boolean;
      courses: Array<{ courseCode: string; credits: number }>;
    }>;
    maxCredits: number;
    overloadedTerms: number;
  }>;
  identify_plan_gaps: (input?: IdentifyPlanGapsInput) => Promise<{
    gaps: Array<{
      blockId: number;
      blockName: string;
      unplannedCount: number;
      unplannedCourses: Array<{ courseId: number; courseCode: string; title: string; credits: number }>;
    }>;
    totalGapBlocks: number;
  }>;
  get_course_details: (input: GetCourseDetailsInput) => Promise<{
    courses: AdvisorCourseDetail[];
    unresolvedCourseCodes: string[];
  }>;
  rename_plan: (input: RenamePlanInput) => Promise<{
    success: boolean;
    planId: number;
    newName: string;
    error?: string;
  }>;
  clear_plan_term: (input: ClearPlanTermInput) => Promise<{
    success: boolean;
    season: string;
    year: number;
    coursesRemoved: number;
    error?: string;
  }>;
  add_course_to_history: (input: AddCourseToHistoryInput) => Promise<{
    success: boolean;
    courseCode: string;
    term: string;
    alreadyExists?: boolean;
    error?: string;
  }>;
  get_plan_warnings: (input?: GetPlanWarningsInput) => Promise<{
    warnings: Array<{ type: string; severity: "error" | "warning"; message: string }>;
    totalWarnings: number;
  }>;
  find_prereq_bottlenecks: (input?: FindPrereqBottlenecksInput) => Promise<{
    bottlenecks: Array<{
      courseId: number;
      courseCode: string;
      title: string;
      blockedCount: number;
      blockedCourses: Array<{ courseId: number; courseCode: string }>;
    }>;
  }>;
  check_registration_eligibility: (input?: CheckRegistrationEligibilityInput) => Promise<{
    season: string;
    year: number;
    eligible: Array<{ courseId: number; courseCode: string; title: string; credits: number }>;
    ineligible: Array<{ courseId: number; courseCode: string; title: string; credits: number; reasons: string[] }>;
    notPlanned: boolean;
  }>;
  estimate_credits_per_term_needed: (input?: EstimateCreditsPerTermNeededInput) => Promise<{
    remainingCredits: number;
    alreadyScheduledCredits: number;
    creditsStillNeeded: number;
    remainingTerms: number | null;
    creditsPerTermNeeded: number | null;
    targetTerm: string | null;
    realistic: boolean;
    warnings: string[];
  }>;
  get_gen_ed_options: (input?: GetGenEdOptionsInput) => Promise<{
    buckets: AdvisorGenEdBucket[];
    total: number;
  }>;
  find_courses_unlocked_by: (input: FindCoursesUnlockedByInput) => Promise<{
    results: Array<{
      prereqCourseCode: string;
      unlockedCourses: Array<{ courseId: number; courseCode: string; title: string; credits: number }>;
    }>;
    unresolvedCourseCodes: string[];
  }>;
  duplicate_plan: (input: DuplicatePlanInput) => Promise<{
    success: boolean;
    newPlanId?: number;
    newName?: string;
    coursesCloned?: number;
    error?: string;
  }>;
  delete_plan: (input: DeletePlanInput) => Promise<{
    success: boolean;
    planId: number;
    error?: string;
  }>;
  get_unfulfillable_requirements: (input?: GetUnfulfillableRequirementsInput) => Promise<{
    unfulfillable: Array<{
      type: "missing_from_plan" | "prereq_violation" | "no_block_coverage";
      blockId?: number;
      blockName?: string;
      courseId?: number;
      courseCode?: string;
      message: string;
    }>;
    totalCount: number;
    canGraduate: boolean;
  }>;
  suggest_term_balance: (input?: SuggestTermBalanceInput) => Promise<{
    averageCredits: number;
    terms: Array<{
      season: string;
      year: number;
      totalCredits: number;
      status: "balanced" | "overloaded" | "underloaded";
      deviation: number;
    }>;
    outlierTerms: number;
    suggestions: string[];
  }>;
  find_shortest_prereq_path: (input: FindShortestPrereqPathInput) => Promise<{
    targetCourseCode: string;
    targetCourseId: number | null;
    found: boolean;
    alreadyEligible: boolean;
    requiredFirst: Array<{ courseId: number; courseCode: string; title: string; credits: number }>;
    minimumTermsNeeded: number;
    message: string;
  }>;
  find_common_requirements: (input?: FindCommonRequirementsInput) => Promise<{
    courses: Array<{
      courseId: number;
      courseCode: string;
      title: string;
      credits: number;
      blocks: Array<{ blockId: number; blockName: string; programId: number; programName: string }>;
      blockCount: number;
    }>;
    totalDoubleCountable: number;
  }>;
  check_minor_completion: (input: CheckMinorCompletionInput) => Promise<{
    programId: number;
    programName: string;
    totalRequirements: number;
    completedCount: number;
    completedCredits: number;
    remainingCourses: Array<{ courseId: number; courseCode: string; title: string; credits: number }>;
    percentComplete: number;
  }>;
  check_double_major_overlap: (input: CheckDoubleMajorOverlapInput) => Promise<{
    program1: { id: number; name: string; totalCourses: number; totalCredits: number };
    program2: { id: number; name: string; totalCourses: number; totalCredits: number };
    overlapCourses: Array<{ courseId: number; courseCode: string; title: string; credits: number }>;
    overlapCount: number;
    overlapCredits: number;
    additionalCreditsForSecond: number;
  }>;
  generate_advising_summary: (input?: GenerateAdvisingSummaryInput) => Promise<{
    studentName: string;
    programs: string[];
    overallProgress: { completedCredits: number; remainingCredits: number; percentage: number };
    planIssues: Array<{ type: string; message: string }>;
    upcomingRequirements: Array<{ blockName: string; courses: string[] }>;
    planGaps: string[];
    openQuestions: string[];
  }>;
  find_compatible_minors: (input?: FindCompatibleMinorsInput) => Promise<{
    minors: Array<{
      programId: number;
      programName: string;
      totalRequirements: number;
      alreadySatisfied: number;
      remaining: number;
      percentComplete: number;
    }>;
    topN: number;
  }>;
  suggest_course_substitutions: (input: SuggestCourseSubstitutionsInput) => Promise<{
    targetCourseCode: string;
    targetCourseId: number | null;
    blocks: Array<{
      blockId: number;
      blockName: string;
      programName: string;
      alternatives: Array<{ courseId: number; courseCode: string; title: string; credits: number }>;
    }>;
    notFound: boolean;
    message: string;
  }>;
  remove_student_program: (input: RemoveStudentProgramInput) => Promise<{
    success: boolean;
    programId: number;
    programName?: string;
    plansUnlinked?: number;
    error?: string;
  }>;
  add_student_program: (input: AddStudentProgramInput) => Promise<{
    success: boolean;
    programId: number;
    programName?: string;
    error?: string;
  }>;
  remove_course_from_history: (input: RemoveCourseFromHistoryInput) => Promise<{
    success: boolean;
    courseCode: string;
    error?: string;
  }>;
  update_course_history: (input: UpdateCourseHistoryInput) => Promise<{
    success: boolean;
    courseCode: string;
    updated?: boolean;
    error?: string;
  }>;
}

export function createAdvisorTools(deps: AdvisorToolDependencies): AdvisorToolset {
  return {
    async get_student_profile() {
      const profile = await deps.getStudentProfile();
      return {
        studentId: profile.studentId,
        name: profile.fullName,
        email: profile.email,
        hasCompletedOnboarding: profile.hasCompletedOnboarding,
        expectedGraduation: profile.expectedGraduation,
        programs: profile.programs.map((program) => ({
          id: program.id,
          name: program.name,
          programType: program.programType,
          catalogYear: program.catalogYear,
        })),
      };
    },

    async get_plan_snapshot(input?: GetPlanScopedInput) {
      return deps.getPlanSnapshot(input?.planId ?? null);
    },

    async get_degree_progress(input?: GetPlanScopedInput) {
      return deps.getDegreeProgress(input?.planId ?? null);
    },

    async get_remaining_requirements(input?: GetRemainingRequirementsInput) {
      return deps.getRemainingRequirements(input?.planId ?? null, input?.limit ?? 25);
    },

    async check_course_prereqs(input: CheckCoursePrereqsInput) {
      const normalizedIds = Array.from(
        new Set(
          (input.courseIds ?? [])
            .map(Number)
            .filter((id) => Number.isFinite(id))
        )
      );

      const normalizedCodes = Array.from(
        new Set((input.courseCodes ?? []).map((code) => normalizeCourseCode(code)).filter(Boolean))
      );

      const lookup = normalizedCodes.length
        ? await deps.resolveCourseIdsByCodes(normalizedCodes)
        : { resolvedIds: [], unresolvedCodes: [], resolvedCodes: [] };

      const candidateIds = Array.from(new Set([...normalizedIds, ...lookup.resolvedIds]));
      const prereqMap = await deps.evaluatePrereqs(candidateIds);

      const idToCode = new Map<number, string>();
      lookup.resolvedIds.forEach((id, idx) => {
        const code = lookup.resolvedCodes[idx];
        if (code) idToCode.set(id, code);
      });

      const results = candidateIds
        .map((courseId) => {
          const courseCode = idToCode.get(courseId);
          if (!courseCode) return null;
          const prereq = prereqMap.get(courseId) ?? { unlocked: true, summary: [] };
          return {
            courseId,
            courseCode,
            unlocked: prereq.unlocked,
            summary: prereq.summary,
          };
        })
        .filter((result): result is NonNullable<typeof result> => result !== null);

      return {
        results,
        unresolvedCourseCodes: lookup.unresolvedCodes,
      };
    },

    async recommend_next_semester(input?: RecommendNextSemesterInput) {
      const rawCredits = Number(input?.targetCredits ?? 15);
      const targetCredits = Number.isFinite(rawCredits) && !isNaN(rawCredits)
        ? Math.max(3, Math.min(rawCredits, 21))
        : 15;
      const remaining = await deps.getRemainingRequirements(input?.planId ?? null, 200);

      const candidates = remaining.blocks.flatMap((block) =>
        block.remainingCourses.map((course) => ({
          ...course,
          blockName: block.blockName,
        }))
      );

      const uniqueCandidates = Array.from(
        new Map(candidates.map((candidate) => [candidate.id, candidate])).values()
      );

      const prereqMap = await deps.evaluatePrereqs(uniqueCandidates.map((candidate) => candidate.id));
      const scored = uniqueCandidates.map((candidate) => {
        const prereq = prereqMap.get(candidate.id) ?? { unlocked: true, summary: [] };
        const priority = scoreRequirementPriority(candidate.blockName);
        const score = (prereq.unlocked ? 100 : 0) + priority * 10 + candidate.credits;
        return { candidate, prereq, priority, score };
      });

      scored.sort((a, b) => b.score - a.score);

      const selected: Array<{
        courseId: number;
        courseCode: string;
        title: string;
        credits: number;
        reason: string;
        confidence: AdvisorConfidence;
        risk: string | null;
      }> = [];

      let creditTotal = 0;
      const risks: string[] = [];

      for (const item of scored) {
        if (creditTotal >= targetCredits) break;
        const unlocked = item.prereq.unlocked;
        if (!unlocked && selected.length >= 3) continue;

        selected.push({
          courseId: item.candidate.id,
          courseCode: item.candidate.courseCode,
          title: item.candidate.title,
          credits: item.candidate.credits,
          reason: unlocked
            ? `Supports ${item.candidate.blockName} progress and fits your current prerequisite status.`
            : `Relevant to ${item.candidate.blockName}, but prerequisites are not fully met yet.`,
          confidence: recommendationConfidence(unlocked, item.priority),
          risk: unlocked ? null : item.prereq.summary.join("; ") || "Prerequisites may not be met.",
        });
        creditTotal += item.candidate.credits;
      }

      for (const rec of selected) {
        if (rec.risk) risks.push(`${rec.courseCode}: ${rec.risk}`);
      }

      return {
        targetCredits,
        totalRecommendedCredits: creditTotal,
        recommendations: selected,
        risks: dedupeStrings(risks),
      };
    },

    async create_plan(input: CreatePlanInput) {
      const profile = await deps.getStudentProfile();

      // Default to student's enrolled program IDs if none specified.
      const programIds =
        Array.isArray(input.programIds) && input.programIds.length > 0
          ? input.programIds.map(Number).filter((id) => Number.isFinite(id) && id > 0)
          : profile.programs.map((p) => p.id);

      const name = (input.name ?? "My Plan").trim().slice(0, 100) || "My Plan";

      try {
        const { planId } = await deps.createPlan(name, programIds);
        return {
          planId,
          name,
          message: `Plan "${name}" created (ID: ${planId}). You can now add courses to it using add_course_to_plan.`,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to create plan. Check that all program IDs are valid.",
        };
      }
    },

    async add_course_to_plan(input: AddCourseToPlanInput) {
      const normalizedCode = normalizeCourseCode(input.courseCode);
      const { resolvedIds, unresolvedCodes } = await deps.resolveCourseIdsByCodes([normalizedCode]);

      if (unresolvedCodes.length > 0 || resolvedIds.length === 0) {
        return {
          success: false,
          error: `Course "${input.courseCode}" was not found in the course catalog.`,
        };
      }

      const courseId = resolvedIds[0]!;
      const season = input.season;
      const year = Number(input.year);

      if (!Number.isFinite(year) || year < 2020 || year > 2040) {
        return { success: false, error: `Invalid year: ${input.year}.` };
      }

      const validSeasons = ["Fall", "Spring", "Summer"];
      if (!validSeasons.includes(season)) {
        return { success: false, error: `Invalid season "${season}". Must be Fall, Spring, or Summer.` };
      }

      const { alreadyPlanned } = await deps.addCourseToPlan(input.planId, courseId, season, year);

      if (alreadyPlanned) {
        return {
          success: true,
          alreadyPlanned: true,
          courseCode: normalizedCode,
          term: `${season} ${year}`,
        };
      }

      return {
        success: true,
        alreadyPlanned: false,
        courseCode: normalizedCode,
        term: `${season} ${year}`,
      };
    },

    async remove_course_from_plan(input: RemoveCourseFromPlanInput) {
      const normalizedCode = normalizeCourseCode(input.courseCode);
      const { resolvedIds, unresolvedCodes } = await deps.resolveCourseIdsByCodes([normalizedCode]);

      if (unresolvedCodes.length > 0 || resolvedIds.length === 0) {
        return {
          success: false,
          error: `Course "${input.courseCode}" was not found in the course catalog.`,
        };
      }

      const courseId = resolvedIds[0]!;
      const { removed } = await deps.removeCourseFromPlan(input.planId, courseId);

      return {
        success: true,
        removed,
        courseCode: normalizedCode,
      };
    },

    async move_course_in_plan(input: MoveCourseInPlanInput) {
      const normalizedCode = normalizeCourseCode(input.courseCode);
      const { resolvedIds, unresolvedCodes } = await deps.resolveCourseIdsByCodes([normalizedCode]);

      if (unresolvedCodes.length > 0 || resolvedIds.length === 0) {
        return { success: false, error: `Course "${input.courseCode}" was not found in the course catalog.` };
      }

      const toSeason = input.toSeason;
      const toYear = Number(input.toYear);

      if (!Number.isFinite(toYear) || toYear < 2020 || toYear > 2040) {
        return { success: false, error: `Invalid year: ${input.toYear}.` };
      }

      const validSeasons = ["Fall", "Spring", "Summer"];
      if (!validSeasons.includes(toSeason)) {
        return { success: false, error: `Invalid season "${toSeason}". Must be Fall, Spring, or Summer.` };
      }

      const courseId = resolvedIds[0]!;
      const { moved } = await deps.moveCourseInPlan(input.planId, courseId, toSeason, toYear);

      if (!moved) {
        return { success: false, error: `${normalizedCode} was not found in this plan.` };
      }

      return {
        success: true,
        moved: true,
        courseCode: normalizedCode,
        toTerm: `${toSeason} ${toYear}`,
      };
    },

    async search_courses(input: SearchCoursesInput) {
      const results = await deps.searchCourses(
        input.query ?? "",
        input.subject ?? null,
        input.limit ?? 15
      );
      return { results, total: results.length };
    },

    async check_graduation_readiness(input?: CheckGraduationReadinessInput) {
      const planId = input?.planId ?? null;

      const [progress, snapshot, profile] = await Promise.all([
        deps.getDegreeProgress(planId),
        deps.getPlanSnapshot(planId),
        deps.getStudentProfile(),
      ]);

      const remaining = progress.overall.remainingCredits;

      // Determine current term from today's date.
      const now = new Date();
      const month = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const currentSeason = month <= 5 ? "Spring" : month <= 7 ? "Summer" : "Fall";

      const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
      const termKey = (season: string, year: number) =>
        year * 10 + (SEASON_ORDER[season] ?? 0);
      const currentKey = termKey(currentSeason, currentYear);

      // Sum planned credits in the current and future terms.
      const terms = snapshot?.terms ?? [];
      const plannedCourses = snapshot?.plannedCourses ?? [];

      let futurePlannedCredits = 0;
      let lastPlannedTerm: string | null = null;
      let lastPlannedKey = -1;

      for (const term of terms) {
        const key = termKey(term.season, term.year);
        if (key < currentKey) continue;
        const credits = plannedCourses
          .filter((c) => c.termId === term.id)
          .reduce((s, c) => s + c.credits, 0);
        futurePlannedCredits += credits;
        if (credits > 0 && key > lastPlannedKey) {
          lastPlannedKey = key;
          lastPlannedTerm = `${term.season} ${term.year}`;
        }
      }

      const creditDeficit = Math.max(0, remaining - futurePlannedCredits);
      const onTrack = creditDeficit === 0;

      // Resolve target graduation (input override > profile default).
      const targetSeason = input?.targetGradSemester ?? null;
      const targetYear = input?.targetGradYear ?? null;
      let targetKey: number | null = null;
      if (targetSeason && targetYear) {
        targetKey = termKey(targetSeason, Number(targetYear));
      }

      const risks: string[] = [];

      if (!onTrack) {
        risks.push(`${creditDeficit} credit(s) are not yet scheduled in any future term.`);
      }

      if (targetKey !== null && lastPlannedKey > targetKey) {
        risks.push(`Last planned term (${lastPlannedTerm}) is after the target graduation of ${targetSeason} ${targetYear}.`);
      }

      if (progress.overall.percentage < 50 && terms.length === 0) {
        risks.push("No terms have been added to this plan yet.");
      }

      return {
        onTrack,
        remainingCredits: remaining,
        futurePlannedCredits,
        creditDeficit,
        expectedGraduation: profile.expectedGraduation,
        lastPlannedTerm,
        risks,
      };
    },

    async get_course_prerequisites(input: GetCoursePrerequisitesInput) {
      const codes = (input.courseCodes ?? []).map((c) => normalizeCourseCode(c));
      const { resolvedIds, resolvedCodes, unresolvedCodes } =
        await deps.resolveCourseIdsByCodes(codes);

      if (resolvedIds.length === 0) {
        return { results: [], unresolvedCourseCodes: unresolvedCodes };
      }

      const defMap = await deps.getCoursePrerequisites(resolvedIds);

      const results = resolvedIds.map((id, i) => {
        const def = defMap.get(id) ?? { hasPrereqs: false, items: [] };
        return {
          courseCode: resolvedCodes[i] ?? `course #${id}`,
          hasPrereqs: def.hasPrereqs,
          items: def.items,
        };
      });

      return { results, unresolvedCourseCodes: unresolvedCodes };
    },

    async get_course_history(input?: GetCourseHistoryInput) {
      const options: GetCourseHistoryOptions = {
        subject: input?.subject ?? null,
        completedOnly: input?.completedOnly ?? false,
        minLevel: input?.minLevel ?? null,
      };

      const courses = await deps.getCourseHistory(options);

      const completedCount = courses.filter((c) => c.completed).length;
      const totalCredits = courses
        .filter((c) => c.completed)
        .reduce((s, c) => s + c.credits, 0);

      return {
        total: courses.length,
        completedCount,
        totalCredits,
        courses,
      };
    },

    async list_plans() {
      return deps.listPlans();
    },

    async validate_plan(input?: ValidatePlanInput) {
      const planId = input?.planId ?? null;

      type PlanIssue = {
        type: "prereq_order" | "credit_overload" | "requirement_gap" | "past_due_term";
        severity: "error" | "warning";
        message: string;
      };

      const [snapshot, historyEntries, remaining] = await Promise.all([
        deps.getPlanSnapshot(planId),
        deps.getCourseHistory({ completedOnly: true }),
        deps.getRemainingRequirements(planId, 200),
      ]);

      if (!snapshot) {
        return {
          planId,
          valid: false,
          issues: [{
            type: "prereq_order" as const,
            severity: "error" as const,
            message: "No plan found to validate.",
          }],
          summary: "No plan found.",
        };
      }

      const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
      const termKey = (season: string, year: number) => year * 10 + (SEASON_ORDER[season] ?? 0);
      const now = new Date();
      const month = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const currentSeason = month <= 5 ? "Spring" : month <= 7 ? "Summer" : "Fall";
      const currentKey = termKey(currentSeason, currentYear);

      const issues: PlanIssue[] = [];

      // Build term lookup
      const termById = new Map<number, { season: string; year: number; key: number }>();
      for (const term of snapshot.terms) {
        termById.set(term.id, { season: term.season, year: term.year, key: termKey(term.season, term.year) });
      }

      // Build courseId → term key for all planned courses and sum credits per term
      const courseToTermKey = new Map<number, number>();
      const termCreditTotals = new Map<number, { season: string; year: number; credits: number }>();
      for (const planned of snapshot.plannedCourses) {
        if (planned.termId == null) continue;
        const term = termById.get(planned.termId);
        if (!term) continue;
        courseToTermKey.set(planned.courseId, term.key);
        const existing = termCreditTotals.get(planned.termId);
        if (existing) {
          existing.credits += planned.credits;
        } else {
          termCreditTotals.set(planned.termId, { season: term.season, year: term.year, credits: planned.credits });
        }
      }

      // Completed course IDs from history
      const completedIds = new Set(historyEntries.map((h) => h.courseId));

      // 1. Credit overloads
      for (const [, termInfo] of termCreditTotals) {
        if (termInfo.credits > 18) {
          issues.push({
            type: "credit_overload",
            severity: "warning",
            message: `${termInfo.season} ${termInfo.year} has ${termInfo.credits} credits scheduled (recommended max is 18).`,
          });
        }
      }

      // 2. Past-due terms with planned courses
      for (const term of snapshot.terms) {
        const key = termKey(term.season, term.year);
        if (key < currentKey) {
          const coursesInTerm = snapshot.plannedCourses.filter((c) => c.termId === term.id);
          if (coursesInTerm.length > 0) {
            issues.push({
              type: "past_due_term",
              severity: "warning",
              message: `${term.season} ${term.year} is in the past but still has ${coursesInTerm.length} planned course(s): ${coursesInTerm.map((c) => c.courseCode).join(", ")}.`,
            });
          }
        }
      }

      // 3. Prereq ordering violations
      const plannedCourseIds = snapshot.plannedCourses
        .filter((c) => c.termId != null)
        .map((c) => c.courseId);

      if (plannedCourseIds.length > 0) {
        const prereqDefs = await deps.getCoursePrerequisites(plannedCourseIds);

        for (const planned of snapshot.plannedCourses) {
          if (planned.termId == null) continue;
          const def = prereqDefs.get(planned.courseId);
          if (!def || !def.hasPrereqs || def.requiredCourseIds.length === 0) continue;

          const plannedTermInfo = termById.get(planned.termId);
          if (!plannedTermInfo) continue;

          for (const reqId of def.requiredCourseIds) {
            if (completedIds.has(reqId)) continue;
            const prereqKey = courseToTermKey.get(reqId);
            if (prereqKey == null) continue; // not planned — skip (handled elsewhere)

            if (prereqKey >= plannedTermInfo.key) {
              const prereqEntry = snapshot.plannedCourses.find((c) => c.courseId === reqId);
              const prereqTermInfo = prereqEntry?.termId != null ? termById.get(prereqEntry.termId) : null;
              issues.push({
                type: "prereq_order",
                severity: "error",
                message: `${planned.courseCode} is in ${plannedTermInfo.season} ${plannedTermInfo.year}, but its prerequisite${prereqEntry ? ` ${prereqEntry.courseCode}` : ` #${reqId}`} is ${prereqTermInfo ? `not completed until ${prereqTermInfo.season} ${prereqTermInfo.year}` : "in the same or a later term"}.`,
              });
            }
          }
        }
      }

      // 4. Requirement gaps — blocks with no planned courses
      const plannedCourseIdSet = new Set(plannedCourseIds);
      for (const block of remaining.blocks) {
        const hasAnyPlanned = block.remainingCourses.some((c) => plannedCourseIdSet.has(c.id));
        if (!hasAnyPlanned && block.remainingCourses.length > 0) {
          issues.push({
            type: "requirement_gap",
            severity: "warning",
            message: `"${block.blockName}" has ${block.remainingCourses.length} unmet requirement(s) with none currently planned.`,
          });
        }
      }

      const errorCount = issues.filter((i) => i.severity === "error").length;
      const warningCount = issues.filter((i) => i.severity === "warning").length;
      const valid = errorCount === 0;
      const summary =
        valid && warningCount === 0
          ? "Plan looks good — no issues detected."
          : `Found ${errorCount} error(s) and ${warningCount} warning(s).`;

      return { planId, valid, issues, summary };
    },

    async get_program_requirements(input?: GetProgramRequirementsInput) {
      // Use provided programIds or default to student's enrolled programs.
      let programIds: number[] = (input?.programIds ?? [])
        .map(Number)
        .filter((id) => Number.isFinite(id) && id > 0);

      if (programIds.length === 0) {
        const profile = await deps.getStudentProfile();
        programIds = profile.programs.map((p) => p.id);
      }

      const blocks = await deps.getProgramRequirements(programIds);
      const totalCourses = blocks.reduce((s, b) => s + b.courses.length, 0);

      return { programIds, blocks, totalCourses };
    },

    async find_courses_satisfying_block(input: FindCoursesSatisfyingBlockInput) {
      const searchName = (input.blockName ?? "").trim().toLowerCase();

      let programIds: number[] = (input.programIds ?? [])
        .map(Number)
        .filter((id) => Number.isFinite(id) && id > 0);

      if (programIds.length === 0) {
        const profile = await deps.getStudentProfile();
        programIds = profile.programs.map((p) => p.id);
      }

      const allBlocks = await deps.getProgramRequirements(programIds);

      // Match blocks by exact name first, then partial match.
      const exactMatches = allBlocks.filter(
        (b) => b.blockName.toLowerCase() === searchName
      );
      const matched = exactMatches.length > 0
        ? exactMatches
        : allBlocks.filter((b) => b.blockName.toLowerCase().includes(searchName));

      const totalCourses = matched.reduce((s, b) => s + b.courses.length, 0);

      return {
        blockName: input.blockName,
        matchedBlocks: matched,
        totalCourses,
        notFound: matched.length === 0,
      };
    },

    async get_full_prereq_chain(input: GetFullPrereqChainInput) {
      const codes = (input.courseCodes ?? []).map((c) => normalizeCourseCode(c)).filter(Boolean);
      if (codes.length === 0) {
        return { chains: [], unresolvedCourseCodes: [] };
      }

      const { resolvedIds, resolvedCodes, unresolvedCodes } =
        await deps.resolveCourseIdsByCodes(codes);

      // Get completed course IDs for this student.
      const historyEntries = await deps.getCourseHistory({ completedOnly: true });
      const completedIds = new Set(historyEntries.map((h) => h.courseId));

      const chains: Awaited<ReturnType<AdvisorToolset["get_full_prereq_chain"]>>["chains"] = [];

      for (let i = 0; i < resolvedIds.length; i++) {
        const targetId = resolvedIds[i]!;
        const targetCode = resolvedCodes[i] ?? `course #${targetId}`;

        // BFS to collect all prereq course IDs.
        type NodeEntry = { courseId: number; depth: number; directPrereqIds: number[] };
        const nodeMap = new Map<number, NodeEntry>();
        const queue: Array<{ courseId: number; depth: number }> = [{ courseId: targetId, depth: 0 }];
        const visited = new Set<number>();
        const alreadyCompleted: number[] = [];

        while (queue.length > 0) {
          const batch = queue.splice(0, 20); // process in batches of 20
          const unvisited = batch.filter((item) => {
            if (visited.has(item.courseId)) return false;
            visited.add(item.courseId);
            return true;
          });
          if (unvisited.length === 0) continue;

          const batchIds = unvisited.map((u) => u.courseId);
          const prereqDefs = await deps.getCoursePrerequisites(batchIds);

          for (const { courseId, depth } of unvisited) {
            const def = prereqDefs.get(courseId);
            const directPrereqIds = def?.requiredCourseIds ?? [];
            nodeMap.set(courseId, { courseId, depth, directPrereqIds });

            for (const reqId of directPrereqIds) {
              if (completedIds.has(reqId)) {
                alreadyCompleted.push(reqId);
              } else if (!visited.has(reqId)) {
                queue.push({ courseId: reqId, depth: depth + 1 });
              }
            }
          }
        }

        // Look up course info for all discovered IDs.
        const allIds = Array.from(nodeMap.keys());
        const courseInfoMap = await deps.getCoursesByIds(allIds);

        const nodes = Array.from(nodeMap.values())
          .sort((a, b) => b.depth - a.depth) // deepest (furthest prereq) first
          .map((entry) => {
            const info = courseInfoMap.get(entry.courseId);
            return {
              courseId: entry.courseId,
              courseCode: info?.courseCode ?? `course #${entry.courseId}`,
              title: info?.title ?? "",
              credits: info?.credits ?? 0,
              depth: entry.depth,
              directPrereqIds: entry.directPrereqIds,
            };
          });

        const maxDepth = nodes.length > 0 ? Math.max(...nodes.map((n) => n.depth)) : 0;

        chains.push({
          targetCourseCode: targetCode,
          targetCourseId: targetId,
          found: true,
          nodes,
          maxDepth,
          alreadyCompleted: Array.from(new Set(alreadyCompleted)),
        });
      }

      // Add not-found entries for unresolved codes.
      for (const code of unresolvedCodes) {
        chains.push({
          targetCourseCode: code,
          targetCourseId: null,
          found: false,
          nodes: [],
          maxDepth: 0,
          alreadyCompleted: [],
        });
      }

      return { chains, unresolvedCourseCodes: unresolvedCodes };
    },

    async add_course_to_history(input: AddCourseToHistoryInput) {
      const normalizedCode = normalizeCourseCode(input.courseCode);
      const { resolvedIds, unresolvedCodes } = await deps.resolveCourseIdsByCodes([normalizedCode]);

      if (unresolvedCodes.length > 0 || resolvedIds.length === 0) {
        return {
          success: false,
          courseCode: normalizedCode,
          term: `${input.season} ${input.year}`,
          error: `Course "${input.courseCode}" was not found in the course catalog.`,
        };
      }

      const season = input.season;
      const year = Number(input.year);
      const validSeasons = ["Fall", "Spring", "Summer"];

      if (!validSeasons.includes(season)) {
        return { success: false, courseCode: normalizedCode, term: `${season} ${year}`, error: `Invalid season "${season}".` };
      }
      if (!Number.isFinite(year) || year < 1900 || year > 2100) {
        return { success: false, courseCode: normalizedCode, term: `${season} ${year}`, error: `Invalid year: ${year}.` };
      }

      const courseId = resolvedIds[0]!;
      const completed = input.completed !== false;
      const { added, alreadyExists } = await deps.addCourseToHistory(
        courseId,
        season,
        year,
        input.grade ?? null,
        completed
      );

      return {
        success: true,
        courseCode: normalizedCode,
        term: `${season} ${year}`,
        alreadyExists,
        ...(added ? {} : { alreadyExists: true }),
      };
    },

    async get_plan_warnings(input?: GetPlanWarningsInput) {
      const planId = input?.planId ?? null;
      const maxCredits = Math.max(1, Number(input?.maxCredits ?? 18));

      const snapshot = await deps.getPlanSnapshot(planId);
      const warnings: Array<{ type: string; severity: "error" | "warning"; message: string }> = [];

      if (!snapshot) {
        return { warnings: [{ type: "no_plan", severity: "warning" as const, message: "No plan found." }], totalWarnings: 1 };
      }

      const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
      const termKey = (season: string, year: number) => year * 10 + (SEASON_ORDER[season] ?? 0);
      const now = new Date();
      const month = now.getMonth() + 1;
      const currentSeason = month <= 5 ? "Spring" : month <= 7 ? "Summer" : "Fall";
      const currentKey = termKey(currentSeason, now.getFullYear());

      for (const term of snapshot.terms) {
        const key = termKey(term.season, term.year);
        const termCourses = snapshot.plannedCourses.filter((c) => c.termId === term.id);
        const totalCredits = termCourses.reduce((s, c) => s + c.credits, 0);

        if (totalCredits > maxCredits) {
          warnings.push({
            type: "credit_overload",
            severity: "warning",
            message: `${term.season} ${term.year} has ${totalCredits} credits (max ${maxCredits}).`,
          });
        }

        if (key < currentKey && termCourses.length > 0) {
          warnings.push({
            type: "past_due_term",
            severity: "warning",
            message: `${term.season} ${term.year} is in the past but still has ${termCourses.length} planned course(s).`,
          });
        }
      }

      return { warnings, totalWarnings: warnings.length };
    },

    async find_prereq_bottlenecks(input?: FindPrereqBottlenecksInput) {
      const planId = input?.planId ?? null;
      const topN = Math.max(1, Math.min(Number(input?.topN ?? 10), 25));

      const remaining = await deps.getRemainingRequirements(planId, 200);
      const allRemainingCourses = remaining.blocks.flatMap((b) => b.remainingCourses);
      const remainingIds = allRemainingCourses.map((c) => c.id);

      if (remainingIds.length === 0) {
        return { bottlenecks: [] };
      }

      const prereqDefs = await deps.getCoursePrerequisites(remainingIds);
      const historyEntries = await deps.getCourseHistory({ completedOnly: true });
      const completedIds = new Set(historyEntries.map((h) => h.courseId));

      // Count how many remaining courses each unmet prereq blocks.
      const blockedBy = new Map<number, Set<number>>(); // prereqId → Set of remaining courseIds it blocks

      for (const course of allRemainingCourses) {
        if (completedIds.has(course.id)) continue;
        const def = prereqDefs.get(course.id);
        if (!def || !def.hasPrereqs) continue;

        for (const reqId of def.requiredCourseIds) {
          if (completedIds.has(reqId)) continue;
          if (!blockedBy.has(reqId)) blockedBy.set(reqId, new Set());
          blockedBy.get(reqId)!.add(course.id);
        }
      }

      if (blockedBy.size === 0) return { bottlenecks: [] };

      const bottleneckIds = Array.from(blockedBy.entries())
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, topN)
        .map(([id]) => id);

      const courseInfoMap = await deps.getCoursesByIds(bottleneckIds);
      const remainingInfoMap = new Map(allRemainingCourses.map((c) => [c.id, c]));

      return {
        bottlenecks: bottleneckIds.map((id) => {
          const info = courseInfoMap.get(id);
          const blockedSet = blockedBy.get(id) ?? new Set<number>();
          return {
            courseId: id,
            courseCode: info?.courseCode ?? `course #${id}`,
            title: info?.title ?? "",
            blockedCount: blockedSet.size,
            blockedCourses: Array.from(blockedSet).slice(0, 5).map((cid) => {
              const c = remainingInfoMap.get(cid);
              return { courseId: cid, courseCode: c?.courseCode ?? `course #${cid}` };
            }),
          };
        }),
      };
    },

    async check_registration_eligibility(input?: CheckRegistrationEligibilityInput) {
      const planId = input?.planId ?? null;

      const now = new Date();
      const month = now.getMonth() + 1;
      const defaultSeason = month <= 5 ? "Spring" : month <= 7 ? "Summer" : "Fall";
      const defaultYear = now.getFullYear();

      const season = input?.season ?? defaultSeason;
      const year = Number(input?.year ?? defaultYear);

      const snapshot = await deps.getPlanSnapshot(planId);
      const terms = snapshot?.terms ?? [];
      const plannedCourses = snapshot?.plannedCourses ?? [];

      const matchingTerm = terms.find((t) => t.season === season && t.year === year);
      if (!matchingTerm) {
        return { season, year, eligible: [], ineligible: [], notPlanned: true };
      }

      const termCourses = plannedCourses.filter((c) => c.termId === matchingTerm.id);
      if (termCourses.length === 0) {
        return { season, year, eligible: [], ineligible: [], notPlanned: false };
      }

      const courseIds = termCourses.map((c) => c.courseId);
      const prereqMap = await deps.evaluatePrereqs(courseIds);

      const eligible: Array<{ courseId: number; courseCode: string; title: string; credits: number }> = [];
      const ineligible: Array<{ courseId: number; courseCode: string; title: string; credits: number; reasons: string[] }> = [];

      for (const course of termCourses) {
        const prereq = prereqMap.get(course.courseId) ?? { unlocked: true, summary: [] };
        if (prereq.unlocked) {
          eligible.push({ courseId: course.courseId, courseCode: course.courseCode, title: course.title, credits: course.credits });
        } else {
          ineligible.push({
            courseId: course.courseId,
            courseCode: course.courseCode,
            title: course.title,
            credits: course.credits,
            reasons: prereq.summary,
          });
        }
      }

      return { season, year, eligible, ineligible, notPlanned: false };
    },

    async estimate_credits_per_term_needed(input?: EstimateCreditsPerTermNeededInput) {
      const planId = input?.planId ?? null;
      const [progress, snapshot] = await Promise.all([
        deps.getDegreeProgress(planId),
        deps.getPlanSnapshot(planId),
      ]);

      const remaining = progress.overall.remainingCredits;

      const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
      const termKey = (season: string, year: number) => year * 10 + (SEASON_ORDER[season] ?? 0);
      const now = new Date();
      const month = now.getMonth() + 1;
      const currentSeason = month <= 5 ? "Spring" : month <= 7 ? "Summer" : "Fall";
      const currentKey = termKey(currentSeason, now.getFullYear());

      const terms = snapshot?.terms ?? [];
      const plannedCourses = snapshot?.plannedCourses ?? [];
      let scheduledFuture = 0;

      for (const term of terms) {
        const key = termKey(term.season, term.year);
        if (key < currentKey) continue;
        const credits = plannedCourses.filter((c) => c.termId === term.id).reduce((s, c) => s + c.credits, 0);
        scheduledFuture += credits;
      }

      const creditsStillNeeded = Math.max(0, remaining - scheduledFuture);

      let targetTerm: string | null = null;
      let remainingTermsToTarget: number | null = null;
      let creditsPerTermNeeded: number | null = null;

      if (input?.targetSeason && input?.targetYear) {
        const targetKey = termKey(input.targetSeason, Number(input.targetYear));
        targetTerm = `${input.targetSeason} ${input.targetYear}`;
        remainingTermsToTarget = Math.max(
          0,
          terms.filter((t) => {
            const k = termKey(t.season, t.year);
            return k >= currentKey && k <= targetKey;
          }).length
        );
        creditsPerTermNeeded = remainingTermsToTarget > 0
          ? Math.ceil(creditsStillNeeded / remainingTermsToTarget)
          : null;
      }

      const warnings: string[] = [];
      if (creditsPerTermNeeded != null && creditsPerTermNeeded > 18) {
        warnings.push(`Requires ${creditsPerTermNeeded} credits/term — above the recommended max of 18.`);
      }
      if (creditsStillNeeded === 0) {
        warnings.push("All remaining credits already appear to be scheduled.");
      }

      return {
        remainingCredits: remaining,
        alreadyScheduledCredits: scheduledFuture,
        creditsStillNeeded,
        remainingTerms: remainingTermsToTarget,
        creditsPerTermNeeded,
        targetTerm,
        realistic: creditsPerTermNeeded == null || creditsPerTermNeeded <= 18,
        warnings,
      };
    },

    async get_gen_ed_options(input?: GetGenEdOptionsInput) {
      const buckets = await deps.getGenEdOptions(
        input?.bucketName ?? null,
        input?.bucketId != null ? Number(input.bucketId) : null
      );
      return { buckets, total: buckets.length };
    },

    async find_courses_unlocked_by(input: FindCoursesUnlockedByInput) {
      const codes = (input.courseCodes ?? []).map((c) => normalizeCourseCode(c)).filter(Boolean);
      if (codes.length === 0) return { results: [], unresolvedCourseCodes: [] };

      const { resolvedIds, resolvedCodes, unresolvedCodes } = await deps.resolveCourseIdsByCodes(codes);
      if (resolvedIds.length === 0) return { results: [], unresolvedCourseCodes: unresolvedCodes };

      const dependentsMap = await deps.getDirectDependents(resolvedIds);
      const allDependentIds = Array.from(new Set(Array.from(dependentsMap.values()).flat()));
      const courseInfoMap = allDependentIds.length > 0 ? await deps.getCoursesByIds(allDependentIds) : new Map<number, AdvisorCourseSearchResult>();

      const results = resolvedIds.map((id, i) => {
        const directDeps = dependentsMap.get(id) ?? [];
        return {
          prereqCourseCode: resolvedCodes[i] ?? `course #${id}`,
          unlockedCourses: directDeps.map((depId) => {
            const info = courseInfoMap.get(depId);
            return {
              courseId: depId,
              courseCode: info?.courseCode ?? `course #${depId}`,
              title: info?.title ?? "",
              credits: info?.credits ?? 0,
            };
          }),
        };
      });

      return { results, unresolvedCourseCodes: unresolvedCodes };
    },

    async duplicate_plan(input: DuplicatePlanInput) {
      const newName = (input.newName ?? "").trim().slice(0, 100) || "Copy";
      try {
        const { planId, coursesCloned } = await deps.duplicatePlan(input.sourcePlanId, newName);
        return { success: true, newPlanId: planId, newName, coursesCloned };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Failed to duplicate plan." };
      }
    },

    async delete_plan(input: DeletePlanInput) {
      if (!input.confirm) {
        return { success: false, planId: input.planId, error: "Deletion requires confirm: true. Ask the student to explicitly confirm before deleting." };
      }

      // Guard: cannot delete the only remaining plan.
      const allPlans = await deps.listPlans();
      if (allPlans.length <= 1) {
        return {
          success: false,
          planId: input.planId,
          error: "Cannot delete your only plan. Create a new plan first, then delete this one.",
        };
      }

      try {
        await deps.deletePlan(input.planId);
        return { success: true, planId: input.planId };
      } catch (err) {
        return { success: false, planId: input.planId, error: err instanceof Error ? err.message : "Failed to delete plan." };
      }
    },

    async get_unfulfillable_requirements(input?: GetUnfulfillableRequirementsInput) {
      const planId = input?.planId ?? null;

      const [remaining, snapshot] = await Promise.all([
        deps.getRemainingRequirements(planId),
        deps.getPlanSnapshot(planId),
      ]);

      const unfulfillable: Array<{
        type: "missing_from_plan" | "prereq_violation" | "no_block_coverage";
        blockId?: number;
        blockName?: string;
        courseId?: number;
        courseCode?: string;
        message: string;
      }> = [];

      const plannedCourses = snapshot?.plannedCourses ?? [];
      const plannedCourseIds = new Set(plannedCourses.map((c) => c.courseId));

      // Build term ordering map (termId → sort key).
      const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
      const terms = snapshot?.terms ?? [];
      const termKey = new Map<number, number>();
      for (const t of terms) {
        termKey.set(t.id, t.year * 10 + (SEASON_ORDER[t.season] ?? 0));
      }

      // Per-block analysis.
      for (const block of remaining.blocks) {
        const blockCourseIds = new Set(block.remainingCourses.map((c) => c.id));
        const plannedInBlock = block.remainingCourses.filter((c) => plannedCourseIds.has(c.id));
        const unplannedInBlock = block.remainingCourses.filter((c) => !plannedCourseIds.has(c.id));

        // Flag courses that are required but missing from the plan entirely.
        for (const course of unplannedInBlock) {
          unfulfillable.push({
            type: "missing_from_plan",
            blockId: block.blockId,
            blockName: block.blockName,
            courseId: course.id,
            courseCode: course.courseCode,
            message: `${course.courseCode} is required for "${block.blockName}" but has not been added to the plan.`,
          });
        }

        // Flag block if NONE of its courses are planned.
        if (plannedInBlock.length === 0 && block.remainingCourses.length > 0) {
          unfulfillable.push({
            type: "no_block_coverage",
            blockId: block.blockId,
            blockName: block.blockName,
            message: `"${block.blockName}" has ${block.remainingCourses.length} unfulfilled requirement(s) and no courses are planned for it.`,
          });
        }

        // Suppress the per-course missing entries if we already emitted a block-level one
        // (they are redundant; keep only block-level for all-missing blocks).
        if (plannedInBlock.length === 0 && block.remainingCourses.length > 0) {
          // Remove the per-course entries we just added for this block.
          const redundant = new Set(block.remainingCourses.map((c) => c.id));
          for (let i = unfulfillable.length - 1; i >= 0; i -= 1) {
            const entry = unfulfillable[i];
            if (entry.type === "missing_from_plan" && entry.blockId === block.blockId && entry.courseId != null && redundant.has(entry.courseId)) {
              unfulfillable.splice(i, 1);
            }
          }
        }

        // Check prereq ordering for courses in this block that ARE planned.
        const allPlannedIds = Array.from(plannedCourseIds);
        if (allPlannedIds.length > 0) {
          const prereqMap = await deps.getCoursePrerequisites(
            plannedInBlock.map((c) => c.id)
          );

          for (const course of plannedInBlock) {
            const prereqDef = prereqMap.get(course.id);
            if (!prereqDef?.hasPrereqs) continue;

            const coursePlanned = plannedCourses.find((p) => p.courseId === course.id);
            if (!coursePlanned) continue;
            const courseKey = coursePlanned.termId != null ? (termKey.get(coursePlanned.termId) ?? Infinity) : Infinity;

            for (const reqId of prereqDef.requiredCourseIds) {
              // Prereq must be in history OR planned before this course.
              const prereqPlanned = plannedCourses.find((p) => p.courseId === reqId);
              if (!prereqPlanned) {
                // Not planned anywhere → prereq is missing, course is blocked.
                if (!blockCourseIds.has(reqId)) {
                  // Only flag if not already handled as missing_from_plan in a different block.
                  unfulfillable.push({
                    type: "prereq_violation",
                    blockId: block.blockId,
                    blockName: block.blockName,
                    courseId: course.id,
                    courseCode: course.courseCode,
                    message: `${course.courseCode} (in "${block.blockName}") is missing a prerequisite (course ID ${reqId}) that is not in the plan.`,
                  });
                }
              } else {
                const prereqKey = prereqPlanned.termId != null ? (termKey.get(prereqPlanned.termId) ?? Infinity) : Infinity;
                if (prereqKey >= courseKey) {
                  unfulfillable.push({
                    type: "prereq_violation",
                    blockId: block.blockId,
                    blockName: block.blockName,
                    courseId: course.id,
                    courseCode: course.courseCode,
                    message: `${course.courseCode} (in "${block.blockName}") is scheduled before or in the same term as its prerequisite (course ID ${reqId}).`,
                  });
                }
              }
            }
          }
        }
      }

      return {
        unfulfillable,
        totalCount: unfulfillable.length,
        canGraduate: unfulfillable.length === 0,
      };
    },

    async suggest_term_balance(input?: SuggestTermBalanceInput) {
      const planId = input?.planId ?? null;
      const threshold = Math.max(0.05, Math.min(Number(input?.threshold ?? 0.4), 1.0));

      const snapshot = await deps.getPlanSnapshot(planId);
      const terms = snapshot?.terms ?? [];
      const plannedCourses = snapshot?.plannedCourses ?? [];

      if (terms.length === 0) {
        return { averageCredits: 0, terms: [], outlierTerms: 0, suggestions: ["No terms in the plan yet."] };
      }

      // Tally credits per term.
      const creditsByTerm = new Map<number, number>();
      for (const t of terms) creditsByTerm.set(t.id, 0);
      for (const pc of plannedCourses) {
        if (pc.termId == null) continue;
        creditsByTerm.set(pc.termId, (creditsByTerm.get(pc.termId) ?? 0) + pc.credits);
      }

      const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
      const sortedTerms = [...terms].sort(
        (a, b) => a.year * 10 + (SEASON_ORDER[a.season] ?? 0) - (b.year * 10 + (SEASON_ORDER[b.season] ?? 0))
      );

      const creditValues = sortedTerms.map((t) => creditsByTerm.get(t.id) ?? 0);
      const totalCredits = creditValues.reduce((a, b) => a + b, 0);
      const averageCredits = totalCredits / sortedTerms.length;

      const termResults = sortedTerms.map((t, i) => {
        const tc = creditValues[i] ?? 0;
        const deviation = averageCredits > 0 ? (tc - averageCredits) / averageCredits : 0;
        let status: "balanced" | "overloaded" | "underloaded" = "balanced";
        if (deviation > threshold) status = "overloaded";
        else if (deviation < -threshold) status = "underloaded";
        return { season: t.season, year: t.year, totalCredits: tc, status, deviation: Math.round(deviation * 100) / 100 };
      });

      const outliers = termResults.filter((t) => t.status !== "balanced");

      const suggestions: string[] = [];
      for (const t of termResults) {
        if (t.status === "overloaded") {
          suggestions.push(`${t.season} ${t.year} has ${t.totalCredits} credits (${Math.round(t.deviation * 100)}% above average). Consider moving a course to a lighter term.`);
        } else if (t.status === "underloaded") {
          suggestions.push(`${t.season} ${t.year} has ${t.totalCredits} credits (${Math.round(Math.abs(t.deviation) * 100)}% below average). Consider adding a course here.`);
        }
      }
      if (suggestions.length === 0) suggestions.push("Term credit loads look balanced.");

      return {
        averageCredits: Math.round(averageCredits * 10) / 10,
        terms: termResults,
        outlierTerms: outliers.length,
        suggestions,
      };
    },

    async find_shortest_prereq_path(input: FindShortestPrereqPathInput) {
      const code = normalizeCourseCode(input.courseCode);
      const resolved = await deps.resolveCourseIdsByCodes([code]);
      const targetId = resolved.resolvedIds[0] ?? null;

      if (targetId == null) {
        return {
          targetCourseCode: code,
          targetCourseId: null,
          found: false,
          alreadyEligible: false,
          requiredFirst: [],
          minimumTermsNeeded: 0,
          message: `Course "${code}" was not found in the catalog.`,
        };
      }

      // Get completed courses.
      const history = await deps.getCourseHistory();
      const completedIds = new Set(history.map((h) => h.courseId));

      // BFS to collect all prerequisite courses not yet completed.
      const neededIds = new Set<number>();
      const queue = [targetId];
      const visited = new Set<number>([targetId]);

      while (queue.length > 0) {
        const batch = queue.splice(0, 20);
        const prereqMap = await deps.getCoursePrerequisites(batch);

        for (const courseId of batch) {
          const def = prereqMap.get(courseId);
          if (!def?.hasPrereqs) continue;

          for (const reqId of def.requiredCourseIds) {
            if (completedIds.has(reqId) || visited.has(reqId)) continue;
            visited.add(reqId);
            neededIds.add(reqId);
            queue.push(reqId);
          }
        }
      }

      const alreadyEligible = neededIds.size === 0;

      if (alreadyEligible) {
        return {
          targetCourseCode: code,
          targetCourseId: targetId,
          found: true,
          alreadyEligible: true,
          requiredFirst: [],
          minimumTermsNeeded: 1,
          message: `You already meet the prerequisites for ${code}. You can take it as soon as it is offered.`,
        };
      }

      // Get course info for needed courses.
      const courseMap = await deps.getCoursesByIds(Array.from(neededIds));
      const requiredFirst = Array.from(neededIds).map((id) => {
        const info = courseMap.get(id);
        return {
          courseId: id,
          courseCode: info?.courseCode ?? `Course ${id}`,
          title: info?.title ?? "",
          credits: info?.credits ?? 0,
        };
      });

      // Estimate minimum terms: each term can take one "level" of the prereq chain.
      // Simple approximation: depth of the prereq chain = minimum terms needed before target.
      // We already have a BFS-derived flat list; depth approximation = ceil(log2(N+1)) is naive.
      // Better: re-run BFS tracking max depth.
      const depthMap = new Map<number, number>();
      depthMap.set(targetId, 0);

      const depthQueue = [{ id: targetId, depth: 0 }];
      const depthVisited = new Set<number>([targetId]);

      while (depthQueue.length > 0) {
        const current = depthQueue.shift()!;
        const batch2 = [current.id];
        const prereqMap2 = await deps.getCoursePrerequisites(batch2);
        const def2 = prereqMap2.get(current.id);
        if (!def2?.hasPrereqs) continue;

        for (const reqId of def2.requiredCourseIds) {
          if (depthVisited.has(reqId)) continue;
          depthVisited.add(reqId);
          const d = current.depth + 1;
          depthMap.set(reqId, Math.max(depthMap.get(reqId) ?? 0, d));
          depthQueue.push({ id: reqId, depth: d });
        }
      }

      const maxDepth = Math.max(0, ...Array.from(depthMap.values()));
      // minimumTermsNeeded = chain depth (terms to satisfy prereqs) + 1 (term for the target itself).
      const minimumTermsNeeded = maxDepth + 1;

      return {
        targetCourseCode: code,
        targetCourseId: targetId,
        found: true,
        alreadyEligible: false,
        requiredFirst,
        minimumTermsNeeded,
        message: `To take ${code} you must first complete ${neededIds.size} prerequisite course(s). Minimum ${minimumTermsNeeded} term(s) needed (including the term you take ${code}).`,
      };
    },

    async find_common_requirements(input?: FindCommonRequirementsInput) {
      const profile = await deps.getStudentProfile();
      const programIds = (input?.programIds ?? []).length > 0
        ? (input!.programIds as number[])
        : profile.programs.map((p) => p.id);

      if (programIds.length === 0) {
        return { courses: [], totalDoubleCountable: 0 };
      }

      const blocks = await deps.getProgramRequirements(programIds);

      // Map: courseId → list of blocks it appears in.
      const courseBlockMap = new Map<number, Array<{ blockId: number; blockName: string; programId: number; programName: string }>>();

      for (const block of blocks) {
        for (const course of block.courses) {
          if (!courseBlockMap.has(course.courseId)) courseBlockMap.set(course.courseId, []);
          courseBlockMap.get(course.courseId)!.push({
            blockId: block.blockId,
            blockName: block.blockName,
            programId: block.programId,
            programName: block.programName,
          });
        }
      }

      // Only return courses that appear in 2+ blocks.
      const doubleCountable = Array.from(courseBlockMap.entries())
        .filter(([, bl]) => bl.length >= 2)
        .map(([courseId, bl]) => ({ courseId, blocks: bl }));

      if (doubleCountable.length === 0) {
        return { courses: [], totalDoubleCountable: 0 };
      }

      const courseIds = doubleCountable.map((entry) => entry.courseId);
      const courseInfoMap = await deps.getCoursesByIds(courseIds);

      const courses = doubleCountable
        .map((entry) => {
          const info = courseInfoMap.get(entry.courseId);
          return {
            courseId: entry.courseId,
            courseCode: info?.courseCode ?? `Course ${entry.courseId}`,
            title: info?.title ?? "",
            credits: info?.credits ?? 0,
            blocks: entry.blocks,
            blockCount: entry.blocks.length,
          };
        })
        .sort((a, b) => b.blockCount - a.blockCount || a.courseCode.localeCompare(b.courseCode));

      return { courses, totalDoubleCountable: courses.length };
    },

    async check_minor_completion(input: CheckMinorCompletionInput) {
      const [blocks, history] = await Promise.all([
        deps.getProgramRequirements([input.programId]),
        deps.getCourseHistory(),
      ]);

      const completedIds = new Set(history.map((h) => h.courseId));

      let totalRequirements = 0;
      let completedCount = 0;
      let completedCredits = 0;
      const remainingCourses: Array<{ courseId: number; courseCode: string; title: string; credits: number }> = [];

      // Use first block's programName for the program name.
      const programName = blocks[0]?.programName ?? `Program ${input.programId}`;

      for (const block of blocks) {
        for (const course of block.courses) {
          totalRequirements += 1;
          if (completedIds.has(course.courseId)) {
            completedCount += 1;
            completedCredits += course.credits;
          } else {
            remainingCourses.push({
              courseId: course.courseId,
              courseCode: course.courseCode,
              title: course.title,
              credits: course.credits,
            });
          }
        }
      }

      const percentComplete = totalRequirements > 0 ? Math.round((completedCount / totalRequirements) * 100) : 0;

      return {
        programId: input.programId,
        programName,
        totalRequirements,
        completedCount,
        completedCredits,
        remainingCourses,
        percentComplete,
      };
    },

    async check_double_major_overlap(input: CheckDoubleMajorOverlapInput) {
      const [blocks1, blocks2] = await Promise.all([
        deps.getProgramRequirements([input.programId1]),
        deps.getProgramRequirements([input.programId2]),
      ]);

      const name1 = blocks1[0]?.programName ?? `Program ${input.programId1}`;
      const name2 = blocks2[0]?.programName ?? `Program ${input.programId2}`;

      const courseMap1 = new Map<number, { courseCode: string; title: string; credits: number }>();
      const courseMap2 = new Map<number, { courseCode: string; title: string; credits: number }>();

      for (const block of blocks1) {
        for (const c of block.courses) courseMap1.set(c.courseId, { courseCode: c.courseCode, title: c.title, credits: c.credits });
      }
      for (const block of blocks2) {
        for (const c of block.courses) courseMap2.set(c.courseId, { courseCode: c.courseCode, title: c.title, credits: c.credits });
      }

      const overlapCourses: Array<{ courseId: number; courseCode: string; title: string; credits: number }> = [];
      for (const [id, info] of courseMap1) {
        if (courseMap2.has(id)) {
          overlapCourses.push({ courseId: id, ...info });
        }
      }

      const overlapIds = new Set(overlapCourses.map((c) => c.courseId));
      const overlapCredits = overlapCourses.reduce((sum, c) => sum + c.credits, 0);

      // Additional credits for second major = all of program2 credits minus what overlaps.
      let additionalCreditsForSecond = 0;
      for (const [id, info] of courseMap2) {
        if (!overlapIds.has(id)) additionalCreditsForSecond += info.credits;
      }

      const totalCredits1 = Array.from(courseMap1.values()).reduce((s, c) => s + c.credits, 0);
      const totalCredits2 = Array.from(courseMap2.values()).reduce((s, c) => s + c.credits, 0);

      return {
        program1: { id: input.programId1, name: name1, totalCourses: courseMap1.size, totalCredits: totalCredits1 },
        program2: { id: input.programId2, name: name2, totalCourses: courseMap2.size, totalCredits: totalCredits2 },
        overlapCourses,
        overlapCount: overlapCourses.length,
        overlapCredits,
        additionalCreditsForSecond,
      };
    },

    async generate_advising_summary(input?: GenerateAdvisingSummaryInput) {
      const planId = input?.planId ?? null;

      const [profile, progress, remaining, snapshot] = await Promise.all([
        deps.getStudentProfile(),
        deps.getDegreeProgress(planId),
        deps.getRemainingRequirements(planId, 10),
        deps.getPlanSnapshot(planId),
      ]);

      // Plan issues via lightweight validation.
      const planIssues: Array<{ type: string; message: string }> = [];
      const MAX_CREDITS = 18;
      const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
      const terms = snapshot?.terms ?? [];
      const plannedCourses = snapshot?.plannedCourses ?? [];

      // Check credit overloads.
      for (const term of terms) {
        const termCredits = plannedCourses.filter((c) => c.termId === term.id).reduce((s, c) => s + c.credits, 0);
        if (termCredits > MAX_CREDITS) {
          planIssues.push({ type: "credit_overload", message: `${term.season} ${term.year} has ${termCredits} credits (over the ${MAX_CREDITS}-credit limit).` });
        }
      }

      // Check past-due terms.
      const now = new Date();
      const currentKey = now.getFullYear() * 10 + (SEASON_ORDER[now.getMonth() + 1 <= 5 ? "Spring" : now.getMonth() + 1 <= 7 ? "Summer" : "Fall"] ?? 0);
      for (const term of terms) {
        const termKey = term.year * 10 + (SEASON_ORDER[term.season] ?? 0);
        if (termKey < currentKey && plannedCourses.some((c) => c.termId === term.id && c.status === "planned")) {
          planIssues.push({ type: "past_due_term", message: `${term.season} ${term.year} is in the past but still has planned (not completed) courses.` });
        }
      }

      // Upcoming requirements (blocks with remaining courses).
      const upcomingRequirements = remaining.blocks.slice(0, 5).map((block) => ({
        blockName: block.blockName,
        courses: block.remainingCourses.slice(0, 4).map((c) => `${c.courseCode} — ${c.title}`),
      }));

      // Plan gaps (blocks with no courses in the plan at all).
      const plannedIds = new Set(plannedCourses.map((c) => c.courseId));
      const planGaps = remaining.blocks
        .filter((block) => block.remainingCourses.every((c) => !plannedIds.has(c.id)))
        .map((block) => block.blockName)
        .slice(0, 5);

      // Open questions to raise with advisor.
      const openQuestions: string[] = [];
      if (planIssues.length > 0) openQuestions.push(`There are ${planIssues.length} plan issue(s) to review.`);
      if (planGaps.length > 0) openQuestions.push(`${planGaps.length} requirement block(s) have no courses planned.`);
      if (progress.overall.remainingCredits > 0 && terms.length === 0) openQuestions.push("No terms have been planned yet — when do you plan to start?");

      return {
        studentName: profile.fullName,
        programs: profile.programs.map((p) => `${p.name} (${p.programType})`),
        overallProgress: {
          completedCredits: progress.overall.completedCredits,
          remainingCredits: progress.overall.remainingCredits,
          percentage: progress.overall.percentage,
        },
        planIssues,
        upcomingRequirements,
        planGaps,
        openQuestions,
      };
    },

    async find_compatible_minors(input?: FindCompatibleMinorsInput) {
      const topN = Math.max(1, Math.min(Number(input?.topN ?? 5), 20));

      const [allMinors, history] = await Promise.all([
        deps.getAvailablePrograms("MINOR"),
        deps.getCourseHistory(),
      ]);

      if (allMinors.length === 0) {
        return { minors: [], topN };
      }

      const completedIds = new Set(history.map((h) => h.courseId));

      // For each minor, fetch its requirements and compute completion.
      const results: Array<{
        programId: number;
        programName: string;
        totalRequirements: number;
        alreadySatisfied: number;
        remaining: number;
        percentComplete: number;
      }> = [];

      // Batch-fetch requirements for all minors to avoid N+1.
      const allMinorIds = allMinors.map((m) => m.id);
      const blocks = await deps.getProgramRequirements(allMinorIds);

      // Group blocks by programId.
      const blocksByProgram = new Map<number, typeof blocks>();
      for (const block of blocks) {
        if (!blocksByProgram.has(block.programId)) blocksByProgram.set(block.programId, []);
        blocksByProgram.get(block.programId)!.push(block);
      }

      for (const minor of allMinors) {
        const minorBlocks = blocksByProgram.get(minor.id) ?? [];
        const totalCourses = new Set(minorBlocks.flatMap((b) => b.courses.map((c) => c.courseId)));
        const satisfied = Array.from(totalCourses).filter((id) => completedIds.has(id)).length;
        const total = totalCourses.size;

        results.push({
          programId: minor.id,
          programName: minor.name,
          totalRequirements: total,
          alreadySatisfied: satisfied,
          remaining: total - satisfied,
          percentComplete: total > 0 ? Math.round((satisfied / total) * 100) : 0,
        });
      }

      // Sort by remaining courses ascending (fewest left = most compatible).
      const sorted = results
        .filter((r) => r.totalRequirements > 0)
        .sort((a, b) => a.remaining - b.remaining || b.percentComplete - a.percentComplete)
        .slice(0, topN);

      return { minors: sorted, topN };
    },

    async suggest_course_substitutions(input: SuggestCourseSubstitutionsInput) {
      const code = normalizeCourseCode(input.courseCode);
      const resolved = await deps.resolveCourseIdsByCodes([code]);
      const targetId = resolved.resolvedIds[0] ?? null;

      if (targetId == null) {
        return {
          targetCourseCode: code,
          targetCourseId: null,
          blocks: [],
          notFound: true,
          message: `Course "${code}" was not found in the catalog.`,
        };
      }

      // Get the student's enrolled program IDs.
      const profile = await deps.getStudentProfile();
      const programIds = (input.programIds ?? []).length > 0
        ? (input.programIds as number[])
        : profile.programs.map((p) => p.id);

      if (programIds.length === 0) {
        return {
          targetCourseCode: code,
          targetCourseId: targetId,
          blocks: [],
          notFound: false,
          message: `No programs found. Please specify program IDs.`,
        };
      }

      // Find which blocks the target course belongs to.
      const allBlocks = await deps.getProgramRequirements(programIds);
      const matchingBlocks = allBlocks.filter((b) => b.courses.some((c) => c.courseId === targetId));

      if (matchingBlocks.length === 0) {
        return {
          targetCourseCode: code,
          targetCourseId: targetId,
          blocks: [],
          notFound: false,
          message: `${code} was found in the catalog but does not appear in any of the student's requirement blocks. No substitutions available.`,
        };
      }

      // For each block, return all other courses in the block as alternatives.
      const blockResults = matchingBlocks.map((block) => ({
        blockId: block.blockId,
        blockName: block.blockName,
        programName: block.programName,
        alternatives: block.courses
          .filter((c) => c.courseId !== targetId)
          .map((c) => ({ courseId: c.courseId, courseCode: c.courseCode, title: c.title, credits: c.credits })),
      }));

      const totalAlts = blockResults.reduce((s, b) => s + b.alternatives.length, 0);
      const msg = totalAlts > 0
        ? `Found ${totalAlts} alternative(s) for ${code} across ${matchingBlocks.length} requirement block(s).`
        : `${code} is the only course in its requirement block(s) — no substitutions are available.`;

      return {
        targetCourseCode: code,
        targetCourseId: targetId,
        blocks: blockResults,
        notFound: false,
        message: msg,
      };
    },

    async remove_student_program(input: RemoveStudentProgramInput) {
      if (!input.confirm) {
        return {
          success: false,
          programId: input.programId,
          error: "Removal requires confirm: true. First tell the student which program will be removed and ask them to explicitly confirm.",
        };
      }

      // Query student_programs JOIN programs directly (not via v_student_major_program which only returns MAJORs).
      const enrolled = await deps.getEnrolledProgramById(input.programId);
      if (!enrolled) {
        return {
          success: false,
          programId: input.programId,
          error: `You are not enrolled in program ID ${input.programId}. Use get_student_profile or get_available_programs to see valid programs.`,
        };
      }

      // Guard: cannot remove the last program.
      const programCount = await deps.getStudentProgramCount();
      if (programCount <= 1) {
        return {
          success: false,
          programId: input.programId,
          programName: enrolled.name,
          error: `Cannot remove "${enrolled.name}" — it is your only enrolled program. Add a replacement program first.`,
        };
      }

      try {
        const { plansUnlinked } = await deps.removeStudentProgram(input.programId);
        return { success: true, programId: input.programId, programName: enrolled.name, plansUnlinked };
      } catch (err) {
        return {
          success: false,
          programId: input.programId,
          programName: enrolled.name,
          error: err instanceof Error ? err.message : "Failed to remove program.",
        };
      }
    },

    async add_student_program(input: AddStudentProgramInput) {
      if (!input.confirm) {
        return {
          success: false,
          programId: input.programId,
          error: "Adding a program requires confirm: true. First show the student the program name and ask them to confirm.",
        };
      }

      // Check not already enrolled (handles all program types — no view filter).
      const existing = await deps.getEnrolledProgramById(input.programId);
      if (existing) {
        return {
          success: false,
          programId: input.programId,
          programName: existing.name,
          error: `You are already enrolled in "${existing.name}" (ID: ${input.programId}).`,
        };
      }

      // Verify the program exists in catalog — getAvailablePrograms with no filter returns all types.
      const allPrograms = await deps.getAvailablePrograms();
      const catalogEntry = allPrograms.find((p) => p.id === input.programId);
      if (!catalogEntry) {
        return {
          success: false,
          programId: input.programId,
          error: `Program ID ${input.programId} was not found in the catalog. Use get_available_programs to see valid programs.`,
        };
      }

      try {
        const result = await deps.addStudentProgram(input.programId);
        if (result.alreadyEnrolled) {
          return {
            success: false,
            programId: input.programId,
            programName: catalogEntry.name,
            error: `You are already enrolled in "${catalogEntry.name}".`,
          };
        }
        return { success: true, programId: input.programId, programName: catalogEntry.name };
      } catch (err) {
        return {
          success: false,
          programId: input.programId,
          error: err instanceof Error ? err.message : "Failed to add program.",
        };
      }
    },

    async remove_course_from_history(input: RemoveCourseFromHistoryInput) {
      if (!input.confirm) {
        return {
          success: false,
          courseCode: input.courseCode,
          error: "Removal requires confirm: true. Tell the student which course will be removed from their history and ask them to confirm.",
        };
      }

      const normalizedCode = normalizeCourseCode(input.courseCode);
      const { resolvedIds, unresolvedCodes } = await deps.resolveCourseIdsByCodes([normalizedCode]);
      if (unresolvedCodes.length > 0 || resolvedIds.length === 0) {
        return {
          success: false,
          courseCode: input.courseCode,
          error: `Course "${input.courseCode}" was not found in the course catalog.`,
        };
      }

      const courseId = resolvedIds[0]!;

      // Verify the course is actually in the student's history.
      const history = await deps.getCourseHistory();
      const inHistory = history.some((h) => h.courseId === courseId);
      if (!inHistory) {
        return {
          success: false,
          courseCode: normalizedCode,
          error: `${normalizedCode} is not in your course history.`,
        };
      }

      try {
        await deps.removeCourseFromHistory(courseId);
        return { success: true, courseCode: normalizedCode };
      } catch (err) {
        return {
          success: false,
          courseCode: normalizedCode,
          error: err instanceof Error ? err.message : "Failed to remove course from history.",
        };
      }
    },

    async update_course_history(input: UpdateCourseHistoryInput) {
      const normalizedCode = normalizeCourseCode(input.courseCode);
      const { resolvedIds, unresolvedCodes } = await deps.resolveCourseIdsByCodes([normalizedCode]);
      if (unresolvedCodes.length > 0 || resolvedIds.length === 0) {
        return {
          success: false,
          courseCode: input.courseCode,
          error: `Course "${input.courseCode}" was not found in the course catalog.`,
        };
      }

      const courseId = resolvedIds[0]!;

      const history = await deps.getCourseHistory();
      const inHistory = history.some((h) => h.courseId === courseId);
      if (!inHistory) {
        return {
          success: false,
          courseCode: normalizedCode,
          error: `${normalizedCode} is not in your course history.`,
        };
      }

      if (input.grade === undefined && input.completed === undefined) {
        return {
          success: false,
          courseCode: normalizedCode,
          error: "No updates provided. Specify grade, completed, or both.",
        };
      }

      try {
        await deps.updateCourseHistory(courseId, input.grade, input.completed);
        return { success: true, courseCode: normalizedCode, updated: true };
      } catch (err) {
        return {
          success: false,
          courseCode: normalizedCode,
          error: err instanceof Error ? err.message : "Failed to update course history.",
        };
      }
    },

    async project_graduation_date(input?: ProjectGraduationDateInput) {
      const planId = input?.planId ?? null;
      const creditsPerTerm = Math.max(1, Math.min(Number(input?.creditsPerTerm ?? 15), 21));

      const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
      const SEASON_NAMES = ["Spring", "Summer", "Fall"] as const;
      const termKey = (season: string, year: number) => year * 10 + (SEASON_ORDER[season] ?? 0);

      const now = new Date();
      const month = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const currentSeason = month <= 5 ? "Spring" : month <= 7 ? "Summer" : "Fall";
      const currentKey = termKey(currentSeason, currentYear);

      const [progress, snapshot] = await Promise.all([
        deps.getDegreeProgress(planId),
        deps.getPlanSnapshot(planId),
      ]);

      const remainingCredits = progress.overall.remainingCredits;

      // Sum future scheduled credits.
      const terms = snapshot?.terms ?? [];
      const plannedCourses = snapshot?.plannedCourses ?? [];
      let alreadyScheduledCredits = 0;
      let lastTermKey = currentKey;
      let lastSeason = currentSeason;
      let lastYear = currentYear;

      for (const term of terms) {
        const key = termKey(term.season, term.year);
        if (key < currentKey) continue;
        const credits = plannedCourses
          .filter((c) => c.termId === term.id)
          .reduce((s, c) => s + c.credits, 0);
        if (credits > 0) {
          alreadyScheduledCredits += credits;
          if (key > lastTermKey) {
            lastTermKey = key;
            lastSeason = term.season;
            lastYear = term.year;
          }
        }
      }

      const creditsStillNeeded = Math.max(0, remainingCredits - alreadyScheduledCredits);
      const termsNeeded = creditsStillNeeded > 0 ? Math.ceil(creditsStillNeeded / creditsPerTerm) : 0;

      // Advance from the last planned term (or start term input / current term).
      let projSeason = input?.startSeason ?? lastSeason;
      let projYear = input?.startYear ?? lastYear;

      // If still-needed credits > 0, project forward from last planned (or current) term.
      if (termsNeeded > 0) {
        let seasonIdx = SEASON_ORDER[projSeason] ?? 0;
        for (let t = 0; t < termsNeeded; t++) {
          seasonIdx += 1;
          if (seasonIdx > 2) { seasonIdx = 0; projYear += 1; }
        }
        projSeason = SEASON_NAMES[seasonIdx] ?? "Fall";
      }

      const warnings: string[] = [];
      if (creditsPerTerm > 18) warnings.push("A credits-per-term value above 18 may be unrealistic.");
      if (remainingCredits === 0) warnings.push("No remaining credits — you may already be done.");
      if (termsNeeded > 12) warnings.push("Projection spans more than 4 years; consider increasing credits per term.");

      return {
        projectedSeason: projSeason,
        projectedYear: projYear,
        remainingCredits,
        alreadyScheduledCredits,
        creditsStillNeeded,
        termsNeeded,
        creditsPerTerm,
        warnings,
      };
    },

    async check_term_credit_load(input?: CheckTermCreditLoadInput) {
      const planId = input?.planId ?? null;
      const maxCredits = Math.max(1, Number(input?.maxCredits ?? 18));
      const filterSeason = input?.season ?? null;
      const filterYear = input?.year != null ? Number(input.year) : null;

      const snapshot = await deps.getPlanSnapshot(planId);
      const terms = snapshot?.terms ?? [];
      const plannedCourses = snapshot?.plannedCourses ?? [];

      const result: Array<{
        season: string;
        year: number;
        totalCredits: number;
        courseCount: number;
        overloaded: boolean;
        courses: Array<{ courseCode: string; credits: number }>;
      }> = [];

      for (const term of terms) {
        if (filterSeason && term.season !== filterSeason) continue;
        if (filterYear != null && term.year !== filterYear) continue;

        const termCourses = plannedCourses.filter((c) => c.termId === term.id);
        const totalCredits = termCourses.reduce((s, c) => s + c.credits, 0);

        result.push({
          season: term.season,
          year: term.year,
          totalCredits,
          courseCount: termCourses.length,
          overloaded: totalCredits > maxCredits,
          courses: termCourses.map((c) => ({ courseCode: c.courseCode, credits: c.credits })),
        });
      }

      result.sort((a, b) => {
        const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
        return (a.year * 10 + (SEASON_ORDER[a.season] ?? 0)) - (b.year * 10 + (SEASON_ORDER[b.season] ?? 0));
      });

      return {
        terms: result,
        maxCredits,
        overloadedTerms: result.filter((t) => t.overloaded).length,
      };
    },

    async identify_plan_gaps(input?: IdentifyPlanGapsInput) {
      const planId = input?.planId ?? null;

      const [snapshot, remaining] = await Promise.all([
        deps.getPlanSnapshot(planId),
        deps.getRemainingRequirements(planId, 200),
      ]);

      const plannedIds = new Set((snapshot?.plannedCourses ?? []).map((c) => c.courseId));

      const gaps = remaining.blocks
        .map((block) => {
          const unplanned = block.remainingCourses.filter((c) => !plannedIds.has(c.id));
          return {
            blockId: block.blockId,
            blockName: block.blockName,
            unplannedCount: unplanned.length,
            unplannedCourses: unplanned.map((c) => ({
              courseId: c.id,
              courseCode: c.courseCode,
              title: c.title,
              credits: c.credits,
            })),
          };
        })
        .filter((gap) => gap.unplannedCount > 0);

      return {
        gaps,
        totalGapBlocks: gaps.length,
      };
    },

    async get_course_details(input: GetCourseDetailsInput) {
      const codes = (input.courseCodes ?? []).map((c) => normalizeCourseCode(c)).filter(Boolean);
      if (codes.length === 0) {
        return { courses: [], unresolvedCourseCodes: [] };
      }

      const { resolvedIds, unresolvedCodes } = await deps.resolveCourseIdsByCodes(codes);

      if (resolvedIds.length === 0) {
        return { courses: [], unresolvedCourseCodes: unresolvedCodes };
      }

      const detailMap = await deps.getCourseDetails(resolvedIds);
      const courses = resolvedIds
        .map((id) => detailMap.get(id))
        .filter((c): c is AdvisorCourseDetail => c !== undefined);

      return { courses, unresolvedCourseCodes: unresolvedCodes };
    },

    async rename_plan(input: RenamePlanInput) {
      const newName = (input.newName ?? "").trim().slice(0, 100);
      if (!newName) {
        return { success: false, planId: input.planId, newName: input.newName, error: "Plan name cannot be empty." };
      }

      try {
        await deps.renamePlan(input.planId, newName);
        return { success: true, planId: input.planId, newName };
      } catch (err) {
        return {
          success: false,
          planId: input.planId,
          newName,
          error: err instanceof Error ? err.message : "Failed to rename plan.",
        };
      }
    },

    async clear_plan_term(input: ClearPlanTermInput) {
      const season = input.season;
      const year = Number(input.year);

      const validSeasons = ["Fall", "Spring", "Summer"];
      if (!validSeasons.includes(season)) {
        return { success: false, season, year, coursesRemoved: 0, error: `Invalid season "${season}".` };
      }
      if (!Number.isFinite(year) || year < 2020 || year > 2040) {
        return { success: false, season, year, coursesRemoved: 0, error: `Invalid year: ${year}.` };
      }

      try {
        const { coursesRemoved } = await deps.clearPlanTerm(input.planId, season, year);
        return { success: true, season, year, coursesRemoved };
      } catch (err) {
        return {
          success: false,
          season,
          year,
          coursesRemoved: 0,
          error: err instanceof Error ? err.message : "Failed to clear term.",
        };
      }
    },
  };
}

type ClaudeToolDefinition = Anthropic.Messages.Tool;

const CLAUDE_TOOL_DEFINITIONS: ClaudeToolDefinition[] = [
  {
    name: TOOL_NAMES.getStudentProfile,
    description: "Get the student profile context, programs, and expected graduation information.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: TOOL_NAMES.getPlanSnapshot,
    description: "Get active plan terms, planned courses, and total planned credits.",
    input_schema: {
      type: "object" as const,
      properties: { planId: { type: "integer" as const, description: "Plan ID" } },
    },
  },
  {
    name: TOOL_NAMES.getDegreeProgress,
    description: "Get degree progress by requirement block and overall completion metrics.",
    input_schema: {
      type: "object" as const,
      properties: { planId: { type: "integer" as const, description: "Plan ID" } },
    },
  },
  {
    name: TOOL_NAMES.getRemainingRequirements,
    description: "Get remaining requirement courses grouped by block.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID" },
        limit: { type: "integer" as const, description: "Max courses to return" },
      },
    },
  },
  {
    name: TOOL_NAMES.checkCoursePrereqs,
    description: "Check whether a student can take specified courses and list unmet prerequisites.",
    input_schema: {
      type: "object" as const,
      properties: {
        courseIds: { type: "array" as const, items: { type: "integer" as const }, description: "Course IDs" },
        courseCodes: { type: "array" as const, items: { type: "string" as const }, description: "Course codes" },
      },
    },
  },
  {
    name: TOOL_NAMES.recommendNextSemester,
    description: "Recommend next-semester courses using requirement priority and prerequisite status.",
    input_schema: {
      type: "object" as const,
      properties: {
        targetCredits: { type: "number" as const, description: "Target credits" },
        planId: { type: "integer" as const, description: "Plan ID" },
      },
    },
  },
  {
    name: TOOL_NAMES.createPlan,
    description:
      "Create a new blank graduation plan for the student. Returns the new planId. Only call this when the student explicitly requests plan creation. Confirm the plan name first.",
    input_schema: {
      type: "object" as const,
      required: ["name"] as const,
      properties: {
        name: { type: "string" as const, description: "Plan name (max 100 chars)" },
        programIds: {
          type: "array" as const,
          items: { type: "integer" as const },
          description: "Program IDs to associate. Defaults to student's enrolled programs if omitted.",
        },
      },
    },
  },
  {
    name: TOOL_NAMES.addCourseToPlan,
    description:
      "Add a specific course to a term in an existing plan. Use after create_plan or when the student asks to add a course. Always verify the course exists via check_course_prereqs before adding.",
    input_schema: {
      type: "object" as const,
      required: ["planId", "courseCode", "season", "year"] as const,
      properties: {
        planId: { type: "integer" as const, description: "The plan ID to add the course to" },
        courseCode: { type: "string" as const, description: 'Course code, e.g. "CSCI 340"' },
        season: {
          type: "string" as const,
          enum: ["Fall", "Spring", "Summer"] as const,
          description: "Semester season",
        },
        year: { type: "integer" as const, description: "4-digit year, e.g. 2026" },
      },
    },
  },
  {
    name: TOOL_NAMES.removeCourseFromPlan,
    description:
      "Remove a specific course from a plan. Use when the student asks to delete or remove a course. Removes the course from all terms it appears in within the plan.",
    input_schema: {
      type: "object" as const,
      required: ["planId", "courseCode"] as const,
      properties: {
        planId: { type: "integer" as const, description: "The plan ID to remove the course from" },
        courseCode: { type: "string" as const, description: 'Course code to remove, e.g. "INTS 100"' },
      },
    },
  },
  {
    name: TOOL_NAMES.moveCourseInPlan,
    description:
      "Move a course already in the plan to a different term. Use when the student wants to reschedule a course to another semester.",
    input_schema: {
      type: "object" as const,
      required: ["planId", "courseCode", "toSeason", "toYear"] as const,
      properties: {
        planId: { type: "integer" as const, description: "The plan ID" },
        courseCode: { type: "string" as const, description: 'Course code to move, e.g. "CSCI 340"' },
        toSeason: {
          type: "string" as const,
          enum: ["Fall", "Spring", "Summer"] as const,
          description: "Target semester season",
        },
        toYear: { type: "integer" as const, description: "Target 4-digit year, e.g. 2027" },
      },
    },
  },
  {
    name: TOOL_NAMES.searchCourses,
    description:
      "Search the course catalog by keyword, title, or subject code. Use when the student asks about available courses or you need to discover courses before recommending them.",
    input_schema: {
      type: "object" as const,
      required: ["query"] as const,
      properties: {
        query: { type: "string" as const, description: "Search text — matches course title, subject code, or course number" },
        subject: { type: "string" as const, description: 'Optional subject filter, e.g. "CSCI" or "MATH"' },
        limit: { type: "integer" as const, description: "Max results to return (default 15, max 25)" },
      },
    },
  },
  {
    name: TOOL_NAMES.listPlans,
    description:
      "List all of the student's graduation plans with name, total planned credits, and last updated date. Use when the student asks what plans they have, or before operations that need a plan ID.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: TOOL_NAMES.getCourseHistory,
    description:
      "Return the student's course history with grades, completion status, and term taken. Use when the student asks what courses they have taken, their GPA inputs, courses by department, or highest-level courses completed. Supports optional filters.",
    input_schema: {
      type: "object" as const,
      properties: {
        subject: { type: "string" as const, description: 'Filter by subject code, e.g. "CSCI" or "MATH"' },
        completedOnly: { type: "boolean" as const, description: "If true, only return completed courses (excludes in-progress)" },
        minLevel: { type: "integer" as const, description: "Minimum course level, e.g. 300 to only return 300+ level courses" },
      },
    },
  },
  {
    name: TOOL_NAMES.getCoursePrerequisites,
    description:
      "Return the prerequisite requirements for one or more courses as defined in the catalog — independent of whether the student meets them. Use this when the student asks what a course requires, not whether they qualify.",
    input_schema: {
      type: "object" as const,
      required: ["courseCodes"] as const,
      properties: {
        courseCodes: {
          type: "array" as const,
          items: { type: "string" as const },
          description: 'List of course codes to look up, e.g. ["CIS 570", "CSCI 340"]',
        },
      },
    },
  },
  {
    name: TOOL_NAMES.checkGraduationReadiness,
    description:
      "Check whether the student is on track to graduate. Compares remaining required credits against credits already scheduled in future terms. Use when the student asks if they are on track or when to graduate.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID to evaluate (defaults to active plan)" },
        targetGradSemester: {
          type: "string" as const,
          enum: ["Fall", "Spring", "Summer"] as const,
          description: "Override target graduation season",
        },
        targetGradYear: { type: "integer" as const, description: "Override target graduation year" },
      },
    },
  },
  {
    name: TOOL_NAMES.validatePlan,
    description:
      "Validate a graduation plan for structural issues: prerequisite ordering violations, term credit overloads (>18 credits), unplanned requirement blocks, and courses left in past terms. Returns a list of errors and warnings. Use when the student asks to review or validate their plan.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID to validate (defaults to active plan)" },
      },
    },
  },
  {
    name: TOOL_NAMES.getProgramRequirements,
    description:
      "Return the complete requirement block structure for one or more degree programs: all blocks, the completion rule (ALL_OF / N_OF / ANY_OF / CREDITS_OF), required credit counts, and the specific courses in each block. Use when the student asks what their degree requires in full, or what courses are in a specific requirement block.",
    input_schema: {
      type: "object" as const,
      properties: {
        programIds: {
          type: "array" as const,
          items: { type: "integer" as const },
          description: "Program IDs to fetch requirements for. Defaults to the student's enrolled programs.",
        },
      },
    },
  },
  {
    name: TOOL_NAMES.findCoursesSatisfyingBlock,
    description:
      "Given a requirement block name, return all courses that count toward it — including already-completed ones. Use when the student asks 'what can I take for my X requirement?' or 'what courses satisfy the social science elective block?'.",
    input_schema: {
      type: "object" as const,
      required: ["blockName"] as const,
      properties: {
        blockName: {
          type: "string" as const,
          description: "Name of the requirement block to look up, e.g. \"Major Core\" or \"Social Sciences Elective\"",
        },
        programIds: {
          type: "array" as const,
          items: { type: "integer" as const },
          description: "Program IDs to search within. Defaults to the student's enrolled programs.",
        },
      },
    },
  },
  {
    name: TOOL_NAMES.getFullPrereqChain,
    description:
      "Recursively expand the full prerequisite tree for one or more courses, tracing all the way back to courses with no prerequisites. Use when the student asks 'where do I start to eventually take X?' or 'what is the full prerequisite path for X?'. Marks already-completed courses in the chain.",
    input_schema: {
      type: "object" as const,
      required: ["courseCodes"] as const,
      properties: {
        courseCodes: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "Course codes to trace the full prereq chain for, e.g. [\"CIS 570\"]",
        },
      },
    },
  },
  {
    name: TOOL_NAMES.projectGraduationDate,
    description:
      "Estimate when the student will finish all degree requirements based on how many credits they plan to take per term. Accounts for already-scheduled credits in the plan and projects forward to fill the remaining gap. Use when the student asks 'when will I graduate?' or 'how long will it take to finish?'.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID to use for already-scheduled credits (defaults to active plan)" },
        creditsPerTerm: { type: "number" as const, description: "Credits per term to assume for unscheduled remaining credits (default 15)" },
        startSeason: {
          type: "string" as const,
          enum: ["Fall", "Spring", "Summer"] as const,
          description: "Override the starting season for the projection (defaults to last planned term or current term)",
        },
        startYear: { type: "integer" as const, description: "Override the starting year for the projection" },
      },
    },
  },
  {
    name: TOOL_NAMES.checkTermCreditLoad,
    description:
      "Return the total planned credits for each term in the active plan and flag terms over a configurable limit (default 18). Optionally filter to a single term. Use when the student asks how many credits they have planned in a specific semester, or when checking if a term is overloaded.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID (defaults to active plan)" },
        season: { type: "string" as const, enum: ["Fall", "Spring", "Summer"] as const, description: "Filter to a specific season" },
        year: { type: "integer" as const, description: "Filter to a specific year" },
        maxCredits: { type: "integer" as const, description: "Credit threshold for overload flag (default 18)" },
      },
    },
  },
  {
    name: TOOL_NAMES.identifyPlanGaps,
    description:
      "List every degree requirement block that has remaining courses with none of them currently planned. Unlike get_remaining_requirements (which lists all outstanding courses), this focuses on blocks where no planning has started at all. Use when the student asks which requirements they haven't started planning for.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID to check (defaults to active plan)" },
      },
    },
  },
  {
    name: TOOL_NAMES.getCourseDetails,
    description:
      "Return full catalog metadata for one or more courses: description, prerequisite text, credits, and whether the course is active. Use when the student asks for details about a course they're considering.",
    input_schema: {
      type: "object" as const,
      required: ["courseCodes"] as const,
      properties: {
        courseCodes: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "Course codes to look up, e.g. [\"CIS 570\", \"CSCI 340\"]",
        },
      },
    },
  },
  {
    name: TOOL_NAMES.renamePlan,
    description:
      "Rename an existing graduation plan. Use when the student asks to rename or update the name of a plan. Confirm the new name with the student before calling.",
    input_schema: {
      type: "object" as const,
      required: ["planId", "newName"] as const,
      properties: {
        planId: { type: "integer" as const, description: "The plan ID to rename" },
        newName: { type: "string" as const, description: "The new plan name (max 100 characters)" },
      },
    },
  },
  {
    name: TOOL_NAMES.clearPlanTerm,
    description:
      "Remove all courses from a specific term in a plan at once. Use when the student wants to clear out a semester and start over. Confirm before calling — this removes all planned courses for that term.",
    input_schema: {
      type: "object" as const,
      required: ["planId", "season", "year"] as const,
      properties: {
        planId: { type: "integer" as const, description: "The plan ID" },
        season: {
          type: "string" as const,
          enum: ["Fall", "Spring", "Summer"] as const,
          description: "Season of the term to clear",
        },
        year: { type: "integer" as const, description: "4-digit year of the term to clear, e.g. 2026" },
      },
    },
  },
  {
    name: TOOL_NAMES.getPlanWarnings,
    description:
      "Return a quick list of structural warnings for the active plan: overloaded terms and courses still in past terms. Lighter-weight than validate_plan — no prereq analysis. Use for ambient status checks.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID (defaults to active plan)" },
        maxCredits: { type: "integer" as const, description: "Credit threshold to flag as overloaded (default 18)" },
      },
    },
  },
  {
    name: TOOL_NAMES.findPrereqBottlenecks,
    description:
      "Identify which unmet prerequisite courses are blocking the most downstream degree requirements. Use when the student asks which courses they should prioritize to unlock the most options.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID context (defaults to active plan)" },
        topN: { type: "integer" as const, description: "Number of bottleneck courses to return (default 10, max 25)" },
      },
    },
  },
  {
    name: TOOL_NAMES.checkRegistrationEligibility,
    description:
      "For a specific term, determine which of the student's planned courses they are currently eligible to register for (prereqs met) vs. not yet eligible for (prereqs unmet). Defaults to the current term.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID (defaults to active plan)" },
        season: { type: "string" as const, enum: ["Fall", "Spring", "Summer"] as const, description: "Target semester season" },
        year: { type: "integer" as const, description: "Target semester year" },
      },
    },
  },
  {
    name: TOOL_NAMES.estimateCreditsPerTermNeeded,
    description:
      "Given a target graduation term, compute how many credits per remaining semester the student needs to average to finish on time. Alerts if the required pace exceeds 18 credits/term.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID (defaults to active plan)" },
        targetSeason: { type: "string" as const, enum: ["Fall", "Spring", "Summer"] as const, description: "Target graduation season" },
        targetYear: { type: "integer" as const, description: "Target graduation year" },
      },
    },
  },
  {
    name: TOOL_NAMES.getGenEdOptions,
    description:
      "List all courses that satisfy a general education requirement bucket. Use when the student asks 'what can I take for my gen-ed X requirement?' or 'what counts toward my math requirement?'.",
    input_schema: {
      type: "object" as const,
      properties: {
        bucketName: { type: "string" as const, description: "Partial gen-ed bucket name to search for, e.g. \"Math\" or \"Writing\"" },
        bucketId: { type: "integer" as const, description: "Exact gen-ed bucket ID if known" },
      },
    },
  },
  {
    name: TOOL_NAMES.findCoursesUnlockedBy,
    description:
      "Given a course the student has completed or plans to complete, return all courses that become directly available as a result (reverse prereq lookup). Use when the student asks 'what does completing X unlock?' or 'what can I take after X?'.",
    input_schema: {
      type: "object" as const,
      required: ["courseCodes"] as const,
      properties: {
        courseCodes: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "Course codes whose direct dependents should be looked up, e.g. [\"CSCI 240\"]",
        },
      },
    },
  },
  {
    name: TOOL_NAMES.duplicatePlan,
    description:
      "Copy an existing graduation plan (all terms and courses) into a new plan with a given name. Enables what-if branching — the original plan is not modified. Use when the student wants to try an alternate course sequence without losing their current plan.",
    input_schema: {
      type: "object" as const,
      required: ["sourcePlanId", "newName"] as const,
      properties: {
        sourcePlanId: { type: "integer" as const, description: "Plan ID to copy" },
        newName: { type: "string" as const, description: "Name for the new duplicate plan" },
      },
    },
  },
  {
    name: TOOL_NAMES.deletePlan,
    description:
      "Permanently delete a graduation plan and all its courses. This is irreversible. Requires confirm: true — always ask the student to explicitly confirm before calling.",
    input_schema: {
      type: "object" as const,
      required: ["planId", "confirm"] as const,
      properties: {
        planId: { type: "integer" as const, description: "The plan ID to delete" },
        confirm: { type: "boolean" as const, description: "Must be true — student must confirm deletion before this is called" },
      },
    },
  },
  {
    name: TOOL_NAMES.getUnfulfillableRequirements,
    description:
      "Analyze the current plan and return every degree requirement that cannot be completed before graduation: required courses missing from the plan, blocks with nothing planned, and courses scheduled before their prerequisites. Use when the student asks what they're missing, what's blocking graduation, or wants to know if their plan is completable.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID to analyze. Omit to use the active plan." },
      },
    },
  },
  {
    name: TOOL_NAMES.suggestTermBalance,
    description:
      "Analyze all terms in a plan and flag outliers — terms with significantly more or fewer credits than the student's average planned load. Returns suggestions for which terms to rebalance.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID to analyze. Omit to use the active plan." },
        threshold: { type: "number" as const, description: "Fraction deviation from average before a term is flagged. Default 0.4 (40%)." },
      },
    },
  },
  {
    name: TOOL_NAMES.findShortestPrereqPath,
    description:
      "Given a target course the student wants to reach, compute the minimum number of semesters required to satisfy its entire prerequisite chain given what the student has already completed.",
    input_schema: {
      type: "object" as const,
      required: ["courseCode"] as const,
      properties: {
        courseCode: { type: "string" as const, description: 'Target course code, e.g. "CIS 570"' },
      },
    },
  },
  {
    name: TOOL_NAMES.findCommonRequirements,
    description:
      "Identify courses that count toward multiple requirement blocks simultaneously (double-dipping). Helps students maximize the efficiency of every course they take.",
    input_schema: {
      type: "object" as const,
      properties: {
        programIds: {
          type: "array" as const,
          items: { type: "integer" as const },
          description: "Program IDs to check. Omit to use the student's enrolled programs.",
        },
      },
    },
  },
  {
    name: TOOL_NAMES.suggestCourseSubstitutions,
    description:
      "If a required course is unavailable or the student can't take it, suggest catalog alternatives that satisfy the same requirement block. Use when a student asks 'what else can I take instead of X?'",
    input_schema: {
      type: "object" as const,
      required: ["courseCode"] as const,
      properties: {
        courseCode: { type: "string" as const, description: 'The course the student cannot take, e.g. "CSCI 340"' },
        programIds: {
          type: "array" as const,
          items: { type: "integer" as const },
          description: "Program IDs to check. Omit to use the student's enrolled programs.",
        },
      },
    },
  },
  {
    name: TOOL_NAMES.findCompatibleMinors,
    description:
      "Given the student's course history and current plan, find which available minors they could complete with the fewest additional courses. Use when a student wants to explore adding a minor without extending their timeline.",
    input_schema: {
      type: "object" as const,
      properties: {
        topN: { type: "integer" as const, description: "Return top N most compatible minors. Default 5, max 20." },
      },
    },
  },
  {
    name: TOOL_NAMES.checkMinorCompletion,
    description:
      "Given a specific minor program ID, compute how many of its requirements the student has already satisfied and what remains. Use when the student asks how close they are to completing a minor.",
    input_schema: {
      type: "object" as const,
      required: ["programId"] as const,
      properties: {
        programId: { type: "integer" as const, description: "The program ID of the minor to evaluate" },
      },
    },
  },
  {
    name: TOOL_NAMES.checkDoubleMajorOverlap,
    description:
      "Given two program IDs, compute how many courses overlap (count toward both), how many credits are unique to each, and how many total additional credits the second major would require beyond the first. Use when students ask about adding a second major.",
    input_schema: {
      type: "object" as const,
      required: ["programId1", "programId2"] as const,
      properties: {
        programId1: { type: "integer" as const, description: "The first program ID (typically the student's current major)" },
        programId2: { type: "integer" as const, description: "The second program ID to compare" },
      },
    },
  },
  {
    name: TOOL_NAMES.generateAdvisingSummary,
    description:
      "Produce a structured summary of the student's academic situation: overall progress, plan issues, upcoming requirements, and open questions for their advisor. Use before an advising appointment or when the student wants a full status overview.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID to summarize. Omit to use the active plan." },
      },
    },
  },
  {
    name: TOOL_NAMES.removeStudentProgram,
    description:
      "Permanently remove a degree program from the student's enrollment record. This is irreversible. Before calling, use get_student_profile to confirm the program name, tell the student exactly which program will be removed, and require explicit confirmation. Requires confirm: true.",
    input_schema: {
      type: "object" as const,
      required: ["programId", "confirm"] as const,
      properties: {
        programId: { type: "integer" as const, description: "The program ID to remove from the student's enrollment" },
        confirm: { type: "boolean" as const, description: "Must be true — the student must explicitly confirm the removal before this is called" },
      },
    },
  },
  {
    name: TOOL_NAMES.addCourseToHistory,
    description:
      "Log a course directly to the student's academic history without navigating to the history tab. Use when the student says they have already taken a course and wants it recorded. Ask for the grade if they know it.",
    input_schema: {
      type: "object" as const,
      required: ["courseCode", "season", "year"] as const,
      properties: {
        courseCode: { type: "string" as const, description: 'Course code, e.g. "CSCI 340"' },
        season: {
          type: "string" as const,
          enum: ["Fall", "Spring", "Summer"] as const,
          description: "Season the course was taken",
        },
        year: { type: "integer" as const, description: "4-digit year the course was taken, e.g. 2024" },
        grade: { type: "string" as const, description: 'Letter grade, e.g. "A", "B+". Optional.' },
        completed: { type: "boolean" as const, description: "Whether the course is completed (true) or in-progress (false). Defaults to true." },
      },
    },
  },
  {
    name: TOOL_NAMES.addStudentProgram,
    description:
      "Enroll the student in an additional degree program (major, minor, certificate). Use get_available_programs first to find valid program IDs. Before calling, show the student the program name and require explicit confirmation. Requires confirm: true.",
    input_schema: {
      type: "object" as const,
      required: ["programId", "confirm"] as const,
      properties: {
        programId: { type: "integer" as const, description: "The program ID to add to the student's enrollment" },
        confirm: { type: "boolean" as const, description: "Must be true — the student must explicitly confirm before this is called" },
      },
    },
  },
  {
    name: TOOL_NAMES.removeCourseFromHistory,
    description:
      "Remove a course from the student's academic history. Use when the student says a course was logged by mistake or they want to correct their record. Before calling, tell the student which course will be removed and require explicit confirmation. Requires confirm: true.",
    input_schema: {
      type: "object" as const,
      required: ["courseCode", "confirm"] as const,
      properties: {
        courseCode: { type: "string" as const, description: 'Course code to remove, e.g. "CSCI 340"' },
        confirm: { type: "boolean" as const, description: "Must be true — the student must explicitly confirm the removal before this is called" },
      },
    },
  },
  {
    name: TOOL_NAMES.updateCourseHistory,
    description:
      "Update the grade or completion status of a course already in the student's history. Use when the student wants to correct a grade or mark a course as completed/in-progress.",
    input_schema: {
      type: "object" as const,
      required: ["courseCode"] as const,
      properties: {
        courseCode: { type: "string" as const, description: 'Course code to update, e.g. "CSCI 340"' },
        grade: { type: "string" as const, description: 'New letter grade, e.g. "A", "B+". Pass null to clear.' },
        completed: { type: "boolean" as const, description: "Set to true if the course is completed, false if in-progress." },
      },
    },
  },
];

const CATALOG_TOOL_NAMES = new Set<string>([
  TOOL_NAMES.searchCourses,
  TOOL_NAMES.getCourseDetails,
  TOOL_NAMES.getCoursePrerequisites,
  TOOL_NAMES.getFullPrereqChain,
  TOOL_NAMES.findShortestPrereqPath,
  TOOL_NAMES.findCoursesUnlockedBy,
  TOOL_NAMES.getProgramRequirements,
  TOOL_NAMES.findCoursesSatisfyingBlock,
  TOOL_NAMES.findCommonRequirements,
  TOOL_NAMES.getGenEdOptions,
  TOOL_NAMES.checkDoubleMajorOverlap,
]);

const CATALOG_TOOL_DEFINITIONS = CLAUDE_TOOL_DEFINITIONS.filter(
  (def) => CATALOG_TOOL_NAMES.has(def.name)
);

async function runClaudeToolCalling(args: {
  message: string;
  history: AdvisorChatHistoryItem[];
  profile: AdvisorStudentProfile;
  activePlanId?: number | null;
  activePlanName?: string | null;
  toolDefinitions?: typeof CLAUDE_TOOL_DEFINITIONS;
  executeTool: (name: AdvisorToolName, toolArgs: Record<string, unknown>) => Promise<ToolExecutionResult>;
  onSideEffect: (effect: AdvisorSideEffect) => void;
}): Promise<AdvisorChatResponse | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

  const systemPrompt = buildSystemPrompt({
    promptVersion: PROMPT_VERSION,
    studentName: args.profile.fullName,
    primaryProgram: args.profile.primaryProgram?.name ?? null,
    catalogYear: args.profile.primaryProgram?.catalogYear ?? null,
    expectedGraduation: args.profile.expectedGraduation,
    hasCompletedOnboarding: args.profile.hasCompletedOnboarding,
    activePlanName: args.activePlanName ?? null,
  });

  const messages: Anthropic.Messages.MessageParam[] = [
    ...args.history.slice(-8).map((item) => ({
      role: item.role as "user" | "assistant",
      content: item.text,
    })),
    { role: "user" as const, content: args.message },
  ];

  const maxTurns = 20;
  for (let turn = 0; turn < maxTurns; turn += 1) {
    const response = await client.messages.create({
      model,
      max_tokens: 5000,
      system: `${systemPrompt}\n\nReturn strict JSON with keys: answer, recommendations, risks, missingData, citations.`,
      tools: args.toolDefinitions ?? CLAUDE_TOOL_DEFINITIONS,
      messages,
    });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      const textBlock = response.content.find(
        (block): block is Anthropic.Messages.TextBlock => block.type === "text"
      );
      const content = textBlock?.text ?? "";
      const parsed = normalizeAdvisorResponse(tryParseJson(content));
      if (parsed) return parsed;
      return makeFallbackResponse(
        content || "I could not safely parse a structured response. Please ask your question again."
      );
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const toolInput = (toolUse.input as Record<string, unknown>) ?? {};
      const toolName = toolUse.name as AdvisorToolName;

      // Inject activePlanId for plan-scoped tools when not explicitly provided.
      if (
        args.activePlanId !== undefined &&
        args.activePlanId !== null &&
        (toolName === TOOL_NAMES.getPlanSnapshot ||
          toolName === TOOL_NAMES.getDegreeProgress ||
          toolName === TOOL_NAMES.getRemainingRequirements ||
          toolName === TOOL_NAMES.recommendNextSemester) &&
        !toolInput.planId
      ) {
        toolInput.planId = args.activePlanId;
      }

      const toolResult = await args.executeTool(toolName, toolInput);

      // Detect plan creation side effects.
      if (
        toolName === TOOL_NAMES.createPlan &&
        toolResult.ok &&
        toolResult.data &&
        typeof toolResult.data === "object"
      ) {
        const data = toolResult.data as Record<string, unknown>;
        if (typeof data.planId === "number" && typeof data.name === "string") {
          args.onSideEffect({ type: "plan_created", planId: data.planId, planName: data.name });
        }
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(toolResult),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return makeFallbackResponse("I could not complete tool execution safely in time. Please try again.");
}

async function runDeterministicAdvisor(args: {
  message: string;
  activePlanId?: number | null;
  executeTool: (name: AdvisorToolName, toolArgs: Record<string, unknown>) => Promise<ToolExecutionResult>;
}): Promise<AdvisorChatResponse> {
  const intent = classifyIntent(args.message);

  if (intent === "prereq") {
    const detectedCodes = extractCourseCodes(args.message);
    if (detectedCodes.length === 0) {
      return makeFallbackResponse(
        "I can check prerequisite status, but I need a specific course code (for example, CSCI 340)."
      );
    }

    const prereqResult = await args.executeTool(TOOL_NAMES.checkCoursePrereqs, {
      courseCodes: detectedCodes,
    });
    if (!prereqResult.ok) {
      return makeFallbackResponse(
        "I could not run prerequisite checks right now. Please try again."
      );
    }

    const data = prereqResult.data as {
      results: Array<{ courseCode: string; unlocked: boolean; summary: string[] }>;
      unresolvedCourseCodes: string[];
    };

    const lines = data.results.map((row) =>
      row.unlocked
        ? `${row.courseCode}: prerequisites look satisfied.`
        : `${row.courseCode}: not unlocked (${row.summary.join("; ") || "missing prerequisite data"}).`
    );

    const unresolvedText =
      data.unresolvedCourseCodes.length > 0
        ? ` I could not match: ${data.unresolvedCourseCodes.join(", ")}.`
        : "";

    const risks = data.results
      .filter((row) => !row.unlocked)
      .map((row) => `${row.courseCode}: ${row.summary.join("; ") || "Prerequisites not met."}`);

    return {
      answer: `${lines.join(" ")}${unresolvedText}`,
      recommendations: [],
      risks,
      missingData: [],
      citations: [`tool:${TOOL_NAMES.checkCoursePrereqs}`],
    };
  }

  if (intent === "remaining") {
    const remainingResult = await args.executeTool(TOOL_NAMES.getRemainingRequirements, {
      planId: args.activePlanId ?? null,
      limit: 20,
    });
    if (!remainingResult.ok) {
      return makeFallbackResponse(
        "I could not load remaining requirements right now. Please try again."
      );
    }

    const data = remainingResult.data as AdvisorRemainingRequirements;
    const blockSummaries = data.blocks
      .slice(0, 3)
      .map(
        (block) =>
          `${block.blockName}: ${block.remainingCourses
            .slice(0, 3)
            .map((course) => course.courseCode)
            .join(", ")}`
      );

    const answer =
      blockSummaries.length > 0
        ? `You have ${data.totalRemainingCourses} remaining requirement courses. ${blockSummaries.join(" | ")}`
        : "I did not find remaining courses in your current requirement scope.";

    return {
      answer,
      recommendations: [],
      risks: [],
      missingData: [],
      citations: [`tool:${TOOL_NAMES.getRemainingRequirements}`],
    };
  }

  if (intent === "next_semester") {
    const recommendedResult = await args.executeTool(TOOL_NAMES.recommendNextSemester, {
      targetCredits: 15,
      planId: args.activePlanId ?? null,
    });
    if (!recommendedResult.ok) {
      return makeFallbackResponse(
        "I could not generate next-semester recommendations right now. Please try again."
      );
    }

    const data = recommendedResult.data as {
      targetCredits: number;
      totalRecommendedCredits: number;
      recommendations: Array<{
        courseCode: string;
        reason: string;
        confidence: AdvisorConfidence;
      }>;
      risks: string[];
    };

    const recommendations = data.recommendations.map((item) => ({
      courseCode: item.courseCode,
      reason: item.reason,
      confidence: item.confidence,
    }));

    const answer =
      recommendations.length > 0
        ? `I recommend ${recommendations.length} courses totaling ${data.totalRecommendedCredits} credits (target: ${data.targetCredits}).`
        : "I could not find confident recommendations from current data.";

    return {
      answer,
      recommendations,
      risks: data.risks,
      missingData: [],
      citations: [`tool:${TOOL_NAMES.recommendNextSemester}`],
    };
  }

  if (intent === "progress") {
    const progressResult = await args.executeTool(TOOL_NAMES.getDegreeProgress, {
      planId: args.activePlanId ?? null,
    });
    if (!progressResult.ok) {
      return makeFallbackResponse("I could not load your progress summary right now.");
    }

    const data = progressResult.data as AdvisorDegreeProgress;
    const answer = `You are ${data.overall.percentage}% complete (${data.overall.completedCredits} completed + ${data.overall.inProgressCredits} in progress out of ${data.overall.totalCreditsRequired} required credits).`;

    return {
      answer,
      recommendations: [],
      risks: [],
      missingData: [],
      citations: [`tool:${TOOL_NAMES.getDegreeProgress}`],
    };
  }

  return {
    answer:
      "I'm not certain what you want yet. I can help with next-semester planning, remaining requirements, prerequisite checks, graduation progress, and creating or building out your graduation plan. What should I check first?",
    recommendations: [],
    risks: [],
    missingData: [],
    citations: [],
  };
}

async function executeToolByName(
  toolset: AdvisorToolset,
  toolName: AdvisorToolName,
  toolArgs: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case TOOL_NAMES.getStudentProfile:
      return toolset.get_student_profile();
    case TOOL_NAMES.getPlanSnapshot:
      return toolset.get_plan_snapshot(toolArgs as GetPlanScopedInput);
    case TOOL_NAMES.getDegreeProgress:
      return toolset.get_degree_progress(toolArgs as GetPlanScopedInput);
    case TOOL_NAMES.getRemainingRequirements:
      return toolset.get_remaining_requirements(toolArgs as GetRemainingRequirementsInput);
    case TOOL_NAMES.checkCoursePrereqs:
      return toolset.check_course_prereqs(toolArgs as CheckCoursePrereqsInput);
    case TOOL_NAMES.recommendNextSemester:
      return toolset.recommend_next_semester(toolArgs as RecommendNextSemesterInput);
    case TOOL_NAMES.createPlan:
      return toolset.create_plan(toolArgs as CreatePlanInput);
    case TOOL_NAMES.addCourseToPlan:
      return toolset.add_course_to_plan(toolArgs as AddCourseToPlanInput);
    case TOOL_NAMES.removeCourseFromPlan:
      return toolset.remove_course_from_plan(toolArgs as RemoveCourseFromPlanInput);
    case TOOL_NAMES.moveCourseInPlan:
      return toolset.move_course_in_plan(toolArgs as MoveCourseInPlanInput);
    case TOOL_NAMES.searchCourses:
      return toolset.search_courses(toolArgs as SearchCoursesInput);
    case TOOL_NAMES.checkGraduationReadiness:
      return toolset.check_graduation_readiness(toolArgs as CheckGraduationReadinessInput);
    case TOOL_NAMES.getCoursePrerequisites:
      return toolset.get_course_prerequisites(toolArgs as GetCoursePrerequisitesInput);
    case TOOL_NAMES.getCourseHistory:
      return toolset.get_course_history(toolArgs as GetCourseHistoryInput);
    case TOOL_NAMES.listPlans:
      return toolset.list_plans();
    case TOOL_NAMES.validatePlan:
      return toolset.validate_plan(toolArgs as ValidatePlanInput);
    case TOOL_NAMES.getProgramRequirements:
      return toolset.get_program_requirements(toolArgs as GetProgramRequirementsInput);
    case TOOL_NAMES.findCoursesSatisfyingBlock:
      return toolset.find_courses_satisfying_block(toolArgs as FindCoursesSatisfyingBlockInput);
    case TOOL_NAMES.getFullPrereqChain:
      return toolset.get_full_prereq_chain(toolArgs as GetFullPrereqChainInput);
    case TOOL_NAMES.projectGraduationDate:
      return toolset.project_graduation_date(toolArgs as ProjectGraduationDateInput);
    case TOOL_NAMES.checkTermCreditLoad:
      return toolset.check_term_credit_load(toolArgs as CheckTermCreditLoadInput);
    case TOOL_NAMES.identifyPlanGaps:
      return toolset.identify_plan_gaps(toolArgs as IdentifyPlanGapsInput);
    case TOOL_NAMES.getCourseDetails:
      return toolset.get_course_details(toolArgs as GetCourseDetailsInput);
    case TOOL_NAMES.renamePlan:
      return toolset.rename_plan(toolArgs as RenamePlanInput);
    case TOOL_NAMES.clearPlanTerm:
      return toolset.clear_plan_term(toolArgs as ClearPlanTermInput);
    case TOOL_NAMES.addCourseToHistory:
      return toolset.add_course_to_history(toolArgs as AddCourseToHistoryInput);
    case TOOL_NAMES.getPlanWarnings:
      return toolset.get_plan_warnings(toolArgs as GetPlanWarningsInput);
    case TOOL_NAMES.findPrereqBottlenecks:
      return toolset.find_prereq_bottlenecks(toolArgs as FindPrereqBottlenecksInput);
    case TOOL_NAMES.checkRegistrationEligibility:
      return toolset.check_registration_eligibility(toolArgs as CheckRegistrationEligibilityInput);
    case TOOL_NAMES.estimateCreditsPerTermNeeded:
      return toolset.estimate_credits_per_term_needed(toolArgs as EstimateCreditsPerTermNeededInput);
    case TOOL_NAMES.getGenEdOptions:
      return toolset.get_gen_ed_options(toolArgs as GetGenEdOptionsInput);
    case TOOL_NAMES.findCoursesUnlockedBy:
      return toolset.find_courses_unlocked_by(toolArgs as FindCoursesUnlockedByInput);
    case TOOL_NAMES.duplicatePlan:
      return toolset.duplicate_plan(toolArgs as DuplicatePlanInput);
    case TOOL_NAMES.deletePlan:
      return toolset.delete_plan(toolArgs as DeletePlanInput);
    case TOOL_NAMES.getUnfulfillableRequirements:
      return toolset.get_unfulfillable_requirements(toolArgs as GetUnfulfillableRequirementsInput);
    case TOOL_NAMES.suggestTermBalance:
      return toolset.suggest_term_balance(toolArgs as SuggestTermBalanceInput);
    case TOOL_NAMES.findShortestPrereqPath:
      return toolset.find_shortest_prereq_path(toolArgs as FindShortestPrereqPathInput);
    case TOOL_NAMES.findCommonRequirements:
      return toolset.find_common_requirements(toolArgs as FindCommonRequirementsInput);
    case TOOL_NAMES.checkMinorCompletion:
      return toolset.check_minor_completion(toolArgs as CheckMinorCompletionInput);
    case TOOL_NAMES.checkDoubleMajorOverlap:
      return toolset.check_double_major_overlap(toolArgs as CheckDoubleMajorOverlapInput);
    case TOOL_NAMES.generateAdvisingSummary:
      return toolset.generate_advising_summary(toolArgs as GenerateAdvisingSummaryInput);
    case TOOL_NAMES.findCompatibleMinors:
      return toolset.find_compatible_minors(toolArgs as FindCompatibleMinorsInput);
    case TOOL_NAMES.suggestCourseSubstitutions:
      return toolset.suggest_course_substitutions(toolArgs as SuggestCourseSubstitutionsInput);
    case TOOL_NAMES.removeStudentProgram:
      return toolset.remove_student_program(toolArgs as RemoveStudentProgramInput);
    case TOOL_NAMES.addStudentProgram:
      return toolset.add_student_program(toolArgs as AddStudentProgramInput);
    case TOOL_NAMES.removeCourseFromHistory:
      return toolset.remove_course_from_history(toolArgs as RemoveCourseFromHistoryInput);
    case TOOL_NAMES.updateCourseHistory:
      return toolset.update_course_history(toolArgs as UpdateCourseHistoryInput);
    default:
      throw new Error(`Unknown tool requested: ${toolName}`);
  }
}

export interface GenerateAdvisorResponseInput {
  message: string;
  history: AdvisorChatHistoryItem[];
  activePlanId?: number | null;
  activePlanName?: string | null;
  profile: AdvisorStudentProfile;
  dependencies: AdvisorToolDependencies;
  toolDefinitions?: typeof CLAUDE_TOOL_DEFINITIONS;
}

export async function generateAdvisorResponse(
  input: GenerateAdvisorResponseInput
): Promise<AdvisorChatResponse> {
  const toolset = createAdvisorTools(input.dependencies);
  const usedCitations = new Set<string>();
  const missingData = new Set<string>();
  const sideEffects: AdvisorSideEffect[] = [];

  const executeTool = async (
    toolName: AdvisorToolName,
    toolArgs: Record<string, unknown>
  ): Promise<ToolExecutionResult> => {
    try {
      const data = await executeToolByName(toolset, toolName, toolArgs);
      usedCitations.add(`tool:${toolName}`);
      return { ok: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed";
      missingData.add(`${toolName}: ${message}`);
      return { ok: false, error: message };
    }
  };

  let response: AdvisorChatResponse | null = null;
  try {
    response = await runClaudeToolCalling({
      message: input.message,
      history: input.history,
      profile: input.profile,
      activePlanId: input.activePlanId ?? null,
      activePlanName: input.activePlanName ?? null,
      toolDefinitions: input.toolDefinitions,
      executeTool,
      onSideEffect: (effect) => sideEffects.push(effect),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claude API call failed";
    missingData.add(`claude: ${message}`);
  }

  if (!response) {
    response = await runDeterministicAdvisor({
      message: input.message,
      activePlanId: input.activePlanId ?? null,
      executeTool,
    });
  }

  return {
    ...response,
    risks: dedupeStrings(response.risks),
    missingData: dedupeStrings([...response.missingData, ...Array.from(missingData)]),
    citations: dedupeStrings([...response.citations, ...Array.from(usedCitations)]),
    recommendations: response.recommendations.slice(0, 8),
    sideEffects: sideEffects.length > 0 ? sideEffects : undefined,
  };
}

export {
  CLAUDE_TOOL_DEFINITIONS,
  CATALOG_TOOL_DEFINITIONS,
  executeToolByName,
  normalizeAdvisorResponse,
  tryParseJson,
  makeFallbackResponse,
  TOOL_NAMES as ADVISOR_TOOL_NAMES,
};
