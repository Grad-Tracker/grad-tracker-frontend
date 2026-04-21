import type { Course } from "@/types/course";
import type { RequirementBlockWithCourses } from "@/types/planner";
import {
  computePerProgramCreditTarget,
  isBreadthBlock,
  deduplicateBlocks,
} from "@/types/planner";
import {
  VALIDATION_ISSUE_CODES,
  type AutoGenerateOptions,
  type AutoGenerateResult,
  type ValidationIssue,
  type ValidationResult,
} from "@/types/auto-generate";

import {
  fetchAvailableCourses,
  fetchCompletedCourseIds,
  fetchGenEdBucketsWithCourses,
  fetchCourseOfferings,
  fetchStudentTerms,
  fetchPlannedCourses,
  createPlan,
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
  rebalanceSemesters,
} from "./auto-generate";
import { validatePlan } from "./validate-plan";

export type ProgressCallback = (message: string) => void;

const DEFAULT_CREDIT_CAP = 18;
const FULL_TIME_CREDIT_FLOOR = 15;
const REBALANCE_TARGET_CREDITS = 12;
const REBALANCE_DONOR_FLOOR_CREDITS = 12;
const STRICT_HORIZON_TERMS = 8;

function blockCreditTarget(blocks: RequirementBlockWithCourses[]): number {
  return blocks.reduce((sum, block) => {
    const fallback = block.courses.reduce((courseSum, c) => courseSum + c.credits, 0);
    return sum + (block.credits_required ?? fallback);
  }, 0);
}

function isElectiveLikeBlock(block: RequirementBlockWithCourses): boolean {
  return /elective/i.test(block.name);
}

function isBlockSatisfiedForTopUp(
  block: RequirementBlockWithCourses,
  coveredIds: Set<number>
): boolean {
  let coveredCount = 0;
  let coveredCredits = 0;
  for (const course of block.courses) {
    if (!coveredIds.has(course.id)) continue;
    coveredCount++;
    coveredCredits += course.credits;
  }

  switch (block.rule) {
    case "ALL_OF":
      return coveredCount >= block.courses.length;
    case "ANY_OF":
      return coveredCount >= 1;
    case "N_OF":
      if (block.credits_required != null) {
        return coveredCredits >= block.credits_required;
      }
      return coveredCount >= (block.n_required ?? 1);
    case "CREDITS_OF":
      return coveredCredits >= (block.credits_required ?? 0);
    default:
      return coveredCount >= block.courses.length;
  }
}

function rankTopUpCandidates(
  courses: Course[],
  prereqCounts: Map<number, number>,
  availabilityScores: Map<number, number>
): Course[] {
  return [...courses].sort((a, b) => {
    const aAvailability = availabilityScores.get(a.id) ?? 0;
    const bAvailability = availabilityScores.get(b.id) ?? 0;
    if (aAvailability !== bAvailability) return bAvailability - aAvailability;

    const aPrereqs = prereqCounts.get(a.id) ?? 0;
    const bPrereqs = prereqCounts.get(b.id) ?? 0;
    if (aPrereqs !== bPrereqs) return aPrereqs - bPrereqs;
    if (a.credits !== b.credits) return b.credits - a.credits;
    const aNum = parseInt(a.number, 10) || 999;
    const bNum = parseInt(b.number, 10) || 999;
    return aNum - bNum;
  });
}

function termOrder(season: "Fall" | "Spring" | "Summer"): number {
  if (season === "Spring") return 1;
  if (season === "Summer") return 2;
  return 3;
}

function addOneTerm(
  season: "Fall" | "Spring" | "Summer",
  year: number,
  includeSummers: boolean
): { season: "Fall" | "Spring" | "Summer"; year: number } {
  if (season === "Fall") return { season: "Spring", year: year + 1 };
  if (season === "Spring") {
    if (includeSummers) return { season: "Summer", year };
    return { season: "Fall", year };
  }
  return { season: "Fall", year };
}

export function buildHorizonTerm(
  startSeason: "Fall" | "Spring" | "Summer",
  startYear: number,
  includeSummers: boolean,
  terms: number
): { season: "Fall" | "Spring" | "Summer"; year: number } {
  let season = startSeason;
  let year = startYear;
  for (let i = 1; i < terms; i++) {
    const next = addOneTerm(season, year, includeSummers);
    season = next.season;
    year = next.year;
  }
  return { season, year };
}

