import type { Course } from "@/types/course";
import type { RequirementBlockWithCourses } from "@/types/planner";
import type { BreadthPackage } from "@/types/planner";
import { isBreadthBlock, getPackageCourseKeys, courseKey } from "@/types/planner";
import type {
  AutoGenerateOptions,
  AutoGenerateResult,
  GenEdBucketWithCourses,
  ValidationResult,
} from "@/types/auto-generate";

import {
  fetchAvailableCourses,
  fetchCompletedCourseIds,
  fetchGenEdBucketsWithCourses,
  fetchCourseOfferings,
  fetchStudentTerms,
  fetchPlannedCourses,
  createPlan,
  fetchPlanPrograms,
  batchSavePlanCourses,
  fetchCrossListings,
} from "@/lib/supabase/queries/planner";

import { extractPrereqEdges } from "./prereq-graph";
import {
  selectCoursesForBlock,
  resolveGenEdGaps,
  computeTopologicalLevels,
  scheduleCourses,
  fillExistingPlan,
  buildAvailabilityMap,
} from "./auto-generate";
import { validatePlan } from "./validate-plan";

export type ProgressCallback = (message: string) => void;

const DEFAULT_CREDIT_CAP = 15;

const EMPTY_VALIDATION: ValidationResult = {
  valid: true,
  issues: [],
  blockStatuses: [],
  genEdStatuses: [],
  unscheduledCourses: [],
};

type PlanContext = { planId: number };

type GenerationInputs = {
  blocks: RequirementBlockWithCourses[];
  completedIds: Set<number>;
  genEdBuckets: GenEdBucketWithCourses[];
  existingTerms: Awaited<ReturnType<typeof fetchStudentTerms>>;
  existingCourses: Awaited<ReturnType<typeof fetchPlannedCourses>>;
};

type SchedulingArtifacts = {
  prereqEdges: Map<number, Set<number>>;
  availabilityMap: Map<number, Set<string>>;
  levels: Map<number, number>;
};

export async function autoGeneratePlan(
  studentId: number,
  programIds: number[],
  options: AutoGenerateOptions,
  onProgress?: ProgressCallback
): Promise<AutoGenerateResult> {
  const {
    mode,
    planId: existingPlanId,
    planName,
    includeSummers,
    startSeason,
    startYear,
    breadthPackage,
  } = options;

  onProgress?.("Gathering requirements...");
  const { planId } = await resolvePlanContext(
    studentId,
    programIds,
    mode,
    existingPlanId,
    planName
  );

  const inputs = await fetchGenerationInputs(studentId, planId, mode);

  onProgress?.("Analyzing prerequisites...");
  applyBreadthPackageFilter(inputs.blocks, breadthPackage ?? null);

  const allCandidateIds = collectCandidateCourseIds(inputs.blocks, inputs.genEdBuckets);
  const [candidatePrereqEdges, crossListings] = await Promise.all([
    extractPrereqEdges([...allCandidateIds]),
    fetchCrossListings([...allCandidateIds]),
  ]);
  const prereqCounts = buildPrereqCounts(allCandidateIds, candidatePrereqEdges);

  onProgress?.("Selecting courses...");
  const selectedCourses = selectCoursesForPlan(
    inputs.blocks,
    inputs.completedIds,
    inputs.genEdBuckets,
    prereqCounts,
    crossListings
  );

  if (selectedCourses.length === 0) {
    return {
      planId,
      semesters: [],
      totalCourses: 0,
      totalCredits: 0,
      validation: EMPTY_VALIDATION,
    };
  }

  onProgress?.("Building schedule...");
  const schedulingArtifacts = await buildSchedulingArtifacts(selectedCourses);

  onProgress?.("Scheduling courses...");
  const semesters = buildSemesters(
    mode,
    includeSummers,
    startSeason,
    startYear,
    selectedCourses,
    inputs,
    schedulingArtifacts
  );

  onProgress?.("Validating plan...");
  const validation = validatePlan(
    semesters,
    selectedCourses,
    schedulingArtifacts.prereqEdges,
    schedulingArtifacts.availabilityMap,
    inputs.completedIds,
    inputs.blocks,
    inputs.genEdBuckets,
    DEFAULT_CREDIT_CAP
  );

  onProgress?.("Saving plan...");
  await batchSavePlanCourses(studentId, planId, semesters);

  const totalCourses = semesters.reduce((sum, sem) => sum + sem.courses.length, 0);
  const totalCredits = semesters.reduce((sum, sem) => sum + sem.totalCredits, 0);

  onProgress?.("Done!");
  return {
    planId,
    semesters,
    totalCourses,
    totalCredits,
    validation,
  };
}

async function resolvePlanContext(
  studentId: number,
  programIds: number[],
  mode: AutoGenerateOptions["mode"],
  existingPlanId: number | undefined,
  planName: string | undefined
): Promise<PlanContext> {
  if (mode === "new") {
    const plan = await createPlan(
      studentId,
      planName || "Auto-Generated Plan",
      "Automatically generated course plan",
      programIds
    );
    return { planId: plan.id };
  }

  const planId = existingPlanId!;
  await fetchPlanPrograms(planId);
  return { planId };
}

