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
  fetchStudentCourseProgress,
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
  fetchGenEdBucketsWithCourses,
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
    it("returns [] when view query returns empty array", async () => {
      mockFrom.mockReturnValueOnce(mockChain([]));

      const result = await fetchPlans(1);
      expect(result).toEqual([]);
    });

    it("returns [] when view query returns null", async () => {
      mockFrom.mockReturnValueOnce(mockChain(null));

      const result = await fetchPlans(1);
      expect(result).toEqual([]);
    });

    it("throws when view query errors", async () => {
      const err = { message: "DB error" };
      mockFrom.mockReturnValueOnce(mockChain(null, err));

      await expect(fetchPlans(1)).rejects.toEqual(err);
    });

    it("maps v_plan_meta rows to PlanWithMeta", async () => {
      const rows = [
        {
          plan_id: 1,
          student_id: 1,
          name: "Plan A",
          description: null,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
          program_ids: [10, 11],
          term_count: 2,
          course_count: 8,
          total_credits: 24,
          has_graduate_program: false,
        },
        {
          plan_id: 2,
          student_id: 1,
          name: "Plan B",
          description: "Graduate",
          created_at: "2024-02-01",
          updated_at: "2024-02-02",
          program_ids: "{20}",
          term_count: null,
          course_count: null,
          total_credits: null,
          has_graduate_program: true,
        },
      ];

      mockFrom.mockReturnValueOnce(mockChain(rows));

      const result = await fetchPlans(1);

      expect(result).toHaveLength(2);
      expect(result[0].program_ids).toEqual([10, 11]);
      expect(result[0].term_count).toBe(2);
      expect(result[0].course_count).toBe(8);
      expect(result[0].total_credits).toBe(24);
      expect(result[0].has_graduate_program).toBe(false);

      expect(result[1].program_ids).toEqual([20]);
      expect(result[1].term_count).toBe(0);
      expect(result[1].course_count).toBe(0);
      expect(result[1].total_credits).toBe(0);
      expect(result[1].has_graduate_program).toBe(true);
    });

    it("reads from v_plan_meta", async () => {
      mockFrom.mockReturnValueOnce(mockChain([]));
      await fetchPlans(1);
      expect(mockFrom).toHaveBeenCalledWith("v_plan_meta");
    });
  });

  // -------------------------------------------------------------------------
  // createPlan
  // -------------------------------------------------------------------------
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
        { term_id: 1, season: "Fall", year: 2024 },
        { term_id: 2, season: "Spring", year: 2025 },
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

    it("reads from v_plan_terms", async () => {
      mockFrom.mockReturnValueOnce(mockChain([]));
      await fetchStudentTerms(1, 1);
      expect(mockFrom).toHaveBeenCalledWith("v_plan_terms");
    });

    it("normalizes uppercase season values from view rows", async () => {
      const data = [
        { term_id: 1, season: "FALL", year: 2024 },
        { term_id: 2, season: "SPRING", year: 2025 },
      ];
      mockFrom.mockReturnValueOnce(mockChain(data));

      const result = await fetchStudentTerms(1, 1);

      expect(result).toEqual([
        { id: 1, season: "Fall", year: 2024 },
        { id: 2, season: "Spring", year: 2025 },
      ]);
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
          subject: "CS",
          number: "101",
          title: "Intro CS",
          credits: 3,
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

    it("maps legacy course_* aliases from the view", async () => {
      const data = [
        {
          student_id: 1,
          term_id: 10,
          course_id: 100,
          status: "PLANNED",
          plan_id: 1,
          course_subject: "CS",
          course_number: "102",
          course_title: "Programming",
          course_credits: 4,
        },
      ];
      mockFrom.mockReturnValueOnce(mockChain(data));

      const result = await fetchPlannedCourses(1, 1);

      expect(result).toHaveLength(1);
      expect(result[0].course).toEqual({
        id: 100,
        subject: "CS",
        number: "102",
        title: "Programming",
        credits: 4,
      });
    });

    it("returns empty array when no data", async () => {
      mockFrom.mockReturnValueOnce(mockChain(null));

      const result = await fetchPlannedCourses(1, 1);
      expect(result).toEqual([]);
    });

    it("reads from v_plan_courses", async () => {
      mockFrom.mockReturnValueOnce(mockChain([]));
      await fetchPlannedCourses(1, 1);
      expect(mockFrom).toHaveBeenCalledWith("v_plan_courses");
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
    it("returns [] when view returns empty rows", async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ id: 1 }))
        .mockReturnValueOnce(mockChain([{ program_id: 1 }]))
        .mockReturnValueOnce(mockChain([]));

      const result = await fetchAvailableCourses(1, 1);
      expect(result).toEqual([]);
    });

    it("returns [] when view returns null", async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ id: 1 }))
        .mockReturnValueOnce(mockChain([{ program_id: 1 }]))
        .mockReturnValueOnce(mockChain(null));

      const result = await fetchAvailableCourses(1, 1);
      expect(result).toEqual([]);
    });

    it("groups rows into blocks with mapped courses", async () => {
      const rows = [
        {
          block_id: 10,
          program_id: 1,
          program_name: "Computer Science",
          block_name: "Core",
          rule: "ALL_OF",
          n_required: null,
          credits_required: null,
          course_ids: [100, 101],
          courses: [
            {
              course_id: 100,
              subject: "CS",
              number: "101",
              title: "Intro CS",
              credits: 3,
            },
            {
              course_id: 101,
              subject: "CS",
              number: "201",
              title: "Data Structures",
              credits: 3,
            },
          ],
          is_plannable: true,
          planner_exclusion_reason: null,
        },
      ];

      mockFrom
        .mockReturnValueOnce(mockChain({ id: 1 }))
        .mockReturnValueOnce(mockChain([{ program_id: 1 }]))
        .mockReturnValueOnce(mockChain(rows));

      const result = await fetchAvailableCourses(1, 1);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Core");
      expect(result[0].courses).toHaveLength(2);
      expect(result[0].courses[0].subject).toBe("CS");
    });

    it("returns blocks with empty courses when row has no course data", async () => {
      const rows = [
        {
          block_id: 10,
          program_id: 1,
          block_name: "Core",
          rule: "ALL_OF",
          n_required: null,
          credits_required: null,
          courses: [],
          is_plannable: true,
          planner_exclusion_reason: null,
        },
      ];

      mockFrom
        .mockReturnValueOnce(mockChain({ id: 1 }))
        .mockReturnValueOnce(mockChain([{ program_id: 1 }]))
        .mockReturnValueOnce(mockChain(rows));

      const result = await fetchAvailableCourses(1, 1);

      expect(result).toHaveLength(1);
      expect(result[0].courses).toEqual([]);
    });

    it("filters non-plannable rows by default", async () => {
      const rows = [
        {
          block_id: 99,
          program_id: 1,
          block_name: "Scaffold",
          rule: "ALL_OF",
          n_required: null,
          credits_required: null,
          courses: [],
          is_plannable: false,
          planner_exclusion_reason: "No mapped courses.",
        },
      ];

      const viewChain = mockChain(rows);
      mockFrom
        .mockReturnValueOnce(mockChain({ id: 1 }))
        .mockReturnValueOnce(mockChain([{ program_id: 1 }]))
        .mockReturnValueOnce(viewChain);

      await fetchAvailableCourses(1, 1);
      expect(viewChain.eq).toHaveBeenCalledWith("is_plannable", true);
    });

    it("returns non-plannable rows when includeNonPlannable is true", async () => {
      const rows = [
        {
          block_id: 99,
          program_id: 1,
          block_name: "Scaffold",
          rule: "ALL_OF",
          n_required: null,
          credits_required: null,
          courses: [],
          is_plannable: false,
          planner_exclusion_reason: "No mapped courses.",
        },
      ];

      mockFrom
        .mockReturnValueOnce(mockChain({ id: 1 }))
        .mockReturnValueOnce(mockChain([{ program_id: 1 }]))
        .mockReturnValueOnce(mockChain(rows));

      const result = await fetchAvailableCourses(1, 1, {
        includeNonPlannable: true,
      });
      expect(result).toHaveLength(1);
      expect(result[0].is_plannable).toBe(false);
      expect(result[0].planner_exclusion_reason).toBe("No mapped courses.");
    });

    it("reads from v_program_block_courses", async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ id: 1 }))
        .mockReturnValueOnce(mockChain([{ program_id: 1 }]))
        .mockReturnValueOnce(mockChain([]));
      await fetchAvailableCourses(1, 1);
      expect(mockFrom).toHaveBeenNthCalledWith(3, "v_program_block_courses");
    });

    it("throws on view error", async () => {
      const err = { message: "view error" };
      mockFrom
        .mockReturnValueOnce(mockChain({ id: 1 }))
        .mockReturnValueOnce(mockChain([{ program_id: 1 }]))
        .mockReturnValueOnce(mockChain(null, err));

      await expect(fetchAvailableCourses(1, 1)).rejects.toEqual(err);
    });
  });

  // -------------------------------------------------------------------------
  // getOrCreateTerm
  // -------------------------------------------------------------------------
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
  // -------------------------------------------------------------------------
  // fetchStudentCourseProgress
  // -------------------------------------------------------------------------
  describe("fetchStudentCourseProgress", () => {
    it("returns rows from v_student_course_progress for the student", async () => {
      const rows = [
        {
          student_id: 1,
          course_id: 100,
          plan_id: 10,
          term_id: 20,
          completed: false,
          grade: null,
          progress_status: "planned",
        },
      ];
      mockFrom.mockReturnValueOnce(mockChain(rows));

      const result = await fetchStudentCourseProgress(1);

      expect(result).toEqual(rows);
      expect(mockFrom).toHaveBeenCalledWith("v_student_course_progress");
    });

    it("returns [] when the view returns null/empty", async () => {
      mockFrom.mockReturnValueOnce(mockChain(null));
      const result = await fetchStudentCourseProgress(1);
      expect(result).toEqual([]);
    });

    it("throws on view error", async () => {
      const err = { message: "progress view error" };
      mockFrom.mockReturnValueOnce(mockChain(null, err));

      await expect(fetchStudentCourseProgress(1)).rejects.toEqual(err);
    });
  });

  // -------------------------------------------------------------------------
  // fetchGenEdBucketsWithCourses
  // -------------------------------------------------------------------------
  describe("fetchGenEdBucketsWithCourses", () => {
    it("groups rows into buckets with mapped courses", async () => {
      const rows = [
        {
          bucket_id: 1,
          bucket_code: "HUM",
          bucket_name: "Humanities",
          bucket_credits_required: 6,
          course_ids: [100, 101],
          courses: [
            {
              course_id: 100,
              subject: "ENGL",
              number: "101",
              title: "Composition",
              credits: 3,
            },
            {
              course_id: 101,
              subject: "HIST",
              number: "201",
              title: "World History",
              credits: 3,
            },
          ],
        },
      ];
      mockFrom.mockReturnValueOnce(mockChain(rows));

      const result = await fetchGenEdBucketsWithCourses();

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("HUM");
      expect(result[0].courses).toHaveLength(2);
    });

    it("returns [] when view returns no rows", async () => {
      mockFrom.mockReturnValueOnce(mockChain([]));
      const result = await fetchGenEdBucketsWithCourses();
      expect(result).toEqual([]);
    });

    it("reads from v_gened_bucket_courses", async () => {
      mockFrom.mockReturnValueOnce(mockChain([]));
      await fetchGenEdBucketsWithCourses();
      expect(mockFrom).toHaveBeenCalledWith("v_gened_bucket_courses");
    });

    it("throws on view error", async () => {
      const err = { message: "view error" };
      mockFrom.mockReturnValueOnce(mockChain(null, err));
      await expect(fetchGenEdBucketsWithCourses()).rejects.toEqual(err);
    });
  });

  // -------------------------------------------------------------------------
  // fetchCompletedCourseIds
  // -------------------------------------------------------------------------
  describe("fetchCompletedCourseIds", () => {
    it("returns a Set of course_id numbers", async () => {
      const data = [
        { course_id: 100, completed: true, progress_status: "IN_PROGRESS" },
        { course_id: 200, completed: false, progress_status: "COMPLETED" },
        { course_id: 300, completed: false, progress_status: "IN_PROGRESS" },
      ];
      mockFrom.mockReturnValueOnce(mockChain(data));

      const result = await fetchCompletedCourseIds(1);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
      expect(result.has(100)).toBe(true);
      expect(result.has(200)).toBe(true);
      expect(result.has(300)).toBe(false);
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
      const data = [
        { course_id: "100", completed: true, progress_status: "IN_PROGRESS" },
        { course_id: "200", completed: false, progress_status: "COMPLETED" },
      ];
      mockFrom.mockReturnValueOnce(mockChain(data));

      const result = await fetchCompletedCourseIds(1);

      expect(result.has(100)).toBe(true);
      expect(result.has(200)).toBe(true);
    });
  });
});



