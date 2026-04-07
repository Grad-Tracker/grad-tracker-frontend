import type { Course } from "@/types/course";
import type { Season, RequirementBlockWithCourses, Term, PlannedCourseWithDetails } from "@/types/planner";
import type { ScheduledSemester, ScheduleResult, GenEdBucketWithCourses } from "@/types/auto-generate";
import { SEASON_ORDER } from "@/types/planner";
import type { CourseOffering } from "@/lib/supabase/queries/planner";

const DEFAULT_CREDIT_CAP = 15;

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
      const labNum = Number.parseInt(lab.number) || 0;
      // Find closest lecture by course number
      let bestLecture: Course | null = null;
      let bestDist = Infinity;
      for (const lec of lectures) {
        const lecNum = Number.parseInt(lec.number) || 0;
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

const TERM_CODE_SUFFIX_TO_SEASON: Record<string, Season> = {
  FA: "Fall",
  SP: "Spring",
  SU: "Summer",
};

/** Check if a named term code (e.g. "FALL", "SPRING_EVEN") matches season/year */
function matchesNamedTermCode(code: string, season: Season, year: number): boolean {
  switch (code) {
    case "YEARLY":
      return season === "Fall" || season === "Spring";
    case "FALL":
      return season === "Fall";
    case "SPRING":
      return season === "Spring";
    case "SUMMER":
      return season === "Summer";
    case "FALL_EVEN":
      return season === "Fall" && year % 2 === 0;
    case "FALL_ODD":
      return season === "Fall" && year % 2 !== 0;
    case "SPRING_EVEN":
      return season === "Spring" && year % 2 === 0;
    case "SPRING_ODD":
      return season === "Spring" && year % 2 !== 0;
    case "OCCASIONALLY":
      return true;
    default:
      return false;
  }
}

/** Check if a specific term code like "2026FA" matches season/year */
function matchesSpecificTermCode(code: string, season: Season, year: number): boolean {
  for (const [suffix, expectedSeason] of Object.entries(TERM_CODE_SUFFIX_TO_SEASON)) {
    if (code.endsWith(suffix) && season === expectedSeason) {
      return Number.parseInt(code.slice(0, -suffix.length)) === year;
    }
  }
  return false;
}

/** Check if a course is offered in a specific season+year */
export function isAvailable(
  courseId: number,
  season: Season,
  year: number,
  availabilityMap: Map<number, Set<string>>
): boolean {
  const codes = availabilityMap.get(courseId);
  if (!codes || codes.size === 0) return true;

  for (const code of codes) {
    if (matchesNamedTermCode(code, season, year)) return true;
    if (matchesSpecificTermCode(code, season, year)) return true;
  }

  return false;
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
    const aNum = Number.parseInt(a.number) || 999;
    const bNum = Number.parseInt(b.number) || 999;
    return aNum - bNum;
  });

  if (block.rule === "ANY_OF") {
    return sorted.slice(0, 1);
  }

  if (block.rule === "N_OF") {
    const n = block.n_required ?? 1;
    const creditTarget = block.credits_required ?? 0;
    const selected: Course[] = [];
    const used = new Set<number>();
    let credits = 0;
    for (const course of sorted) {
      if (selected.length >= n && credits >= creditTarget) break;
      if (used.has(course.id)) continue;

      selected.push(course);
      used.add(course.id);
      credits += course.credits;

      // If credits still short, pull in same-subject companions first
      // (e.g. CHEM 103 lab after CHEM 101 lecture) before moving to
      // unrelated courses like PHYS 201
      if (credits < creditTarget) {
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
        const aNum = Number.parseInt(a.number) || 999;
        const bNum = Number.parseInt(b.number) || 999;
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
function buildInDegreeAndDependents(
  courseIds: number[],
  courseIdSet: Set<number>,
  prereqEdges: Map<number, Set<number>>
): { inDegree: Map<number, number>; dependents: Map<number, number[]> } {
  const inDegree = new Map<number, number>();
  const dependents = new Map<number, number[]>();

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

  return { inDegree, dependents };
}

function bfsTopologicalLevels(
  inDegree: Map<number, number>,
  dependents: Map<number, number[]>
): Map<number, number> {
  const levels = new Map<number, number>();
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
      const prevLevel = levels.get(dep) ?? 0;
      levels.set(dep, Math.max(prevLevel, currentLevel + 1));
      if (newDeg === 0) {
        queue.push(dep);
      }
    }
  }

  return levels;
}

export function computeTopologicalLevels(
  courseIds: number[],
  prereqEdges: Map<number, Set<number>>
): Map<number, number> {
  const courseIdSet = new Set(courseIds);
  const { inDegree, dependents } = buildInDegreeAndDependents(courseIds, courseIdSet, prereqEdges);
  const levels = bfsTopologicalLevels(inDegree, dependents);

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

  // Sort by level, then subject + course number for natural variety
  // (NOT credits descending — that causes all-5-credit semesters)
  const sorted = [...courses].sort((a, b) => {
    const levelA = levels.get(a.id) ?? 0;
    const levelB = levels.get(b.id) ?? 0;
    if (levelA !== levelB) return levelA - levelB;
    if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
    const aNum = Number.parseInt(a.number) || 999;
    const bNum = Number.parseInt(b.number) || 999;
    return aNum - bNum;
  });

  // Generate enough semesters (worst case: each course needs its own semester cycle)
  const maxSemesters = sorted.length * 3 + 10;
  const semSlots = generateSemesterSequence(startSeason, startYear, maxSemesters, includeSummers);

  const semesters: ScheduledSemester[] = [];
  const scheduled = new Set<number>(); // courseIds already placed
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const coreqs = buildCoreqMap(courses);

  let semIdx = 0;

  while (scheduled.size < sorted.length && semIdx < semSlots.length) {
    const slot = semSlots[semIdx];
    const semCourses: Course[] = [];
    let semCredits = 0;

    // Helper: try to place a single course in this semester
    const tryPlace = (course: Course): boolean => {
      if (scheduled.has(course.id)) return false;
      if (semCredits + course.credits > creditCap) return false;
      if (!isAvailable(course.id, slot.season, slot.year, availabilityMap)) return false;

      const prereqs = prereqEdges.get(course.id);
      if (prereqs) {
        for (const prereqId of prereqs) {
          if (completedIds.has(prereqId)) continue;
          if (courseById.has(prereqId) && !scheduled.has(prereqId)) return false;
        }
      }

      semCourses.push(course);
      semCredits += course.credits;
      scheduled.add(course.id);
      return true;
    };

    // Try ALL remaining courses — this finds 3cr courses to fill gaps
    // when 5cr courses don't fit, packing semesters close to the cap
    for (const course of sorted) {
      if (scheduled.has(course.id)) continue;
      if (semCredits + course.credits > creditCap) continue;

      if (!tryPlace(course)) continue;

      // Eagerly co-schedule lab/lecture partners in the same semester
      const partners = coreqs.get(course.id);
      if (partners) {
        for (const partnerId of partners) {
          const partner = courseById.get(partnerId);
          if (partner) tryPlace(partner);
        }
      }
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

  const context = createExistingPlanContext(existingTerms, existingCourses, includeSummers);
  const toSchedule = newCourses.filter((c) => !context.existingCourseIds.has(c.id));
  if (toSchedule.length === 0) return { semesters: [], unscheduledCourseIds: [] };

  const sorted = sortCoursesByLevelAndCode(toSchedule, levels);
  const placement = placeIntoExistingSemesters(
    sorted,
    context,
    prereqEdges,
    completedIds,
    creditCap,
    availabilityMap
  );

  const remainingCourses = sorted.filter((c) => !placement.scheduled.has(c.id));
  if (remainingCourses.length === 0) {
    return { semesters: placement.semesters, unscheduledCourseIds: [] };
  }

  const secondPass = scheduleCourses(
    remainingCourses,
    levels,
    prereqEdges,
    context.nextStartSeason,
    context.nextStartYear,
    includeSummers,
    creditCap,
    availabilityMap,
    completedIds
  );

  return {
    semesters: [...placement.semesters, ...secondPass.semesters],
    unscheduledCourseIds: secondPass.unscheduledCourseIds,
  };
}

type ExistingPlanContext = {
  existingCourseIds: Set<number>;
  termCredits: Map<number, number>;
  sortedTerms: Term[];
  existingCourseToSemIdx: Map<number, number>;
  nextStartSeason: Season;
  nextStartYear: number;
};

type ExistingPlacementResult = {
  semesters: ScheduledSemester[];
  scheduled: Set<number>;
};

function sortCoursesByLevelAndCode(
  courses: Course[],
  levels: Map<number, number>
): Course[] {
  return [...courses].sort((a, b) => {
    const levelA = levels.get(a.id) ?? 0;
    const levelB = levels.get(b.id) ?? 0;
    if (levelA !== levelB) return levelA - levelB;
    if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
    const aNum = Number.parseInt(a.number) || 999;
    const bNum = Number.parseInt(b.number) || 999;
    return aNum - bNum;
  });
}

function createExistingPlanContext(
  existingTerms: Term[],
  existingCourses: PlannedCourseWithDetails[],
  includeSummers: boolean
): ExistingPlanContext {
  const existingCourseIds = new Set<number>();
  const termCredits = new Map<number, number>();

  for (const pc of existingCourses) {
    existingCourseIds.add(pc.course_id);
    const current = termCredits.get(pc.term_id) ?? 0;
    termCredits.set(pc.term_id, current + (pc.course?.credits ?? 0));
  }

  const sortedTerms = [...existingTerms].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return SEASON_ORDER[a.season] - SEASON_ORDER[b.season];
  });

  const termToIndex = new Map<number, number>();
  for (let i = 0; i < sortedTerms.length; i++) {
    termToIndex.set(sortedTerms[i].id, i);
  }

  const existingCourseToSemIdx = new Map<number, number>();
  for (const pc of existingCourses) {
    const idx = termToIndex.get(pc.term_id);
    if (idx !== undefined) existingCourseToSemIdx.set(pc.course_id, idx);
  }

  const nextStart = getNextStartTerm(sortedTerms, includeSummers);
  return {
    existingCourseIds,
    termCredits,
    sortedTerms,
    existingCourseToSemIdx,
    nextStartSeason: nextStart.season,
    nextStartYear: nextStart.year,
  };
}

function getNextStartTerm(
  sortedTerms: Term[],
  includeSummers: boolean
): { season: Season; year: number } {
  const lastTerm = sortedTerms[sortedTerms.length - 1];
  if (lastTerm) {
    return {
      season: nextSeason(lastTerm.season, includeSummers),
      year: nextYear(lastTerm.season, lastTerm.year),
    };
  }

  const now = new Date();
  const month = now.getMonth();
  const season: Season = month < 8 ? "Fall" : "Spring";
  const year = month < 8 ? now.getFullYear() : now.getFullYear() + 1;
  return { season, year };
}

function arePrereqsSatisfiedForExistingTerm(
  course: Course,
  termIdx: number,
  prereqEdges: Map<number, Set<number>>,
  completedIds: Set<number>,
  existingCourseToSemIdx: Map<number, number>,
  newCourseToSemIdx: Map<number, number>
): boolean {
  const prereqs = prereqEdges.get(course.id);
  if (!prereqs) return true;

  for (const prereqId of prereqs) {
    if (completedIds.has(prereqId)) continue;
    const existingIdx = existingCourseToSemIdx.get(prereqId);
    if (existingIdx !== undefined && existingIdx < termIdx) continue;
    const newIdx = newCourseToSemIdx.get(prereqId);
    if (newIdx !== undefined && newIdx < termIdx) continue;
    return false;
  }

  return true;
}

type TermPlacementState = {
  semCourses: Course[];
  remaining: number;
  scheduled: Set<number>;
  newCourseToSemIdx: Map<number, number>;
};

function tryPlaceInExistingTerm(
  course: Course,
  term: Term,
  termIdx: number,
  state: TermPlacementState,
  prereqEdges: Map<number, Set<number>>,
  completedIds: Set<number>,
  existingCourseToSemIdx: Map<number, number>,
  availabilityMap: Map<number, Set<string>>
): boolean {
  if (state.scheduled.has(course.id)) return false;
  if (course.credits > state.remaining) return false;
  if (!isAvailable(course.id, term.season, term.year, availabilityMap)) return false;
  if (
    !arePrereqsSatisfiedForExistingTerm(
      course, termIdx, prereqEdges, completedIds,
      existingCourseToSemIdx, state.newCourseToSemIdx
    )
  ) {
    return false;
  }

  state.semCourses.push(course);
  state.remaining -= course.credits;
  state.scheduled.add(course.id);
  state.newCourseToSemIdx.set(course.id, termIdx);
  return true;
}

function placeIntoExistingSemesters(
  sortedCourses: Course[],
  context: ExistingPlanContext,
  prereqEdges: Map<number, Set<number>>,
  completedIds: Set<number>,
  creditCap: number,
  availabilityMap: Map<number, Set<string>>
): ExistingPlacementResult {
  const scheduled = new Set<number>();
  const newCourseToSemIdx = new Map<number, number>();
  const semesters: ScheduledSemester[] = [];
  const coreqs = buildCoreqMap(sortedCourses);
  const courseById = new Map(sortedCourses.map((c) => [c.id, c]));

  for (let termIdx = 0; termIdx < context.sortedTerms.length; termIdx++) {
    const term = context.sortedTerms[termIdx];
    const currentCredits = context.termCredits.get(term.id) ?? 0;
    const remaining = creditCap - currentCredits;
    if (remaining <= 0) continue;

    const state: TermPlacementState = {
      semCourses: [],
      remaining,
      scheduled,
      newCourseToSemIdx,
    };

    for (const course of sortedCourses) {
      if (scheduled.has(course.id) || course.credits > state.remaining) continue;
      if (!tryPlaceInExistingTerm(course, term, termIdx, state, prereqEdges, completedIds, context.existingCourseToSemIdx, availabilityMap)) continue;

      const partners = coreqs.get(course.id);
      if (partners) {
        for (const partnerId of partners) {
          const partner = courseById.get(partnerId);
          if (partner) tryPlaceInExistingTerm(partner, term, termIdx, state, prereqEdges, completedIds, context.existingCourseToSemIdx, availabilityMap);
        }
      }
    }

    if (state.semCourses.length > 0) {
      semesters.push({
        season: term.season,
        year: term.year,
        courses: state.semCourses,
        totalCredits: currentCredits + state.semCourses.reduce((s, c) => s + c.credits, 0),
      });
    }
  }

  return { semesters, scheduled };
}