async function fetchGenerationInputs(
  studentId: number,
  planId: number,
  mode: AutoGenerateOptions["mode"]
): Promise<GenerationInputs> {
  const shouldLoadExisting = mode === "fill";

  const [blocks, completedIds, genEdBuckets, existingTerms, existingCourses] = await Promise.all([
    fetchAvailableCourses(studentId, planId),
    fetchCompletedCourseIds(studentId),
    fetchGenEdBucketsWithCourses(),
    shouldLoadExisting ? fetchStudentTerms(studentId, planId) : Promise.resolve([]),
    shouldLoadExisting ? fetchPlannedCourses(studentId, planId) : Promise.resolve([]),
  ]);

  return {
    blocks,
    completedIds,
    genEdBuckets,
    existingTerms,
    existingCourses,
  };
}

function applyBreadthPackageFilter(
  blocks: RequirementBlockWithCourses[],
  breadthPackage: BreadthPackage | null
): void {
  if (!breadthPackage) return;

  const allowedKeys = getPackageCourseKeys(breadthPackage);
  for (const block of blocks) {
    if (!isBreadthBlock(block)) continue;
    block.courses = block.courses.filter((c) => allowedKeys.has(courseKey(c)));
    block.credits_required = breadthPackage.totalCreditsRequired;
    block.rule = "ALL_OF";
  }
}

function collectCandidateCourseIds(
  blocks: RequirementBlockWithCourses[],
  genEdBuckets: GenEdBucketWithCourses[]
): Set<number> {
  const ids = new Set<number>();
  for (const block of blocks) {
    for (const course of block.courses) ids.add(course.id);
  }
  for (const bucket of genEdBuckets) {
    for (const course of bucket.courses) ids.add(course.id);
  }
  return ids;
}

function buildPrereqCounts(
  allCandidateIds: Set<number>,
  candidatePrereqEdges: Map<number, Set<number>>
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const id of allCandidateIds) {
    const prereqs = candidatePrereqEdges.get(id);
    counts.set(id, prereqs ? prereqs.size : 0);
  }
  return counts;
}

function selectCoursesForPlan(
  blocks: RequirementBlockWithCourses[],
  completedIds: Set<number>,
  genEdBuckets: GenEdBucketWithCourses[],
  prereqCounts: Map<number, number>,
  crossListings: Map<number, Set<number>>
): Course[] {
  const selectedCourses: Course[] = [];
  const selectedIds = new Set<number>();
  const genEdCourseIds = collectGenEdCourseIds(genEdBuckets);

  const markSelected = (courseId: number) => {
    selectedIds.add(courseId);
    const equivalents = crossListings.get(courseId);
    if (!equivalents) return;
    for (const eqId of equivalents) {
      selectedIds.add(eqId);
    }
  };

  const addSelection = (course: Course) => {
    if (selectedIds.has(course.id)) return;
    selectedCourses.push(course);
    markSelected(course.id);
  };

  for (const block of blocks) {
    const picked = selectCoursesForBlock(
      block,
      completedIds,
      selectedIds,
      genEdCourseIds,
      prereqCounts
    );
    for (const course of picked) {
      addSelection(course);
    }
  }

  const genEdExtra = resolveGenEdGaps(
    selectedIds,
    genEdBuckets,
    completedIds,
    prereqCounts
  );
  for (const course of genEdExtra) {
    addSelection(course);
  }

  return selectedCourses;
}

function collectGenEdCourseIds(genEdBuckets: GenEdBucketWithCourses[]): Set<number> {
  const ids = new Set<number>();
  for (const bucket of genEdBuckets) {
    for (const course of bucket.courses) ids.add(course.id);
  }
  return ids;
}

async function buildSchedulingArtifacts(
  selectedCourses: Course[]
): Promise<SchedulingArtifacts> {
  const allCourseIds = selectedCourses.map((c) => c.id);
  const [prereqEdges, offerings] = await Promise.all([
    extractPrereqEdges(allCourseIds),
    fetchCourseOfferings(allCourseIds),
  ]);

  return {
    prereqEdges,
    availabilityMap: buildAvailabilityMap(offerings),
    levels: computeTopologicalLevels(allCourseIds, prereqEdges),
  };
}

function buildSemesters(
  mode: AutoGenerateOptions["mode"],
  includeSummers: boolean,
  startSeason: AutoGenerateOptions["startSeason"],
  startYear: AutoGenerateOptions["startYear"],
  selectedCourses: Course[],
  inputs: GenerationInputs,
  artifacts: SchedulingArtifacts
) {
  if (mode === "fill" && inputs.existingTerms.length > 0) {
    return fillExistingPlan(
      inputs.existingTerms,
      inputs.existingCourses,
      selectedCourses,
      artifacts.levels,
      artifacts.prereqEdges,
      includeSummers,
      DEFAULT_CREDIT_CAP,
      artifacts.availabilityMap,
      inputs.completedIds
    ).semesters;
  }

  return scheduleCourses(
    selectedCourses,
    artifacts.levels,
    artifacts.prereqEdges,
    startSeason,
    startYear,
    includeSummers,
    DEFAULT_CREDIT_CAP,
    artifacts.availabilityMap,
    inputs.completedIds
  ).semesters;
}
