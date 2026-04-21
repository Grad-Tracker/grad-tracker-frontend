import type { Course } from "@/types/course";
import type { Season, RequirementBlockWithCourses, Term, PlannedCourseWithDetails } from "@/types/planner";
import type { ScheduledSemester, ScheduleResult, GenEdBucketWithCourses } from "@/types/auto-generate";
import { SEASON_ORDER } from "@/types/planner";
import type { CourseOffering } from "@/lib/supabase/queries/planner";

const DEFAULT_CREDIT_CAP = 18;

// ── Co-requisite detection (lab + lecture pairs) ─────────

/**
 * Detect lab+lecture pairs that should be scheduled in the same semester.
 * Returns a map where each course ID points to the set of course IDs
 * it must be co-scheduled with.
 *
 * Heuristic: within the course list, find 1-credit courses with "Lab" in
 * the title and pair them with the same-subject course whose number is
 * closest (within 5) and has more credits.
 */
export function buildCoreqMap(courses: Course[]): Map<number, Set<number>> {
  const coreqs = new Map<number, Set<number>>();

  // Group by subject
  const bySubject = new Map<string, Course[]>();
  for (const c of courses) {
    if (!bySubject.has(c.subject)) bySubject.set(c.subject, []);
    bySubject.get(c.subject)!.push(c);
  }

  for (const group of bySubject.values()) {
    const labs = group.filter((c) => c.credits === 1 && /\blab\b/i.test(c.title));
    const lectures = group.filter((c) => c.credits > 1 && !/\blab\b/i.test(c.title));

    for (const lab of labs) {
      const labNum = parseInt(lab.number) || 0;
      // Find closest lecture by course number
      let bestLecture: Course | null = null;
      let bestDist = Infinity;
      for (const lec of lectures) {
        const lecNum = parseInt(lec.number) || 0;
        const dist = Math.abs(labNum - lecNum);
        if (dist <= 5 && dist < bestDist) {
          bestDist = dist;
          bestLecture = lec;
        }
      }
      if (bestLecture) {
        if (!coreqs.has(lab.id)) coreqs.set(lab.id, new Set());
        if (!coreqs.has(bestLecture.id)) coreqs.set(bestLecture.id, new Set());
        coreqs.get(lab.id)!.add(bestLecture.id);
        coreqs.get(bestLecture.id)!.add(lab.id);
      }
    }
  }

  return coreqs;
}

function buildCoreqGroupMap(
  courseIds: number[],
  coreqs: Map<number, Set<number>>
): Map<number, Set<number>> {
  const available = new Set(courseIds);
  const visited = new Set<number>();
  const groupsByCourse = new Map<number, Set<number>>();

  for (const id of available) {
    if (visited.has(id)) continue;

    const stack = [id];
    const group = new Set<number>();

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current) || !available.has(current)) continue;
      visited.add(current);
      group.add(current);

      for (const partner of coreqs.get(current) ?? []) {
        if (!visited.has(partner) && available.has(partner)) {
          stack.push(partner);
        }
      }
    }

    for (const member of group) {
      groupsByCourse.set(member, group);
    }
  }

  return groupsByCourse;
}

// ── Course availability from offerings ───────────────────

/**
 * Build a lookup: given a courseId, season, and year, is it offered?
 *
 * Term codes:
 *   FALL, SPRING, SUMMER      → every year
 *   YEARLY                    → Fall and Spring every year
 *   FALL_EVEN, SPRING_EVEN    → even years only
 *   FALL_ODD, SPRING_ODD      → odd years only
 *   OCCASIONALLY              → treat as available any semester
 *   2026FA, 2026SP            → specific term (year + season)
 *   WINTERIM                  → ignore (not scheduled)
 *
 * Courses with NO offerings are treated as available every semester.
 */
export function buildAvailabilityMap(
  offerings: CourseOffering[]
): Map<number, Set<string>> {
  // Group offerings by course_id
  const byCourse = new Map<number, string[]>();
  for (const o of offerings) {
    if (!byCourse.has(o.course_id)) byCourse.set(o.course_id, []);
    byCourse.get(o.course_id)!.push(o.term_code);
  }
  return new Map(
    [...byCourse.entries()].map(([id, codes]) => [id, new Set(codes)])
  );
}

/** Check if a course is offered in a specific season+year */
export function isAvailable(
  courseId: number,
  season: Season,
  year: number,
  availabilityMap: Map<number, Set<string>>
): boolean {
  const codes = availabilityMap.get(courseId);
  // No offering data → assume available everywhere
  if (!codes || codes.size === 0) return true;

  for (const code of codes) {
    switch (code) {
      case "YEARLY":
        if (season === "Fall" || season === "Spring") return true;
        break;
      case "FALL":
        if (season === "Fall") return true;
        break;
      case "SPRING":
        if (season === "Spring") return true;
        break;
      case "SUMMER":
        if (season === "Summer") return true;
        break;
      case "FALL_EVEN":
        if (season === "Fall" && year % 2 === 0) return true;
        break;
      case "FALL_ODD":
        if (season === "Fall" && year % 2 !== 0) return true;
        break;
      case "SPRING_EVEN":
        if (season === "Spring" && year % 2 === 0) return true;
        break;
      case "SPRING_ODD":
        if (season === "Spring" && year % 2 !== 0) return true;
        break;
      case "OCCASIONALLY":
        // Can't predict — treat as available
        return true;
      default:
        // Specific term codes like "2026FA", "2026SP"
        if (code.endsWith("FA") && season === "Fall") {
          const y = parseInt(code.slice(0, -2));
          if (y === year) return true;
        } else if (code.endsWith("SP") && season === "Spring") {
          const y = parseInt(code.slice(0, -2));
          if (y === year) return true;
        } else if (code.endsWith("SU") && season === "Summer") {
          const y = parseInt(code.slice(0, -2));
          if (y === year) return true;
        }
        break;
    }
  }

  return false;
}

function offeringScarcityScore(
  courseId: number,
  availabilityMap: Map<number, Set<string>>
): number {
  const codes = availabilityMap.get(courseId);
  if (!codes || codes.size === 0) return 3;

  if (codes.has("YEARLY") || codes.has("OCCASIONALLY")) return 3;

  const recurring = new Set<string>();
  let hasSpecificTerm = false;

  for (const code of codes) {
    if (
      code === "FALL" ||
      code === "SPRING" ||
      code === "SUMMER" ||
      code === "FALL_EVEN" ||
      code === "FALL_ODD" ||
      code === "SPRING_EVEN" ||
      code === "SPRING_ODD"
    ) {
      recurring.add(code);
      continue;
    }
    if (/^\d{4}(FA|SP|SU)$/.test(code)) {
      hasSpecificTerm = true;
    }
  }

  if (recurring.size > 0) {
    return recurring.size === 1 ? 0 : 2;
  }

  return hasSpecificTerm ? 1 : 2;
}

// ── Course selection for requirement blocks ──────────────

/**
 * For flexible blocks (ANY_OF, N_OF, CREDITS_OF), select courses using a heuristic:
 * 1. Prefer courses that also satisfy a gen ed bucket (overlap)
 * 2. Prefer courses with fewer prerequisites
 * 3. Prefer lower course numbers (intro courses first)
 */
