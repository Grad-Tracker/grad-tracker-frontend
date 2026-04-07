import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChainMock } from "../helpers/mocks";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";
import {
  fetchPlans,
  createPlan,
  updatePlan,
  deletePlan,
  fetchPlanPrograms,
  setPlanPrograms,
  fetchStudentTerms,
  fetchPlannedCourses,
  fetchAvailableCourses,
  getOrCreateTerm,
  addTermPlan,
  removeTermPlan,
  addPlannedCourse,
  removePlannedCourse,
  movePlannedCourse,
  fetchCompletedCourseIds,
  fetchBreadthPackageId,
  updateBreadthPackageId,
  fetchStudentCourseProgress,
  fetchCourseOfferings,
  fetchCrossListings,
  fetchGenEdBucketsWithCourses,
  batchSavePlanCourses,
} from "@/lib/supabase/queries/planner";

/**
 * Helper: create a chain that resolves as a thenable with the given data/error.
 */
function mockChain(data: unknown = null, error: unknown = null) {
  return createChainMock({
    then: (resolve: (v: unknown) => void) => resolve({ data, error }),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  });
}

describe("planner queries", () => {
  let mockFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom = vi.fn();
    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // fetchPlans
  // ─────────────────────────────────────────────────────────────────────────
  describe("fetchPlans", () => {
    it("returns [] when plan meta query returns empty array", async () => {
      mockFrom.mockReturnValueOnce(mockChain([]));

      const result = await fetchPlans(1);
      expect(result).toEqual([]);
    });

    it("returns [] when plan meta query returns null", async () => {
      mockFrom.mockReturnValueOnce(mockChain(null));

      const result = await fetchPlans(1);
      expect(result).toEqual([]);
    });

    it("throws when plan meta query errors", async () => {
      const err = { message: "DB error" };
      mockFrom.mockReturnValueOnce(mockChain(null, err));

      await expect(fetchPlans(1)).rejects.toEqual(err);
    });

    it("returns mapped PlanWithMeta rows from v_plan_meta", async () => {
      const plans = [
        {
          plan_id: 1,
          student_id: 1,
          name: "Plan A",
          description: null,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
          program_ids: [10],
          term_count: 2,
          course_count: 2,
          total_credits: 7,
          has_graduate_program: false,
        },
      ];

      mockFrom.mockReturnValueOnce(mockChain(plans));

      const result = await fetchPlans(1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].program_ids).toEqual([10]);
      expect(result[0].term_count).toBe(2);
      expect(result[0].course_count).toBe(2);
      expect(result[0].total_credits).toBe(7);
      expect(result[0].has_graduate_program).toBe(false);
    });

    it("normalizes numeric fields from string-like values", async () => {
      const plans = [
        {
          plan_id: "2",
          student_id: "1",
          name: "Plan B",
          description: null,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
          program_ids: ["11", "12"],
          term_count: "3",
          course_count: "5",
          total_credits: "15",
          has_graduate_program: true,
        },
      ];

      mockFrom.mockReturnValueOnce(mockChain(plans));
      const result = await fetchPlans(1);

      expect(result[0].id).toBe(2);
      expect(result[0].student_id).toBe(1);
      expect(result[0].program_ids).toEqual([11, 12]);
      expect(result[0].term_count).toBe(3);
      expect(result[0].course_count).toBe(5);
      expect(result[0].total_credits).toBe(15);
      expect(result[0].has_graduate_program).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createPlan
  // ─────────────────────────────────────────────────────────────────────────
  describe("createPlan", () => {
    it("inserts a plan and returns it", async () => {
      const planData = {
        id: 1,
        student_id: 1,
        name: "My Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      };

      const planChain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: planData, error: null }),
      });
      mockFrom.mockReturnValueOnce(planChain);

      const result = await createPlan(1, "My Plan", null, []);

      expect(result).toEqual(planData);
      expect(mockFrom).toHaveBeenCalledWith("plans");
    });

    it("skips plan_programs insert when programIds is empty", async () => {
      const planData = { id: 1, student_id: 1, name: "No Programs", description: null, created_at: "", updated_at: "" };

      const planChain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: planData, error: null }),
      });
      mockFrom.mockReturnValueOnce(planChain);

      await createPlan(1, "No Programs", null, []);

      // Should only call from() once (for the plan insert), not for plan_programs
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it("inserts plan_programs when programIds non-empty", async () => {
      const planData = { id: 5, student_id: 1, name: "With Programs", description: null, created_at: "", updated_at: "" };

      const planChain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: planData, error: null }),
      });
      const ppChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });

      mockFrom
        .mockReturnValueOnce(planChain)
        .mockReturnValueOnce(ppChain);

      await createPlan(1, "With Programs", null, [10, 11]);

      expect(mockFrom).toHaveBeenCalledTimes(2);
      expect(mockFrom).toHaveBeenNthCalledWith(2, "plan_programs");
    });

    it("throws on plan insert error", async () => {
      const err = { message: "insert error" };
      const planChain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: null, error: err }),
      });
      mockFrom.mockReturnValueOnce(planChain);

      await expect(createPlan(1, "Fail Plan", null, [])).rejects.toEqual(err);
    });

    it("throws on plan_programs insert error", async () => {
      const planData = { id: 3, student_id: 1, name: "Plan", description: null, created_at: "", updated_at: "" };
      const err = { message: "pp insert error" };

      const planChain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: planData, error: null }),
      });
      const ppChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });

      mockFrom
        .mockReturnValueOnce(planChain)
        .mockReturnValueOnce(ppChain);

      await expect(createPlan(1, "Plan", null, [10])).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updatePlan
  // ─────────────────────────────────────────────────────────────────────────
  describe("updatePlan", () => {
    it("calls update with the correct data", async () => {
      const chain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      mockFrom.mockReturnValueOnce(chain);

      await updatePlan(1, { name: "Updated Name" });

      expect(mockFrom).toHaveBeenCalledWith("plans");
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated Name", updated_at: expect.any(String) })
      );
      expect(chain.eq).toHaveBeenCalledWith("id", 1);
    });

    it("throws on error", async () => {
      const err = { message: "update error" };
      const chain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });
      mockFrom.mockReturnValueOnce(chain);

      await expect(updatePlan(99, { name: "Fail" })).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deletePlan
  // ─────────────────────────────────────────────────────────────────────────
  describe("deletePlan", () => {
    it("makes 3 deletes in the correct order (planned_courses, term_plan, plans)", async () => {
      const pcChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      const tpChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      const planChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });

      mockFrom
        .mockReturnValueOnce(pcChain)
        .mockReturnValueOnce(tpChain)
        .mockReturnValueOnce(planChain);

      await deletePlan(1);

      expect(mockFrom).toHaveBeenCalledTimes(3);
      expect(mockFrom).toHaveBeenNthCalledWith(1, "student_planned_courses");
      expect(mockFrom).toHaveBeenNthCalledWith(2, "student_term_plan");
      expect(mockFrom).toHaveBeenNthCalledWith(3, "plans");
    });

    it("throws if student_planned_courses delete errors", async () => {
      const err = { message: "planned courses delete error" };
      const pcChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });
      mockFrom.mockReturnValueOnce(pcChain);

      await expect(deletePlan(1)).rejects.toEqual(err);
    });

    it("throws if student_term_plan delete errors", async () => {
      const err = { message: "term plan delete error" };
      const pcChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      const tpChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });

      mockFrom
        .mockReturnValueOnce(pcChain)
        .mockReturnValueOnce(tpChain);

      await expect(deletePlan(1)).rejects.toEqual(err);
    });

    it("throws if plans delete errors", async () => {
      const err = { message: "plans delete error" };
      const pcChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      const tpChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      const planChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });

      mockFrom
        .mockReturnValueOnce(pcChain)
        .mockReturnValueOnce(tpChain)
        .mockReturnValueOnce(planChain);

      await expect(deletePlan(1)).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // fetchPlanPrograms
  // ─────────────────────────────────────────────────────────────────────────
  describe("fetchPlanPrograms", () => {
    it("returns array of program_id numbers", async () => {
      const data = [{ program_id: 10 }, { program_id: 20 }];
      mockFrom.mockReturnValueOnce(mockChain(data));

      const result = await fetchPlanPrograms(1);
      expect(result).toEqual([10, 20]);
    });

    it("returns empty array when no data", async () => {
      mockFrom.mockReturnValueOnce(mockChain(null));

      const result = await fetchPlanPrograms(1);
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      const err = { message: "fetch error" };
      mockFrom.mockReturnValueOnce(mockChain(null, err));

      await expect(fetchPlanPrograms(1)).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // setPlanPrograms
  // ─────────────────────────────────────────────────────────────────────────
  describe("setPlanPrograms", () => {
    it("deletes existing and inserts new programs", async () => {
      const delChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      const insChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });

      mockFrom
        .mockReturnValueOnce(delChain)
        .mockReturnValueOnce(insChain);

      await setPlanPrograms(1, [10, 11]);

      expect(mockFrom).toHaveBeenCalledTimes(2);
      expect(mockFrom).toHaveBeenNthCalledWith(1, "plan_programs");
      expect(mockFrom).toHaveBeenNthCalledWith(2, "plan_programs");
      expect(delChain.delete).toHaveBeenCalled();
      expect(insChain.insert).toHaveBeenCalledWith([
        { plan_id: 1, program_id: 10 },
        { plan_id: 1, program_id: 11 },
      ]);
    });

    it("skips insert when programIds is empty", async () => {
      const delChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      mockFrom.mockReturnValueOnce(delChain);

      await setPlanPrograms(1, []);

      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it("throws on delete error", async () => {
      const err = { message: "delete error" };
      const delChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });
      mockFrom.mockReturnValueOnce(delChain);

      await expect(setPlanPrograms(1, [10])).rejects.toEqual(err);
    });

    it("throws on insert error", async () => {
      const err = { message: "insert error" };
      const delChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      const insChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });

      mockFrom
        .mockReturnValueOnce(delChain)
        .mockReturnValueOnce(insChain);

      await expect(setPlanPrograms(1, [10])).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // fetchStudentTerms
  // ─────────────────────────────────────────────────────────────────────────
  describe("fetchStudentTerms", () => {
    it("maps row data to Term objects", async () => {
      const data = [
        { terms: { id: 1, season: "Fall", year: 2024 } },
        { terms: { id: 2, season: "Spring", year: 2025 } },
      ];
      mockFrom.mockReturnValueOnce(mockChain(data));

      const result = await fetchStudentTerms(1, 1);

      expect(result).toEqual([
        { id: 1, season: "Fall", year: 2024 },
        { id: 2, season: "Spring", year: 2025 },
      ]);
    });

    it("returns empty array when no data", async () => {
      mockFrom.mockReturnValueOnce(mockChain(null));

      const result = await fetchStudentTerms(1, 1);
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      const err = { message: "fetch terms error" };
      mockFrom.mockReturnValueOnce(mockChain(null, err));

      await expect(fetchStudentTerms(1, 1)).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // fetchPlannedCourses
  // ─────────────────────────────────────────────────────────────────────────
  describe("fetchPlannedCourses", () => {
    it("maps row data to PlannedCourseWithDetails objects", async () => {
      const data = [
        {
          student_id: 1,
          term_id: 10,
          course_id: 100,
          status: "PLANNED",
          plan_id: 1,
          courses: { id: 100, subject: "CS", number: "101", title: "Intro CS", credits: 3 },
        },
      ];
      mockFrom.mockReturnValueOnce(mockChain(data));

      const result = await fetchPlannedCourses(1, 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        student_id: 1,
        term_id: 10,
        course_id: 100,
        status: "PLANNED",
        plan_id: 1,
        course: { id: 100, subject: "CS", number: "101", title: "Intro CS", credits: 3 },
      });
    });

    it("returns empty array when no data", async () => {
      mockFrom.mockReturnValueOnce(mockChain(null));

      const result = await fetchPlannedCourses(1, 1);
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      const err = { message: "fetch planned courses error" };
      mockFrom.mockReturnValueOnce(mockChain(null, err));

      await expect(fetchPlannedCourses(1, 1)).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // fetchAvailableCourses
  // ─────────────────────────────────────────────────────────────────────────
  describe("fetchAvailableCourses", () => {
    it("returns [] when plan meta has no program_ids", async () => {
      mockFrom.mockReturnValueOnce(mockChain({ program_ids: [] }));

      const result = await fetchAvailableCourses(1, 1);
      expect(result).toEqual([]);
    });

    it("returns blocks with mapped courses", async () => {
      const planMeta = { program_ids: [1] };
      const blocks = [
        {
          block_id: 10,
          program_id: 1,
          block_name: "Core",
          rule: "ALL_OF",
          n_required: null,
          credits_required: null,
          courses: [
            { course_id: 100, subject: "CS", number: "101", title: "Intro CS", credits: 3 },
            { course_id: 101, subject: "CS", number: "201", title: "Data Structures", credits: 3 },
          ],
        },
      ];

      mockFrom
        .mockReturnValueOnce(mockChain(planMeta))
        .mockReturnValueOnce(mockChain(blocks));

      const result = await fetchAvailableCourses(1, 1);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Core");
      expect(result[0].courses).toHaveLength(2);
      expect(result[0].courses[0].subject).toBe("CS");
    });

    it("throws on v_plan_meta error", async () => {
      const err = { message: "plan meta error" };
      mockFrom.mockReturnValueOnce(mockChain(null, err));

      await expect(fetchAvailableCourses(1, 1)).rejects.toEqual(err);
    });

    it("throws on v_program_block_courses error", async () => {
      const err = { message: "blocks error" };
      mockFrom
        .mockReturnValueOnce(mockChain({ program_ids: [1] }))
        .mockReturnValueOnce(mockChain(null, err));

      await expect(fetchAvailableCourses(1, 1)).rejects.toEqual(err);
    });
  });
  describe("getOrCreateTerm", () => {
    it("returns existing term when maybeSingle returns data", async () => {
      const termData = { id: 5, season: "Fall", year: 2024 };
      const findChain = createChainMock({
        maybeSingle: vi.fn().mockResolvedValue({ data: termData, error: null }),
      });
      mockFrom.mockReturnValueOnce(findChain);

      const result = await getOrCreateTerm("Fall", 2024);

      expect(result).toEqual(termData);
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it("creates new term when maybeSingle returns null", async () => {
      const newTerm = { id: 6, season: "Spring", year: 2025 };
      const findChain = createChainMock({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      const createChainInstance = createChainMock({
        single: vi.fn().mockResolvedValue({ data: newTerm, error: null }),
      });
      mockFrom
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(createChainInstance);

      const result = await getOrCreateTerm("Spring", 2025);

      expect(result).toEqual(newTerm);
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it("throws on select error", async () => {
      const err = { message: "select error" };
      const findChain = createChainMock({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: err }),
      });
      mockFrom.mockReturnValueOnce(findChain);

      await expect(getOrCreateTerm("Fall", 2024)).rejects.toEqual(err);
    });

    it("throws on insert error", async () => {
      const err = { message: "insert error" };
      const findChain = createChainMock({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      const createChainInstance = createChainMock({
        single: vi.fn().mockResolvedValue({ data: null, error: err }),
      });
      mockFrom
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(createChainInstance);

      await expect(getOrCreateTerm("Summer", 2025)).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // addTermPlan
  // ─────────────────────────────────────────────────────────────────────────
  describe("addTermPlan", () => {
    it("inserts with correct payload", async () => {
      const chain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      mockFrom.mockReturnValueOnce(chain);

      await addTermPlan(1, 10, 5);

      expect(mockFrom).toHaveBeenCalledWith("student_term_plan");
      expect(chain.insert).toHaveBeenCalledWith({
        student_id: 1,
        term_id: 10,
        plan_id: 5,
      });
    });

    it("throws on error", async () => {
      const err = { message: "insert error" };
      const chain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });
      mockFrom.mockReturnValueOnce(chain);

      await expect(addTermPlan(1, 10, 5)).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // removeTermPlan
  // ─────────────────────────────────────────────────────────────────────────
  describe("removeTermPlan", () => {
    it("deletes planned_courses then term_plan", async () => {
      const pcChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      const tpChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });

      mockFrom
        .mockReturnValueOnce(pcChain)
        .mockReturnValueOnce(tpChain);

      await removeTermPlan(1, 10, 5);

      expect(mockFrom).toHaveBeenCalledTimes(2);
      expect(mockFrom).toHaveBeenNthCalledWith(1, "student_planned_courses");
      expect(mockFrom).toHaveBeenNthCalledWith(2, "student_term_plan");
    });

    it("throws if planned_courses delete errors", async () => {
      const err = { message: "planned courses error" };
      const pcChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });
      mockFrom.mockReturnValueOnce(pcChain);

      await expect(removeTermPlan(1, 10, 5)).rejects.toEqual(err);
    });

    it("throws if term_plan delete errors", async () => {
      const err = { message: "term plan error" };
      const pcChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      const tpChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });

      mockFrom
        .mockReturnValueOnce(pcChain)
        .mockReturnValueOnce(tpChain);

      await expect(removeTermPlan(1, 10, 5)).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // addPlannedCourse
  // ─────────────────────────────────────────────────────────────────────────
  describe("addPlannedCourse", () => {
    it("inserts with status PLANNED", async () => {
      const chain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      mockFrom.mockReturnValueOnce(chain);

      await addPlannedCourse(1, 10, 100, 5);

      expect(mockFrom).toHaveBeenCalledWith("student_planned_courses");
      expect(chain.insert).toHaveBeenCalledWith({
        student_id: 1,
        term_id: 10,
        course_id: 100,
        plan_id: 5,
        status: "PLANNED",
      });
    });

    it("throws on error", async () => {
      const err = { message: "insert error" };
      const chain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });
      mockFrom.mockReturnValueOnce(chain);

      await expect(addPlannedCourse(1, 10, 100, 5)).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // removePlannedCourse
  // ─────────────────────────────────────────────────────────────────────────
  describe("removePlannedCourse", () => {
    it("calls delete with correct eq filters", async () => {
      const chain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      mockFrom.mockReturnValueOnce(chain);

      await removePlannedCourse(1, 10, 100, 5);

      expect(mockFrom).toHaveBeenCalledWith("student_planned_courses");
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith("student_id", 1);
      expect(chain.eq).toHaveBeenCalledWith("term_id", 10);
      expect(chain.eq).toHaveBeenCalledWith("course_id", 100);
      expect(chain.eq).toHaveBeenCalledWith("plan_id", 5);
    });

    it("throws on error", async () => {
      const err = { message: "delete error" };
      const chain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });
      mockFrom.mockReturnValueOnce(chain);

      await expect(removePlannedCourse(1, 10, 100, 5)).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // movePlannedCourse
  // ─────────────────────────────────────────────────────────────────────────
  describe("movePlannedCourse", () => {
    it("deletes from old term then inserts in new term", async () => {
      const delChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      const insChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });

      mockFrom
        .mockReturnValueOnce(delChain)
        .mockReturnValueOnce(insChain);

      await movePlannedCourse(1, 100, 10, 20, 5);

      expect(mockFrom).toHaveBeenCalledTimes(2);
      expect(mockFrom).toHaveBeenNthCalledWith(1, "student_planned_courses");
      expect(mockFrom).toHaveBeenNthCalledWith(2, "student_planned_courses");
      expect(delChain.delete).toHaveBeenCalled();
      expect(delChain.eq).toHaveBeenCalledWith("term_id", 10);
      expect(insChain.insert).toHaveBeenCalledWith({
        student_id: 1,
        term_id: 20,
        course_id: 100,
        plan_id: 5,
        status: "PLANNED",
      });
    });

    it("throws on delete error", async () => {
      const err = { message: "delete error" };
      const delChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });
      mockFrom.mockReturnValueOnce(delChain);

      await expect(movePlannedCourse(1, 100, 10, 20, 5)).rejects.toEqual(err);
    });

    it("throws on insert error", async () => {
      const err = { message: "insert error" };
      const delChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      const insChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });

      mockFrom
        .mockReturnValueOnce(delChain)
        .mockReturnValueOnce(insChain);

      await expect(movePlannedCourse(1, 100, 10, 20, 5)).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // fetchCompletedCourseIds
  // ─────────────────────────────────────────────────────────────────────────
  describe("fetchCompletedCourseIds", () => {
    it("returns a Set of course_id numbers", async () => {
      const data = [{ course_id: 100 }, { course_id: 200 }, { course_id: 300 }];
      mockFrom.mockReturnValueOnce(mockChain(data));

      const result = await fetchCompletedCourseIds(1);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(3);
      expect(result.has(100)).toBe(true);
      expect(result.has(200)).toBe(true);
      expect(result.has(300)).toBe(true);
    });

    it("returns empty Set when no data", async () => {
      mockFrom.mockReturnValueOnce(mockChain(null));

      const result = await fetchCompletedCourseIds(1);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it("returns empty Set when data is empty array", async () => {
      mockFrom.mockReturnValueOnce(mockChain([]));

      const result = await fetchCompletedCourseIds(1);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it("throws on error", async () => {
      const err = { message: "fetch error" };
      mockFrom.mockReturnValueOnce(mockChain(null, err));

      await expect(fetchCompletedCourseIds(1)).rejects.toEqual(err);
    });

    it("converts course_id values to numbers via Number()", async () => {
      // Simulate bigint-like string values coming from DB
      const data = [{ course_id: "100" }, { course_id: "200" }];
      mockFrom.mockReturnValueOnce(mockChain(data));

      const result = await fetchCompletedCourseIds(1);

      expect(result.has(100)).toBe(true);
      expect(result.has(200)).toBe(true);
    });
  });

  describe("breadth package persistence", () => {
    it("fetchBreadthPackageId returns string value", async () => {
      mockFrom.mockReturnValueOnce(mockChain({ breadth_package_id: "math" }));
      await expect(fetchBreadthPackageId(1)).resolves.toBe("math");
    });

    it("fetchBreadthPackageId returns null when row value is null", async () => {
      mockFrom.mockReturnValueOnce(mockChain({ breadth_package_id: null }));
      await expect(fetchBreadthPackageId(1)).resolves.toBeNull();
    });

    it("fetchBreadthPackageId throws on error", async () => {
      const err = { message: "fetch breadth error" };
      mockFrom.mockReturnValueOnce(mockChain(null, err));
      await expect(fetchBreadthPackageId(1)).rejects.toEqual(err);
    });

    it("updateBreadthPackageId updates students row", async () => {
      const chain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });
      mockFrom.mockReturnValueOnce(chain);

      await updateBreadthPackageId(1, "business");

      expect(mockFrom).toHaveBeenCalledWith("students");
      expect(chain.update).toHaveBeenCalledWith({ breadth_package_id: "business" });
      expect(chain.eq).toHaveBeenCalledWith("id", 1);
    });

    it("updateBreadthPackageId throws on error", async () => {
      const err = { message: "update breadth error" };
      const chain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });
      mockFrom.mockReturnValueOnce(chain);

      await expect(updateBreadthPackageId(1, "business")).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // fetchStudentCourseProgress
  // ─────────────────────────────────────────────────────────────────────────
  describe("fetchStudentCourseProgress", () => {
    it("returns progress rows for a student", async () => {
      const data = [
        { student_id: 1, course_id: 100, plan_id: 1, term_id: 10, completed: true, grade: "A", progress_status: "completed" },
      ];
      mockFrom.mockReturnValueOnce(mockChain(data));

      const result = await fetchStudentCourseProgress(1);

      expect(result).toHaveLength(1);
      expect(result[0].student_id).toBe(1);
      expect(result[0].course_id).toBe(100);
    });

    it("returns empty array when no data", async () => {
      mockFrom.mockReturnValueOnce(mockChain(null));

      const result = await fetchStudentCourseProgress(1);
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      const err = { message: "progress error" };
      mockFrom.mockReturnValueOnce(mockChain(null, err));

      await expect(fetchStudentCourseProgress(1)).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // fetchCourseOfferings
  // ─────────────────────────────────────────────────────────────────────────
  describe("fetchCourseOfferings", () => {
    it("returns empty array when courseIds is empty without calling supabase", async () => {
      const result = await fetchCourseOfferings([]);
      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns offerings for given course IDs", async () => {
      const data = [{ course_id: 100, term_code: "FA25" }, { course_id: 200, term_code: "SP26" }];
      mockFrom.mockReturnValueOnce(mockChain(data));

      const result = await fetchCourseOfferings([100, 200]);

      expect(result).toHaveLength(2);
      expect(result[0].term_code).toBe("FA25");
      expect(result[1].course_id).toBe(200);
    });

    it("returns empty array when data is null", async () => {
      mockFrom.mockReturnValueOnce(mockChain(null));

      const result = await fetchCourseOfferings([100]);
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      const err = { message: "offerings error" };
      mockFrom.mockReturnValueOnce(mockChain(null, err));

      await expect(fetchCourseOfferings([100])).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // fetchCrossListings
  // ─────────────────────────────────────────────────────────────────────────
  describe("fetchCrossListings", () => {
    it("returns empty map when courseIds is empty without calling supabase", async () => {
      const result = await fetchCrossListings([]);
      expect(result.size).toBe(0);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns empty map when no cross-listings found", async () => {
      mockFrom.mockReturnValueOnce(mockChain([]));

      const result = await fetchCrossListings([100]);
      expect(result.size).toBe(0);
    });

    it("builds equivalence map from cross-listing data", async () => {
      const crossData = [{ course_id: 100, cross_subject: "MATH", cross_number: "201" }];
      const coursesData = [{ id: 200, subject: "MATH", number: "201" }];

      mockFrom
        .mockReturnValueOnce(mockChain(crossData))
        .mockReturnValueOnce(mockChain(coursesData));

      const result = await fetchCrossListings([100]);

      expect(result.has(100)).toBe(true);
      expect(result.get(100)?.has(200)).toBe(true);
      expect(result.has(200)).toBe(true);
      expect(result.get(200)?.has(100)).toBe(true);
    });

    it("skips cross-listed course when ID is not found in courses table", async () => {
      const crossData = [{ course_id: 100, cross_subject: "MATH", cross_number: "999" }];
      const coursesData: unknown[] = []; // no matching course found

      mockFrom
        .mockReturnValueOnce(mockChain(crossData))
        .mockReturnValueOnce(mockChain(coursesData));

      const result = await fetchCrossListings([100]);
      expect(result.size).toBe(0);
    });

    it("throws on cross-listings query error", async () => {
      const err = { message: "cross error" };
      mockFrom.mockReturnValueOnce(mockChain(null, err));

      await expect(fetchCrossListings([100])).rejects.toEqual(err);
    });

    it("throws on courses query error", async () => {
      const crossData = [{ course_id: 100, cross_subject: "MATH", cross_number: "201" }];
      const err = { message: "courses error" };

      mockFrom
        .mockReturnValueOnce(mockChain(crossData))
        .mockReturnValueOnce(mockChain(null, err));

      await expect(fetchCrossListings([100])).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // fetchGenEdBucketsWithCourses
  // ─────────────────────────────────────────────────────────────────────────
  describe("fetchGenEdBucketsWithCourses", () => {
    it("returns mapped buckets with courses", async () => {
      const data = [
        {
          bucket_id: 1,
          bucket_code: "MATH",
          bucket_name: "Mathematics",
          bucket_credits_required: "6",
          courses: [
            { course_id: 100, subject: "MATH", number: "101", title: "Calculus I", credits: 3 },
          ],
        },
      ];
      mockFrom.mockReturnValueOnce(mockChain(data));

      const result = await fetchGenEdBucketsWithCourses();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].code).toBe("MATH");
      expect(result[0].name).toBe("Mathematics");
      expect(result[0].credits_required).toBe(6);
      expect(result[0].courses).toHaveLength(1);
      expect(result[0].courses[0].subject).toBe("MATH");
      expect(result[0].courses[0].id).toBe(100);
    });

    it("returns empty array when data is null", async () => {
      mockFrom.mockReturnValueOnce(mockChain(null));

      const result = await fetchGenEdBucketsWithCourses();
      expect(result).toEqual([]);
    });

    it("returns empty array when data is empty array", async () => {
      mockFrom.mockReturnValueOnce(mockChain([]));

      const result = await fetchGenEdBucketsWithCourses();
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      const err = { message: "gen-ed error" };
      mockFrom.mockReturnValueOnce(mockChain(null, err));

      await expect(fetchGenEdBucketsWithCourses()).rejects.toEqual(err);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // batchSavePlanCourses
  // ─────────────────────────────────────────────────────────────────────────
  describe("batchSavePlanCourses", () => {
    it("completes without inserts when semesters list is empty", async () => {
      // Still queries for existing term plans and planned courses
      mockFrom
        .mockReturnValueOnce(mockChain([]))  // fetch existing term plans
        .mockReturnValueOnce(mockChain([])); // fetch existing planned courses

      await batchSavePlanCourses(1, 1, []);

      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it("inserts term plan and course rows for a new semester", async () => {
      const term = { id: 5, season: "Fall", year: 2025 };
      const semesters = [
        {
          season: "Fall" as const,
          year: 2025,
          courses: [{ id: 100, subject: "CS", number: "101", title: "Intro CS", credits: 3 }],
        },
      ];

      // getOrCreateTerm: find existing term
      const findTermChain = createChainMock({
        maybeSingle: vi.fn().mockResolvedValue({ data: term, error: null }),
      });

      // insert term plan
      const insertTermPlanChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });

      // insert planned courses
      const insertCoursesChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      });

      mockFrom
        .mockReturnValueOnce(findTermChain)         // getOrCreateTerm: find
        .mockReturnValueOnce(mockChain([]))         // fetch existing term plans (none)
        .mockReturnValueOnce(insertTermPlanChain)   // insert term plan
        .mockReturnValueOnce(mockChain([]))         // fetch existing planned courses (none)
        .mockReturnValueOnce(insertCoursesChain);   // insert planned courses

      await batchSavePlanCourses(1, 1, semesters);

      expect(insertTermPlanChain.insert).toHaveBeenCalledWith([
        { student_id: 1, term_id: 5, plan_id: 1 },
      ]);
      expect(insertCoursesChain.insert).toHaveBeenCalledWith([
        { student_id: 1, term_id: 5, course_id: 100, plan_id: 1, status: "PLANNED" },
      ]);
    });

    it("skips existing terms and courses to avoid duplicates", async () => {
      const term = { id: 5, season: "Fall", year: 2025 };
      const semesters = [
        {
          season: "Fall" as const,
          year: 2025,
          courses: [{ id: 100, subject: "CS", number: "101", title: "Intro CS", credits: 3 }],
        },
      ];

      const findTermChain = createChainMock({
        maybeSingle: vi.fn().mockResolvedValue({ data: term, error: null }),
      });

      mockFrom
        .mockReturnValueOnce(findTermChain)
        .mockReturnValueOnce(mockChain([{ term_id: 5 }]))      // term plan already exists
        .mockReturnValueOnce(mockChain([{ course_id: 100 }])); // planned course already exists

      await batchSavePlanCourses(1, 1, semesters);

      // Only 3 from() calls: getOrCreateTerm + 2 select queries; no inserts
      expect(mockFrom).toHaveBeenCalledTimes(3);
    });

    it("throws when term plan insert fails", async () => {
      const term = { id: 5, season: "Fall", year: 2025 };
      const semesters = [
        {
          season: "Fall" as const,
          year: 2025,
          courses: [{ id: 100, subject: "CS", number: "101", title: "Intro CS", credits: 3 }],
        },
      ];
      const err = { message: "insert term plan error" };

      const findTermChain = createChainMock({
        maybeSingle: vi.fn().mockResolvedValue({ data: term, error: null }),
      });
      const failChain = createChainMock({
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: err }),
      });

      mockFrom
        .mockReturnValueOnce(findTermChain)
        .mockReturnValueOnce(mockChain([]))   // no existing term plans
        .mockReturnValueOnce(failChain);      // insert fails

      await expect(batchSavePlanCourses(1, 1, semesters)).rejects.toEqual(err);
    });
  });
});

