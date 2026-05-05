import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, PROMPT_VERSION } from "@/lib/ai-advisor/prompt";
import type {
  AdvisorCourseDetail,
  AdvisorCourseHistoryEntry,
  AdvisorCourseSearchResult,
  AdvisorDegreeProgress,
  AdvisorGenEdBucket,
  AdvisorPlanSnapshot,
  AdvisorRemainingRequirements,
  AdvisorRequirementBlock,
  AdvisorStudentProfile,
} from "@/lib/ai-advisor/data";
import type {
  AdvisorChatHistoryItem,
  AdvisorChatResponse,
  AdvisorConfidence,
  AdvisorPlanSummary,
  AdvisorSideEffect,
} from "@/types/ai-advisor";

// Shared
import { TOOL_NAMES } from "./shared/names";
import type { AdvisorToolName } from "./shared/names";
import type { AdvisorToolDependencies } from "./shared/dependencies";
import { createAdvisorToolDependencies } from "./shared/dependencies";
import type { AdvisorDependencyContext } from "./shared/dependencies";
import { dedupeStrings, extractCourseCodes, tryParseJson } from "./shared/utils";
import { normalizeAdvisorResponse, makeFallbackResponse, classifyIntent } from "./shared/response";

// Batch A — simple read tools
import { createGetStudentProfileTool, GET_STUDENT_PROFILE_DEFINITION } from "./get-student-profile";
import { createGetPlanSnapshotTool, GET_PLAN_SNAPSHOT_DEFINITION } from "./get-plan-snapshot";
import type { GetPlanSnapshotInput } from "./get-plan-snapshot";
import { createGetDegreeProgressTool, GET_DEGREE_PROGRESS_DEFINITION } from "./get-degree-progress";
import type { GetDegreeProgressInput } from "./get-degree-progress";
import { createGetRemainingRequirementsTool, GET_REMAINING_REQUIREMENTS_DEFINITION } from "./get-remaining-requirements";
import type { GetRemainingRequirementsInput } from "./get-remaining-requirements";
import { createSearchCoursesTool, SEARCH_COURSES_DEFINITION } from "./search-courses";
import type { SearchCoursesInput } from "./search-courses";
import { createGetCourseHistoryTool, GET_COURSE_HISTORY_DEFINITION } from "./get-course-history";
import type { GetCourseHistoryInput } from "./get-course-history";
import { createListPlansTool, LIST_PLANS_DEFINITION } from "./list-plans";
import { createGetProgramRequirementsTool, GET_PROGRAM_REQUIREMENTS_DEFINITION } from "./get-program-requirements";
import type { GetProgramRequirementsInput } from "./get-program-requirements";
import { createGetGenEdOptionsTool, GET_GEN_ED_OPTIONS_DEFINITION } from "./get-gen-ed-options";
import type { GetGenEdOptionsInput } from "./get-gen-ed-options";
import { createRenamePlanTool, RENAME_PLAN_DEFINITION } from "./rename-plan";
import type { RenamePlanInput } from "./rename-plan";
import { createClearPlanTermTool, CLEAR_PLAN_TERM_DEFINITION } from "./clear-plan-term";
import type { ClearPlanTermInput } from "./clear-plan-term";

// Batch B — util-using tools
import { createCheckCoursePrereqsTool, CHECK_COURSE_PREREQS_DEFINITION } from "./check-course-prereqs";
import type { CheckCoursePrereqsInput } from "./check-course-prereqs";
import { createRecommendNextSemesterTool, RECOMMEND_NEXT_SEMESTER_DEFINITION } from "./recommend-next-semester";
import type { RecommendNextSemesterInput } from "./recommend-next-semester";
import { createGetCourseDetailsTool, GET_COURSE_DETAILS_DEFINITION } from "./get-course-details";
import type { GetCourseDetailsInput } from "./get-course-details";
import { createGetCoursePrerequisitesTool, GET_COURSE_PREREQUISITES_DEFINITION } from "./get-course-prerequisites";
import type { GetCoursePrerequisitesInput } from "./get-course-prerequisites";
import { createGetFullPrereqChainTool, GET_FULL_PREREQ_CHAIN_DEFINITION } from "./get-full-prereq-chain";
import type { GetFullPrereqChainInput } from "./get-full-prereq-chain";
import { createFindCoursesUnlockedByTool, FIND_COURSES_UNLOCKED_BY_DEFINITION } from "./find-courses-unlocked-by";
import type { FindCoursesUnlockedByInput } from "./find-courses-unlocked-by";
import { createFindCoursesSatisfyingBlockTool, FIND_COURSES_SATISFYING_BLOCK_DEFINITION } from "./find-courses-satisfying-block";
import type { FindCoursesSatisfyingBlockInput } from "./find-courses-satisfying-block";
import { createAddCourseToHistoryTool, ADD_COURSE_TO_HISTORY_DEFINITION } from "./add-course-to-history";
import type { AddCourseToHistoryInput } from "./add-course-to-history";