export function selectCoursesForBlock(
  block: RequirementBlockWithCourses,
  completedIds: Set<number>,
  alreadySelectedIds: Set<number>,
  genEdCourseIds: Set<number>,
  prereqCounts: Map<number, number>
): Course[] {
  // Filter out completed and already selected courses
  const available = block.courses.filter(
    (c) => !completedIds.has(c.id) && !alreadySelectedIds.has(c.id)
  );

  if (block.rule === "ALL_OF") {
    return available;
  }

  // Sort by heuristic
  const sorted = [...available].sort((a, b) => {
    // 1. Prefer courses that satisfy gen ed (overlap)
    const aGenEd = genEdCourseIds.has(a.id) ? 0 : 1;
    const bGenEd = genEdCourseIds.has(b.id) ? 0 : 1;
    if (aGenEd !== bGenEd) return aGenEd - bGenEd;

    // 2. Fewer prerequisites first
    const aPrereqs = prereqCounts.get(a.id) ?? 0;
    const bPrereqs = prereqCounts.get(b.id) ?? 0;
    if (aPrereqs !== bPrereqs) return aPrereqs - bPrereqs;

    // 3. Lower course number first
    const aNum = parseInt(a.number) || 999;
    const bNum = parseInt(b.number) || 999;
    return aNum - bNum;
  });

  if (block.rule === "ANY_OF") {
    return sorted.slice(0, 1);
  }

  if (block.rule === "N_OF") {
    const nTarget = block.n_required ?? 1;
    const creditTarget = block.credits_required;
    const selected: Course[] = [];
    const used = new Set<number>();
    let credits = 0;

    const targetMet = () => {
      if (creditTarget != null) return credits >= creditTarget;
      return selected.length >= nTarget;
    };

    for (const course of sorted) {
      if (targetMet()) break;
      if (used.has(course.id)) continue;

      selected.push(course);
      used.add(course.id);
      credits += course.credits;

      // If credits still short, pull in same-subject companions first
      // (e.g. CHEM 103 lab after CHEM 101 lecture) before moving to
      // unrelated courses like PHYS 201
      if (creditTarget != null && credits < creditTarget) {
        for (const companion of sorted) {
          if (used.has(companion.id)) continue;
          if (companion.subject !== course.subject) continue;
          if (credits >= creditTarget) break;
          selected.push(companion);
          used.add(companion.id);
          credits += companion.credits;
        }
      }
    }
    return selected;
  }

  if (block.rule === "CREDITS_OF") {
    const target = block.credits_required ?? 0;
    const selected: Course[] = [];
    let credits = 0;
    for (const course of sorted) {
      if (credits >= target) break;
      selected.push(course);
      credits += course.credits;
    }
    return selected;
  }

  // Unknown rule: take all
  return available;
}

// ── Gen ed gap resolution ────────────────────────────────

/**
 * After selecting program courses, check which gen ed buckets still need credits.
 * Returns additional courses to fill unsatisfied buckets.
 */
export function resolveGenEdGaps(
  selectedProgramCourseIds: Set<number>,
  genEdBuckets: GenEdBucketWithCourses[],
  completedIds: Set<number>,
  prereqCounts: Map<number, number>
): Course[] {
  const additional: Course[] = [];
  const usedIds = new Set([...selectedProgramCourseIds, ...completedIds]);

  for (const bucket of genEdBuckets) {
    // Calculate credits already covered by selected/completed courses
    let coveredCredits = 0;
    for (const course of bucket.courses) {
      if (usedIds.has(course.id)) {
        coveredCredits += course.credits;
      }
    }

    const needed = bucket.credits_required - coveredCredits;
    if (needed <= 0) continue;

    // Pick additional courses from this bucket
    const available = bucket.courses
      .filter((c) => !usedIds.has(c.id))
      .sort((a, b) => {
        const aPrereqs = prereqCounts.get(a.id) ?? 0;
        const bPrereqs = prereqCounts.get(b.id) ?? 0;
        if (aPrereqs !== bPrereqs) return aPrereqs - bPrereqs;
        const aNum = parseInt(a.number) || 999;
        const bNum = parseInt(b.number) || 999;
        return aNum - bNum;
      });

    let addedCredits = 0;
    for (const course of available) {
      if (addedCredits >= needed) break;
      additional.push(course);
      usedIds.add(course.id);
      addedCredits += course.credits;
    }
  }

  return additional;
}

// ── Topological sort (Kahn's algorithm) ──────────────────

/**
 * Compute topological levels via Kahn's algorithm.
 * Level 0 = no prerequisites, level 1 = depends only on level 0, etc.
 * Courses not in prereqEdges get level 0.
 */
export function computeTopologicalLevels(
  courseIds: number[],
  prereqEdges: Map<number, Set<number>>
): Map<number, number> {
  const levels = new Map<number, number>();
  const courseIdSet = new Set(courseIds);

  // Build in-degree map (only counting edges within our course set)
  const inDegree = new Map<number, number>();
  const dependents = new Map<number, number[]>(); // prereq → courses that depend on it

  for (const id of courseIds) {
    inDegree.set(id, 0);
  }

  for (const id of courseIds) {
    const prereqs = prereqEdges.get(id);
    if (!prereqs) continue;
    let count = 0;
    for (const prereqId of prereqs) {
      if (courseIdSet.has(prereqId)) {
        count++;
        if (!dependents.has(prereqId)) dependents.set(prereqId, []);
        dependents.get(prereqId)!.push(id);
      }
    }
    inDegree.set(id, count);
  }

  // BFS from in-degree 0
  const queue: number[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id);
      levels.set(id, 0);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const currentLevel = levels.get(current)!;

    for (const dep of dependents.get(current) ?? []) {
      const newDeg = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, newDeg);
      // Level is max of all prereq levels + 1
      const prevLevel = levels.get(dep) ?? 0;
      levels.set(dep, Math.max(prevLevel, currentLevel + 1));
      if (newDeg === 0) {
        queue.push(dep);
      }
    }
  }

  // Any course not reached (cycle) gets pushed to a high level
  for (const id of courseIds) {
    if (!levels.has(id)) {
      levels.set(id, 999);
    }
  }

  return levels;
}

// ── Semester sequence generation ─────────────────────────

function nextSeason(season: Season, includeSummers: boolean): Season {
  if (season === "Fall") return "Spring";
  if (season === "Spring") return includeSummers ? "Summer" : "Fall";
  return "Fall"; // Summer → Fall
}

function nextYear(season: Season, year: number): number {
  // Year increments when going from Fall to Spring
  if (season === "Fall") return year + 1;
  return year;
}

function generateSemesterSequence(
  startSeason: Season,
  startYear: number,
  count: number,
  includeSummers: boolean
): { season: Season; year: number }[] {
  const semesters: { season: Season; year: number }[] = [];
  let season = startSeason;
  let year = startYear;

  for (let i = 0; i < count; i++) {
    semesters.push({ season, year });
    const prevSeason = season;
    season = nextSeason(season, includeSummers);
    year = nextYear(prevSeason, year);
  }

  return semesters;
}

// ── Greedy bin-packing scheduler ─────────────────────────

/**
 * Schedule courses into semesters using greedy bin-packing by topological level.
 *
 * Courses at lower levels are scheduled first. Within a level, courses are
 * sorted by subject + course number to naturally interleave different subjects
 * and credit values (e.g. CSCI 5cr, ENGL 3cr, MATH 4cr) instead of clustering
 * same-credit courses together.
 *
 * Each semester iterates ALL remaining courses, so 3-credit courses fill gaps
 * left when 5-credit courses don't fit — achieving ~15 credits with variety.
 */
