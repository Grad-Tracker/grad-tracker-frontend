import { describe, it, expect, beforeEach } from "vitest";
import {
  buildCoreqMap,
  buildAvailabilityMap,
  isAvailable,
  selectCoursesForBlock,
  resolveGenEdGaps,
  computeTopologicalLevels,
  scheduleCourses,
  fillExistingPlan,
  rebalanceSemesters,
} from "@/lib/planner/auto-generate";

// ---------------------------------------------------------------------------
// Types (local aliases for readability)
// ---------------------------------------------------------------------------
type Season = "Fall" | "Spring" | "Summer";

interface Course {
  id: number;
  subject: string;
  number: string;
  title: string;
  credits: number;
  description?: string | null;
  prereq_text?: string | null;
}

interface CourseOffering {
  course_id: number;
  term_code: string;
}

interface RequirementBlockWithCourses {
  id: number;
  program_id: number;
  name: string;
  rule: string;
  n_required: number | null;
  credits_required: number | null;
  courses: Course[];
}

interface GenEdBucketWithCourses {
  id: number;
  code: string;
  name: string;
  credits_required: number;
  courses: Course[];
}

interface Term {
  id: number;
  season: Season;
  year: number;
}

interface PlannedCourseWithDetails {
  student_id: number;
  term_id: number;
  course_id: number;
  status: string;
  plan_id: number;
  course: Course;
}

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------
let nextCourseId: number;
let nextBlockId: number;
let nextBucketId: number;
let nextTermId: number;

beforeEach(() => {
  nextCourseId = 1;
  nextBlockId = 1;
  nextBucketId = 1;
  nextTermId = 1;
});

function makeCourse(overrides: Partial<Course> = {}): Course {
  const id = overrides.id ?? nextCourseId++;
  return {
    id,
    subject: "CS",
    number: "101",
    title: "Intro to CS",
    credits: 3,
    description: null,
    prereq_text: null,
    ...overrides,
  };
}

function makeBlock(
  overrides: Partial<RequirementBlockWithCourses> = {}
): RequirementBlockWithCourses {
  const id = overrides.id ?? nextBlockId++;
  return {
    id,
    program_id: 1,
    name: "Core Courses",
    rule: "ALL_OF",
    n_required: null,
    credits_required: null,
    courses: [],
    ...overrides,
  };
}

function makeBucket(
  overrides: Partial<GenEdBucketWithCourses> = {}
): GenEdBucketWithCourses {
  const id = overrides.id ?? nextBucketId++;
  return {
    id,
    code: "HU",
    name: "Humanities",
    credits_required: 6,
    courses: [],
    ...overrides,
  };
}

function makeTerm(overrides: Partial<Term> = {}): Term {
  const id = overrides.id ?? nextTermId++;
  return {
    id,
    season: "Fall",
    year: 2026,
    ...overrides,
  };
}

