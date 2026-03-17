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