export function termCompare(
  a: { season: "Fall" | "Spring" | "Summer"; year: number },
  b: { season: "Fall" | "Spring" | "Summer"; year: number }
): number {
  if (a.year !== b.year) return a.year - b.year;
  return termOrder(a.season) - termOrder(b.season);
}

function parseSpecificTermCode(
  code: string
): { year: number; season: "Fall" | "Spring" | "Summer" } | null {
  const match = code.match(/^(\d{4})(FA|SP|SU)$/);
  if (!match) return null;
  const year = Number(match[1]);
  const suffix = match[2];
  const season =
    suffix === "FA" ? "Fall" : suffix === "SP" ? "Spring" : "Summer";
  return { year, season };
}

function isTermOnOrAfter(
  year: number,
  season: "Fall" | "Spring" | "Summer",
  startYear: number,
  startSeason: "Fall" | "Spring" | "Summer"
): boolean {
  if (year !== startYear) return year > startYear;
  return termOrder(season) >= termOrder(startSeason);
}

function buildAvailabilityScores(
  courseIds: number[],
  availabilityMap: Map<number, Set<string>>,
  includeSummers: boolean,
  startSeason: "Fall" | "Spring" | "Summer",
  startYear: number
): Map<number, number> {
  const scores = new Map<number, number>();

  for (const courseId of courseIds) {
    const codes = availabilityMap.get(courseId);
    if (!codes || codes.size === 0) {
      scores.set(courseId, 2);
      continue;
    }

    let hasRecurringNonSummer = false;
    let hasSummerOnlyRecurring = false;
    let hasFutureSpecific = false;
    let hasGeneric = false;

    for (const code of codes) {
      switch (code) {
        case "YEARLY":
        case "FALL":
        case "SPRING":
        case "FALL_EVEN":
        case "FALL_ODD":
        case "SPRING_EVEN":
        case "SPRING_ODD":
        case "OCCASIONALLY":
          hasGeneric = true;
          hasRecurringNonSummer = true;
          break;
        case "SUMMER":
          hasGeneric = true;
          hasSummerOnlyRecurring = true;
          break;
        default: {
          const specific = parseSpecificTermCode(code);
          if (
            specific &&
            (includeSummers || specific.season !== "Summer") &&
            isTermOnOrAfter(
              specific.year,
              specific.season,
              startYear,
              startSeason
            )
          ) {
            hasFutureSpecific = true;
          }
          break;
        }
      }
    }

    if (hasRecurringNonSummer) {
      scores.set(courseId, 2);
      continue;
    }

    if (hasSummerOnlyRecurring) {
      scores.set(courseId, includeSummers ? 2 : 0);
      continue;
    }

    if (hasFutureSpecific) {
      scores.set(courseId, 1);
      continue;
    }

    // Generic codes exist but none are usable for this scheduling mode.
    if (hasGeneric) {
      scores.set(courseId, includeSummers ? 1 : 0);
      continue;
    }

    scores.set(courseId, 0);
  }

  return scores;
}

export function partitionPlannableBlocks(
  blocks: RequirementBlockWithCourses[]
): {
  plannableBlocks: RequirementBlockWithCourses[];
  exclusionIssues: ValidationIssue[];
} {
  const plannableBlocks: RequirementBlockWithCourses[] = [];
  const exclusionIssues: ValidationIssue[] = [];

  for (const block of blocks) {
    const excludedByFlag = block.is_plannable === false;
    const excludedByNoCourses = block.courses.length === 0;

    if (!excludedByFlag && !excludedByNoCourses) {
      plannableBlocks.push(block);
      continue;
    }

    const hasChildBlocks = blocks.some(
      (other) => other.id !== block.id && other.name.startsWith(`${block.name} - `)
    );

    // Parent/umbrella blocks are requirement scaffolds. If child blocks exist,
    // exclude quietly without surfacing a warning to the user.
    if (hasChildBlocks) {
      continue;
    }

    const reason =
      block.planner_exclusion_reason?.trim() ||
      (excludedByFlag
        ? "Marked as NON_PLANNABLE in requirement cleanup."
        : "No schedulable courses are mapped to this block.");

    exclusionIssues.push({
      severity: "warning",
      code: VALIDATION_ISSUE_CODES.blockExcludedNonPlannable,
      message: `Excluded requirement "${block.name}" from auto-generation: ${reason}`,
    });
  }

  return { plannableBlocks, exclusionIssues };
}

