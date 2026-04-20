import { describe, it, expect } from "vitest";
import {
  arePrereqsSatisfied,
  findBrokenDependents,
  buildCourseTermIndex,
  termSortKey,
} from "@/lib/planner/prereq-validation";
import { isAvailable, buildAvailabilityMap } from "@/lib/planner/auto-generate";
import type { Term, PlannedCourseWithDetails } from "@/types/planner";
import type { Course } from "@/types/course";
import type { CourseOffering } from "@/lib/supabase/queries/planner";

// ── Realistic fixture data ─────────────────────────────────

const CSCI_240: Course = { id: 1, subject: "CSCI", number: "240", title: "Computer Science I", credits: 4 };
const CSCI_241: Course = { id: 2, subject: "CSCI", number: "241", title: "Computer Science II", credits: 4 };
const CSCI_340: Course = { id: 3, subject: "CSCI", number: "340", title: "Data Structures", credits: 3 };
const MATH_222: Course = { id: 4, subject: "MATH", number: "222", title: "Calculus II", credits: 4 };
const ENGL_101: Course = { id: 5, subject: "ENGL", number: "101", title: "English Composition", credits: 3 };

const FALL_2026: Term = { id: 10, season: "Fall", year: 2026 };
const SPRING_2027: Term = { id: 20, season: "Spring", year: 2027 };
const SUMMER_2027: Term = { id: 25, season: "Summer", year: 2027 };
const FALL_2027: Term = { id: 30, season: "Fall", year: 2027 };

const ALL_TERMS = [FALL_2026, SPRING_2027, SUMMER_2027, FALL_2027];

// CSCI 241 requires CSCI 240; CSCI 340 requires CSCI 241
const PREREQ_EDGES = new Map<number, Set<number>>([
  [2, new Set([1])],  // CSCI 241 requires CSCI 240
  [3, new Set([2])],  // CSCI 340 requires CSCI 241
]);

function makePlanned(course: Course, term: Term): PlannedCourseWithDetails {
  return {
    student_id: 1,
    term_id: term.id,
    course_id: course.id,
    status: "planned",
    plan_id: 1,
    course,
  };
}

// ── Prereq Validation Scenarios ───────────────────────────

