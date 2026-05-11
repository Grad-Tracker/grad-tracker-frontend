import { describe, it, expect, beforeEach } from "vitest";
import { validatePlan } from "@/lib/planner/validate-plan";
import type { Course } from "@/types/course";
import type { RequirementBlockWithCourses } from "@/types/planner";
import type {
  ScheduledSemester,
  GenEdBucketWithCourses,
} from "@/types/auto-generate";

// ── Helpers ──────────────────────────────────────────────

let _id = 1;

function makeCourse(overrides: Partial<Course> = {}): Course {
  const id = overrides.id ?? _id++;
  return {
    id,
    subject: "CS",
    number: `${100 + id}`,
    title: `Course ${id}`,
    credits: 3,
    ...overrides,
  };
}

function makeSemester(
  season: ScheduledSemester["season"],
  year: number,
  courses: Course[],
): ScheduledSemester {
  return {
    season,
    year,
    courses,
    totalCredits: courses.reduce((s, c) => s + c.credits, 0),
  };
}

function makeBlock(
  overrides: Partial<RequirementBlockWithCourses> = {},
): RequirementBlockWithCourses {
  return {
    id: 1,
    program_id: 1,
    name: "Required Courses",
    rule: "ALL_OF",
    n_required: null,
    credits_required: null,
    courses: [],
    ...overrides,
  };
}

function makeBucket(
  overrides: Partial<GenEdBucketWithCourses> = {},
): GenEdBucketWithCourses {
  return {
    id: 1,
    code: "HUM",
    name: "Humanities",
    credits_required: 6,
    courses: [],
    ...overrides,
  };
}

// Reset auto-increment between describes so IDs stay predictable
function resetId() {
  _id = 1;
}

// ── Tests ────────────────────────────────────────────────

