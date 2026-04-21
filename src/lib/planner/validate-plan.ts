import type { Course } from "@/types/course";
import type { RequirementBlockWithCourses } from "@/types/planner";
import type {
  ScheduledSemester,
  GenEdBucketWithCourses,
  ValidationResult,
  ValidationIssue,
  BlockSatisfactionStatus,
  GenEdSatisfactionStatus,
} from "@/types/auto-generate";
import { buildCoreqMap, isAvailable } from "./auto-generate";

function canonicalAllOfCourses(courses: Course[]): Course[] {
  const grouped = new Map<string, Course[]>();
  for (const course of courses) {
    const key = `${course.number}|${course.title.trim().toLowerCase()}|${course.credits}`;
    const list = grouped.get(key) ?? [];
    list.push(course);
    grouped.set(key, list);
  }

  const canonical: Course[] = [];
  for (const group of grouped.values()) {
    const subjects = new Set(group.map((course) => course.subject));
    if (subjects.size > 1) {
      canonical.push(group[0]);
      continue;
    }
    canonical.push(...group);
  }

  return canonical;
}

function inferNOfRequiredCredits(courses: Course[], nRequired: number): number {
  if (nRequired <= 0 || courses.length === 0) return 0;

  const freq = new Map<number, number>();
  for (const course of courses) {
    const current = freq.get(course.credits) ?? 0;
    freq.set(course.credits, current + 1);
  }

  let modeCredits = courses[0].credits;
  let modeCount = -1;
  for (const [credits, count] of freq) {
    if (count > modeCount || (count === modeCount && credits > modeCredits)) {
      modeCount = count;
      modeCredits = credits;
    }
  }

  return modeCredits * nRequired;
}

/**
 * Pure validation function — no Supabase calls.
 * Checks the scheduler's output before saving and returns structured issues.
 */