export function scheduleCourses(
  courses: Course[],
  levels: Map<number, number>,
  prereqEdges: Map<number, Set<number>>,
  startSeason: Season,
  startYear: number,
  includeSummers: boolean,
  creditCap: number = DEFAULT_CREDIT_CAP,
  availabilityMap: Map<number, Set<string>> = new Map(),
  completedIds: Set<number> = new Set()
): ScheduleResult {
  if (courses.length === 0) return { semesters: [], unscheduledCourseIds: [] };
  const softCreditTarget = Math.min(15, creditCap);
  const dependentCounts = buildDependentCounts(
    courses.map((course) => course.id),
    prereqEdges
  );

  // Sort by level, then subject + course number for natural variety
  // (NOT credits descending — that causes all-5-credit semesters)
  const sorted = [...courses].sort((a, b) => {
    const levelA = levels.get(a.id) ?? 0;
    const levelB = levels.get(b.id) ?? 0;
    if (levelA !== levelB) return levelA - levelB;
    const scarcityA = offeringScarcityScore(a.id, availabilityMap);
    const scarcityB = offeringScarcityScore(b.id, availabilityMap);
    if (scarcityA !== scarcityB) return scarcityA - scarcityB;
    const dependentsA = dependentCounts.get(a.id) ?? 0;
    const dependentsB = dependentCounts.get(b.id) ?? 0;
    if (dependentsA !== dependentsB) return dependentsB - dependentsA;
    if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
    const aNum = parseInt(a.number) || 999;
    const bNum = parseInt(b.number) || 999;
    return aNum - bNum;
  });

  // Generate enough semesters (worst case: each course needs its own semester cycle)
  const maxSemesters = sorted.length * 3 + 10;
  const semSlots = generateSemesterSequence(startSeason, startYear, maxSemesters, includeSummers);

  const semesters: ScheduledSemester[] = [];
  const scheduled = new Set<number>(); // courseIds already placed
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const coreqs = buildCoreqMap(courses);
  const coreqGroups = buildCoreqGroupMap(
    courses.map((c) => c.id),
    coreqs
  );

  let semIdx = 0;

  const countFutureOfferingOpportunities = (courseId: number, fromSemIdx: number): number => {
    let count = 0;
    for (let idx = fromSemIdx + 1; idx < semSlots.length; idx++) {
      const future = semSlots[idx];
      if (isAvailable(courseId, future.season, future.year, availabilityMap)) {
        count++;
      }
    }
    return count;
  };

  while (scheduled.size < sorted.length && semIdx < semSlots.length) {
    const slot = semSlots[semIdx];
    const semCourses: Course[] = [];
    let semCredits = 0;
    const scheduledBeforeThisSemester = new Set(scheduled);

    // Helper: place the full co-req group atomically in this semester.
    const tryPlace = (course: Course): boolean => {
      if (scheduled.has(course.id)) return false;
      const groupIds = coreqGroups.get(course.id) ?? new Set([course.id]);
      const groupCourses: Course[] = [];
      let groupCredits = 0;

      for (const groupId of groupIds) {
        if (scheduled.has(groupId)) continue;
        const member = courseById.get(groupId);
        if (!member) continue;
        if (!isAvailable(member.id, slot.season, slot.year, availabilityMap)) {
          return false;
        }
        groupCourses.push(member);
        groupCredits += member.credits;
      }

      if (groupCourses.length === 0) return false;
      if (semCredits + groupCredits > creditCap) return false;

      for (const member of groupCourses) {
        const prereqs = prereqEdges.get(member.id);
        if (!prereqs) continue;
        for (const prereqId of prereqs) {
          if (completedIds.has(prereqId)) continue;
          // Co-req pairs are allowed in the same semester.
          if (groupIds.has(prereqId)) continue;
          // Prereqs within this scheduling set must be in an earlier semester,
          // not merely earlier in this same semester pass.
          if (courseById.has(prereqId) && !scheduledBeforeThisSemester.has(prereqId)) {
            return false;
          }
        }
      }

      for (const member of groupCourses) {
        semCourses.push(member);
        semCredits += member.credits;
        scheduled.add(member.id);
      }

      return true;
    };

    // Try ALL remaining courses — this finds 3cr courses to fill gaps
    // when 5cr courses don't fit, packing semesters close to the cap
    for (const course of sorted) {
      if (scheduled.has(course.id)) continue;
      if (semCredits >= softCreditTarget) {
        // Once we hit the soft target, continue only for courses that have
        // very few remaining offering opportunities in future terms.
        const futureOpportunities = countFutureOfferingOpportunities(course.id, semIdx);
        const urgentScarceCourse = futureOpportunities <= 1;
        if (!urgentScarceCourse) continue;
      }
      const placed = tryPlace(course);
      void placed;
    }

    if (semCourses.length > 0) {
      semesters.push({
        season: slot.season,
        year: slot.year,
        courses: semCourses,
        totalCredits: semCredits,
      });
    }

    semIdx++;
  }

  // Collect any courses that couldn't be placed
  const unscheduledCourseIds = sorted
    .filter((c) => !scheduled.has(c.id))
    .map((c) => c.id);

  return { semesters, unscheduledCourseIds };
}

function buildDependentsMap(
  prereqEdges: Map<number, Set<number>>
): Map<number, Set<number>> {
  const dependents = new Map<number, Set<number>>();

  for (const [courseId, prereqs] of prereqEdges) {
    for (const prereqId of prereqs) {
      if (!dependents.has(prereqId)) {
        dependents.set(prereqId, new Set<number>());
      }
      dependents.get(prereqId)!.add(courseId);
    }
  }

  return dependents;
}

function buildDependentCounts(
  courseIds: number[],
  prereqEdges: Map<number, Set<number>>
): Map<number, number> {
  const dependentsMap = buildDependentsMap(prereqEdges);
  const counts = new Map<number, number>();
  const courseSet = new Set(courseIds);

  for (const courseId of courseIds) {
    counts.set(courseId, 0);
  }

  for (const courseId of courseIds) {
    const visited = new Set<number>();
    const stack = [...(dependentsMap.get(courseId) ?? [])];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current) || !courseSet.has(current)) continue;
      visited.add(current);
      for (const dependent of dependentsMap.get(current) ?? []) {
        if (!visited.has(dependent) && courseSet.has(dependent)) {
          stack.push(dependent);
        }
      }
    }

    counts.set(courseId, visited.size);
  }

  return counts;
}

function buildCourseToSemesterMap(semesters: ScheduledSemester[]): Map<number, number> {
  const courseToSemester = new Map<number, number>();

  for (let semIdx = 0; semIdx < semesters.length; semIdx++) {
    for (const course of semesters[semIdx].courses) {
      courseToSemester.set(course.id, semIdx);
    }
  }

  return courseToSemester;
}

