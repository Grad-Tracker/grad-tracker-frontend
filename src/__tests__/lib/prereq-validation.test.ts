import { describe, it, expect } from "vitest";
import {
  termSortKey,
  buildCourseTermIndex,
  arePrereqsSatisfied,
  findBrokenDependents,
} from "@/lib/planner/prereq-validation";
import type { Term, PlannedCourseWithDetails, Season } from "@/types/planner";
import type { Course } from "@/types/course";

// ── Helpers ──────────────────────────────────────────────

let _courseId = 100;
let _termId = 1;

function makeCourse(overrides: Partial<Course> = {}): Course {
  const id = overrides.id ?? _courseId++;
  return {
    id,
    subject: "CS",
    number: `${id}`,
    title: `Course ${id}`,
    credits: 3,
    ...overrides,
  };
}

function makeTerm(season: Season, year: number, id?: number): Term {
  return { id: id ?? _termId++, season, year };
}

function makePlannedCourse(
  course: Course,
  term: Term,
  overrides: Partial<PlannedCourseWithDetails> = {}
): PlannedCourseWithDetails {
  return {
    student_id: 1,
    term_id: term.id,
    course_id: course.id,
    status: "planned",
    plan_id: 1,
    course,
    ...overrides,
  };
}

// ── termSortKey ──────────────────────────────────────────

describe("termSortKey", () => {
  it("returns a lower value for Fall than Spring within the same year", () => {
    const fall = makeTerm("Fall", 2024);
    const spring = makeTerm("Spring", 2024);
    expect(termSortKey(fall)).toBeLessThan(termSortKey(spring));
  });

  it("orders Fall < Spring < Summer within the same year", () => {
    const fall = makeTerm("Fall", 2024);
    const spring = makeTerm("Spring", 2024);
    const summer = makeTerm("Summer", 2024);
    expect(termSortKey(fall)).toBeLessThan(termSortKey(spring));
    expect(termSortKey(spring)).toBeLessThan(termSortKey(summer));
  });

  it("returns a lower value for an earlier year than a later year", () => {
    const fall2023 = makeTerm("Fall", 2023);
    const spring2024 = makeTerm("Spring", 2024);
    expect(termSortKey(fall2023)).toBeLessThan(termSortKey(spring2024));
  });

  it("returns equal values for identical season and year", () => {
    const a = makeTerm("Spring", 2025);
    const b = makeTerm("Spring", 2025);
    expect(termSortKey(a)).toBe(termSortKey(b));
  });

  it("Fall 2023 is before Summer 2023 (Fall=0 < Summer=2 within a year)", () => {
    const fall2023 = makeTerm("Fall", 2023);
    const summer2023 = makeTerm("Summer", 2023);
    expect(termSortKey(fall2023)).toBeLessThan(termSortKey(summer2023));
  });

  it("Fall 2022 is before Spring 2023", () => {
    const fall2022 = makeTerm("Fall", 2022);
    const spring2023 = makeTerm("Spring", 2023);
    expect(termSortKey(fall2022)).toBeLessThan(termSortKey(spring2023));
  });
});

// ── buildCourseTermIndex ─────────────────────────────────

describe("buildCourseTermIndex", () => {
  it("returns an empty map when there are no planned courses", () => {
    const result = buildCourseTermIndex([], []);
    expect(result.size).toBe(0);
  });

  it("maps course IDs to their term sort key", () => {
    const termFall = makeTerm("Fall", 2024, 10);
    const termSpring = makeTerm("Spring", 2025, 11);
    const courseA = makeCourse({ id: 1 });
    const courseB = makeCourse({ id: 2 });

    const planned: PlannedCourseWithDetails[] = [
      makePlannedCourse(courseA, termFall),
      makePlannedCourse(courseB, termSpring),
    ];

    const result = buildCourseTermIndex(planned, [termFall, termSpring]);
    expect(result.get(1)).toBe(termSortKey(termFall));
    expect(result.get(2)).toBe(termSortKey(termSpring));
  });

  it("ignores courses whose term_id is not in the terms list", () => {
    const termFall = makeTerm("Fall", 2024, 10);
    const orphanTerm = makeTerm("Spring", 2025, 99); // not in terms list
    const courseA = makeCourse({ id: 1 });
    const courseB = makeCourse({ id: 2 });

    const planned: PlannedCourseWithDetails[] = [
      makePlannedCourse(courseA, termFall),
      makePlannedCourse(courseB, orphanTerm),
    ];

    const result = buildCourseTermIndex(planned, [termFall]);
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(false);
  });

  it("returns correct sort keys for multiple courses in the same term", () => {
    const termFall = makeTerm("Fall", 2024, 10);
    const courseA = makeCourse({ id: 1 });
    const courseB = makeCourse({ id: 2 });

    const planned: PlannedCourseWithDetails[] = [
      makePlannedCourse(courseA, termFall),
      makePlannedCourse(courseB, termFall),
    ];

    const result = buildCourseTermIndex(planned, [termFall]);
    expect(result.get(1)).toBe(termSortKey(termFall));
    expect(result.get(2)).toBe(termSortKey(termFall));
  });
});