describe("Prereq validation — realistic scenarios", () => {
  it("scenario 1: valid 3-course chain is fully satisfied", () => {
    // CSCI 240 Fall 2026 → CSCI 241 Spring 2027 → CSCI 340 Fall 2027
    const planned = [
      makePlanned(CSCI_240, FALL_2026),
      makePlanned(CSCI_241, SPRING_2027),
      makePlanned(CSCI_340, FALL_2027),
    ];
    const index = buildCourseTermIndex(planned, ALL_TERMS);
    const completedIds = new Set<number>();

    // CSCI 241 (Spring 2027) requires CSCI 240 (Fall 2026) — earlier, satisfied
    const result241 = arePrereqsSatisfied(
      CSCI_241.id,
      termSortKey(SPRING_2027),
      PREREQ_EDGES,
      index,
      completedIds
    );
    expect(result241.satisfied).toBe(true);
    expect(result241.missing).toHaveLength(0);

    // CSCI 340 (Fall 2027) requires CSCI 241 (Spring 2027) — earlier, satisfied
    const result340 = arePrereqsSatisfied(
      CSCI_340.id,
      termSortKey(FALL_2027),
      PREREQ_EDGES,
      index,
      completedIds
    );
    expect(result340.satisfied).toBe(true);
    expect(result340.missing).toHaveLength(0);
  });

  it("scenario 2: CSCI 340 blocked when CSCI 241 is in the same semester", () => {
    // CSCI 240 Fall 2026; trying to add CSCI 340 to Spring 2027 while CSCI 241 is also Spring 2027
    const planned = [
      makePlanned(CSCI_240, FALL_2026),
      makePlanned(CSCI_241, SPRING_2027),
    ];
    const index = buildCourseTermIndex(planned, ALL_TERMS);
    const completedIds = new Set<number>();

    // Attempting CSCI 340 in Spring 2027 — prereq CSCI 241 is same semester, not satisfied
    const result = arePrereqsSatisfied(
      CSCI_340.id,
      termSortKey(SPRING_2027),
      PREREQ_EDGES,
      index,
      completedIds
    );
    expect(result.satisfied).toBe(false);
    expect(result.missing).toContain(CSCI_241.id);
  });

  it("scenario 3: CSCI 241 allowed when CSCI 240 is completed (not planned)", () => {
    // CSCI 240 was completed — it's not in the planned list
    const planned: PlannedCourseWithDetails[] = [];
    const index = buildCourseTermIndex(planned, ALL_TERMS);
    // CSCI 240 is in completedIds
    const completedIds = new Set<number>([CSCI_240.id]);

    const result = arePrereqsSatisfied(
      CSCI_241.id,
      termSortKey(SPRING_2027),
      PREREQ_EDGES,
      index,
      completedIds
    );
    expect(result.satisfied).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("scenario 4: removing CSCI 241 detects CSCI 340 as broken dependent", () => {
    // CSCI 240 Fall 2026, CSCI 241 Spring 2027, CSCI 340 Fall 2027
    const planned = [
      makePlanned(CSCI_240, FALL_2026),
      makePlanned(CSCI_241, SPRING_2027),
      makePlanned(CSCI_340, FALL_2027),
    ];
    const index = buildCourseTermIndex(planned, ALL_TERMS);
    const completedIds = new Set<number>();

    // Remove CSCI 241 (newSortKey = null) — CSCI 340 depends on it and should break
    const broken = findBrokenDependents(
      CSCI_241.id,
      null,
      PREREQ_EDGES,
      index,
      completedIds
    );
    expect(broken).toContain(CSCI_340.id);
  });

  it("scenario 5: moving CSCI 240 after CSCI 241 breaks CSCI 241", () => {
    // CSCI 240 Fall 2026, CSCI 241 Spring 2027
    const planned = [
      makePlanned(CSCI_240, FALL_2026),
      makePlanned(CSCI_241, SPRING_2027),
    ];
    const index = buildCourseTermIndex(planned, ALL_TERMS);
    const completedIds = new Set<number>();

    // Move CSCI 240 to Fall 2027 (after CSCI 241 in Spring 2027)
    // CSCI 241's prereq (CSCI 240) is now scheduled in a later term — broken
    const broken = findBrokenDependents(
      CSCI_240.id,
      termSortKey(FALL_2027),
      PREREQ_EDGES,
      index,
      completedIds
    );
    expect(broken).toContain(CSCI_241.id);
  });

  it("scenario 6: removing ENGL 101 (no dependents) finds no broken courses", () => {
    const planned = [
      makePlanned(ENGL_101, FALL_2026),
      makePlanned(CSCI_240, FALL_2026),
      makePlanned(CSCI_241, SPRING_2027),
    ];
    const index = buildCourseTermIndex(planned, ALL_TERMS);
    const completedIds = new Set<number>();

    // ENGL 101 has no dependents in the prereq graph
    const broken = findBrokenDependents(
      ENGL_101.id,
      null,
      PREREQ_EDGES,
      index,
      completedIds
    );
    expect(broken).toHaveLength(0);
  });
});

// ── Availability Validation Scenarios ─────────────────────

describe("Availability validation — realistic scenarios", () => {
  // CSCI 240: FALL only
  // CSCI 241: SPRING only
  // MATH 222: FALL and SPRING
  // ENGL 101: no offerings (available everywhere)
  const offerings: CourseOffering[] = [
    { course_id: CSCI_240.id, term_code: "FALL" },
    { course_id: CSCI_241.id, term_code: "SPRING" },
    { course_id: MATH_222.id, term_code: "FALL" },
    { course_id: MATH_222.id, term_code: "SPRING" },
  ];

  const availabilityMap = buildAvailabilityMap(offerings);

  it("scenario 7: CSCI 240 is available in Fall", () => {
    expect(isAvailable(CSCI_240.id, "Fall", 2026, availabilityMap)).toBe(true);
  });

  it("scenario 8: CSCI 240 is NOT available in Spring (would trigger warning)", () => {
    expect(isAvailable(CSCI_240.id, "Spring", 2027, availabilityMap)).toBe(false);
  });

  it("scenario 9: MATH 222 is available in both Fall and Spring", () => {
    expect(isAvailable(MATH_222.id, "Fall", 2026, availabilityMap)).toBe(true);
    expect(isAvailable(MATH_222.id, "Spring", 2027, availabilityMap)).toBe(true);
  });

  it("scenario 10: ENGL 101 is available anywhere (no offerings = available everywhere)", () => {
    expect(isAvailable(ENGL_101.id, "Fall", 2026, availabilityMap)).toBe(true);
    expect(isAvailable(ENGL_101.id, "Spring", 2027, availabilityMap)).toBe(true);
    expect(isAvailable(ENGL_101.id, "Summer", 2027, availabilityMap)).toBe(true);
  });
});