function canMoveCourseToSemester(
  course: Course,
  targetSemesterIdx: number,
  targetSemester: ScheduledSemester,
  courseToSemester: Map<number, number>,
  prereqEdges: Map<number, Set<number>>,
  dependentsMap: Map<number, Set<number>>,
  availabilityMap: Map<number, Set<string>>,
  completedIds: Set<number>,
  movingCourseIds: Set<number> = new Set()
): boolean {
  if (!isAvailable(course.id, targetSemester.season, targetSemester.year, availabilityMap)) {
    return false;
  }

  const prereqs = prereqEdges.get(course.id);
  if (prereqs) {
    for (const prereqId of prereqs) {
      if (movingCourseIds.has(prereqId)) continue;
      if (completedIds.has(prereqId)) continue;
      const prereqSemester = courseToSemester.get(prereqId);
      if (prereqSemester !== undefined && prereqSemester >= targetSemesterIdx) {
        return false;
      }
    }
  }

  const dependents = dependentsMap.get(course.id);
  if (dependents) {
    for (const dependentId of dependents) {
      if (movingCourseIds.has(dependentId)) continue;
      const dependentSemester = courseToSemester.get(dependentId);
      if (dependentSemester !== undefined && dependentSemester <= targetSemesterIdx) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Move eligible courses from earlier loaded semesters into trailing underfilled
 * semesters while preserving prerequisite and offering constraints.
 */
export interface RebalanceSemestersOptions {
  creditCap?: number;
  minTailCredits?: number;
  donorFloorCredits?: number;
  flexibleCourseIds?: Set<number>;
  horizonEndTerm?: { season: Season; year: number } | null;
  minLastSemesterCredits?: number;
}

export function rebalanceSemesters(
  semesters: ScheduledSemester[],
  prereqEdges: Map<number, Set<number>>,
  availabilityMap: Map<number, Set<string>>,
  completedIds?: Set<number>,
  options?: RebalanceSemestersOptions
): ScheduledSemester[];
export function rebalanceSemesters(
  semesters: ScheduledSemester[],
  prereqEdges: Map<number, Set<number>>,
  availabilityMap: Map<number, Set<string>>,
  completedIds?: Set<number>,
  creditCap?: number,
  minTailCredits?: number,
  donorFloorCredits?: number,
  flexibleCourseIds?: Set<number>,
  horizonEndTerm?: { season: Season; year: number } | null,
  minLastSemesterCredits?: number
): ScheduledSemester[];
export function rebalanceSemesters(
  semesters: ScheduledSemester[],
  prereqEdges: Map<number, Set<number>>,
  availabilityMap: Map<number, Set<string>>,
  completedIdsArg?: Set<number>,
  creditCapOrOptions?: number | RebalanceSemestersOptions,
  minTailCreditsArg?: number,
  donorFloorCreditsArg?: number,
  flexibleCourseIdsArg?: Set<number>,
  horizonEndTermArg?: { season: Season; year: number } | null,
  minLastSemesterCreditsArg?: number
): ScheduledSemester[] {
  const resolvedCompletedIds = completedIdsArg ?? new Set<number>();
  const optionsArg =
    typeof creditCapOrOptions === "object" && creditCapOrOptions !== null
      ? (creditCapOrOptions as RebalanceSemestersOptions)
      : null;

  const resolvedCreditCap =
    optionsArg?.creditCap ??
    (typeof creditCapOrOptions === "number" ? creditCapOrOptions : DEFAULT_CREDIT_CAP);
  const resolvedMinTailCredits =
    optionsArg?.minTailCredits ??
    (typeof minTailCreditsArg === "number"
      ? minTailCreditsArg
      : Math.min(12, resolvedCreditCap));
  const resolvedDonorFloorCredits =
    optionsArg?.donorFloorCredits ??
    (typeof donorFloorCreditsArg === "number"
      ? donorFloorCreditsArg
      : Math.max(0, resolvedMinTailCredits - 3));
  const resolvedFlexibleCourseIds =
    optionsArg?.flexibleCourseIds ??
    (flexibleCourseIdsArg ?? new Set<number>());
  const resolvedHorizonEndTerm =
    optionsArg?.horizonEndTerm ??
    (horizonEndTermArg ?? null);
  const resolvedMinLastSemesterCredits =
    optionsArg?.minLastSemesterCredits ??
    (typeof minLastSemesterCreditsArg === "number"
      ? minLastSemesterCreditsArg
      : Math.min(15, resolvedCreditCap));

  const completedIds = resolvedCompletedIds;
  const creditCap = resolvedCreditCap;
  const minTailCredits = resolvedMinTailCredits;
  const donorFloorCredits = resolvedDonorFloorCredits;
  const flexibleCourseIds = resolvedFlexibleCourseIds;
  const horizonEndTerm = resolvedHorizonEndTerm;
  const minLastSemesterCredits = resolvedMinLastSemesterCredits;

  if (semesters.length < 2) return semesters;

  const rebalanced = semesters.map((sem) => ({
    ...sem,
    courses: [...sem.courses],
    totalCredits: sem.totalCredits,
  }));

  const dependentsMap = buildDependentsMap(prereqEdges);
  const allCourses = rebalanced.flatMap((sem) => sem.courses);
  const dependentCounts = buildDependentCounts(
    allCourses.map((course) => course.id),
    prereqEdges
  );
  // Safety guard: front-load should always converge, but cap move count to
  // avoid pathological oscillation on messy real-world data.
  const frontloadOpLimit = Math.max(
    1,
    allCourses.length * Math.max(2, rebalanced.length) * 4
  );
  let frontloadOps = 0;
  const courseToSemester = buildCourseToSemesterMap(rebalanced);
  const coreqs = buildCoreqMap(allCourses);
  const coreqGroups = buildCoreqGroupMap(
    allCourses.map((course) => course.id),
    coreqs
  );
  const getGroupInSemester = (courseId: number, semesterIdx: number): { groupIds: Set<number>; groupCourses: Course[]; groupCredits: number } | null => {
    const groupIds = coreqGroups.get(courseId) ?? new Set([courseId]);
    const groupCourses: Course[] = [];
    let groupCredits = 0;
    for (const groupId of groupIds) {
      if (courseToSemester.get(groupId) !== semesterIdx) return null;
      const member = rebalanced[semesterIdx].courses.find((c) => c.id === groupId);
      if (!member) return null;
      groupCourses.push(member);
      groupCredits += member.credits;
    }
    if (groupCourses.length === 0) return null;
    return { groupIds, groupCourses, groupCredits };
  };

  const moveGroup = (
    sourceIdx: number,
    targetIdx: number,
    groupIds: Set<number>,
    groupCourses: Course[],
    groupCredits: number
  ) => {
    const source = rebalanced[sourceIdx];
    const target = rebalanced[targetIdx];
    source.courses = source.courses.filter((c) => !groupIds.has(c.id));
    source.totalCredits -= groupCredits;
    target.courses.push(...groupCourses);
    target.totalCredits += groupCredits;
    for (const movedCourse of groupCourses) {
      courseToSemester.set(movedCourse.id, targetIdx);
    }
  };

  const termCompare = (
    a: { season: Season; year: number },
    b: { season: Season; year: number }
  ): number => {
    if (a.year !== b.year) return a.year - b.year;
    return SEASON_ORDER[a.season] - SEASON_ORDER[b.season];
  };

  const tryFreeCapacityForIncoming = (
    targetIdx: number,
    donorIdx: number,
    incomingGroupIds: Set<number>,
    neededCredits: number
  ): boolean => {
    if (neededCredits <= 0) return true;
    let freed = 0;

    while (freed < neededCredits) {
      const target = rebalanced[targetIdx];
      let movedOne = false;

      const seenGroups = new Set<string>();
      const evictionCandidates = target.courses
        .filter((course) => !incomingGroupIds.has(course.id))
        .filter((course) => (dependentCounts.get(course.id) ?? 0) === 0)
        .filter((course) => {
          const groupIds = coreqGroups.get(course.id) ?? new Set([course.id]);
          for (const groupId of groupIds) {
            if (incomingGroupIds.has(groupId)) return false;
          }
          const key = [...groupIds].sort((a, b) => a - b).join(",");
          if (seenGroups.has(key)) return false;
          seenGroups.add(key);
          return true;
        })
        .sort((a, b) => {
          const flexA = flexibleCourseIds.has(a.id) ? 0 : 1;
          const flexB = flexibleCourseIds.has(b.id) ? 0 : 1;
          if (flexA !== flexB) return flexA - flexB;
          const depA = dependentCounts.get(a.id) ?? 0;
          const depB = dependentCounts.get(b.id) ?? 0;
          if (depA !== depB) return depA - depB;
          if (a.credits !== b.credits) return a.credits - b.credits;
          return a.id - b.id;
        });

      for (const candidate of evictionCandidates) {
        const group = getGroupInSemester(candidate.id, targetIdx);
        if (!group) continue;

        const relocationTargets: number[] = [];
        if (donorIdx > targetIdx && donorIdx < rebalanced.length) {
          relocationTargets.push(donorIdx);
        }
        for (let idx = targetIdx + 1; idx < rebalanced.length; idx++) {
          if (idx === donorIdx) continue;
          relocationTargets.push(idx);
        }

        for (const laterIdx of relocationTargets) {
          if (laterIdx === targetIdx) continue;
          const later = rebalanced[laterIdx];
          if (later.totalCredits + group.groupCredits > creditCap) continue;

          const canMoveGroup = group.groupCourses.every((member) =>
            canMoveCourseToSemester(
              member,
              laterIdx,
              later,
              courseToSemester,
              prereqEdges,
              dependentsMap,
              availabilityMap,
              completedIds,
              group.groupIds
            )
          );
          if (!canMoveGroup) continue;

          moveGroup(targetIdx, laterIdx, group.groupIds, group.groupCourses, group.groupCredits);
          frontloadOps++;
          freed += group.groupCredits;
          movedOne = true;
          break;
        }

        if (movedOne) break;
      }

      if (!movedOne) break;
    }

    return freed >= neededCredits;
  };

  // Front-load movable courses into the earliest valid terms so prerequisite
  // chains unlock sooner (helps avoid tiny terminal semesters).
  let frontloadMoved = true;
  while (frontloadMoved && frontloadOps < frontloadOpLimit) {
    frontloadMoved = false;

    for (let donorIdx = 1; donorIdx < rebalanced.length; donorIdx++) {
      const donor = rebalanced[donorIdx];
      if (donor.courses.length === 0) continue;

      const seenGroups = new Set<string>();
      const donorCandidates = donor.courses
        .filter((course) => {
          const groupIds = coreqGroups.get(course.id) ?? new Set([course.id]);
          const hasDependents = [...groupIds].some(
            (groupId) => (dependentCounts.get(groupId) ?? 0) > 0
          );
          if (!hasDependents) return false;
          const key = [...groupIds].sort((a, b) => a - b).join(",");
          if (seenGroups.has(key)) return false;
          seenGroups.add(key);
          return true;
        })
        .sort((a, b) => {
          const depA = dependentCounts.get(a.id) ?? 0;
          const depB = dependentCounts.get(b.id) ?? 0;
          if (depA !== depB) return depB - depA;
          const scarcityA = offeringScarcityScore(a.id, availabilityMap);
          const scarcityB = offeringScarcityScore(b.id, availabilityMap);
          if (scarcityA !== scarcityB) return scarcityA - scarcityB;
          return b.credits - a.credits;
        });

      for (const course of donorCandidates) {
        const groupIds = coreqGroups.get(course.id) ?? new Set([course.id]);
        const group = getGroupInSemester(course.id, donorIdx);
        if (!group) continue;
        const { groupCourses, groupCredits } = group;

        let moved = false;
        for (let targetIdx = 0; targetIdx < donorIdx; targetIdx++) {
          const target = rebalanced[targetIdx];
          if (target.totalCredits + groupCredits > creditCap) {
            const needed = target.totalCredits + groupCredits - creditCap;
            const freed = tryFreeCapacityForIncoming(targetIdx, donorIdx, groupIds, needed);
            if (!freed) continue;
            if (target.totalCredits + groupCredits > creditCap) continue;
          }

          const canMoveGroup = groupCourses.every((member) =>
            canMoveCourseToSemester(
              member,
              targetIdx,
              target,
              courseToSemester,
              prereqEdges,
              dependentsMap,
              availabilityMap,
              completedIds,
              groupIds
            )
          );
          if (!canMoveGroup) continue;

          moveGroup(donorIdx, targetIdx, groupIds, groupCourses, groupCredits);
          frontloadOps++;
          frontloadMoved = true;
          moved = true;
          break;
        }

        if (moved) continue;
      }
    }
  }

  for (let i = rebalanced.length - 1; i >= 0; i--) {
    if (rebalanced[i].courses.length === 0) {
      rebalanced.splice(i, 1);
    }
  }
  const refreshedAfterFrontload = buildCourseToSemesterMap(rebalanced);
  courseToSemester.clear();
  for (const [courseId, semIdx] of refreshedAfterFrontload) {
    courseToSemester.set(courseId, semIdx);
  }

  const trailingUnderfilled: number[] = [];
  for (let i = rebalanced.length - 1; i >= 0; i--) {
    if (rebalanced[i].totalCredits < minTailCredits) {
      trailingUnderfilled.unshift(i);
      continue;
    }
    break;
  }

  if (trailingUnderfilled.length > 0) {
    for (const targetIdx of trailingUnderfilled) {
    const target = rebalanced[targetIdx];

    while (target.totalCredits < minTailCredits) {
      let moved = false;

      for (let donorIdx = 0; donorIdx < targetIdx; donorIdx++) {
        const donor = rebalanced[donorIdx];

        // Only donate from sufficiently loaded terms.
        if (donor.totalCredits <= donorFloorCredits) continue;

        const donorCandidates = [...donor.courses].sort((a, b) => {
          const flexA = flexibleCourseIds.has(a.id) ? 0 : 1;
          const flexB = flexibleCourseIds.has(b.id) ? 0 : 1;
          if (flexA !== flexB) return flexA - flexB;
          return b.credits - a.credits;
        });
        for (const course of donorCandidates) {
          const groupIds = coreqGroups.get(course.id) ?? new Set([course.id]);
          const groupCourses: Course[] = [];
          let groupCredits = 0;
          let groupFullyInDonor = true;

          for (const groupId of groupIds) {
            if (courseToSemester.get(groupId) !== donorIdx) {
              groupFullyInDonor = false;
              break;
            }
            const member = donor.courses.find((c) => c.id === groupId);
            if (!member) {
              groupFullyInDonor = false;
              break;
            }
            groupCourses.push(member);
            groupCredits += member.credits;
          }

          if (!groupFullyInDonor || groupCourses.length === 0) continue;
          if (target.totalCredits + groupCredits > creditCap) continue;
          if (donor.totalCredits - groupCredits < donorFloorCredits) continue;

          const canMoveGroup = groupCourses.every((member) =>
            canMoveCourseToSemester(
              member,
              targetIdx,
              target,
              courseToSemester,
              prereqEdges,
              dependentsMap,
              availabilityMap,
              completedIds,
              groupIds
            )
          );
          if (!canMoveGroup) continue;

          donor.courses = donor.courses.filter((c) => !groupIds.has(c.id));
          donor.totalCredits -= groupCredits;
          target.courses.push(...groupCourses);
          target.totalCredits += groupCredits;
          for (const movedCourse of groupCourses) {
            courseToSemester.set(movedCourse.id, targetIdx);
          }
          moved = true;
          break;
        }

        if (moved) break;
      }

      if (!moved) break;
    }
    }
  }

  // Final pass: if trailing semesters can be fully absorbed into earlier terms
  // without violating caps/prereqs/availability, drop the extra late term(s).
  while (rebalanced.length > 1) {
    const donorIdx = rebalanced.length - 1;
    const donor = rebalanced[donorIdx];
    if (donor.courses.length === 0) {
      rebalanced.pop();
      continue;
    }

    const donorCourseIds = new Set(donor.courses.map((course) => course.id));
    let movedAny = true;

    while (donor.courses.length > 0 && movedAny) {
      movedAny = false;

      const donorCandidates = [...donor.courses].sort((a, b) => b.credits - a.credits);
      for (const course of donorCandidates) {
        if (!donorCourseIds.has(course.id)) continue;

        const groupIds = coreqGroups.get(course.id) ?? new Set([course.id]);
        const groupCourses: Course[] = [];
        let groupCredits = 0;
        let groupFullyInDonor = true;

        for (const groupId of groupIds) {
          if (!donorCourseIds.has(groupId)) {
            groupFullyInDonor = false;
            break;
          }
          const member = donor.courses.find((c) => c.id === groupId);
          if (!member) {
            groupFullyInDonor = false;
            break;
          }
          groupCourses.push(member);
          groupCredits += member.credits;
        }

        if (!groupFullyInDonor || groupCourses.length === 0) continue;

        let placed = false;

        // Prefer direct fit first to avoid unnecessary make-room churn.
        for (let targetIdx = donorIdx - 1; targetIdx >= 0; targetIdx--) {
          const target = rebalanced[targetIdx];
          if (target.totalCredits + groupCredits > creditCap) continue;

          const canMoveGroup = groupCourses.every((member) =>
            canMoveCourseToSemester(
              member,
              targetIdx,
              target,
              courseToSemester,
              prereqEdges,
              dependentsMap,
              availabilityMap,
              completedIds,
              groupIds
            )
          );
          if (!canMoveGroup) continue;

          donor.courses = donor.courses.filter((c) => !groupIds.has(c.id));
          donor.totalCredits -= groupCredits;
          target.courses.push(...groupCourses);
          target.totalCredits += groupCredits;
          for (const movedCourse of groupCourses) {
            donorCourseIds.delete(movedCourse.id);
            courseToSemester.set(movedCourse.id, targetIdx);
          }
          movedAny = true;
          placed = true;
          break;
        }

        if (!placed) {
          // If no direct fit exists, try make-room in earlier terms.
          for (let targetIdx = donorIdx - 1; targetIdx >= 0; targetIdx--) {
            const target = rebalanced[targetIdx];
            if (target.totalCredits + groupCredits <= creditCap) continue;

            const needed = target.totalCredits + groupCredits - creditCap;
            const freed = tryFreeCapacityForIncoming(
              targetIdx,
              donorIdx,
              groupIds,
              needed
            );
            if (!freed) continue;
            if (target.totalCredits + groupCredits > creditCap) continue;

            const canMoveGroup = groupCourses.every((member) =>
              canMoveCourseToSemester(
                member,
                targetIdx,
                target,
                courseToSemester,
                prereqEdges,
                dependentsMap,
                availabilityMap,
                completedIds,
                groupIds
              )
            );
            if (!canMoveGroup) continue;

            donor.courses = donor.courses.filter((c) => !groupIds.has(c.id));
            donor.totalCredits -= groupCredits;
            target.courses.push(...groupCourses);
            target.totalCredits += groupCredits;
            for (const movedCourse of groupCourses) {
              donorCourseIds.delete(movedCourse.id);
              courseToSemester.set(movedCourse.id, targetIdx);
            }
            movedAny = true;
            placed = true;
            break;
          }
        }

        if (placed) break;
      }
    }

    if (donor.courses.length > 0) break;

    rebalanced.pop();
    const refreshedMap = buildCourseToSemesterMap(rebalanced);
    courseToSemester.clear();
    for (const [courseId, semIdx] of refreshedMap) {
      courseToSemester.set(courseId, semIdx);
    }
  }

  if (horizonEndTerm) {
    const getHorizonLastIdx = (): number => {
      let idx = -1;
      for (let i = 0; i < rebalanced.length; i++) {
        if (termCompare(rebalanced[i], horizonEndTerm) <= 0) idx = i;
      }
      return idx;
    };

    const tryFreeCapacityInHorizon = (
      targetIdx: number,
      donorIdx: number,
      incomingGroupIds: Set<number>,
      neededCredits: number,
      horizonLastIdx: number
    ): boolean => {
      if (neededCredits <= 0) return true;
      let freed = 0;

      while (freed < neededCredits) {
        const target = rebalanced[targetIdx];
        let movedOne = false;
        const seenGroups = new Set<string>();

        const evictionCandidates = target.courses
          .filter((course) => !incomingGroupIds.has(course.id))
          .filter((course) => flexibleCourseIds.has(course.id))
          .filter((course) => {
            const groupIds = coreqGroups.get(course.id) ?? new Set([course.id]);
            for (const groupId of groupIds) {
              if (incomingGroupIds.has(groupId)) return false;
            }
            const key = [...groupIds].sort((a, b) => a - b).join(",");
            if (seenGroups.has(key)) return false;
            seenGroups.add(key);
            return true;
          })
          .sort((a, b) => {
            if (a.credits !== b.credits) return b.credits - a.credits;
            return a.id - b.id;
          });

        for (const candidate of evictionCandidates) {
          const group = getGroupInSemester(candidate.id, targetIdx);
          if (!group) continue;

          for (let relocationIdx = targetIdx + 1; relocationIdx <= horizonLastIdx; relocationIdx++) {
            if (relocationIdx === donorIdx || relocationIdx === targetIdx) continue;
            const relocation = rebalanced[relocationIdx];
            if (!relocation) continue;
            if (relocation.totalCredits + group.groupCredits > creditCap) continue;

            const canMoveGroup = group.groupCourses.every((member) =>
              canMoveCourseToSemester(
                member,
                relocationIdx,
                relocation,
                courseToSemester,
                prereqEdges,
                dependentsMap,
                availabilityMap,
                completedIds,
                group.groupIds
              )
            );
            if (!canMoveGroup) continue;

            moveGroup(targetIdx, relocationIdx, group.groupIds, group.groupCourses, group.groupCredits);
            freed += group.groupCredits;
            movedOne = true;
            break;
          }

          if (movedOne) break;
        }

        if (!movedOne) break;
      }

      return freed >= neededCredits;
    };

    const horizonOpLimit = Math.max(1, rebalanced.flatMap((sem) => sem.courses).length * 8);
    let horizonOps = 0;

    while (horizonOps < horizonOpLimit) {
      const horizonLastIdx = getHorizonLastIdx();
      if (horizonLastIdx < 0 || horizonLastIdx >= rebalanced.length - 1) break;

      const donorIdx = rebalanced.length - 1;
      if (donorIdx <= horizonLastIdx) break;
      const donor = rebalanced[donorIdx];
      if (!donor || donor.courses.length === 0) {
        rebalanced.pop();
        continue;
      }

      const seenGroups = new Set<string>();
      const donorCandidates = [...donor.courses]
        .filter((course) => {
          const groupIds = coreqGroups.get(course.id) ?? new Set([course.id]);
          const key = [...groupIds].sort((a, b) => a - b).join(",");
          if (seenGroups.has(key)) return false;
          seenGroups.add(key);
          return true;
        })
        .sort((a, b) => {
          const flexA = flexibleCourseIds.has(a.id) ? 0 : 1;
          const flexB = flexibleCourseIds.has(b.id) ? 0 : 1;
          if (flexA !== flexB) return flexA - flexB;
          const depA = dependentCounts.get(a.id) ?? 0;
          const depB = dependentCounts.get(b.id) ?? 0;
          if (depA !== depB) return depA - depB;
          const scarcityA = offeringScarcityScore(a.id, availabilityMap);
          const scarcityB = offeringScarcityScore(b.id, availabilityMap);
          if (scarcityA !== scarcityB) return scarcityA - scarcityB;
          return b.credits - a.credits;
        });

      let movedOne = false;

      for (const candidate of donorCandidates) {
        const group = getGroupInSemester(candidate.id, donorIdx);
        if (!group) continue;

        for (let targetIdx = horizonLastIdx; targetIdx >= 0; targetIdx--) {
          const target = rebalanced[targetIdx];
          if (!target) continue;

          if (target.totalCredits + group.groupCredits > creditCap) {
            const needed = target.totalCredits + group.groupCredits - creditCap;
            const freed = tryFreeCapacityInHorizon(
              targetIdx,
              donorIdx,
              group.groupIds,
              needed,
              horizonLastIdx
            );
            if (!freed) continue;
            if (target.totalCredits + group.groupCredits > creditCap) continue;
          }

          const canMoveGroup = group.groupCourses.every((member) =>
            canMoveCourseToSemester(
              member,
              targetIdx,
              target,
              courseToSemester,
              prereqEdges,
              dependentsMap,
              availabilityMap,
              completedIds,
              group.groupIds
            )
          );
          if (!canMoveGroup) continue;

          moveGroup(donorIdx, targetIdx, group.groupIds, group.groupCourses, group.groupCredits);
          horizonOps++;
          movedOne = true;
          break;
        }

        if (movedOne) break;
      }

      if (!movedOne) break;

      if (rebalanced[donorIdx]?.courses.length === 0) {
        rebalanced.pop();
        const refreshedMap = buildCourseToSemesterMap(rebalanced);
        courseToSemester.clear();
        for (const [courseId, semIdx] of refreshedMap) {
          courseToSemester.set(courseId, semIdx);
        }
      }
    }
  }

  // Targeted pass: if final semester is underfilled, pull flexible courses
  // from the highest-credit donor semesters first.
  if (rebalanced.length > 1) {
    const lastIdx = rebalanced.length - 1;
    const last = rebalanced[lastIdx];
    const lastTarget = Math.min(minLastSemesterCredits, creditCap);

    while (last.totalCredits < lastTarget) {
      let moved = false;

      const donorIndices = Array.from({ length: lastIdx }, (_, i) => i)
        .filter((idx) => rebalanced[idx].totalCredits > donorFloorCredits)
        .sort((a, b) => rebalanced[b].totalCredits - rebalanced[a].totalCredits);

      for (const donorIdx of donorIndices) {
        const donor = rebalanced[donorIdx];
        const seenGroups = new Set<string>();

        const donorCandidates = [...donor.courses]
          .filter((course) => flexibleCourseIds.has(course.id))
          .filter((course) => {
            const groupIds = coreqGroups.get(course.id) ?? new Set([course.id]);
            const key = [...groupIds].sort((x, y) => x - y).join(",");
            if (seenGroups.has(key)) return false;
            seenGroups.add(key);
            return true;
          })
          .sort((a, b) => {
            if (a.credits !== b.credits) return b.credits - a.credits;
            return a.id - b.id;
          });

        for (const candidate of donorCandidates) {
          const group = getGroupInSemester(candidate.id, donorIdx);
          if (!group) continue;
          if (last.totalCredits + group.groupCredits > creditCap) continue;
          if (donor.totalCredits - group.groupCredits < donorFloorCredits) continue;

          const canMoveGroup = group.groupCourses.every((member) =>
            canMoveCourseToSemester(
              member,
              lastIdx,
              last,
              courseToSemester,
              prereqEdges,
              dependentsMap,
              availabilityMap,
              completedIds,
              group.groupIds
            )
          );
          if (!canMoveGroup) continue;

          moveGroup(donorIdx, lastIdx, group.groupIds, group.groupCourses, group.groupCredits);
          moved = true;
          break;
        }

        if (moved) break;
      }

      if (!moved) break;
    }
  }

  // Final smoothing pass: reduce max/min semester credit spread as much as
  // possible without violating prereqs, offerings, coreqs, or credit cap.
  if (rebalanced.length > 1) {
    const totalCredits = rebalanced.reduce((sum, sem) => sum + sem.totalCredits, 0);
    const avgFloor = Math.floor(totalCredits / rebalanced.length);
    const avgCeil = Math.ceil(totalCredits / rebalanced.length);
    const smoothingOpLimit = Math.max(1, allCourses.length * 10);
    let smoothingOps = 0;

    const computeSpread = (): number => {
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const sem of rebalanced) {
        if (sem.totalCredits < min) min = sem.totalCredits;
        if (sem.totalCredits > max) max = sem.totalCredits;
      }
      return max - min;
    };

    while (smoothingOps < smoothingOpLimit) {
      const currentSpread = computeSpread();
      if (currentSpread <= 1) break;

      const donorIndices = Array.from({ length: rebalanced.length }, (_, i) => i).sort(
        (a, b) => rebalanced[b].totalCredits - rebalanced[a].totalCredits
      );
      let moved = false;

      for (const donorIdx of donorIndices) {
        const donor = rebalanced[donorIdx];
        const donorFloor = Math.max(donorFloorCredits, avgFloor);
        if (donor.totalCredits <= donorFloor) continue;

        const recipientIndices = Array.from({ length: rebalanced.length }, (_, i) => i)
          .filter((idx) => idx !== donorIdx)
          .sort((a, b) => rebalanced[a].totalCredits - rebalanced[b].totalCredits);

        const seenGroups = new Set<string>();
        const donorCandidates = [...donor.courses]
          .filter((course) => {
            const groupIds = coreqGroups.get(course.id) ?? new Set([course.id]);
            const key = [...groupIds].sort((x, y) => x - y).join(",");
            if (seenGroups.has(key)) return false;
            seenGroups.add(key);
            return true;
          })
          .sort((a, b) => {
            const flexA = flexibleCourseIds.has(a.id) ? 0 : 1;
            const flexB = flexibleCourseIds.has(b.id) ? 0 : 1;
            if (flexA !== flexB) return flexA - flexB;
            const depA = dependentCounts.get(a.id) ?? 0;
            const depB = dependentCounts.get(b.id) ?? 0;
            if (depA !== depB) return depA - depB;
            if (a.credits !== b.credits) return b.credits - a.credits;
            return a.id - b.id;
          });

        for (const candidate of donorCandidates) {
          const group = getGroupInSemester(candidate.id, donorIdx);
          if (!group) continue;
          if (donor.totalCredits - group.groupCredits < donorFloor) continue;

          for (const recipientIdx of recipientIndices) {
            const recipient = rebalanced[recipientIdx];
            if (recipient.totalCredits + group.groupCredits > creditCap) continue;
            if (recipient.totalCredits >= avgCeil && donor.totalCredits <= avgCeil + 1) continue;

            const canMoveGroup = group.groupCourses.every((member) =>
              canMoveCourseToSemester(
                member,
                recipientIdx,
                recipient,
                courseToSemester,
                prereqEdges,
                dependentsMap,
                availabilityMap,
                completedIds,
                group.groupIds
              )
            );
            if (!canMoveGroup) continue;

            const donorAfter = donor.totalCredits - group.groupCredits;
            const recipientAfter = recipient.totalCredits + group.groupCredits;

            let nextMin = Number.POSITIVE_INFINITY;
            let nextMax = Number.NEGATIVE_INFINITY;
            for (let i = 0; i < rebalanced.length; i++) {
              const credits =
                i === donorIdx ? donorAfter : i === recipientIdx ? recipientAfter : rebalanced[i].totalCredits;
              if (credits < nextMin) nextMin = credits;
              if (credits > nextMax) nextMax = credits;
            }
            const nextSpread = nextMax - nextMin;
            if (nextSpread >= currentSpread) continue;

            moveGroup(donorIdx, recipientIdx, group.groupIds, group.groupCourses, group.groupCredits);
            smoothingOps++;
            moved = true;
            break;
          }

          if (moved) break;
        }

        if (moved) break;
      }

      if (!moved) break;
    }
  }

  return rebalanced;
}

// ── Fill existing plan ───────────────────────────────────

/**
 * For "fill existing" mode: treat already-placed courses as resolved,
 * and only schedule remaining courses into semesters with capacity or new semesters.
 *
 * Prereq ordering is enforced using semester indices — a prereq must be in a
 * strictly earlier term (or in completedIds) to count as satisfied.
 */
export function fillExistingPlan(
  existingTerms: Term[],
  existingCourses: PlannedCourseWithDetails[],
  newCourses: Course[],
  levels: Map<number, number>,
  prereqEdges: Map<number, Set<number>>,
  includeSummers: boolean,
  creditCap: number = DEFAULT_CREDIT_CAP,
  availabilityMap: Map<number, Set<string>> = new Map(),
  completedIds: Set<number> = new Set()
): ScheduleResult {
  if (newCourses.length === 0) return { semesters: [], unscheduledCourseIds: [] };
  const dependentCounts = buildDependentCounts(
    newCourses.map((course) => course.id),
    prereqEdges
  );

  // Build a map of existing term credits
  const termCredits = new Map<number, number>();
  const existingCourseIds = new Set<number>();

  for (const pc of existingCourses) {
    existingCourseIds.add(pc.course_id);
    const current = termCredits.get(pc.term_id) ?? 0;
    termCredits.set(pc.term_id, current + (pc.course?.credits ?? 0));
  }

  // Sort existing terms chronologically
  const sortedTerms = [...existingTerms].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return SEASON_ORDER[a.season] - SEASON_ORDER[b.season];
  });

  // Build semester index for existing terms: termId → chronological index
  const termToIndex = new Map<number, number>();
  for (let i = 0; i < sortedTerms.length; i++) {
    termToIndex.set(sortedTerms[i].id, i);
  }

  // Map existing courses to their term's semester index
  const existingCourseToSemIdx = new Map<number, number>();
  for (const pc of existingCourses) {
    const idx = termToIndex.get(pc.term_id);
    if (idx !== undefined) {
      existingCourseToSemIdx.set(pc.course_id, idx);
    }
  }

  // Determine which semester comes after the last existing term
  const lastTerm = sortedTerms[sortedTerms.length - 1];
  let nextStartSeason: Season;
  let nextStartYear: number;

  if (lastTerm) {
    nextStartSeason = nextSeason(lastTerm.season, includeSummers);
    nextStartYear = nextYear(lastTerm.season, lastTerm.year);
  } else {
    // No existing terms - use current date as fallback
    const now = new Date();
    const month = now.getMonth();
    nextStartSeason = month < 5 ? "Fall" : month < 8 ? "Fall" : "Spring";
    nextStartYear = month < 8 ? now.getFullYear() : now.getFullYear() + 1;
  }

  // Filter new courses that aren't already placed
  const toSchedule = newCourses.filter((c) => !existingCourseIds.has(c.id));
  if (toSchedule.length === 0) return { semesters: [], unscheduledCourseIds: [] };

  // Sort by level, then subject + number for diversity (not credits descending)
  const sorted = [...toSchedule].sort((a, b) => {
    const levelA = levels.get(a.id) ?? 0;
    const levelB = levels.get(b.id) ?? 0;
    if (levelA !== levelB) return levelA - levelB;
    const scarcityA = offeringScarcityScore(a.id, availabilityMap);
    const scarcityB = offeringScarcityScore(b.id, availabilityMap);
    if (scarcityA !== scarcityB) return scarcityA - scarcityB;
    const dependentsA = dependentCounts.get(a.id) ?? 0;
    const dependentsB = dependentCounts.get(b.id) ?? 0;
    if (dependentsA !== dependentsB) return dependentsB - dependentsA;
    if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
    const aNum = parseInt(a.number) || 999;
    const bNum = parseInt(b.number) || 999;
    return aNum - bNum;
  });

  const scheduled = new Set<number>();
  // Track which semester index newly scheduled courses land in
  const newCourseToSemIdx = new Map<number, number>();
  const semesters: ScheduledSemester[] = [];
  const courseById = new Map(toSchedule.map((c) => [c.id, c]));
  const coreqs = buildCoreqMap(toSchedule);
  const coreqGroups = buildCoreqGroupMap(
    toSchedule.map((c) => c.id),
    coreqs
  );

  // First pass: try to fill existing terms that have capacity
  for (let termIdx = 0; termIdx < sortedTerms.length; termIdx++) {
    const term = sortedTerms[termIdx];
    const currentCredits = termCredits.get(term.id) ?? 0;
    let remaining = creditCap - currentCredits;
    if (remaining <= 0) continue;

    const semCourses: Course[] = [];

    // Helper: place the full co-req group atomically in this term.
    const tryPlace = (course: Course): boolean => {
      if (scheduled.has(course.id)) return false;
      const groupIds = coreqGroups.get(course.id) ?? new Set([course.id]);
      const groupCourses: Course[] = [];
      let groupCredits = 0;

      for (const groupId of groupIds) {
        if (scheduled.has(groupId)) continue;
        const member = courseById.get(groupId);
        if (!member) continue;
        if (!isAvailable(member.id, term.season, term.year, availabilityMap)) {
          return false;
        }
        groupCourses.push(member);
        groupCredits += member.credits;
      }

      if (groupCourses.length === 0) return false;
      if (groupCredits > remaining) return false;

      for (const member of groupCourses) {
        const prereqs = prereqEdges.get(member.id);
        if (!prereqs) continue;
        for (const prereqId of prereqs) {
          if (completedIds.has(prereqId)) continue;
          // Co-req pairs are allowed in the same semester.
          if (groupIds.has(prereqId)) continue;
          const existingIdx = existingCourseToSemIdx.get(prereqId);
          if (existingIdx !== undefined && existingIdx < termIdx) continue;
          const newIdx = newCourseToSemIdx.get(prereqId);
          if (newIdx !== undefined && newIdx < termIdx) continue;
          return false;
        }
      }

      for (const member of groupCourses) {
        semCourses.push(member);
        remaining -= member.credits;
        scheduled.add(member.id);
        newCourseToSemIdx.set(member.id, termIdx);
      }

      return true;
    };

    for (const course of sorted) {
      if (scheduled.has(course.id)) continue;
      void tryPlace(course);
    }

    if (semCourses.length > 0) {
      semesters.push({
        season: term.season,
        year: term.year,
        courses: semCourses,
        totalCredits: currentCredits + semCourses.reduce((s, c) => s + c.credits, 0),
      });
    }
  }

  // Second pass: schedule remaining courses into new semesters
  const remainingCourses = sorted.filter((c) => !scheduled.has(c.id));
  if (remainingCourses.length > 0) {
    const result = scheduleCourses(
      remainingCourses,
      levels,
      prereqEdges,
      nextStartSeason,
      nextStartYear,
      includeSummers,
      creditCap,
      availabilityMap,
      completedIds
    );
    semesters.push(...result.semesters);

    // Merge unscheduled from second pass
    const allUnscheduled = result.unscheduledCourseIds;
    return { semesters, unscheduledCourseIds: allUnscheduled };
  }

  return { semesters, unscheduledCourseIds: [] };
}