// ── arePrereqsSatisfied ──────────────────────────────────

describe("arePrereqsSatisfied", () => {
  it("returns satisfied when a course has no prerequisites", () => {
    const prereqEdges = new Map<number, Set<number>>();
    const courseTermIndex = new Map<number, number>();
    const completedIds = new Set<number>();

    const result = arePrereqsSatisfied(
      1,
      termSortKey(makeTerm("Spring", 2025)),
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result.satisfied).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("returns satisfied when the prerequisite is already completed", () => {
    const prereqEdges = new Map([[10, new Set([5])]]);
    const courseTermIndex = new Map<number, number>();
    const completedIds = new Set([5]);

    const result = arePrereqsSatisfied(
      10,
      termSortKey(makeTerm("Spring", 2025)),
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result.satisfied).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("returns satisfied when the prerequisite is planned in an earlier term", () => {
    const fallKey = termSortKey(makeTerm("Fall", 2024));
    const springKey = termSortKey(makeTerm("Spring", 2025));

    // Course 10 requires course 5; course 5 is planned in Fall 2024
    const prereqEdges = new Map([[10, new Set([5])]]);
    const courseTermIndex = new Map([[5, fallKey]]);
    const completedIds = new Set<number>();

    const result = arePrereqsSatisfied(
      10,
      springKey,
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result.satisfied).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("returns not satisfied when the prerequisite is in the same semester", () => {
    const springKey = termSortKey(makeTerm("Spring", 2025));

    const prereqEdges = new Map([[10, new Set([5])]]);
    const courseTermIndex = new Map([[5, springKey]]);
    const completedIds = new Set<number>();

    const result = arePrereqsSatisfied(
      10,
      springKey,
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result.satisfied).toBe(false);
    expect(result.missing).toContain(5);
  });

  it("returns not satisfied when the prerequisite is planned in a later term", () => {
    const springKey = termSortKey(makeTerm("Spring", 2025));
    const summerKey = termSortKey(makeTerm("Summer", 2025));

    // Course 10 in Spring 2025 needs course 5, but course 5 is in Summer 2025 (later)
    // Spring 2025 = 20251, Summer 2025 = 20252, so Summer > Spring — prereq is later
    const prereqEdges = new Map([[10, new Set([5])]]);
    const courseTermIndex = new Map([[5, summerKey]]);
    const completedIds = new Set<number>();

    const result = arePrereqsSatisfied(
      10,
      springKey,
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result.satisfied).toBe(false);
    expect(result.missing).toContain(5);
  });

  it("returns not satisfied when the prerequisite is not planned at all", () => {
    const springKey = termSortKey(makeTerm("Spring", 2025));

    const prereqEdges = new Map([[10, new Set([5])]]);
    const courseTermIndex = new Map<number, number>(); // course 5 not indexed
    const completedIds = new Set<number>();

    const result = arePrereqsSatisfied(
      10,
      springKey,
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result.satisfied).toBe(false);
    expect(result.missing).toContain(5);
  });

  it("handles multiple prerequisites with partial satisfaction", () => {
    const fallKey = termSortKey(makeTerm("Fall", 2024));
    const springKey = termSortKey(makeTerm("Spring", 2025));
    const summerKey = termSortKey(makeTerm("Summer", 2025));

    // Course 10 requires courses 5, 6, and 7
    // 5 is completed, 6 is planned earlier (Fall), 7 is planned in same term (Spring)
    const prereqEdges = new Map([[10, new Set([5, 6, 7])]]);
    const courseTermIndex = new Map([
      [6, fallKey],
      [7, springKey], // same term as target — violation
    ]);
    const completedIds = new Set([5]);

    const result = arePrereqsSatisfied(
      10,
      springKey,
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result.satisfied).toBe(false);
    expect(result.missing).toContain(7);
    expect(result.missing).not.toContain(5); // completed
    expect(result.missing).not.toContain(6); // planned earlier
  });

  it("returns all missing prereqs when multiple are violated", () => {
    const springKey = termSortKey(makeTerm("Spring", 2025));
    const summerKey = termSortKey(makeTerm("Summer", 2025));

    // Course 10 in Spring 2025 requires course 5 (not planned) and course 6 (planned in Summer 2025)
    // Summer 2025 = 20252 > Spring 2025 = 20251 — so course 6 is AFTER the target term
    const prereqEdges = new Map([[10, new Set([5, 6])]]);
    const courseTermIndex = new Map([[6, summerKey]]);
    const completedIds = new Set<number>();

    const result = arePrereqsSatisfied(
      10,
      springKey,
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result.satisfied).toBe(false);
    expect(result.missing).toContain(5);
    expect(result.missing).toContain(6);
  });
});

// ── findBrokenDependents ─────────────────────────────────

describe("findBrokenDependents", () => {
  it("returns empty when there are no dependents", () => {
    // No course depends on course 5
    const prereqEdges = new Map<number, Set<number>>();
    const courseTermIndex = new Map<number, number>();
    const completedIds = new Set<number>();

    const result = findBrokenDependents(
      5,
      null,
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result).toHaveLength(0);
  });

  it("finds a dependent that breaks when its prereq is removed (newSortKey=null)", () => {
    const springKey = termSortKey(makeTerm("Spring", 2025));
    const fallKey = termSortKey(makeTerm("Fall", 2024));

    // Course 10 depends on course 5; course 5 was in Fall, course 10 in Spring
    const prereqEdges = new Map([[10, new Set([5])]]);
    const courseTermIndex = new Map([
      [5, fallKey],
      [10, springKey],
    ]);
    const completedIds = new Set<number>();

    const result = findBrokenDependents(
      5,
      null, // course 5 is being removed
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result).toContain(10);
  });

  it("finds a dependent that breaks when prereq is moved to a later term", () => {
    const fallKey = termSortKey(makeTerm("Fall", 2024));
    const springKey = termSortKey(makeTerm("Spring", 2025));
    const summerKey = termSortKey(makeTerm("Summer", 2025));

    // Course 10 is in Spring 2025, depends on course 5
    // Course 5 is moved from Fall 2024 to Summer 2025 (after course 10)
    const prereqEdges = new Map([[10, new Set([5])]]);
    const courseTermIndex = new Map([
      [5, fallKey], // current position (before the move)
      [10, springKey],
    ]);
    const completedIds = new Set<number>();

    const result = findBrokenDependents(
      5,
      summerKey, // moved to after course 10's term
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result).toContain(10);
  });

  it("returns empty when the prereq is moved to an earlier term", () => {
    const fallKey = termSortKey(makeTerm("Fall", 2024));
    const springKey = termSortKey(makeTerm("Spring", 2025));
    const summerKey = termSortKey(makeTerm("Summer", 2023));

    // Course 10 is in Spring 2025, depends on course 5
    // Course 5 is moved from Fall 2024 to Summer 2023 (still before course 10)
    const prereqEdges = new Map([[10, new Set([5])]]);
    const courseTermIndex = new Map([
      [5, fallKey],
      [10, springKey],
    ]);
    const completedIds = new Set<number>();

    const result = findBrokenDependents(
      5,
      summerKey, // still earlier than Spring 2025
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result).toHaveLength(0);
  });

  it("skips dependents whose prereq is already completed", () => {
    const fallKey = termSortKey(makeTerm("Fall", 2024));
    const springKey = termSortKey(makeTerm("Spring", 2025));

    // Course 10 depends on course 5; but course 5 is completed — no breakage
    const prereqEdges = new Map([[10, new Set([5])]]);
    const courseTermIndex = new Map([
      [5, fallKey],
      [10, springKey],
    ]);
    const completedIds = new Set([5]); // course 5 is completed

    const result = findBrokenDependents(
      5,
      null, // removing course 5 from plan
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result).toHaveLength(0);
  });

  it("finds multiple broken dependents when a shared prereq is removed", () => {
    const fallKey = termSortKey(makeTerm("Fall", 2024));
    const springKey = termSortKey(makeTerm("Spring", 2025));
    const summerKey = termSortKey(makeTerm("Summer", 2025));

    // Both course 10 and course 11 depend on course 5
    const prereqEdges = new Map([
      [10, new Set([5])],
      [11, new Set([5])],
    ]);
    const courseTermIndex = new Map([
      [5, fallKey],
      [10, springKey],
      [11, summerKey],
    ]);
    const completedIds = new Set<number>();

    const result = findBrokenDependents(
      5,
      null,
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result).toContain(10);
    expect(result).toContain(11);
  });

  it("does not flag dependents that still have the prereq satisfied after a move", () => {
    const summerKey = termSortKey(makeTerm("Summer", 2023));
    const fallKey = termSortKey(makeTerm("Fall", 2024));
    const springKey = termSortKey(makeTerm("Spring", 2025));

    // Course 10 in Spring 2025 depends on course 5
    // Course 5 is moved from Fall 2024 to Summer 2023 — still before Spring 2025
    const prereqEdges = new Map([[10, new Set([5])]]);
    const courseTermIndex = new Map([
      [5, fallKey],
      [10, springKey],
    ]);
    const completedIds = new Set<number>();

    const result = findBrokenDependents(
      5,
      summerKey,
      prereqEdges,
      courseTermIndex,
      completedIds
    );

    expect(result).not.toContain(10);
    expect(result).toHaveLength(0);
  });
});