export async function autoGeneratePlan(
  studentId: number,
  programIds: number[],
  options: AutoGenerateOptions,
  onProgress?: ProgressCallback
): Promise<AutoGenerateResult> {
  const { mode, planId: existingPlanId, planName, includeSummers, startSeason, startYear, breadthPackage } = options;
  const targetHorizon = buildHorizonTerm(startSeason, startYear, includeSummers, STRICT_HORIZON_TERMS);

  // ── Step 1: Gather data ────────────────────────────────
  onProgress?.("Gathering requirements...");

  // Determine which plan to work with
  let planId: number;

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
  }

  // Fetch all needed data in parallel
  const [blocks, completedIds, genEdBuckets, existingTerms, existingCourses] = await Promise.all([
    fetchAvailableCourses(studentId, planId, { includeNonPlannable: true }),
    fetchCompletedCourseIds(studentId),
    fetchGenEdBucketsWithCourses(),
    mode === "fill" ? fetchStudentTerms(studentId, planId) : Promise.resolve([]),
    mode === "fill" ? fetchPlannedCourses(studentId, planId) : Promise.resolve([]),
  ]);

  // ── Step 2: Extract prereqs for ALL candidates ─────────
  onProgress?.("Analyzing prerequisites...");

  const { plannableBlocks: rawPlannableBlocks, exclusionIssues } =
    partitionPlannableBlocks(blocks);

  const computedTargetCredits = computePerProgramCreditTarget(rawPlannableBlocks, {
    selectedPackage: breadthPackage ?? null,
  });
  const plannerTargetCredits =
    typeof options.targetCredits === "number" && Number.isFinite(options.targetCredits)
      ? Math.max(0, Math.round(options.targetCredits))
      : computedTargetCredits;

  const plannableBlocks = deduplicateBlocks(rawPlannableBlocks, {
    selectedPackage: breadthPackage ?? null,
  });

  if (breadthPackage) {
    const breadthBlock = plannableBlocks.find((block) => isBreadthBlock(block));
    if (!breadthBlock || breadthBlock.courses.length === 0) {
      exclusionIssues.push({
        severity: "warning",
        code: VALIDATION_ISSUE_CODES.blockExcludedNonPlannable,
        message: `Selected breadth package "${breadthPackage.name}" has no mapped schedulable courses in this plan context.`,
      });
    }
  }

  // Collect ALL candidate course IDs from blocks + gen ed buckets
  const allCandidateIds = new Set<number>();
  for (const block of plannableBlocks) {
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
  const [candidatePrereqEdges, crossListings, candidateOfferings] = await Promise.all([
    extractPrereqEdges([...allCandidateIds]),
    fetchCrossListings([...allCandidateIds]),
    fetchCourseOfferings([...allCandidateIds]),
  ]);
  const candidateAvailabilityMap = buildAvailabilityMap(candidateOfferings);
  const availabilityScores = buildAvailabilityScores(
    [...allCandidateIds],
    candidateAvailabilityMap,
    includeSummers,
    startSeason,
    startYear
  );

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

  for (const block of plannableBlocks) {
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

  // Ensure selection meets the planner's displayed credit target for this plan context.
  const fallbackPlannerTargetCredits = blockCreditTarget(plannableBlocks);
  const targetCredits = plannerTargetCredits > 0
    ? plannerTargetCredits
    : fallbackPlannerTargetCredits;
  let selectedCredits = selectedCourses.reduce((sum, course) => sum + course.credits, 0);
  if (selectedCredits < targetCredits) {
    const candidateById = new Map<number, Course>();
    const coveredIds = new Set<number>([...completedIds, ...selectedIds]);
    for (const block of plannableBlocks) {
      const satisfied = isBlockSatisfiedForTopUp(block, coveredIds);
      if (satisfied && !isElectiveLikeBlock(block)) {
        continue;
      }
      for (const course of block.courses) {
        if (completedIds.has(course.id) || selectedIds.has(course.id)) continue;
        if (!candidateById.has(course.id)) candidateById.set(course.id, course);
      }
    }
    const rankedCandidates = rankTopUpCandidates(
      Array.from(candidateById.values()),
      prereqCounts,
      availabilityScores
    );

    const prereqsSatisfied = (courseId: number): boolean => {
      const prereqs = candidatePrereqEdges.get(courseId);
      if (!prereqs || prereqs.size === 0) return true;
      for (const prereqId of prereqs) {
        if (completedIds.has(prereqId) || selectedIds.has(prereqId)) continue;
        return false;
      }
      return true;
    };

    const remaining = [...rankedCandidates];
    let progressed = true;
    while (selectedCredits < targetCredits && progressed && remaining.length > 0) {
      progressed = false;
      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        if (completedIds.has(candidate.id) || selectedIds.has(candidate.id)) {
          remaining.splice(i, 1);
          i--;
          continue;
        }
        if ((availabilityScores.get(candidate.id) ?? 0) <= 0) continue;
        if (!prereqsSatisfied(candidate.id)) continue;
        selectedCourses.push(candidate);
        markSelected(candidate.id);
        selectedCredits += candidate.credits;
        remaining.splice(i, 1);
        i--;
        progressed = true;
        if (selectedCredits >= targetCredits) break;
      }
    }
  }

  const emptyValidation: ValidationResult = {
    valid: exclusionIssues.every((i) => i.severity !== "error"),
    issues: [...exclusionIssues],
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
      targetHorizon: {
        ...targetHorizon,
        terms: STRICT_HORIZON_TERMS,
      },
      tailEliminationSucceeded: true,
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
  const selectedDependentCounts = new Map<number, number>();
  for (const course of selectedCourses) {
    selectedDependentCounts.set(course.id, 0);
  }
  for (const prereqs of prereqEdges.values()) {
    for (const prereqId of prereqs) {
      if (!selectedDependentCounts.has(prereqId)) continue;
      selectedDependentCounts.set(prereqId, (selectedDependentCounts.get(prereqId) ?? 0) + 1);
    }
  }
  const flexibleCourseIds = new Set<number>();
  for (const course of selectedCourses) {
    const isGenEd = genEdCourseIds.has(course.id);
    const hasDependents = (selectedDependentCounts.get(course.id) ?? 0) > 0;
    if (isGenEd || !hasDependents) {
      flexibleCourseIds.add(course.id);
    }
  }

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

  const semesters = rebalanceSemesters(
    scheduleResult.semesters,
    prereqEdges,
    availabilityMap,
    completedIds,
    {
      creditCap: DEFAULT_CREDIT_CAP,
      minTailCredits: REBALANCE_TARGET_CREDITS,
      donorFloorCredits: REBALANCE_DONOR_FLOOR_CREDITS,
      flexibleCourseIds,
      horizonEndTerm: targetHorizon,
      minLastSemesterCredits: FULL_TIME_CREDIT_FLOOR,
    }
  );

  const overflowSemesters = semesters.filter((sem) => termCompare(sem, targetHorizon) > 0);
  const horizonIssues: ValidationIssue[] = [];
  const tailEliminationSucceeded = overflowSemesters.length === 0;
  if (!tailEliminationSucceeded) {
    const firstOverflow = overflowSemesters[0];
    horizonIssues.push({
      severity: "error",
      code: VALIDATION_ISSUE_CODES.horizonUnachievable,
      message: `Unable to fit all selected courses by ${targetHorizon.season} ${targetHorizon.year}; first overflow term is ${firstOverflow.season} ${firstOverflow.year}.`,
      semester: `${firstOverflow.season} ${firstOverflow.year}`,
    });
  }

  // ── Step 6: Validate plan ──────────────────────────────
  onProgress?.("Validating plan...");

  const rawValidation = validatePlan(
    semesters,
    selectedCourses,
    prereqEdges,
    availabilityMap,
    completedIds,
    plannableBlocks,
    genEdBuckets,
    DEFAULT_CREDIT_CAP,
  );
  const validation: ValidationResult = {
    ...rawValidation,
    issues: [...exclusionIssues, ...horizonIssues, ...rawValidation.issues],
    valid: [...exclusionIssues, ...horizonIssues, ...rawValidation.issues].every(
      (issue) => issue.severity !== "error"
    ),
  };

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
    targetHorizon: {
      ...targetHorizon,
      terms: STRICT_HORIZON_TERMS,
    },
    tailEliminationSucceeded,
  };
}