function makePlannedCourse(
  termId: number,
  course: Course,
  overrides: Partial<PlannedCourseWithDetails> = {}
): PlannedCourseWithDetails {
  return {
    student_id: 1,
    term_id: termId,
    course_id: course.id,
    status: "PLANNED",
    plan_id: 1,
    course,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildCoreqMap
// ---------------------------------------------------------------------------
describe("buildCoreqMap", () => {
  it("pairs a 1-credit lab with a 3-credit lecture in the same subject within number distance ≤ 5", () => {
    const lab = makeCourse({
      subject: "CHEM",
      number: "101",
      title: "Chem Lab",
      credits: 1,
    });
    const lecture = makeCourse({
      subject: "CHEM",
      number: "103",
      title: "Chemistry",
      credits: 3,
    });

    const map = buildCoreqMap([lab, lecture]);

    expect(map.get(lab.id)?.has(lecture.id)).toBe(true);
    expect(map.get(lecture.id)?.has(lab.id)).toBe(true);
  });

  it("returns an empty map when there are no labs in input", () => {
    const c1 = makeCourse({ credits: 3, title: "Lecture A" });
    const c2 = makeCourse({ credits: 3, title: "Lecture B" });

    const map = buildCoreqMap([c1, c2]);

    expect(map.size).toBe(0);
  });

  it("only pairs courses within the same subject", () => {
    const chemLab = makeCourse({
      subject: "CHEM",
      number: "101",
      title: "Chem Lab",
      credits: 1,
    });
    const physLecture = makeCourse({
      subject: "PHYS",
      number: "102",
      title: "Physics",
      credits: 3,
    });
    const chemLecture = makeCourse({
      subject: "CHEM",
      number: "103",
      title: "Chemistry",
      credits: 3,
    });

    const map = buildCoreqMap([chemLab, physLecture, chemLecture]);

    // CHEM lab pairs with CHEM lecture
    expect(map.get(chemLab.id)?.has(chemLecture.id)).toBe(true);
    // CHEM lab does NOT pair with PHYS lecture
    expect(map.get(chemLab.id)?.has(physLecture.id)).toBeFalsy();
  });

  it("does not pair lab and lecture when number distance > 5", () => {
    const lab = makeCourse({
      subject: "CHEM",
      number: "101",
      title: "Chem Lab",
      credits: 1,
    });
    const lecture = makeCourse({
      subject: "CHEM",
      number: "200",
      title: "Chemistry II",
      credits: 3,
    });

    const map = buildCoreqMap([lab, lecture]);

    expect(map.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildAvailabilityMap
// ---------------------------------------------------------------------------
describe("buildAvailabilityMap", () => {
  it("maps offerings to a Set of term codes per course", () => {
    const offerings: CourseOffering[] = [
      { course_id: 10, term_code: "FALL" },
    ];

    const map = buildAvailabilityMap(offerings);

    expect(map.get(10)).toEqual(new Set(["FALL"]));
  });

  it("merges multiple offerings for the same course into one Set", () => {
    const offerings: CourseOffering[] = [
      { course_id: 10, term_code: "FALL" },
      { course_id: 10, term_code: "SPRING" },
      { course_id: 10, term_code: "SUMMER" },
    ];

    const map = buildAvailabilityMap(offerings);

    expect(map.get(10)).toEqual(new Set(["FALL", "SPRING", "SUMMER"]));
  });

  it("returns an empty map for empty offerings", () => {
    const map = buildAvailabilityMap([]);

    expect(map.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------
describe("isAvailable", () => {
  function availMap(
    courseId: number,
    codes: string[]
  ): Map<number, Set<string>> {
    return new Map([[courseId, new Set(codes)]]);
  }

  it("FALL code → true for Fall, false for Spring", () => {
    const map = availMap(1, ["FALL"]);
    expect(isAvailable(1, "Fall", 2026, map)).toBe(true);
    expect(isAvailable(1, "Spring", 2026, map)).toBe(false);
  });

  it("SPRING code → true for Spring, false for Fall", () => {
    const map = availMap(1, ["SPRING"]);
    expect(isAvailable(1, "Spring", 2026, map)).toBe(true);
    expect(isAvailable(1, "Fall", 2026, map)).toBe(false);
  });

  it("SUMMER code → true for Summer, false for Fall", () => {
    const map = availMap(1, ["SUMMER"]);
    expect(isAvailable(1, "Summer", 2026, map)).toBe(true);
    expect(isAvailable(1, "Fall", 2026, map)).toBe(false);
  });

  it("YEARLY → true for Fall and Spring, false for Summer", () => {
    const map = availMap(1, ["YEARLY"]);
    expect(isAvailable(1, "Fall", 2026, map)).toBe(true);
    expect(isAvailable(1, "Spring", 2026, map)).toBe(true);
    expect(isAvailable(1, "Summer", 2026, map)).toBe(false);
  });

  it("FALL_EVEN → true for Fall in even year, false for odd year", () => {
    const map = availMap(1, ["FALL_EVEN"]);
    expect(isAvailable(1, "Fall", 2026, map)).toBe(true);
    expect(isAvailable(1, "Fall", 2027, map)).toBe(false);
  });

  it("FALL_ODD → true for Fall in odd year, false for even year", () => {
    const map = availMap(1, ["FALL_ODD"]);
    expect(isAvailable(1, "Fall", 2027, map)).toBe(true);
    expect(isAvailable(1, "Fall", 2026, map)).toBe(false);
  });

  it("SPRING_EVEN → true for Spring in even year", () => {
    const map = availMap(1, ["SPRING_EVEN"]);
    expect(isAvailable(1, "Spring", 2026, map)).toBe(true);
    expect(isAvailable(1, "Spring", 2027, map)).toBe(false);
  });

  it("SPRING_ODD → true for Spring in odd year", () => {
    const map = availMap(1, ["SPRING_ODD"]);
    expect(isAvailable(1, "Spring", 2027, map)).toBe(true);
    expect(isAvailable(1, "Spring", 2026, map)).toBe(false);
  });

  it("OCCASIONALLY → always true", () => {
    const map = availMap(1, ["OCCASIONALLY"]);
    expect(isAvailable(1, "Fall", 2026, map)).toBe(true);
    expect(isAvailable(1, "Spring", 2027, map)).toBe(true);
    expect(isAvailable(1, "Summer", 2028, map)).toBe(true);
  });

  it("specific term code '2026FA' → true for Fall 2026, false for Fall 2027", () => {
    const map = availMap(1, ["2026FA"]);
    expect(isAvailable(1, "Fall", 2026, map)).toBe(true);
    expect(isAvailable(1, "Fall", 2027, map)).toBe(false);
  });

  it("no availability data → always true (treated as available everywhere)", () => {
    const emptyMap = new Map<number, Set<string>>();
    expect(isAvailable(999, "Fall", 2026, emptyMap)).toBe(true);
    expect(isAvailable(999, "Spring", 2027, emptyMap)).toBe(true);
    expect(isAvailable(999, "Summer", 2028, emptyMap)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// selectCoursesForBlock
// ---------------------------------------------------------------------------
describe("selectCoursesForBlock", () => {
  it("ALL_OF → returns all non-completed, non-selected courses", () => {
    const c1 = makeCourse();
    const c2 = makeCourse();
    const c3 = makeCourse();
    const block = makeBlock({ rule: "ALL_OF", courses: [c1, c2, c3] });

    const result = selectCoursesForBlock(
      block,
      new Set<number>(),
      new Set<number>(),
      new Set<number>(),
      new Map<number, number>()
    );

    expect(result).toHaveLength(3);
    expect(result.map((c) => c.id)).toEqual(
      expect.arrayContaining([c1.id, c2.id, c3.id])
    );
  });

  it("ANY_OF → returns exactly 1 course", () => {
    const c1 = makeCourse();
    const c2 = makeCourse();
    const block = makeBlock({ rule: "ANY_OF", courses: [c1, c2] });

    const result = selectCoursesForBlock(
      block,
      new Set<number>(),
      new Set<number>(),
      new Set<number>(),
      new Map<number, number>()
    );

    expect(result).toHaveLength(1);
  });

  it("N_OF → returns n_required courses", () => {
    const courses = Array.from({ length: 5 }, () => makeCourse());
    const block = makeBlock({
      rule: "N_OF",
      n_required: 3,
      courses,
    });

    const result = selectCoursesForBlock(
      block,
      new Set<number>(),
      new Set<number>(),
      new Set<number>(),
      new Map<number, number>()
    );

    expect(result).toHaveLength(3);
  });

  it("N_OF with credits_required → returns courses until credit target is met", () => {
    const c1 = makeCourse({ credits: 5, number: "101" });
    const c2 = makeCourse({ credits: 4, number: "102" });
    const c3 = makeCourse({ credits: 3, number: "103" });
    const block = makeBlock({
      rule: "N_OF",
      n_required: 9,
      credits_required: 9,
      courses: [c1, c2, c3],
    });

    const result = selectCoursesForBlock(
      block,
      new Set<number>(),
      new Set<number>(),
      new Set<number>(),
      new Map<number, number>()
    );

    const totalCredits = result.reduce((sum, c) => sum + c.credits, 0);
    expect(totalCredits).toBeGreaterThanOrEqual(9);
    expect(result).toHaveLength(2);
  });

  it("CREDITS_OF → returns courses until credits_required is met", () => {
    const c1 = makeCourse({ credits: 3 });
    const c2 = makeCourse({ credits: 3 });
    const c3 = makeCourse({ credits: 3 });
    const c4 = makeCourse({ credits: 3 });
    const block = makeBlock({
      rule: "CREDITS_OF",
      credits_required: 6,
      courses: [c1, c2, c3, c4],
    });

    const result = selectCoursesForBlock(
      block,
      new Set<number>(),
      new Set<number>(),
      new Set<number>(),
      new Map<number, number>()
    );

    const totalCredits = result.reduce((sum, c) => sum + c.credits, 0);
    expect(totalCredits).toBeGreaterThanOrEqual(6);
    // Should not over-select wildly — at most one extra course beyond the threshold
    expect(totalCredits).toBeLessThanOrEqual(9);
  });

  it("filters out completed courses", () => {
    const c1 = makeCourse();
    const c2 = makeCourse();
    const block = makeBlock({ rule: "ALL_OF", courses: [c1, c2] });

    const result = selectCoursesForBlock(
      block,
      new Set([c1.id]),
      new Set<number>(),
      new Set<number>(),
      new Map<number, number>()
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(c2.id);
  });

  it("filters out already-selected courses", () => {
    const c1 = makeCourse();
    const c2 = makeCourse();
    const block = makeBlock({ rule: "ALL_OF", courses: [c1, c2] });

    const result = selectCoursesForBlock(
      block,
      new Set<number>(),
      new Set([c2.id]),
      new Set<number>(),
      new Map<number, number>()
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(c1.id);
  });

  it("prefers gen-ed overlap courses, then fewer prereqs, then lower course numbers", () => {
    // c1: NOT gen-ed, 0 prereqs, number "100"
    const c1 = makeCourse({ number: "100", credits: 3 });
    // c2: IS gen-ed overlap, 2 prereqs, number "300"
    const c2 = makeCourse({ number: "300", credits: 3 });
    // c3: IS gen-ed overlap, 0 prereqs, number "200"
    const c3 = makeCourse({ number: "200", credits: 3 });

    const genEdCourseIds = new Set([c2.id, c3.id]);
    const prereqCounts = new Map<number, number>([
      [c1.id, 0],
      [c2.id, 2],
      [c3.id, 0],
    ]);

    const block = makeBlock({
      rule: "N_OF",
      n_required: 1,
      courses: [c1, c2, c3],
    });

    const result = selectCoursesForBlock(
      block,
      new Set<number>(),
      new Set<number>(),
      genEdCourseIds,
      prereqCounts
    );

    // Should prefer c3: gen-ed overlap + 0 prereqs + lower number than c2
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(c3.id);
  });
});

// ---------------------------------------------------------------------------
// resolveGenEdGaps
// ---------------------------------------------------------------------------
describe("resolveGenEdGaps", () => {
  it("returns nothing when bucket is fully covered by selected courses", () => {
    const c1 = makeCourse({ credits: 3 });
    const c2 = makeCourse({ credits: 3 });
    const bucket = makeBucket({
      credits_required: 6,
      courses: [c1, c2],
    });

    const selectedProgramCourseIds = new Set([c1.id, c2.id]);

    const result = resolveGenEdGaps(
      selectedProgramCourseIds,
      [bucket],
      new Set<number>(),
      new Map<number, number>()
    );

    expect(result).toHaveLength(0);
  });

  it("picks additional courses to fill a partial gap", () => {
    const c1 = makeCourse({ credits: 3 });
    const c2 = makeCourse({ credits: 3 });
    const c3 = makeCourse({ credits: 3 });
    const bucket = makeBucket({
      credits_required: 6,
      courses: [c1, c2, c3],
    });

    // Only c1 is already selected from program courses
    const selectedProgramCourseIds = new Set([c1.id]);

    const result = resolveGenEdGaps(
      selectedProgramCourseIds,
      [bucket],
      new Set<number>(),
      new Map<number, number>()
    );

    // Need 3 more credits → should pick 1 additional course
    expect(result.length).toBeGreaterThanOrEqual(1);
    const totalAdditionalCredits = result.reduce(
      (sum, c) => sum + c.credits,
      0
    );
    expect(totalAdditionalCredits).toBeGreaterThanOrEqual(3);
  });

  it("returns empty when no available courses after filtering completed", () => {
    const c1 = makeCourse({ credits: 3 });
    const c2 = makeCourse({ credits: 3 });
    const bucket = makeBucket({
      credits_required: 6,
      courses: [c1, c2],
    });

    // No program courses selected, but all bucket courses are completed
    const completedIds = new Set([c1.id, c2.id]);

    const result = resolveGenEdGaps(
      new Set<number>(),
      [bucket],
      completedIds,
      new Map<number, number>()
    );

    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// computeTopologicalLevels
// ---------------------------------------------------------------------------
describe("computeTopologicalLevels", () => {
  it("assigns level 0 to all courses when there are no prereqs", () => {
    const levels = computeTopologicalLevels(
      [1, 2, 3],
      new Map<number, Set<number>>()
    );

    expect(levels.get(1)).toBe(0);
    expect(levels.get(2)).toBe(0);
    expect(levels.get(3)).toBe(0);
  });

  it("assigns increasing levels for a linear chain A→B→C", () => {
    // B depends on A, C depends on B
    const prereqEdges = new Map<number, Set<number>>([
      [2, new Set([1])], // B requires A
      [3, new Set([2])], // C requires B
    ]);

    const levels = computeTopologicalLevels([1, 2, 3], prereqEdges);

    expect(levels.get(1)).toBe(0);
    expect(levels.get(2)).toBe(1);
    expect(levels.get(3)).toBe(2);
  });

  it("assigns correct levels for a diamond dependency", () => {
    //     A (0)
    //    / \
    //   B   C  (1)
    //    \ /
    //     D    (2)
    const prereqEdges = new Map<number, Set<number>>([
      [2, new Set([1])], // B requires A
      [3, new Set([1])], // C requires A
      [4, new Set([2, 3])], // D requires B and C
    ]);

    const levels = computeTopologicalLevels([1, 2, 3, 4], prereqEdges);

    expect(levels.get(1)).toBe(0);
    expect(levels.get(2)).toBe(1);
    expect(levels.get(3)).toBe(1);
    expect(levels.get(4)).toBe(2);
  });

  it("assigns level 999 for courses involved in a cycle", () => {
    // A requires B, B requires A → cycle
    const prereqEdges = new Map<number, Set<number>>([
      [1, new Set([2])],
      [2, new Set([1])],
    ]);

    const levels = computeTopologicalLevels([1, 2], prereqEdges);

    expect(levels.get(1)).toBe(999);
    expect(levels.get(2)).toBe(999);
  });
});

// ---------------------------------------------------------------------------
// scheduleCourses
// ---------------------------------------------------------------------------
describe("scheduleCourses", () => {
  it("returns empty result for empty courses array", () => {
    const result = scheduleCourses(
      [],
      new Map<number, number>(),
      new Map<number, Set<number>>(),
      "Fall",
      2026,
      false
    );

    expect(result.semesters).toHaveLength(0);
    expect(result.unscheduledCourseIds).toHaveLength(0);
  });

  it("schedules courses sorted by level into semesters", () => {
    const c1 = makeCourse({ credits: 3 });
    const c2 = makeCourse({ credits: 3 });

    const levels = new Map<number, number>([
      [c1.id, 0],
      [c2.id, 0],
    ]);

    const result = scheduleCourses(
      [c1, c2],
      levels,
      new Map<number, Set<number>>(),
      "Fall",
      2026,
      false
    );

    expect(result.semesters.length).toBeGreaterThanOrEqual(1);
    const allScheduled = result.semesters.flatMap((s) => s.courses);
    expect(allScheduled).toHaveLength(2);
  });

  it("does not exceed creditCap per semester", () => {
    const courses = Array.from({ length: 6 }, () =>
      makeCourse({ credits: 3 })
    );
    const levels = new Map<number, number>(
      courses.map((c) => [c.id, 0])
    );

    const result = scheduleCourses(
      courses,
      levels,
      new Map<number, Set<number>>(),
      "Fall",
      2026,
      false,
      9 // cap at 9 credits per semester
    );

    for (const sem of result.semesters) {
      expect(sem.totalCredits).toBeLessThanOrEqual(9);
    }
  });

  it("places prereqs in an earlier semester than dependents", () => {
    const prereq = makeCourse({ credits: 3, number: "101" });
    const dependent = makeCourse({ credits: 3, number: "201" });

    const levels = new Map<number, number>([
      [prereq.id, 0],
      [dependent.id, 1],
    ]);
    const prereqEdges = new Map<number, Set<number>>([
      [dependent.id, new Set([prereq.id])],
    ]);

    // Use a low credit cap so each course gets its own semester
    const result = scheduleCourses(
      [dependent, prereq],
      levels,
      prereqEdges,
      "Fall",
      2026,
      false,
      3
    );

    // Find semester index for each course
    let prereqSemIdx = -1;
    let dependentSemIdx = -1;
    result.semesters.forEach((sem, idx) => {
      if (sem.courses.some((c) => c.id === prereq.id)) prereqSemIdx = idx;
      if (sem.courses.some((c) => c.id === dependent.id))
        dependentSemIdx = idx;
    });

    expect(prereqSemIdx).toBeGreaterThanOrEqual(0);
    expect(dependentSemIdx).toBeGreaterThan(prereqSemIdx);
  });

  it("does not allow prereq and dependent in the same semester even when capacity allows", () => {
    const prereq = makeCourse({ id: 900, credits: 3, number: "100" });
    const dependent = makeCourse({ id: 901, credits: 3, number: "200" });
    const filler = makeCourse({ id: 902, credits: 3, number: "110" });

    const levels = new Map<number, number>([
      [prereq.id, 0],
      [filler.id, 0],
      [dependent.id, 1],
    ]);
    const prereqEdges = new Map<number, Set<number>>([
      [dependent.id, new Set([prereq.id])],
    ]);

    const result = scheduleCourses(
      [prereq, dependent, filler],
      levels,
      prereqEdges,
      "Fall",
      2026,
      false,
      18
    );

    let prereqSemIdx = -1;
    let dependentSemIdx = -1;
    result.semesters.forEach((sem, idx) => {
      if (sem.courses.some((c) => c.id === prereq.id)) prereqSemIdx = idx;
      if (sem.courses.some((c) => c.id === dependent.id)) dependentSemIdx = idx;
    });

    expect(prereqSemIdx).toBeGreaterThanOrEqual(0);
    expect(dependentSemIdx).toBeGreaterThanOrEqual(0);
    expect(prereqSemIdx).toBeLessThan(dependentSemIdx);
  });

  it("does not place a spring-only course in a fall semester", () => {
    const springCourse = makeCourse({ credits: 3 });

    const levels = new Map<number, number>([[springCourse.id, 0]]);
    const availabilityMap = new Map<number, Set<string>>([
      [springCourse.id, new Set(["SPRING"])],
    ]);

    const result = scheduleCourses(
      [springCourse],
      levels,
      new Map<number, Set<number>>(),
      "Fall",
      2026,
      false,
      undefined,
      availabilityMap
    );

    // The course should be in a Spring semester, not Fall
    for (const sem of result.semesters) {
      if (sem.courses.some((c) => c.id === springCourse.id)) {
        expect(sem.season).toBe("Spring");
      }
    }
  });

  it("places coreq lab and lecture in the same semester", () => {
    const lab = makeCourse({
      subject: "CHEM",
      number: "101",
      title: "Chem Lab",
      credits: 1,
    });
    const lecture = makeCourse({
      subject: "CHEM",
      number: "103",
      title: "Chemistry",
      credits: 3,
    });

    const levels = new Map<number, number>([
      [lab.id, 0],
      [lecture.id, 0],
    ]);

    const result = scheduleCourses(
      [lab, lecture],
      levels,
      new Map<number, Set<number>>(),
      "Fall",
      2026,
      false
    );

    // Find semesters containing each
    let labSemIdx = -1;
    let lectureSemIdx = -1;
    result.semesters.forEach((sem, idx) => {
      if (sem.courses.some((c) => c.id === lab.id)) labSemIdx = idx;
      if (sem.courses.some((c) => c.id === lecture.id)) lectureSemIdx = idx;
    });

    expect(labSemIdx).toBeGreaterThanOrEqual(0);
    expect(lectureSemIdx).toBeGreaterThanOrEqual(0);
    expect(labSemIdx).toBe(lectureSemIdx);
  });
});

// ---------------------------------------------------------------------------
// fillExistingPlan
// ---------------------------------------------------------------------------
describe("fillExistingPlan", () => {
  it("returns empty result when newCourses is empty", () => {
    const term = makeTerm({ season: "Fall", year: 2026 });

    const result = fillExistingPlan(
      [term],
      [],
      [],
      new Map<number, number>(),
      new Map<number, Set<number>>(),
      false
    );

    expect(result.semesters).toHaveLength(0);
    expect(result.unscheduledCourseIds).toHaveLength(0);
  });

  it("fills an existing term that has remaining capacity", () => {
    const term = makeTerm({ season: "Fall", year: 2026 });
    const existingCourse = makeCourse({ credits: 3 });
    const planned = makePlannedCourse(term.id, existingCourse);

    const newCourse = makeCourse({ credits: 3 });
    const levels = new Map<number, number>([[newCourse.id, 0]]);

    const result = fillExistingPlan(
      [term],
      [planned],
      [newCourse],
      levels,
      new Map<number, Set<number>>(),
      false,
      15 // 15 credit cap — plenty of room
    );

    // The new course should be placed, potentially in the existing Fall 2026 term
    const allScheduled = result.semesters.flatMap((s) => s.courses);
    expect(allScheduled.some((c) => c.id === newCourse.id)).toBe(true);
  });

  it("skips courses that are already placed in existing plan", () => {
    const term = makeTerm({ season: "Fall", year: 2026 });
    const existingCourse = makeCourse({ credits: 3 });
    const planned = makePlannedCourse(term.id, existingCourse);

    // Try to add the same course that's already planned
    const levels = new Map<number, number>([[existingCourse.id, 0]]);

    const result = fillExistingPlan(
      [term],
      [planned],
      [existingCourse],
      levels,
      new Map<number, Set<number>>(),
      false
    );

    // The course should not be duplicated
    const allScheduled = result.semesters.flatMap((s) => s.courses);
    const count = allScheduled.filter(
      (c) => c.id === existingCourse.id
    ).length;
    expect(count).toBeLessThanOrEqual(1);
  });

  it("spills to new semesters when existing terms are full", () => {
    const term = makeTerm({ season: "Fall", year: 2026 });
    // Fill existing term to capacity
    const existingCourses = Array.from({ length: 5 }, () =>
      makeCourse({ credits: 3 })
    );
    const planned = existingCourses.map((c) =>
      makePlannedCourse(term.id, c)
    );

    const newCourse = makeCourse({ credits: 3 });
    const levels = new Map<number, number>([[newCourse.id, 0]]);

    const result = fillExistingPlan(
      [term],
      planned,
      [newCourse],
      levels,
      new Map<number, Set<number>>(),
      false,
      15 // 15-credit cap, existing term already has 15
    );

    // New course should be scheduled but in a later semester
    const allScheduled = result.semesters.flatMap((s) => s.courses);
    expect(allScheduled.some((c) => c.id === newCourse.id)).toBe(true);

    // Should have created at least one new semester beyond the existing term
    const newSemesters = result.semesters.filter(
      (s) => !(s.season === "Fall" && s.year === 2026)
    );
    expect(newSemesters.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// rebalanceSemesters
// ---------------------------------------------------------------------------
describe("rebalanceSemesters", () => {
  it("moves lab/lecture co-req pairs together when rebalancing", () => {
    const chemLecture = makeCourse({
      id: 400,
      subject: "CHEM",
      number: "101",
      title: "General Chemistry I",
      credits: 4,
    });
    const chemLab = makeCourse({
      id: 401,
      subject: "CHEM",
      number: "103",
      title: "General Chemistry Lab I",
      credits: 1,
    });
    const donorFill = [
      makeCourse({ id: 402, subject: "CS", number: "201", credits: 3 }),
      makeCourse({ id: 403, subject: "CS", number: "202", credits: 3 }),
      makeCourse({ id: 404, subject: "CS", number: "203", credits: 3 }),
    ];

    const semesters = [
      {
        season: "Fall" as const,
        year: 2026,
        courses: [chemLecture, chemLab, ...donorFill],
        totalCredits: 14,
      },
      {
        season: "Spring" as const,
        year: 2027,
        courses: [makeCourse({ id: 405, subject: "MATH", number: "110", credits: 3 })],
        totalCredits: 3,
      },
    ];

    const result = rebalanceSemesters(
      semesters,
      new Map<number, Set<number>>(),
      new Map<number, Set<string>>(),
      new Set<number>(),
      15,
      8
    );

    const donorHasLecture = result[0].courses.some((c) => c.id === chemLecture.id);
    const donorHasLab = result[0].courses.some((c) => c.id === chemLab.id);
    const targetHasLecture = result[1].courses.some((c) => c.id === chemLecture.id);
    const targetHasLab = result[1].courses.some((c) => c.id === chemLab.id);

    expect(donorHasLecture).toBe(donorHasLab);
    expect(targetHasLecture).toBe(targetHasLab);
  });

  it("can rebalance from 14-credit donor terms (not only cap-full terms)", () => {
    const donorCourses = [
      makeCourse({ id: 300, credits: 3, number: "300" }),
      makeCourse({ id: 301, credits: 3, number: "301" }),
      makeCourse({ id: 302, credits: 3, number: "302" }),
      makeCourse({ id: 303, credits: 3, number: "303" }),
      makeCourse({ id: 304, credits: 2, number: "304" }),
    ];
    const tailCourses = [
      makeCourse({ id: 310, credits: 3, number: "310" }),
      makeCourse({ id: 311, credits: 3, number: "311" }),
      makeCourse({ id: 312, credits: 3, number: "312" }),
    ];

    const semesters = [
      {
        season: "Fall" as const,
        year: 2026,
        courses: donorCourses,
        totalCredits: 14,
      },
      {
        season: "Spring" as const,
        year: 2027,
        courses: tailCourses,
        totalCredits: 9,
      },
    ];

    const result = rebalanceSemesters(
      semesters,
      new Map<number, Set<number>>(),
      new Map<number, Set<string>>(),
      new Set<number>(),
      15,
      12
    );

    const totalBefore = semesters.reduce((sum, sem) => sum + sem.totalCredits, 0);
    const totalAfter = result.reduce((sum, sem) => sum + sem.totalCredits, 0);
    expect(totalAfter).toBe(totalBefore);
    result.forEach((sem) => expect(sem.totalCredits).toBeLessThanOrEqual(15));
  });

  it("reduces trailing underfilled tail terms without breaking credit caps", () => {
    const makeSem = (season: Season, year: number, courses: Course[]) => ({
      season,
      year,
      courses,
      totalCredits: courses.reduce((sum, c) => sum + c.credits, 0),
    });

    const donorA = [
      makeCourse({ id: 100, credits: 3, number: "100" }),
      makeCourse({ id: 101, credits: 3, number: "101" }),
      makeCourse({ id: 102, credits: 3, number: "102" }),
      makeCourse({ id: 103, credits: 3, number: "103" }),
      makeCourse({ id: 104, credits: 3, number: "104" }),
    ];
    const donorB = [
      makeCourse({ id: 110, credits: 3, number: "110" }),
      makeCourse({ id: 111, credits: 3, number: "111" }),
      makeCourse({ id: 112, credits: 3, number: "112" }),
      makeCourse({ id: 113, credits: 3, number: "113" }),
      makeCourse({ id: 114, credits: 3, number: "114" }),
    ];
    const tailA = [
      makeCourse({ id: 120, credits: 3, number: "120" }),
      makeCourse({ id: 121, credits: 3, number: "121" }),
      makeCourse({ id: 122, credits: 3, number: "122" }),
    ];
    const tailB = [
      makeCourse({ id: 130, credits: 3, number: "130" }),
      makeCourse({ id: 131, credits: 3, number: "131" }),
      makeCourse({ id: 132, credits: 3, number: "132" }),
    ];

    const semesters = [
      makeSem("Fall", 2026, donorA),    // 15
      makeSem("Spring", 2027, donorB),  // 15
      makeSem("Fall", 2027, tailA),     // 9
      makeSem("Spring", 2028, tailB),   // 9
    ];

    const countTailUnderfilled = (input: typeof semesters): number => {
      let count = 0;
      for (let i = input.length - 1; i >= 0; i--) {
        if (input[i].totalCredits < 12) {
          count++;
          continue;
        }
        break;
      }
      return count;
    };

    const beforeCount = countTailUnderfilled(semesters);

    const result = rebalanceSemesters(
      semesters,
      new Map<number, Set<number>>(),
      new Map<number, Set<string>>(),
      new Set<number>(),
      15,
      12
    );

    const afterCount = countTailUnderfilled(result);
    expect(afterCount).toBeLessThan(beforeCount);
    result.forEach((sem) => expect(sem.totalCredits).toBeLessThanOrEqual(15));
  });

  it("does not move a prerequisite after its dependent", () => {
    const prereq = makeCourse({ id: 200, subject: "CS", number: "101", credits: 3 });
    const filler = [
      makeCourse({ id: 201, subject: "CS", number: "102", credits: 3, title: "Filler Lab" }),
      makeCourse({ id: 202, subject: "CS", number: "103", credits: 3, title: "Filler Lab" }),
      makeCourse({ id: 203, subject: "CS", number: "104", credits: 3, title: "Filler Lab" }),
      makeCourse({ id: 204, subject: "CS", number: "105", credits: 3, title: "Filler Lab" }),
    ];
    const dependent = makeCourse({ id: 205, subject: "CS", number: "201", credits: 3 });
    const tailCourse = makeCourse({ id: 206, subject: "MATH", number: "101", credits: 3 });

    const semesters = [
      {
        season: "Fall" as const,
        year: 2026,
        courses: [prereq, ...filler],
        totalCredits: 15,
      },
      {
        season: "Spring" as const,
        year: 2027,
        courses: [dependent],
        totalCredits: 3,
      },
      {
        season: "Fall" as const,
        year: 2027,
        courses: [tailCourse],
        totalCredits: 3,
      },
    ];

    const prereqEdges = new Map<number, Set<number>>([
      [dependent.id, new Set([prereq.id])],
    ]);

    const availabilityMap = new Map<number, Set<string>>([
      [filler[0].id, new Set(["SPRING"])],
      [filler[1].id, new Set(["SPRING"])],
      [filler[2].id, new Set(["SPRING"])],
      [filler[3].id, new Set(["SPRING"])],
    ]);

    const result = rebalanceSemesters(
      semesters,
      prereqEdges,
      availabilityMap,
      new Set<number>(),
      15,
      12
    );

    const prereqSemIdx = result.findIndex((sem) =>
      sem.courses.some((course) => course.id === prereq.id)
    );
    const dependentSemIdx = result.findIndex((sem) =>
      sem.courses.some((course) => course.id === dependent.id)
    );

    expect(prereqSemIdx).toBeGreaterThanOrEqual(0);
    expect(dependentSemIdx).toBeGreaterThanOrEqual(0);
    expect(prereqSemIdx).toBeLessThan(dependentSemIdx);
  });

  it("drops an unnecessary trailing semester when its courses fit earlier terms", () => {
    const makeSem = (season: Season, year: number, courses: Course[]) => ({
      season,
      year,
      courses,
      totalCredits: courses.reduce((sum, c) => sum + c.credits, 0),
    });

    const fallFull = [
      makeCourse({ id: 500, credits: 3 }),
      makeCourse({ id: 501, credits: 3 }),
      makeCourse({ id: 502, credits: 3 }),
      makeCourse({ id: 503, credits: 3 }),
      makeCourse({ id: 504, credits: 3 }),
    ]; // 15

    const springTwelve = [
      makeCourse({ id: 510, credits: 3 }),
      makeCourse({ id: 511, credits: 3 }),
      makeCourse({ id: 512, credits: 3 }),
      makeCourse({ id: 513, credits: 3 }),
    ]; // 12

    const lateThree = [makeCourse({ id: 520, credits: 3 })]; // 3

    const semesters = [
      makeSem("Fall", 2026, fallFull),
      makeSem("Spring", 2027, springTwelve),
      makeSem("Fall", 2027, lateThree),
    ];

    const result = rebalanceSemesters(
      semesters,
      new Map<number, Set<number>>(),
      new Map<number, Set<string>>(),
      new Set<number>(),
      15,
      15,
      12
    );

    expect(result).toHaveLength(2);
    expect(result[0].totalCredits).toBe(15);
    expect(result[1].totalCredits).toBe(15);
    expect(
      result.some((sem) => sem.courses.some((course) => course.id === 520))
    ).toBe(true);
  });

  it("front-loads movable prerequisite courses into earlier valid terms", () => {
    const c231 = makeCourse({ id: 800, subject: "CSCI", number: "231", credits: 3 });
    const c245 = makeCourse({ id: 801, subject: "CSCI", number: "245", credits: 3 });
    const c355 = makeCourse({ id: 802, subject: "CSCI", number: "355", credits: 3 });
    const c370 = makeCourse({ id: 803, subject: "CSCI", number: "370", credits: 3 });

    const fillerA = [
      makeCourse({ id: 810, credits: 3 }),
      makeCourse({ id: 811, credits: 3 }),
      makeCourse({ id: 812, credits: 3 }),
    ];
    const fillerB = [
      makeCourse({ id: 820, credits: 3 }),
      makeCourse({ id: 821, credits: 3 }),
      makeCourse({ id: 822, credits: 3 }),
      makeCourse({ id: 823, credits: 3 }),
    ];
    const fillerC = [
      makeCourse({ id: 830, credits: 3 }),
      makeCourse({ id: 831, credits: 3 }),
      makeCourse({ id: 832, credits: 3 }),
    ];
    const fillerD = [
      makeCourse({ id: 840, credits: 3 }),
      makeCourse({ id: 841, credits: 3 }),
      makeCourse({ id: 842, credits: 3 }),
    ];

    const semesters = [
      { season: "Fall" as const, year: 2027, courses: [c231, ...fillerA], totalCredits: 12 },
      { season: "Spring" as const, year: 2028, courses: fillerB, totalCredits: 12 },
      { season: "Fall" as const, year: 2028, courses: [c245, ...fillerC], totalCredits: 12 },
      { season: "Spring" as const, year: 2029, courses: [c355, ...fillerD], totalCredits: 12 },
      { season: "Fall" as const, year: 2029, courses: [c370], totalCredits: 3 },
    ];

    const prereqEdges = new Map<number, Set<number>>([
      [c355.id, new Set([c245.id])],
      [c370.id, new Set([c355.id])],
    ]);
    const availabilityMap = new Map<number, Set<string>>([
      [c355.id, new Set(["SPRING"])],
      [c370.id, new Set(["FALL"])],
    ]);

    const result = rebalanceSemesters(
      semesters,
      prereqEdges,
      availabilityMap,
      new Set<number>(),
      18,
      15,
      12
    );

    const semIdxOf = (courseId: number) =>
      result.findIndex((sem) => sem.courses.some((c) => c.id === courseId));

    expect(semIdxOf(c245.id)).toBeLessThan(2);
  });

  it("can free capacity via intermediate terms when front-loading into a full earlier term", () => {
    const blocker = makeCourse({ id: 901, subject: "GEN", number: "101", credits: 3 });
    const t0Fill = [
      blocker,
      makeCourse({ id: 902, credits: 3 }),
      makeCourse({ id: 903, credits: 3 }),
      makeCourse({ id: 904, credits: 3 }),
      makeCourse({ id: 905, credits: 3 }),
    ]; // 15

    const intermediate = [
      makeCourse({ id: 906, credits: 3 }),
      makeCourse({ id: 907, credits: 3 }),
      makeCourse({ id: 908, credits: 3 }),
      makeCourse({ id: 909, credits: 3 }),
    ]; // 12

    const springOnlyDependent = makeCourse({
      id: 910,
      subject: "CSCI",
      number: "355",
      credits: 3,
    });
    const donorCourse = makeCourse({
      id: 911,
      subject: "CSCI",
      number: "242",
      credits: 4,
    });

    const semesters = [
      { season: "Fall" as const, year: 2027, courses: t0Fill, totalCredits: 15 },
      { season: "Spring" as const, year: 2028, courses: intermediate, totalCredits: 12 },
      { season: "Fall" as const, year: 2028, courses: [donorCourse], totalCredits: 4 },
      { season: "Fall" as const, year: 2029, courses: [springOnlyDependent], totalCredits: 3 },
    ];

    const prereqEdges = new Map<number, Set<number>>([
      [springOnlyDependent.id, new Set([donorCourse.id])],
    ]);

    const availabilityMap = new Map<number, Set<string>>([
      [blocker.id, new Set(["SPRING"])],   // can only be evicted into the intermediate Spring term
      [donorCourse.id, new Set(["FALL"])], // donor course can move to earlier Fall
    ]);

    const result = rebalanceSemesters(
      semesters,
      prereqEdges,
      availabilityMap,
      new Set<number>(),
      18,
      15,
      12
    );

    const semIdxOf = (courseId: number) =>
      result.findIndex((sem) => sem.courses.some((c) => c.id === courseId));

    expect(semIdxOf(donorCourse.id)).toBeLessThan(2);
  });

  it("eliminates an out-of-horizon singleton by swapping flexible courses", () => {
    const flex = makeCourse({ id: 950, subject: "ART", number: "100", credits: 3 });
    const req = makeCourse({ id: 951, subject: "PHYS", number: "202", credits: 4 });

    const t0Courses = [
      makeCourse({ id: 952, credits: 3 }),
      makeCourse({ id: 953, credits: 3 }),
      makeCourse({ id: 954, credits: 3 }),
      makeCourse({ id: 955, credits: 3 }),
      makeCourse({ id: 956, credits: 3 }),
      flex,
    ]; // 18

    const t1Courses = [
      makeCourse({ id: 957, credits: 3 }),
      makeCourse({ id: 958, credits: 3 }),
      makeCourse({ id: 959, credits: 3 }),
      makeCourse({ id: 960, credits: 3 }),
    ]; // 12

    const semesters = [
      { season: "Fall" as const, year: 2026, courses: t0Courses, totalCredits: 18 },
      { season: "Spring" as const, year: 2027, courses: t1Courses, totalCredits: 12 },
      { season: "Fall" as const, year: 2027, courses: [req], totalCredits: 4 },
    ];

    const availability = new Map<number, Set<string>>([
      [req.id, new Set(["FALL"])],
      [flex.id, new Set(["YEARLY"])],
    ]);

    const result = rebalanceSemesters(
      semesters,
      new Map<number, Set<number>>(),
      availability,
      new Set<number>(),
      18,
      12,
      12,
      new Set<number>([flex.id]),
      { season: "Spring", year: 2027 }
    );

    const hasOutOfHorizon = result.some(
      (sem) => sem.year > 2027 || (sem.year === 2027 && sem.season === "Fall")
    );
    expect(hasOutOfHorizon).toBe(false);
    expect(
      result.some((sem) => sem.courses.some((course) => course.id === req.id))
    ).toBe(true);
  });

  it("can absorb a terminal singleton by freeing capacity in an earlier term", () => {
    const donorCourse = makeCourse({ id: 980, subject: "CSCI", number: "405", credits: 3 });
    const moveableFlex = makeCourse({ id: 981, subject: "BUS", number: "100", credits: 3 });

    const fallA = [
      makeCourse({ id: 982, credits: 3 }),
      makeCourse({ id: 983, credits: 3 }),
      makeCourse({ id: 984, credits: 3 }),
      makeCourse({ id: 985, credits: 3 }),
      makeCourse({ id: 986, credits: 3 }),
    ]; // 15

    const springB = [
      moveableFlex,
      makeCourse({ id: 987, credits: 3 }),
      makeCourse({ id: 988, credits: 3 }),
      makeCourse({ id: 989, credits: 3 }),
      makeCourse({ id: 990, credits: 5 }),
    ]; // 17

    const fallC = [
      makeCourse({ id: 991, credits: 3 }),
      makeCourse({ id: 992, credits: 3 }),
      makeCourse({ id: 993, credits: 3 }),
      makeCourse({ id: 994, credits: 3 }),
      makeCourse({ id: 995, credits: 3 }),
    ]; // 15

    const semesters = [
      { season: "Fall" as const, year: 2028, courses: fallA, totalCredits: 15 },
      { season: "Spring" as const, year: 2029, courses: springB, totalCredits: 17 },
      { season: "Fall" as const, year: 2029, courses: fallC, totalCredits: 15 },
      { season: "Spring" as const, year: 2030, courses: [donorCourse], totalCredits: 3 },
    ];

    const availability = new Map<number, Set<string>>([
      [donorCourse.id, new Set(["SPRING"])],
      [moveableFlex.id, new Set(["YEARLY"])],
    ]);

    const result = rebalanceSemesters(
      semesters,
      new Map<number, Set<number>>(),
      availability,
      new Set<number>(),
      18,
      12,
      12,
      new Set<number>([moveableFlex.id]),
      { season: "Spring", year: 2030 }
    );

    expect(result.length).toBeLessThanOrEqual(3);
    expect(
      result.some((sem) => sem.courses.some((course) => course.id === donorCourse.id))
    ).toBe(true);
  });

  it("improves an underfilled final semester by pulling flexible courses from heavier donors", () => {
    const flexA = makeCourse({ id: 996, subject: "ART", number: "100", credits: 3 });
    const flexB = makeCourse({ id: 997, subject: "BUS", number: "100", credits: 3 });
    const flexC = makeCourse({ id: 998, subject: "MUSI", number: "100", credits: 3 });

    const semesters = [
      {
        season: "Fall" as const,
        year: 2027,
        courses: [flexA, makeCourse({ id: 999, credits: 3 }), makeCourse({ id: 1000, credits: 3 }), makeCourse({ id: 1001, credits: 3 }), makeCourse({ id: 1002, credits: 3 }), makeCourse({ id: 1003, credits: 3 })],
        totalCredits: 18,
      },
      {
        season: "Spring" as const,
        year: 2028,
        courses: [flexB, makeCourse({ id: 1004, credits: 3 }), makeCourse({ id: 1005, credits: 3 }), makeCourse({ id: 1006, credits: 3 }), makeCourse({ id: 1007, credits: 3 }), makeCourse({ id: 1008, credits: 2 })],
        totalCredits: 17,
      },
      {
        season: "Fall" as const,
        year: 2028,
        courses: [flexC, makeCourse({ id: 1009, credits: 3 }), makeCourse({ id: 1010, credits: 3 }), makeCourse({ id: 1011, credits: 3 }), makeCourse({ id: 1012, credits: 3 }), makeCourse({ id: 1013, credits: 1 })],
        totalCredits: 16,
      },
      {
        season: "Spring" as const,
        year: 2029,
        courses: [makeCourse({ id: 1014, credits: 3 }), makeCourse({ id: 1015, credits: 3 })],
        totalCredits: 6,
      },
    ];

    const result = rebalanceSemesters(
      semesters,
      new Map<number, Set<number>>(),
      new Map<number, Set<string>>(),
      new Set<number>(),
      18,
      12,
      12,
      new Set<number>([flexA.id, flexB.id, flexC.id]),
      null,
      15
    );

    const finalSemester = result[result.length - 1];
    expect(finalSemester.totalCredits).toBeGreaterThan(6);
    expect(finalSemester.totalCredits).toBeLessThanOrEqual(18);
    expect(
      finalSemester.courses.some((course) =>
        [flexA.id, flexB.id, flexC.id].includes(course.id)
      )
    ).toBe(true);
  });

  it("smooths semester credits by reducing max/min spread when legal moves exist", () => {
    const flexA = makeCourse({ id: 1100, subject: "ART", number: "100", credits: 3 });
    const flexB = makeCourse({ id: 1101, subject: "MUSI", number: "100", credits: 3 });
    const flexC = makeCourse({ id: 1102, subject: "BUS", number: "100", credits: 3 });

    const semesters = [
      {
        season: "Fall" as const,
        year: 2026,
        courses: [
          flexA,
          makeCourse({ id: 1103, credits: 3 }),
          makeCourse({ id: 1104, credits: 3 }),
          makeCourse({ id: 1105, credits: 3 }),
          makeCourse({ id: 1106, credits: 3 }),
          makeCourse({ id: 1107, credits: 3 }),
        ],
        totalCredits: 18,
      },
      {
        season: "Spring" as const,
        year: 2027,
        courses: [
          flexB,
          makeCourse({ id: 1108, credits: 3 }),
          makeCourse({ id: 1109, credits: 3 }),
          makeCourse({ id: 1110, credits: 3 }),
          makeCourse({ id: 1111, credits: 3 }),
          makeCourse({ id: 1112, credits: 3 }),
        ],
        totalCredits: 18,
      },
      {
        season: "Fall" as const,
        year: 2027,
        courses: [flexC, makeCourse({ id: 1113, credits: 3 })],
        totalCredits: 6,
      },
      {
        season: "Spring" as const,
        year: 2028,
        courses: [makeCourse({ id: 1114, credits: 3 }), makeCourse({ id: 1115, credits: 3 })],
        totalCredits: 6,
      },
    ];

    const spread = (input: typeof semesters): number => {
      const credits = input.map((sem) => sem.totalCredits);
      return Math.max(...credits) - Math.min(...credits);
    };

    const beforeSpread = spread(semesters);

    const result = rebalanceSemesters(
      semesters,
      new Map<number, Set<number>>(),
      new Map<number, Set<string>>(),
      new Set<number>(),
      18,
      12,
      12,
      new Set<number>([flexA.id, flexB.id, flexC.id])
    );

    const afterSpread = spread(result);
    expect(afterSpread).toBeLessThan(beforeSpread);
    result.forEach((sem) => expect(sem.totalCredits).toBeLessThanOrEqual(18));
  });
});
