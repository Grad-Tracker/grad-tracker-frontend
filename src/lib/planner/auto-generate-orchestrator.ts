import type { Course } from "@/types/course";
import type { RequirementBlockWithCourses } from "@/types/planner";
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

export async function autoGeneratePlan(
  studentId: number,
  programIds: number[],
  options: AutoGenerateOptions,
  onProgress?: ProgressCallback
): Promise<AutoGenerateResult> {
  const { mode, planId: existingPlanId, planName, includeSummers, startSeason, startYear, breadthPackage } = options;

  // ── Step 1: Gather data ────────────────────────────────
  onProgress?.("Gathering requirements...");

  // Determine which plan to work with
  let planId: number;
  let planProgramIds = programIds;

  if (mode === "new") {
    const plan = await createPlan(
      studentId,
      planName || "Auto-Generated Plan",
      "Automatically generated course plan",
      programIds
    );
    planId = plan.id;
  } else {
    planId = existingPlanId!;
    // Get the existing plan's programs
    planProgramIds = await fetchPlanPrograms(planId);
  }

  // Fetch all needed data in parallel
  const [blocks, completedIds, genEdBuckets, existingTerms, existingCourses] = await Promise.all([
    fetchAvailableCourses(studentId, planId),
    fetchCompletedCourseIds(studentId),
    fetchGenEdBucketsWithCourses(),
    mode === "fill" ? fetchStudentTerms(studentId, planId) : Promise.resolve([]),
    mode === "fill" ? fetchPlannedCourses(studentId, planId) : Promise.resolve([]),
  ]);

  // ── Step 2: Extract prereqs for ALL candidates ─────────
  onProgress?.("Analyzing prerequisites...");

  // If a breadth package was selected, narrow the breadth block to that package.
  // Every course in the selected package is required (ALL_OF), since each package totals 9 credits.
  if (breadthPackage) {
    const allowedKeys = getPackageCourseKeys(breadthPackage);
    for (const block of blocks) {
      if (isBreadthBlock(block)) {
        block.courses = block.courses.filter((c) => allowedKeys.has(courseKey(c)));
        block.credits_required = breadthPackage.totalCreditsRequired;
        block.rule = "ALL_OF";
      }
    }
  }

  // Collect ALL candidate course IDs from blocks + gen ed buckets
  const allCandidateIds = new Set<number>();
  for (const block of blocks) {
    for (const course of block.courses) {
      allCandidateIds.add(course.id);
    }
  }
  for (const bucket of genEdBuckets) {
    for (const course of bucket.courses) {
      allCandidateIds.add(course.id);
    }
  }

  // Extract prereqs and cross-listings for ALL candidates in parallel
  const [candidatePrereqEdges, crossListings] = await Promise.all([
    extractPrereqEdges([...allCandidateIds]),
    fetchCrossListings([...allCandidateIds]),
  ]);

  // Build prereqCounts: courseId → number of prerequisites (in-degree)
  const prereqCounts = new Map<number, number>();
  for (const id of allCandidateIds) {
    const prereqs = candidatePrereqEdges.get(id);
    prereqCounts.set(id, prereqs ? prereqs.size : 0);
  }

  // ── Step 3: Select courses (with real prereqCounts) ────
  onProgress?.("Selecting courses...");

  // Build set of all gen ed course IDs for overlap detection
  const genEdCourseIds = new Set<number>();
  for (const bucket of genEdBuckets) {
    for (const course of bucket.courses) {
      genEdCourseIds.add(course.id);
    }
  }

  // Helper: when a course is selected, also mark cross-listed equivalents
  // so they won't be picked again (e.g. CSCI 231 and MATH 231 are the same class)
  const markSelected = (courseId: number) => {
    selectedIds.add(courseId);
    const equivalents = crossListings.get(courseId);
    if (equivalents) {
      for (const eqId of equivalents) {
        selectedIds.add(eqId);
      }
    }
  };

  // Select courses from each requirement block
  const selectedCourses: Course[] = [];
  const selectedIds = new Set<number>();

  for (const block of blocks) {
    const picked = selectCoursesForBlock(
      block,
      completedIds,
      selectedIds,
      genEdCourseIds,
      prereqCounts
    );
    for (const course of picked) {
      if (!selectedIds.has(course.id)) {
        selectedCourses.push(course);
        markSelected(course.id);
      }
    }
  }

  // Resolve gen ed gaps
  const genEdExtra = resolveGenEdGaps(
    selectedIds,
    genEdBuckets,
    completedIds,
    prereqCounts
  );
  for (const course of genEdExtra) {
    if (!selectedIds.has(course.id)) {
      selectedCourses.push(course);
      markSelected(course.id);
    }
  }

  const emptyValidation: ValidationResult = {
    valid: true,
    issues: [],
    blockStatuses: [],
    genEdStatuses: [],
    unscheduledCourses: [],
  };

  if (selectedCourses.length === 0) {
    return {
      planId,
      semesters: [],
      totalCourses: 0,
      totalCredits: 0,
      validation: emptyValidation,
    };
  }

  // ── Step 4: Build precise prereq graph + availability ──
  onProgress?.("Building schedule...");

  const allCourseIds = selectedCourses.map((c) => c.id);
  const [prereqEdges, offerings] = await Promise.all([
    extractPrereqEdges(allCourseIds),
    fetchCourseOfferings(allCourseIds),
  ]);

  const availabilityMap = buildAvailabilityMap(offerings);

  // ── Step 5: Schedule courses ───────────────────────────
  onProgress?.("Scheduling courses...");

  const levels = computeTopologicalLevels(allCourseIds, prereqEdges);

  let scheduleResult;
  if (mode === "fill" && existingTerms.length > 0) {
    scheduleResult = fillExistingPlan(
      existingTerms,
      existingCourses,
      selectedCourses,
      levels,
      prereqEdges,
      includeSummers,
      DEFAULT_CREDIT_CAP,
      availabilityMap,
      completedIds
    );
  } else {
    scheduleResult = scheduleCourses(
      selectedCourses,
      levels,
      prereqEdges,
      startSeason,
      startYear,
      includeSummers,
      DEFAULT_CREDIT_CAP,
      availabilityMap,
      completedIds
    );
  }

  const { semesters } = scheduleResult;

  // ── Step 6: Validate plan ──────────────────────────────
  onProgress?.("Validating plan...");

  const validation = validatePlan(
    semesters,
    selectedCourses,
    prereqEdges,
    availabilityMap,
    completedIds,
    blocks,
    genEdBuckets,
    DEFAULT_CREDIT_CAP,
  );

  // ── Step 7: Save to Supabase ───────────────────────────
  onProgress?.("Saving plan...");

  await batchSavePlanCourses(studentId, planId, semesters);

  const totalCourses = semesters.reduce((s, sem) => s + sem.courses.length, 0);
  const totalCredits = semesters.reduce((s, sem) => s + sem.totalCredits, 0);

  onProgress?.("Done!");

  return {
    planId,
    semesters,
    totalCourses,
    totalCredits,
    validation,
  };
}
