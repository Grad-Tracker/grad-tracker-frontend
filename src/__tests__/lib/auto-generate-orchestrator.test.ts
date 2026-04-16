import { beforeEach, describe, expect, it, vi } from "vitest";
import { BREADTH_PACKAGES } from "@/types/planner";
import { autoGeneratePlan } from "@/lib/planner/auto-generate-orchestrator";
import * as plannerQueries from "@/lib/supabase/queries/planner";
import * as prereqGraph from "@/lib/planner/prereq-graph";
import * as autoGenerateLib from "@/lib/planner/auto-generate";
import * as validatePlanLib from "@/lib/planner/validate-plan";

vi.mock("@/lib/supabase/queries/planner", () => ({
  fetchAvailableCourses: vi.fn(),
  fetchCompletedCourseIds: vi.fn(),
  fetchGenEdBucketsWithCourses: vi.fn(),
  fetchCourseOfferings: vi.fn(),
  fetchStudentTerms: vi.fn(),
  fetchPlannedCourses: vi.fn(),
  createPlan: vi.fn(),
  fetchPlanPrograms: vi.fn(),
  batchSavePlanCourses: vi.fn(),
  fetchCrossListings: vi.fn(),
}));

vi.mock("@/lib/planner/prereq-graph", () => ({
  extractPrereqEdges: vi.fn(),
}));

vi.mock("@/lib/planner/auto-generate", () => ({
  selectCoursesForBlock: vi.fn(),
  resolveGenEdGaps: vi.fn(),
  computeTopologicalLevels: vi.fn(),
  scheduleCourses: vi.fn(),
  fillExistingPlan: vi.fn(),
  buildAvailabilityMap: vi.fn(),
  rebalanceSemesters: vi.fn(),
}));

vi.mock("@/lib/planner/validate-plan", () => ({
  validatePlan: vi.fn(),
}));

const course1 = {
  id: 101,
  subject: "MATH",
  number: "222",
  title: "Calculus II",
  credits: 5,
  description: null,
  prereq_text: null,
};

const course2 = {
  id: 102,
  subject: "CSCI",
  number: "242",
  title: "Computer Science II",
  credits: 5,
  description: null,
  prereq_text: null,
};

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(plannerQueries.fetchAvailableCourses).mockResolvedValue([]);
  vi.mocked(plannerQueries.fetchCompletedCourseIds).mockResolvedValue(new Set<number>());
  vi.mocked(plannerQueries.fetchGenEdBucketsWithCourses).mockResolvedValue([]);
  vi.mocked(plannerQueries.fetchStudentTerms).mockResolvedValue([]);
  vi.mocked(plannerQueries.fetchPlannedCourses).mockResolvedValue([]);
  vi.mocked(plannerQueries.fetchCourseOfferings).mockResolvedValue([]);
  vi.mocked(plannerQueries.fetchCrossListings).mockResolvedValue(new Map<number, Set<number>>());
  vi.mocked(prereqGraph.extractPrereqEdges).mockResolvedValue(new Map<number, Set<number>>());

  vi.mocked(autoGenerateLib.selectCoursesForBlock).mockImplementation((block) => block.courses);
  vi.mocked(autoGenerateLib.resolveGenEdGaps).mockReturnValue([]);
  vi.mocked(autoGenerateLib.computeTopologicalLevels).mockReturnValue(new Map<number, number>());
  vi.mocked(autoGenerateLib.buildAvailabilityMap).mockReturnValue(new Map<number, Set<string>>());
  vi.mocked(autoGenerateLib.scheduleCourses).mockReturnValue({
    semesters: [],
    unscheduledCourseIds: [],
  });
  vi.mocked(autoGenerateLib.fillExistingPlan).mockReturnValue({
    semesters: [],
    unscheduledCourseIds: [],
  });
  vi.mocked(autoGenerateLib.rebalanceSemesters).mockImplementation(
    (semesters) => semesters as any
  );

  vi.mocked(validatePlanLib.validatePlan).mockReturnValue({
    valid: true,
    issues: [],
    blockStatuses: [],
    genEdStatuses: [],
    unscheduledCourses: [],
  });
});