// Batch C — plan mutation tools
import { createCreatePlanTool, CREATE_PLAN_DEFINITION } from "./create-plan";
import type { CreatePlanInput } from "./create-plan";
import { createAddCourseToPlanTool, ADD_COURSE_TO_PLAN_DEFINITION } from "./add-course-to-plan";
import type { AddCourseToPlanInput } from "./add-course-to-plan";
import { createRemoveCourseFromPlanTool, REMOVE_COURSE_FROM_PLAN_DEFINITION } from "./remove-course-from-plan";
import type { RemoveCourseFromPlanInput } from "./remove-course-from-plan";
import { createMoveCourseInPlanTool, MOVE_COURSE_IN_PLAN_DEFINITION } from "./move-course-in-plan";
import type { MoveCourseInPlanInput } from "./move-course-in-plan";
import { createDuplicatePlanTool, DUPLICATE_PLAN_DEFINITION } from "./duplicate-plan";
import type { DuplicatePlanInput } from "./duplicate-plan";
import { createDeletePlanTool, DELETE_PLAN_DEFINITION } from "./delete-plan";
import type { DeletePlanInput } from "./delete-plan";
import { createRemoveStudentProgramTool, REMOVE_STUDENT_PROGRAM_DEFINITION } from "./remove-student-program";
import type { RemoveStudentProgramInput } from "./remove-student-program";
import { createAddStudentProgramTool, ADD_STUDENT_PROGRAM_DEFINITION } from "./add-student-program";
import type { AddStudentProgramInput } from "./add-student-program";
import { createRemoveCourseFromHistoryTool, REMOVE_COURSE_FROM_HISTORY_DEFINITION } from "./remove-course-from-history";
import type { RemoveCourseFromHistoryInput } from "./remove-course-from-history";
import { createUpdateCourseHistoryTool, UPDATE_COURSE_HISTORY_DEFINITION } from "./update-course-history";
import type { UpdateCourseHistoryInput } from "./update-course-history";