export function validatePlan(
  semesters: ScheduledSemester[],
  allSelectedCourses: Course[],
  prereqEdges: Map<number, Set<number>>,
  availabilityMap: Map<number, Set<string>>,
  completedIds: Set<number>,
  blocks: RequirementBlockWithCourses[],
  genEdBuckets: GenEdBucketWithCourses[],
  creditCap: number,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Build lookup: courseId → semester index
  const courseToSemIdx = new Map<number, number>();
  for (let i = 0; i < semesters.length; i++) {
    for (const c of semesters[i].courses) {
      courseToSemIdx.set(c.id, i);
    }
  }

  const scheduledIds = new Set(courseToSemIdx.keys());
  const allScheduledAndCompleted = new Set([...scheduledIds, ...completedIds]);
  const scheduledCourses = semesters.flatMap((semester) => semester.courses);
  const coreqMap = buildCoreqMap(scheduledCourses);

  // ── 1. Unscheduled courses ────────────────────────────
  const unscheduledCourses: Course[] = [];
  for (const course of allSelectedCourses) {
    if (!scheduledIds.has(course.id) && !completedIds.has(course.id)) {
      unscheduledCourses.push(course);
      issues.push({
        severity: "error",
        code: "COURSE_NOT_SCHEDULED",
        message: `${course.subject} ${course.number} was selected but could not be scheduled`,
        courseId: course.id,
      });
    }
  }

  // ── 2. Prerequisite ordering ──────────────────────────
  for (const [courseId, prereqs] of prereqEdges) {
    const courseIdx = courseToSemIdx.get(courseId);
    if (courseIdx === undefined) continue; // not scheduled

    for (const prereqId of prereqs) {
      if (completedIds.has(prereqId)) continue; // already done

      const prereqIdx = courseToSemIdx.get(prereqId);
      if (prereqIdx === undefined) {
        // Prereq not in our scheduled set — might be outside the plan
        continue;
      }

      // Lab/lecture pairs are allowed in the same semester.
      const isSameSemesterCoreq =
        prereqIdx === courseIdx &&
        (coreqMap.get(courseId)?.has(prereqId) ?? false);
      if (isSameSemesterCoreq) {
        continue;
      }

      if (prereqIdx >= courseIdx) {
        const sem = semesters[courseIdx];
        issues.push({
          severity: "error",
          code: "PREREQ_VIOLATION",
          message: `Course ${courseId} is scheduled in ${sem.season} ${sem.year} but its prerequisite ${prereqId} is not in an earlier semester`,
          courseId,
          semester: `${sem.season} ${sem.year}`,
        });
      }
    }
  }

  // ── 3. Availability ───────────────────────────────────
  for (const sem of semesters) {
    for (const course of sem.courses) {
      if (!isAvailable(course.id, sem.season, sem.year, availabilityMap)) {
        issues.push({
          severity: "error",
          code: "AVAILABILITY_VIOLATION",
          message: `${course.subject} ${course.number} is not offered in ${sem.season} ${sem.year}`,
          courseId: course.id,
          semester: `${sem.season} ${sem.year}`,
        });
      }
    }
  }

  // ── 4. Credit cap ─────────────────────────────────────
  for (const sem of semesters) {
    if (sem.totalCredits > creditCap) {
      issues.push({
        severity: "warning",
        code: "CREDIT_CAP_EXCEEDED",
        message: `${sem.season} ${sem.year} has ${sem.totalCredits} credits (cap: ${creditCap})`,
        semester: `${sem.season} ${sem.year}`,
      });
    }
  }

  // ── 5. Block satisfaction ─────────────────────────────
  const blockStatuses: BlockSatisfactionStatus[] = [];
  for (const block of blocks) {
    const blockCourses =
      block.rule === "ALL_OF"
        ? canonicalAllOfCourses(block.courses)
        : block.courses;
    let scheduledCredits = 0;
    let scheduledCount = 0;

    for (const course of blockCourses) {
      if (allScheduledAndCompleted.has(course.id)) {
        scheduledCredits += course.credits;
        scheduledCount++;
      }
    }

    let satisfied = false;
    let requiredCredits: number | null = null;

    switch (block.rule) {
      case "ALL_OF":
        satisfied = scheduledCount >= blockCourses.length;
        requiredCredits =
          block.credits_required ??
          blockCourses.reduce((s, c) => s + c.credits, 0);
        break;
      case "ANY_OF":
        satisfied = scheduledCount >= 1;
        requiredCredits =
          blockCourses.length > 0
            ? Math.min(...blockCourses.map((c) => c.credits))
            : 0;
        break;
      case "N_OF":
        if (block.credits_required != null) {
          satisfied = scheduledCredits >= block.credits_required;
          requiredCredits = block.credits_required;
        } else {
          const nRequired = block.n_required ?? 1;
          satisfied = scheduledCount >= nRequired;
          requiredCredits = inferNOfRequiredCredits(blockCourses, nRequired);
        }
        break;
      case "CREDITS_OF":
        satisfied = scheduledCredits >= (block.credits_required ?? 0);
        requiredCredits = block.credits_required;
        break;
      default:
        satisfied = scheduledCount >= blockCourses.length;
        requiredCredits = blockCourses.reduce((s, c) => s + c.credits, 0);
    }

    const missingCredits = Math.max(0, (requiredCredits ?? 0) - scheduledCredits);

    blockStatuses.push({
      blockId: block.id,
      blockName: block.name,
      rule: block.rule,
      satisfied,
      requiredCredits,
      scheduledCredits,
      missingCredits,
    });

    if (!satisfied) {
      issues.push({
        severity: "warning",
        code: "BLOCK_UNSATISFIED",
        message: `Requirement "${block.name}" is not fully satisfied (${scheduledCredits} credits scheduled)`,
      });
    }
  }

  // ── 6. Gen ed satisfaction ────────────────────────────
  const genEdStatuses: GenEdSatisfactionStatus[] = [];
  for (const bucket of genEdBuckets) {
    let coveredCredits = 0;
    for (const course of bucket.courses) {
      if (allScheduledAndCompleted.has(course.id)) {
        coveredCredits += course.credits;
      }
    }

    const missingCredits = Math.max(0, bucket.credits_required - coveredCredits);
    const satisfied = coveredCredits >= bucket.credits_required;

    genEdStatuses.push({
      bucketId: bucket.id,
      bucketName: bucket.name,
      satisfied,
      requiredCredits: bucket.credits_required,
      coveredCredits,
      missingCredits,
    });

    if (!satisfied) {
      issues.push({
        severity: "warning",
        code: "GENED_UNSATISFIED",
        message: `Gen ed "${bucket.name}" needs ${missingCredits} more credits (${coveredCredits}/${bucket.credits_required})`,
      });
    }
  }

  // ── 7. Credit average ─────────────────────────────────
  if (semesters.length > 0) {
    const totalCredits = semesters.reduce((s, sem) => s + sem.totalCredits, 0);
    const avg = totalCredits / semesters.length;
    if (avg < 12) {
      issues.push({
        severity: "info",
        code: "LOW_CREDIT_AVERAGE",
        message: `Average credit load is ${avg.toFixed(1)} per semester (below 12)`,
      });
    } else if (avg > 18) {
      issues.push({
        severity: "warning",
        code: "HIGH_CREDIT_AVERAGE",
        message: `Average credit load is ${avg.toFixed(1)} per semester (above 18)`,
      });
    }
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
    blockStatuses,
    genEdStatuses,
    unscheduledCourses,
  };
}