describe("autoGeneratePlan orchestrator", () => {
  it("returns early with empty schedule when no courses are selected", async () => {
    vi.mocked(plannerQueries.createPlan).mockResolvedValue({ id: 11 } as never);

    const result = await autoGeneratePlan(1, [10], {
      mode: "new",
      planName: "Auto Plan",
      includeSummers: false,
      startSeason: "Fall",
      startYear: 2026,
    });

    expect(result.planId).toBe(11);
    expect(result.semesters).toEqual([]);
    expect(result.totalCourses).toBe(0);
    expect(result.totalCredits).toBe(0);
    expect(plannerQueries.batchSavePlanCourses).not.toHaveBeenCalled();
    expect(validatePlanLib.validatePlan).not.toHaveBeenCalled();
  });


  it("uses new mode scheduling path when there are selected courses", async () => {
    vi.mocked(plannerQueries.createPlan).mockResolvedValue({ id: 22 } as never);
    vi.mocked(plannerQueries.fetchAvailableCourses).mockResolvedValue([
      {
        id: 2,
        program_id: 9,
        name: "Required Courses",
        rule: "ALL_OF",
        n_required: null,
        credits_required: null,
        courses: [course2],
      },
    ]);
    vi.mocked(plannerQueries.fetchGenEdBucketsWithCourses).mockResolvedValue([
      {
        id: 77,
        code: "HU",
        name: "Humanities",
        credits_required: 3,
        courses: [course1],
      },
    ]);
    vi.mocked(autoGenerateLib.computeTopologicalLevels).mockReturnValue(
      new Map<number, number>([
        [101, 0],
        [102, 0],
      ])
    );
    vi.mocked(autoGenerateLib.scheduleCourses).mockReturnValue({
      semesters: [
        {
          season: "Fall",
          year: 2026,
          courses: [course2],
          totalCredits: 5,
        },
      ],
      unscheduledCourseIds: [],
    });

    const progress: string[] = [];
    const result = await autoGeneratePlan(
      1,
      [9],
      {
        mode: "new",
        includeSummers: false,
        startSeason: "Fall",
        startYear: 2026,
      },
      (msg) => progress.push(msg)
    );

    expect(autoGenerateLib.fillExistingPlan).not.toHaveBeenCalled();
    expect(autoGenerateLib.scheduleCourses).toHaveBeenCalled();
    expect(validatePlanLib.validatePlan).toHaveBeenCalled();
    expect(progress.at(-1)).toBe("Done!");
    expect(result.planId).toBe(22);
    expect(result.totalCourses).toBe(1);
  });

  it("falls back to scheduleCourses in fill mode when no existing terms are present", async () => {
    vi.mocked(plannerQueries.fetchAvailableCourses).mockResolvedValue([
      {
        id: 3,
        program_id: 9,
        name: "Required Courses",
        rule: "ALL_OF",
        n_required: null,
        credits_required: null,
        courses: [course1],
      },
    ]);
    vi.mocked(plannerQueries.fetchStudentTerms).mockResolvedValue([]);
    vi.mocked(plannerQueries.fetchPlannedCourses).mockResolvedValue([]);
    vi.mocked(autoGenerateLib.scheduleCourses).mockReturnValue({
      semesters: [
        {
          season: "Spring",
          year: 2027,
          courses: [course1],
          totalCredits: 5,
        },
      ],
      unscheduledCourseIds: [],
    });

    const result = await autoGeneratePlan(1, [9], {
      mode: "fill",
      planId: 99,
      includeSummers: false,
      startSeason: "Fall",
      startYear: 2026,
    });

    expect(autoGenerateLib.fillExistingPlan).not.toHaveBeenCalled();
    expect(autoGenerateLib.scheduleCourses).toHaveBeenCalled();
    expect(result.planId).toBe(99);
    expect(result.totalCourses).toBe(1);
  });

  it("uses fill mode + breadth package filter and saves generated semesters", async () => {
    vi.mocked(plannerQueries.fetchAvailableCourses).mockResolvedValue([
      {
        id: 1,
        program_id: 9,
        name: "Breadth Requirement",
        rule: "N_OF",
        n_required: 1,
        credits_required: null,
        courses: [course1, course2],
      },
    ]);
    vi.mocked(plannerQueries.fetchStudentTerms).mockResolvedValue([
      { id: 90, season: "Fall", year: 2026 },
    ]);
    vi.mocked(plannerQueries.fetchPlannedCourses).mockResolvedValue([]);
    vi.mocked(plannerQueries.fetchPlanPrograms).mockResolvedValue([9]);
    vi.mocked(plannerQueries.fetchCourseOfferings).mockResolvedValue([
      { course_id: 101, term_code: "FALL" },
    ]);
    vi.mocked(autoGenerateLib.computeTopologicalLevels).mockReturnValue(
      new Map<number, number>([[101, 0]])
    );
    vi.mocked(autoGenerateLib.fillExistingPlan).mockReturnValue({
      semesters: [
        {
          season: "Fall",
          year: 2026,
          courses: [course1],
          totalCredits: 5,
        },
      ],
      unscheduledCourseIds: [],
    });

    const result = await autoGeneratePlan(1, [9], {
      mode: "fill",
      planId: 55,
      includeSummers: false,
      startSeason: "Fall",
      startYear: 2026,
      breadthPackage: BREADTH_PACKAGES.find((pkg) => pkg.id === "math"),
    });

    expect(plannerQueries.createPlan).not.toHaveBeenCalled();
    expect(plannerQueries.fetchPlanPrograms).not.toHaveBeenCalled();
    expect(autoGenerateLib.selectCoursesForBlock).toHaveBeenCalled();
    expect(autoGenerateLib.fillExistingPlan).toHaveBeenCalled();
    expect(plannerQueries.batchSavePlanCourses).toHaveBeenCalled();
    expect(result.planId).toBe(55);
    expect(result.totalCourses).toBe(1);
    expect(result.totalCredits).toBe(5);
  });

  it("does not top-up from already satisfied non-elective blocks", async () => {
    const math221 = {
      id: 201,
      subject: "MATH",
      number: "221",
      title: "Calculus I",
      credits: 5,
      description: null,
      prereq_text: null,
    };
    const chem215 = {
      id: 202,
      subject: "CHEM",
      number: "215",
      title: "Organic Chemistry",
      credits: 5,
      description: null,
      prereq_text: null,
    };
    const chem101 = {
      id: 203,
      subject: "CHEM",
      number: "101",
      title: "General Chemistry I",
      credits: 4,
      description: null,
      prereq_text: null,
    };
    const chem102 = {
      id: 204,
      subject: "CHEM",
      number: "102",
      title: "General Chemistry II",
      credits: 5,
      description: null,
      prereq_text: null,
    };
    const electiveA = {
      id: 205,
      subject: "CSCI",
      number: "323",
      title: "Software Design",
      credits: 3,
      description: null,
      prereq_text: null,
    };
    const electiveB = {
      id: 206,
      subject: "CSCI",
      number: "333",
      title: "Databases",
      credits: 3,
      description: null,
      prereq_text: null,
    };

    vi.mocked(plannerQueries.createPlan).mockResolvedValue({ id: 77 } as never);
    vi.mocked(plannerQueries.fetchAvailableCourses).mockResolvedValue([
      {
        id: 10,
        program_id: 9,
        name: "Math & Chemistry",
        rule: "CREDITS_OF",
        n_required: null,
        credits_required: 10,
        courses: [math221, chem215, chem101, chem102],
      },
      {
        id: 11,
        program_id: 9,
        name: "Electives",
        rule: "N_OF",
        n_required: 2,
        credits_required: null,
        courses: [electiveA, electiveB],
      },
    ]);
    vi.mocked(prereqGraph.extractPrereqEdges).mockResolvedValue(
      new Map<number, Set<number>>([
        [chem215.id, new Set([chem102.id])],
        [chem102.id, new Set([chem101.id])],
      ])
    );
    vi.mocked(autoGenerateLib.selectCoursesForBlock).mockImplementation((block) => {
      if (block.name === "Math & Chemistry") return [math221 as any, chem215 as any];
      return [];
    });
    vi.mocked(autoGenerateLib.scheduleCourses).mockImplementation((courses) => ({
      semesters: [
        {
          season: "Fall",
          year: 2026,
          courses: courses as any[],
          totalCredits: (courses as any[]).reduce((sum, c) => sum + c.credits, 0),
        },
      ],
      unscheduledCourseIds: [],
    }));

    await autoGeneratePlan(1, [9], {
      mode: "new",
      includeSummers: false,
      startSeason: "Fall",
      startYear: 2026,
      targetCredits: 13,
    });

    const scheduleArgs = vi.mocked(autoGenerateLib.scheduleCourses).mock.calls[0]?.[0] ?? [];
    const scheduledIds = new Set((scheduleArgs as Array<{ id: number }>).map((c) => c.id));

    expect(scheduledIds.has(electiveA.id) || scheduledIds.has(electiveB.id)).toBe(true);
    expect(scheduledIds.has(chem101.id)).toBe(false);
    expect(scheduledIds.has(chem102.id)).toBe(false);
  });
});