// Batch D — complex analysis tools
import { createValidatePlanTool, VALIDATE_PLAN_DEFINITION } from "./validate-plan";
import type { ValidatePlanInput } from "./validate-plan";
import { createCheckGraduationReadinessTool, CHECK_GRADUATION_READINESS_DEFINITION } from "./check-graduation-readiness";
import type { CheckGraduationReadinessInput } from "./check-graduation-readiness";
import { createProjectGraduationDateTool, PROJECT_GRADUATION_DATE_DEFINITION } from "./project-graduation-date";
import type { ProjectGraduationDateInput } from "./project-graduation-date";
import { createCheckTermCreditLoadTool, CHECK_TERM_CREDIT_LOAD_DEFINITION } from "./check-term-credit-load";
import type { CheckTermCreditLoadInput } from "./check-term-credit-load";
import { createIdentifyPlanGapsTool, IDENTIFY_PLAN_GAPS_DEFINITION } from "./identify-plan-gaps";
import type { IdentifyPlanGapsInput } from "./identify-plan-gaps";
import { createGetPlanWarningsTool, GET_PLAN_WARNINGS_DEFINITION } from "./get-plan-warnings";
import type { GetPlanWarningsInput } from "./get-plan-warnings";
import { createFindPrereqBottlenecksTool, FIND_PREREQ_BOTTLENECKS_DEFINITION } from "./find-prereq-bottlenecks";
import type { FindPrereqBottlenecksInput } from "./find-prereq-bottlenecks";
import { createCheckRegistrationEligibilityTool, CHECK_REGISTRATION_ELIGIBILITY_DEFINITION } from "./check-registration-eligibility";
import type { CheckRegistrationEligibilityInput } from "./check-registration-eligibility";
import { createEstimateCreditsPerTermNeededTool, ESTIMATE_CREDITS_PER_TERM_NEEDED_DEFINITION } from "./estimate-credits-per-term-needed";
import type { EstimateCreditsPerTermNeededInput } from "./estimate-credits-per-term-needed";
import { createGetUnfulfillableRequirementsTool, GET_UNFULFILLABLE_REQUIREMENTS_DEFINITION } from "./get-unfulfillable-requirements";
import type { GetUnfulfillableRequirementsInput } from "./get-unfulfillable-requirements";
import { createSuggestTermBalanceTool, SUGGEST_TERM_BALANCE_DEFINITION } from "./suggest-term-balance";
import type { SuggestTermBalanceInput } from "./suggest-term-balance";
import { createFindShortestPrereqPathTool, FIND_SHORTEST_PREREQ_PATH_DEFINITION } from "./find-shortest-prereq-path";
import type { FindShortestPrereqPathInput } from "./find-shortest-prereq-path";
import { createFindCommonRequirementsTool, FIND_COMMON_REQUIREMENTS_DEFINITION } from "./find-common-requirements";
import type { FindCommonRequirementsInput } from "./find-common-requirements";
import { createCheckMinorCompletionTool, CHECK_MINOR_COMPLETION_DEFINITION } from "./check-minor-completion";
import type { CheckMinorCompletionInput } from "./check-minor-completion";
import { createCheckDoubleMajorOverlapTool, CHECK_DOUBLE_MAJOR_OVERLAP_DEFINITION } from "./check-double-major-overlap";
import type { CheckDoubleMajorOverlapInput } from "./check-double-major-overlap";
import { createGenerateAdvisingSummaryTool, GENERATE_ADVISING_SUMMARY_DEFINITION } from "./generate-advising-summary";
import type { GenerateAdvisingSummaryInput } from "./generate-advising-summary";
import { createFindCompatibleMinorsTool, FIND_COMPATIBLE_MINORS_DEFINITION } from "./find-compatible-minors";
import type { FindCompatibleMinorsInput } from "./find-compatible-minors";
import { createSuggestCourseSubstitutionsTool, SUGGEST_COURSE_SUBSTITUTIONS_DEFINITION } from "./suggest-course-substitutions";
import type { SuggestCourseSubstitutionsInput } from "./suggest-course-substitutions";

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
  get_plan_snapshot: (input?: GetPlanSnapshotInput) => Promise<AdvisorPlanSnapshot | null>;
  get_degree_progress: (input?: GetDegreeProgressInput) => Promise<AdvisorDegreeProgress>;
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
    get_student_profile: createGetStudentProfileTool(deps),
    get_plan_snapshot: createGetPlanSnapshotTool(deps),
    get_degree_progress: createGetDegreeProgressTool(deps),
    get_remaining_requirements: createGetRemainingRequirementsTool(deps),
    check_course_prereqs: createCheckCoursePrereqsTool(deps),
    recommend_next_semester: createRecommendNextSemesterTool(deps),
    create_plan: createCreatePlanTool(deps),
    add_course_to_plan: createAddCourseToPlanTool(deps),
    remove_course_from_plan: createRemoveCourseFromPlanTool(deps),
    move_course_in_plan: createMoveCourseInPlanTool(deps),
    search_courses: createSearchCoursesTool(deps),
    check_graduation_readiness: createCheckGraduationReadinessTool(deps),
    get_course_prerequisites: createGetCoursePrerequisitesTool(deps),
    get_course_history: createGetCourseHistoryTool(deps),
    list_plans: createListPlansTool(deps),
    validate_plan: createValidatePlanTool(deps),
    get_program_requirements: createGetProgramRequirementsTool(deps),
    find_courses_satisfying_block: createFindCoursesSatisfyingBlockTool(deps),
    get_full_prereq_chain: createGetFullPrereqChainTool(deps),
    project_graduation_date: createProjectGraduationDateTool(deps),
    check_term_credit_load: createCheckTermCreditLoadTool(deps),
    identify_plan_gaps: createIdentifyPlanGapsTool(deps),
    get_course_details: createGetCourseDetailsTool(deps),
    rename_plan: createRenamePlanTool(deps),
    clear_plan_term: createClearPlanTermTool(deps),
    add_course_to_history: createAddCourseToHistoryTool(deps),
    get_plan_warnings: createGetPlanWarningsTool(deps),
    find_prereq_bottlenecks: createFindPrereqBottlenecksTool(deps),
    check_registration_eligibility: createCheckRegistrationEligibilityTool(deps),
    estimate_credits_per_term_needed: createEstimateCreditsPerTermNeededTool(deps),
    get_gen_ed_options: createGetGenEdOptionsTool(deps),
    find_courses_unlocked_by: createFindCoursesUnlockedByTool(deps),
    duplicate_plan: createDuplicatePlanTool(deps),
    delete_plan: createDeletePlanTool(deps),
    get_unfulfillable_requirements: createGetUnfulfillableRequirementsTool(deps),
    suggest_term_balance: createSuggestTermBalanceTool(deps),
    find_shortest_prereq_path: createFindShortestPrereqPathTool(deps),
    find_common_requirements: createFindCommonRequirementsTool(deps),
    check_minor_completion: createCheckMinorCompletionTool(deps),
    check_double_major_overlap: createCheckDoubleMajorOverlapTool(deps),
    generate_advising_summary: createGenerateAdvisingSummaryTool(deps),
    find_compatible_minors: createFindCompatibleMinorsTool(deps),
    suggest_course_substitutions: createSuggestCourseSubstitutionsTool(deps),
    remove_student_program: createRemoveStudentProgramTool(deps),
    add_student_program: createAddStudentProgramTool(deps),
    remove_course_from_history: createRemoveCourseFromHistoryTool(deps),
    update_course_history: createUpdateCourseHistoryTool(deps),
  };
}

