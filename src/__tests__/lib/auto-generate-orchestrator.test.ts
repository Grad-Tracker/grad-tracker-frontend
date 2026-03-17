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
    vi.mocked(plannerQueries.fetchPlanPrograms).mockResolvedValue([9]);
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
    expect(plannerQueries.fetchPlanPrograms).toHaveBeenCalledWith(55);
    expect(autoGenerateLib.selectCoursesForBlock).toHaveBeenCalled();
    expect(autoGenerateLib.fillExistingPlan).toHaveBeenCalled();
    expect(plannerQueries.batchSavePlanCourses).toHaveBeenCalled();
    expect(result.planId).toBe(55);
    expect(result.totalCourses).toBe(1);
    expect(result.totalCredits).toBe(5);
  });
});
