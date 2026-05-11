import "server-only";

import {
  evaluatePrereqsForCourses,
  fetchPrereqDefinitions,
  type PrereqEvaluationMap,
  type PrereqDefinitionMap,
} from "@/lib/prereq";
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
import type { AdvisorPlanSummary } from "@/types/ai-advisor";

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