export const CLAUDE_TOOL_DEFINITIONS = ([
  GET_STUDENT_PROFILE_DEFINITION,
  GET_PLAN_SNAPSHOT_DEFINITION,
  GET_DEGREE_PROGRESS_DEFINITION,
  GET_REMAINING_REQUIREMENTS_DEFINITION,
  CHECK_COURSE_PREREQS_DEFINITION,
  RECOMMEND_NEXT_SEMESTER_DEFINITION,
  CREATE_PLAN_DEFINITION,
  ADD_COURSE_TO_PLAN_DEFINITION,
  REMOVE_COURSE_FROM_PLAN_DEFINITION,
  MOVE_COURSE_IN_PLAN_DEFINITION,
  SEARCH_COURSES_DEFINITION,
  CHECK_GRADUATION_READINESS_DEFINITION,
  GET_COURSE_PREREQUISITES_DEFINITION,
  GET_COURSE_HISTORY_DEFINITION,
  LIST_PLANS_DEFINITION,
  VALIDATE_PLAN_DEFINITION,
  GET_PROGRAM_REQUIREMENTS_DEFINITION,
  FIND_COURSES_SATISFYING_BLOCK_DEFINITION,
  GET_FULL_PREREQ_CHAIN_DEFINITION,
  PROJECT_GRADUATION_DATE_DEFINITION,
  CHECK_TERM_CREDIT_LOAD_DEFINITION,
  IDENTIFY_PLAN_GAPS_DEFINITION,
  GET_COURSE_DETAILS_DEFINITION,
  RENAME_PLAN_DEFINITION,
  CLEAR_PLAN_TERM_DEFINITION,
  ADD_COURSE_TO_HISTORY_DEFINITION,
  GET_PLAN_WARNINGS_DEFINITION,
  FIND_PREREQ_BOTTLENECKS_DEFINITION,
  CHECK_REGISTRATION_ELIGIBILITY_DEFINITION,
  ESTIMATE_CREDITS_PER_TERM_NEEDED_DEFINITION,
  GET_GEN_ED_OPTIONS_DEFINITION,
  FIND_COURSES_UNLOCKED_BY_DEFINITION,
  DUPLICATE_PLAN_DEFINITION,
  DELETE_PLAN_DEFINITION,
  GET_UNFULFILLABLE_REQUIREMENTS_DEFINITION,
  SUGGEST_TERM_BALANCE_DEFINITION,
  FIND_SHORTEST_PREREQ_PATH_DEFINITION,
  FIND_COMMON_REQUIREMENTS_DEFINITION,
  CHECK_MINOR_COMPLETION_DEFINITION,
  CHECK_DOUBLE_MAJOR_OVERLAP_DEFINITION,
  GENERATE_ADVISING_SUMMARY_DEFINITION,
  FIND_COMPATIBLE_MINORS_DEFINITION,
  SUGGEST_COURSE_SUBSTITUTIONS_DEFINITION,
  REMOVE_STUDENT_PROGRAM_DEFINITION,
  ADD_STUDENT_PROGRAM_DEFINITION,
  REMOVE_COURSE_FROM_HISTORY_DEFINITION,
  UPDATE_COURSE_HISTORY_DEFINITION,
] as unknown as Anthropic.Messages.Tool[]);

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

export const CATALOG_TOOL_DEFINITIONS = CLAUDE_TOOL_DEFINITIONS.filter(
  (def) => CATALOG_TOOL_NAMES.has(def.name)
);

export async function executeToolByName(
  toolset: AdvisorToolset,
  toolName: AdvisorToolName,
  toolArgs: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case TOOL_NAMES.getStudentProfile:
      return toolset.get_student_profile();
    case TOOL_NAMES.getPlanSnapshot:
      return toolset.get_plan_snapshot(toolArgs as GetPlanSnapshotInput);
    case TOOL_NAMES.getDegreeProgress:
      return toolset.get_degree_progress(toolArgs as GetDegreeProgressInput);
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

export { TOOL_NAMES, type AdvisorToolName } from "./shared/names";
export type { AdvisorToolDependencies, AdvisorDependencyContext } from "./shared/dependencies";
export { createAdvisorToolDependencies } from "./shared/dependencies";
export { normalizeAdvisorResponse, makeFallbackResponse } from "./shared/response";
export { tryParseJson } from "./shared/utils";
export { TOOL_NAMES as ADVISOR_TOOL_NAMES } from "./shared/names";