describe("validatePlan", () => {
  beforeEach(() => resetId());

  // ── 1. Empty plan ────────────────────────────────────

  it("returns valid with no issues for an empty plan", () => {
    const result = validatePlan(
      [],                       // semesters
      [],                       // allSelectedCourses
      new Map(),                // prereqEdges
      new Map(),                // availabilityMap
      new Set(),                // completedIds
      [],                       // blocks
      [],                       // genEdBuckets
      18,                       // creditCap
    );

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.blockStatuses).toHaveLength(0);
    expect(result.genEdStatuses).toHaveLength(0);
    expect(result.unscheduledCourses).toHaveLength(0);
  });

  // ── 2. All courses scheduled, prereqs correct ────────

  it("returns valid when all courses are scheduled with correct prereq ordering", () => {
    const prereq = makeCourse({ id: 10, subject: "CS", number: "101" });
    const course = makeCourse({ id: 11, subject: "CS", number: "201" });

    const semesters = [
      makeSemester("Fall", 2026, [prereq]),
      makeSemester("Spring", 2027, [course]),
    ];

    const prereqEdges = new Map<number, Set<number>>([
      [11, new Set([10])],
    ]);

    const block = makeBlock({
      rule: "ALL_OF",
      courses: [prereq, course],
    });

    const result = validatePlan(
      semesters,
      [prereq, course],
      prereqEdges,
      new Map(),
      new Set(),
      [block],
      [],
      18,
    );

    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
    expect(result.blockStatuses[0].satisfied).toBe(true);
  });

  // ── 3. Prereq in same semester ───────────────────────

  it("reports PREREQ_VIOLATION when a prereq is in the same semester", () => {
    const prereq = makeCourse({ id: 20 });
    const course = makeCourse({ id: 21 });

    const semesters = [
      makeSemester("Fall", 2026, [prereq, course]),
    ];

    const prereqEdges = new Map<number, Set<number>>([
      [21, new Set([20])],
    ]);

    const result = validatePlan(
      semesters,
      [prereq, course],
      prereqEdges,
      new Map(),
      new Set(),
      [],
      [],
      18,
    );

    expect(result.valid).toBe(false);
    const violation = result.issues.find((i) => i.code === "PREREQ_VIOLATION");
    expect(violation).toBeDefined();
    expect(violation!.severity).toBe("error");
    expect(violation!.courseId).toBe(21);
  });

  it("allows lab/lecture co-req pairs in the same semester", () => {
    const lecture = makeCourse({
      id: 22,
      subject: "CHEM",
      number: "101",
      title: "General Chemistry I",
      credits: 4,
    });
    const lab = makeCourse({
      id: 23,
      subject: "CHEM",
      number: "103",
      title: "General Chemistry Lab I",
      credits: 1,
    });

    const semesters = [makeSemester("Fall", 2026, [lecture, lab])];

    const prereqEdges = new Map<number, Set<number>>([
      [22, new Set([23])],
      [23, new Set([22])],
    ]);

    const result = validatePlan(
      semesters,
      [lecture, lab],
      prereqEdges,
      new Map(),
      new Set(),
      [],
      [],
      18
    );

    expect(result.issues.find((i) => i.code === "PREREQ_VIOLATION")).toBeUndefined();
  });

  // ── 4. Prereq in later semester ──────────────────────

  it("reports PREREQ_VIOLATION when a prereq is scheduled after the course", () => {
    const prereq = makeCourse({ id: 30 });
    const course = makeCourse({ id: 31 });

    const semesters = [
      makeSemester("Fall", 2026, [course]),
      makeSemester("Spring", 2027, [prereq]),
    ];

    const prereqEdges = new Map<number, Set<number>>([
      [31, new Set([30])],
    ]);

    const result = validatePlan(
      semesters,
      [prereq, course],
      prereqEdges,
      new Map(),
      new Set(),
      [],
      [],
      18,
    );

    expect(result.valid).toBe(false);
    const violation = result.issues.find((i) => i.code === "PREREQ_VIOLATION");
    expect(violation).toBeDefined();
    expect(violation!.courseId).toBe(31);
  });

  // ── 5. Prereq already completed ─────────────────────

  it("does not report a violation when the prereq is in completedIds", () => {
    const course = makeCourse({ id: 41 });

    const semesters = [
      makeSemester("Fall", 2026, [course]),
    ];

    // Course 41 requires prereq 40, which is already completed
    const prereqEdges = new Map<number, Set<number>>([
      [41, new Set([40])],
    ]);
    const completedIds = new Set([40]);

    const result = validatePlan(
      semesters,
      [course],
      prereqEdges,
      new Map(),
      completedIds,
      [],
      [],
      18,
    );

    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.code === "PREREQ_VIOLATION")).toHaveLength(0);
  });

  // ── 6. Course unavailable in scheduled semester ──────

  it("reports AVAILABILITY_VIOLATION when a course is not offered in the scheduled semester", () => {
    const course = makeCourse({ id: 50, subject: "CS", number: "350" });

    // Course 50 is only offered in Fall
    const availabilityMap = new Map<number, Set<string>>([
      [50, new Set(["FALL"])],
    ]);

    const semesters = [
      makeSemester("Spring", 2027, [course]),
    ];

    const result = validatePlan(
      semesters,
      [course],
      new Map(),
      availabilityMap,
      new Set(),
      [],
      [],
      18,
    );

    expect(result.valid).toBe(false);
    const violation = result.issues.find((i) => i.code === "AVAILABILITY_VIOLATION");
    expect(violation).toBeDefined();
    expect(violation!.severity).toBe("error");
    expect(violation!.courseId).toBe(50);
    expect(violation!.semester).toBe("Spring 2027");
  });

  // ── 7. Credit cap exceeded ───────────────────────────

  it("reports CREDIT_CAP_EXCEEDED as a warning (plan is still valid)", () => {
    const courses = [
      makeCourse({ id: 60, credits: 4 }),
      makeCourse({ id: 61, credits: 4 }),
      makeCourse({ id: 62, credits: 4 }),
      makeCourse({ id: 63, credits: 4 }),
      makeCourse({ id: 64, credits: 4 }),
    ];

    const semesters = [makeSemester("Fall", 2026, courses)]; // 20 credits

    const result = validatePlan(
      semesters,
      courses,
      new Map(),
      new Map(),
      new Set(),
      [],
      [],
      18, // creditCap = 18
    );

    // Warnings don't make the plan invalid
    expect(result.valid).toBe(true);
    const warning = result.issues.find((i) => i.code === "CREDIT_CAP_EXCEEDED");
    expect(warning).toBeDefined();
    expect(warning!.severity).toBe("warning");
    expect(warning!.semester).toBe("Fall 2026");
  });

  // ── 8. Unscheduled courses ───────────────────────────

  it("reports COURSE_NOT_SCHEDULED for courses in allSelectedCourses but not in any semester", () => {
    const scheduled = makeCourse({ id: 70 });
    const missing = makeCourse({ id: 71 });

    const semesters = [
      makeSemester("Fall", 2026, [scheduled]),
    ];

    const result = validatePlan(
      semesters,
      [scheduled, missing],
      new Map(),
      new Map(),
      new Set(),
      [],
      [],
      18,
    );

    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.code === "COURSE_NOT_SCHEDULED");
    expect(issue).toBeDefined();
    expect(issue!.courseId).toBe(71);
    expect(result.unscheduledCourses).toHaveLength(1);
    expect(result.unscheduledCourses[0].id).toBe(71);
  });

  // ── 9. Block unsatisfied: ALL_OF missing a course ────

  it("reports BLOCK_UNSATISFIED when an ALL_OF block is missing a course", () => {
    const c1 = makeCourse({ id: 80, credits: 3 });
    const c2 = makeCourse({ id: 81, credits: 3 });

    const semesters = [
      makeSemester("Fall", 2026, [c1]), // only c1 scheduled
    ];

    const block = makeBlock({
      id: 10,
      rule: "ALL_OF",
      name: "Core Requirements",
      courses: [c1, c2],
    });

    const result = validatePlan(
      semesters,
      [c1],
      new Map(),
      new Map(),
      new Set(),
      [block],
      [],
      18,
    );

    // BLOCK_UNSATISFIED is a warning, plan can still be valid
    const warning = result.issues.find((i) => i.code === "BLOCK_UNSATISFIED");
    expect(warning).toBeDefined();
    expect(warning!.severity).toBe("warning");
    expect(result.blockStatuses[0].satisfied).toBe(false);
    expect(result.blockStatuses[0].blockName).toBe("Core Requirements");
  });

  it("treats cross-listed ALL_OF duplicates as one required course", () => {
    const csci231 = makeCourse({
      id: 82,
      subject: "CSCI",
      number: "231",
      title: "Discrete Mathematics",
      credits: 3,
    });
    const math231 = makeCourse({
      id: 99,
      subject: "MATH",
      number: "231",
      title: "Discrete Mathematics",
      credits: 3,
    });

    const semesters = [makeSemester("Fall", 2026, [csci231])];

    const block = makeBlock({
      id: 11,
      rule: "ALL_OF",
      name: "Required Courses",
      courses: [csci231, math231],
    });

    const result = validatePlan(
      semesters,
      [csci231],
      new Map(),
      new Map(),
      new Set(),
      [block],
      [],
      18
    );

    expect(result.blockStatuses[0].requiredCredits).toBe(3);
    expect(result.blockStatuses[0].satisfied).toBe(true);
    expect(result.issues.find((i) => i.code === "BLOCK_UNSATISFIED")).toBeUndefined();
  });

  // ── 10. Block unsatisfied: CREDITS_OF short ──────────

  it("reports BLOCK_UNSATISFIED when a CREDITS_OF block is short on credits", () => {
    const c1 = makeCourse({ id: 90, credits: 3 });
    const c2 = makeCourse({ id: 91, credits: 3 });

    const semesters = [
      makeSemester("Fall", 2026, [c1]), // 3 credits scheduled
    ];

    const block = makeBlock({
      id: 20,
      rule: "CREDITS_OF",
      name: "Electives",
      credits_required: 9,
      courses: [c1, c2],
    });

    const result = validatePlan(
      semesters,
      [c1],
      new Map(),
      new Map(),
      new Set(),
      [block],
      [],
      18,
    );

    const warning = result.issues.find((i) => i.code === "BLOCK_UNSATISFIED");
    expect(warning).toBeDefined();
    expect(warning!.severity).toBe("warning");

    const status = result.blockStatuses[0];
    expect(status.satisfied).toBe(false);
    expect(status.scheduledCredits).toBe(3);
    expect(status.requiredCredits).toBe(9);
    expect(status.missingCredits).toBe(6);
  });

  it("treats N_OF with credits_required as credit-based satisfaction", () => {
    const c1 = makeCourse({ id: 92, credits: 5 });
    const c2 = makeCourse({ id: 93, credits: 4 });
    const c3 = makeCourse({ id: 94, credits: 3 });

    const semesters = [makeSemester("Fall", 2026, [c1, c2])];

    const block = makeBlock({
      id: 21,
      rule: "N_OF",
      name: "Breadth Requirements",
      n_required: 9,
      credits_required: 9,
      courses: [c1, c2, c3],
    });

    const result = validatePlan(
      semesters,
      [c1, c2],
      new Map(),
      new Map(),
      new Set(),
      [block],
      [],
      18
    );

    expect(result.issues.find((i) => i.code === "BLOCK_UNSATISFIED")).toBeUndefined();
    expect(result.blockStatuses[0].satisfied).toBe(true);
    expect(result.blockStatuses[0].requiredCredits).toBe(9);
    expect(result.blockStatuses[0].scheduledCredits).toBe(9);
  });

  // ── 11. Gen ed bucket short ──────────────────────────

  it("reports GENED_UNSATISFIED when a gen ed bucket is short on credits", () => {
    const c1 = makeCourse({ id: 100, credits: 3 });
    const c2 = makeCourse({ id: 101, credits: 3 });

    const semesters = [
      makeSemester("Fall", 2026, [c1]), // 3 credits
    ];

    const bucket = makeBucket({
      id: 5,
      code: "HUM",
      name: "Humanities",
      credits_required: 6,
      courses: [c1, c2],
    });

    const result = validatePlan(
      semesters,
      [c1],
      new Map(),
      new Map(),
      new Set(),
      [],
      [bucket],
      18,
    );

    const warning = result.issues.find((i) => i.code === "GENED_UNSATISFIED");
    expect(warning).toBeDefined();
    expect(warning!.severity).toBe("warning");

    const status = result.genEdStatuses[0];
    expect(status.satisfied).toBe(false);
    expect(status.coveredCredits).toBe(3);
    expect(status.requiredCredits).toBe(6);
    expect(status.missingCredits).toBe(3);
  });

  // ── 12. Multiple issues at once ──────────────────────

  it("returns multiple issues when several problems exist simultaneously", () => {
    const prereq = makeCourse({ id: 200, subject: "CS", number: "100" });
    const course = makeCourse({ id: 201, subject: "CS", number: "200" });
    const unscheduled = makeCourse({ id: 202, subject: "CS", number: "300" });
    const fallOnly = makeCourse({ id: 203, subject: "CS", number: "400" });
    const heavy1 = makeCourse({ id: 204, credits: 5 });
    const heavy2 = makeCourse({ id: 205, credits: 5 });
    const heavy3 = makeCourse({ id: 206, credits: 5 });
    const heavy4 = makeCourse({ id: 207, credits: 5 });

    // prereq (200) and course (201) in the same semester → PREREQ_VIOLATION
    // fallOnly (203) scheduled in Spring → AVAILABILITY_VIOLATION
    // heavy semester totals 20 credits with cap 18 → CREDIT_CAP_EXCEEDED
    // unscheduled (202) not in any semester → COURSE_NOT_SCHEDULED
    const semesters = [
      makeSemester("Spring", 2027, [prereq, course, fallOnly, heavy1, heavy2, heavy3, heavy4]),
    ];

    const prereqEdges = new Map<number, Set<number>>([
      [201, new Set([200])],
    ]);

    const availabilityMap = new Map<number, Set<string>>([
      [203, new Set(["FALL"])],
    ]);

    const block = makeBlock({
      id: 30,
      rule: "ALL_OF",
      name: "Core",
      courses: [prereq, course, unscheduled],
    });

    const bucket = makeBucket({
      id: 10,
      credits_required: 99,
      courses: [prereq],
    });

    const allSelected = [prereq, course, unscheduled, fallOnly, heavy1, heavy2, heavy3, heavy4];

    const result = validatePlan(
      semesters,
      allSelected,
      prereqEdges,
      availabilityMap,
      new Set(),
      [block],
      [bucket],
      18,
    );

    // Errors present → invalid
    expect(result.valid).toBe(false);

    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain("PREREQ_VIOLATION");
    expect(codes).toContain("AVAILABILITY_VIOLATION");
    expect(codes).toContain("CREDIT_CAP_EXCEEDED");
    expect(codes).toContain("COURSE_NOT_SCHEDULED");
    expect(codes).toContain("BLOCK_UNSATISFIED");
    expect(codes).toContain("GENED_UNSATISFIED");

    // Check error vs warning counts
    const errors = result.issues.filter((i) => i.severity === "error");
    const warnings = result.issues.filter((i) => i.severity === "warning");

    expect(errors.length).toBeGreaterThanOrEqual(3); // prereq, availability, unscheduled
    expect(warnings.length).toBeGreaterThanOrEqual(3); // credit cap, block, gened

    expect(result.unscheduledCourses).toHaveLength(1);
    expect(result.unscheduledCourses[0].id).toBe(202);
  });

  it("uses inferNOfRequiredCredits for N_OF block without credits_required", () => {
    const c1 = makeCourse({ id: 210, credits: 3 });
    const c2 = makeCourse({ id: 211, credits: 3 });
    const c3 = makeCourse({ id: 212, credits: 3 });

    const semesters = [makeSemester("Fall", 2026, [c1, c2])];

    const block = makeBlock({
      id: 30,
      rule: "N_OF",
      name: "Elective Group",
      n_required: 2,
      credits_required: null,
      courses: [c1, c2, c3],
    });

    const result = validatePlan(
      semesters,
      [c1, c2],
      new Map(),
      new Map(),
      new Set(),
      [block],
      [],
      18,
    );

    const status = result.blockStatuses[0];
    expect(status.satisfied).toBe(true);
    expect(status.requiredCredits).toBe(6); // 2 courses × 3 credits each
  });
});
