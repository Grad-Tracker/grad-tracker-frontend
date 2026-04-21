import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChainMock } from "../../../helpers/mocks";

const mockFrom = vi.hoisted(() => vi.fn());
const mockSafeLogActivity = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/supabase/queries/helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/queries/helpers")>();
  return {
    ...actual,
    safeLogActivity: mockSafeLogActivity,
  };
});

import {
  fetchPlans,
  createPlan,
  updatePlan,
  deletePlan,
  fetchPlanPrograms,
  setPlanPrograms,
  fetchStudentTerms,
  fetchPlannedCourses,
  getOrCreateTerm,
  addTermPlan,
  removeTermPlan,
  addPlannedCourse,
  removePlannedCourse,
  movePlannedCourse,
  fetchCompletedCourseIds,
  fetchStudentCourseProgress,
  fetchBreadthPackageId,
  updateBreadthPackageId,
  fetchCourseOfferings,
  fetchCrossListings,
  fetchGenEdBucketsWithCourses,
} from "@/lib/supabase/queries/planner";

function makeChain(data: unknown, error: unknown = null) {
  const chain = createChainMock();
  chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) => r({ data, error }));
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// fetchPlans
// ---------------------------------------------------------------------------

describe("fetchPlans", () => {
  it("returns empty array when no plans", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    const result = await fetchPlans(1);
    expect(result).toEqual([]);
  });

  it("returns mapped plan list", async () => {
    const rows = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan A",
        description: "desc",
        created_at: "2025-01-01",
        updated_at: "2025-01-02",
        program_ids: [10, 20],
        term_count: 2,
        course_count: 3,
        total_credits: 9,
        has_graduate_program: false,
      },
    ];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await fetchPlans(1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(5);
    expect(result[0].name).toBe("Plan A");
    expect(result[0].program_ids).toEqual([10, 20]);
    expect(result[0].has_graduate_program).toBe(false);
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("fetch error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(fetchPlans(1)).rejects.toThrow("fetch error");
  });
});

// ---------------------------------------------------------------------------
// createPlan
// ---------------------------------------------------------------------------

describe("createPlan", () => {
  it("creates a plan with no programs", async () => {
    const planData = { id: 10, student_id: 1, name: "New Plan", description: null, created_at: "2025-01-01", updated_at: "2025-01-01" };
    const chain = createChainMock();
    chain.single = vi.fn().mockResolvedValue({ data: planData, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await createPlan(1, "New Plan", null, []);
    expect(result).toEqual(planData);
    expect(mockSafeLogActivity).toHaveBeenCalledWith(1, "plan_created", "Created plan New Plan", expect.any(Object));
  });

  it("creates a plan and links programs", async () => {
    const planData = { id: 11, student_id: 1, name: "Plan B", description: null, created_at: "2025-01-01", updated_at: "2025-01-01" };
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChainMock();
      if (callCount === 1) {
        chain.single = vi.fn().mockResolvedValue({ data: planData, error: null });
      } else {
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) => r({ data: null, error: null }));
      }
      return chain;
    });

    const result = await createPlan(1, "Plan B", null, [10, 20]);
    expect(result).toEqual(planData);
  });

  it("throws when insert errors", async () => {
    const chain = createChainMock();
    chain.single = vi.fn().mockResolvedValue({ data: null, error: new Error("create error") });
    mockFrom.mockReturnValue(chain);
    await expect(createPlan(1, "Plan", null, [])).rejects.toThrow("create error");
  });
});

// ---------------------------------------------------------------------------
// updatePlan
// ---------------------------------------------------------------------------

describe("updatePlan", () => {
  it("updates plan without error", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await expect(updatePlan(5, { name: "New Name" })).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith("plans");
  });

  it("throws when update errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("update error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(updatePlan(5, { name: "Bad" })).rejects.toThrow("update error");
  });
});

// ---------------------------------------------------------------------------
// deletePlan
// ---------------------------------------------------------------------------

describe("deletePlan", () => {
  it("deletes plan and related records", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await expect(deletePlan(5)).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });

  it("throws when any delete errors", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChainMock();
      if (callCount === 1) {
        // student_planned_courses delete fails
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({ data: null, error: new Error("delete planned courses error") })
        );
      } else {
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) => r({ data: null, error: null }));
      }
      return chain;
    });
    await expect(deletePlan(5)).rejects.toThrow("delete planned courses error");
  });
});

// ---------------------------------------------------------------------------
// fetchPlanPrograms
// ---------------------------------------------------------------------------

describe("fetchPlanPrograms", () => {
  it("returns program ids for a plan", async () => {
    mockFrom.mockReturnValue(makeChain([{ program_id: 10 }, { program_id: 20 }]));
    const result = await fetchPlanPrograms(5);
    expect(result).toEqual([10, 20]);
  });

  it("returns empty array when no programs", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    const result = await fetchPlanPrograms(5);
    expect(result).toEqual([]);
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("fetch error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(fetchPlanPrograms(5)).rejects.toThrow("fetch error");
  });
});

// ---------------------------------------------------------------------------
// setPlanPrograms
// ---------------------------------------------------------------------------

describe("setPlanPrograms", () => {
  it("deletes existing and inserts new program links", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return makeChain(null);
    });
    await expect(setPlanPrograms(5, [10, 20])).resolves.toBeUndefined();
    expect(callCount).toBe(2); // delete + insert
  });

  it("only deletes when programIds is empty", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await expect(setPlanPrograms(5, [])).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledTimes(1); // only delete
  });

  it("throws when delete errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("delete error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(setPlanPrograms(5, [10])).rejects.toThrow("delete error");
  });
});

// ---------------------------------------------------------------------------
// fetchStudentTerms
// ---------------------------------------------------------------------------

describe("fetchStudentTerms", () => {
  it("returns mapped terms", async () => {
    const rows = [
      { term_id: 1, season: "Fall", year: 2024 },
      { term_id: 2, season: "Spring", year: 2025 },
    ];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await fetchStudentTerms(1, 5);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 1, season: "Fall", year: 2024 });
  });

  it("returns empty array when no terms", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    const result = await fetchStudentTerms(1, 5);
    expect(result).toEqual([]);
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("terms error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(fetchStudentTerms(1, 5)).rejects.toThrow("terms error");
  });
});

// ---------------------------------------------------------------------------
// fetchPlannedCourses
// ---------------------------------------------------------------------------

describe("fetchPlannedCourses", () => {
  it("returns mapped planned courses from flat view rows", async () => {
    const rows = [
      { student_id: 1, term_id: 5, course_id: 100, status: "PLANNED", plan_id: 1, subject: "CSCI", number: "101", title: "Intro", credits: 3 },
    ];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await fetchPlannedCourses(1, 1);
    expect(result).toHaveLength(1);
    expect(result[0].course.id).toBe(100);
    expect(result[0].status).toBe("PLANNED");
  });

  it("returns empty array when no planned courses", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    const result = await fetchPlannedCourses(1, 1);
    expect(result).toEqual([]);
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("planned courses error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(fetchPlannedCourses(1, 1)).rejects.toThrow("planned courses error");
  });
});

// ---------------------------------------------------------------------------
// getOrCreateTerm
// ---------------------------------------------------------------------------

describe("getOrCreateTerm", () => {
  it("returns existing term when found", async () => {
    const termData = { id: 5, season: "Fall", year: 2024 };
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: termData, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await getOrCreateTerm("Fall", 2024);
    expect(result).toEqual(termData);
  });

  it("creates new term when not found", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChainMock();
      if (callCount === 1) {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      } else {
        chain.single = vi.fn().mockResolvedValue({ data: { id: 10, season: "Spring", year: 2025 }, error: null });
      }
      return chain;
    });

    const result = await getOrCreateTerm("Spring", 2025);
    expect(result).toEqual({ id: 10, season: "Spring", year: 2025 });
  });

  it("throws when select errors", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: new Error("select error") });
    mockFrom.mockReturnValue(chain);
    await expect(getOrCreateTerm("Fall", 2024)).rejects.toThrow("select error");
  });
});

// ---------------------------------------------------------------------------
// addTermPlan
// ---------------------------------------------------------------------------

describe("addTermPlan", () => {
  it("inserts term plan link", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await expect(addTermPlan(1, 5, 10)).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith("student_term_plan");
  });

  it("throws when insert errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("insert error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(addTermPlan(1, 5, 10)).rejects.toThrow("insert error");
  });
});

// ---------------------------------------------------------------------------
// removeTermPlan
// ---------------------------------------------------------------------------

describe("removeTermPlan", () => {
  it("removes courses and term plan link", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await expect(removeTermPlan(1, 5, 10)).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it("throws when course delete errors", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChainMock();
      if (callCount === 1) {
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({ data: null, error: new Error("courses delete error") })
        );
      }
      return chain;
    });
    await expect(removeTermPlan(1, 5, 10)).rejects.toThrow("courses delete error");
  });
});

// ---------------------------------------------------------------------------
// addPlannedCourse
// ---------------------------------------------------------------------------

describe("addPlannedCourse", () => {
  it("inserts planned course and logs activity", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await expect(addPlannedCourse(1, 5, 100, 10, "CSCI 101")).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith("student_planned_courses");
    expect(mockSafeLogActivity).toHaveBeenCalledWith(
      1,
      "course_added",
      "Added CSCI 101 to a semester plan",
      expect.any(Object)
    );
  });

  it("uses 'a course' label when not provided", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await addPlannedCourse(1, 5, 100, 10);
    expect(mockSafeLogActivity).toHaveBeenCalledWith(
      1,
      "course_added",
      "Added a course to a semester plan",
      expect.any(Object)
    );
  });

  it("throws when insert errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("insert error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(addPlannedCourse(1, 5, 100, 10)).rejects.toThrow("insert error");
  });
});

// ---------------------------------------------------------------------------
// removePlannedCourse
// ---------------------------------------------------------------------------

describe("removePlannedCourse", () => {
  it("deletes planned course and logs activity", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await expect(removePlannedCourse(1, 5, 100, 10, "CSCI 101")).resolves.toBeUndefined();
    expect(mockSafeLogActivity).toHaveBeenCalledWith(
      1,
      "course_removed",
      "Removed CSCI 101 from a semester plan",
      expect.any(Object)
    );
  });

  it("throws when delete errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("delete error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(removePlannedCourse(1, 5, 100, 10)).rejects.toThrow("delete error");
  });
});

// ---------------------------------------------------------------------------
// movePlannedCourse
// ---------------------------------------------------------------------------

describe("movePlannedCourse", () => {
  it("moves course from one term to another and logs activity", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await expect(movePlannedCourse(1, 100, 5, 6, 10, "CSCI 101")).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledTimes(2); // delete + insert
    expect(mockSafeLogActivity).toHaveBeenCalledWith(
      1,
      "plan_updated",
      "Moved CSCI 101 to a different semester",
      expect.any(Object)
    );
  });

  it("throws when delete errors", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChainMock();
      if (callCount === 1) {
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({ data: null, error: new Error("delete error") })
        );
      }
      return chain;
    });
    await expect(movePlannedCourse(1, 100, 5, 6, 10)).rejects.toThrow("delete error");
  });
});

// ---------------------------------------------------------------------------
// fetchCompletedCourseIds
// ---------------------------------------------------------------------------

describe("fetchCompletedCourseIds", () => {
  it("returns set of completed course IDs", async () => {
    const rows = [
      { course_id: 100, completed: true, progress_status: "COMPLETED" },
      { course_id: 200, completed: null, progress_status: "COMPLETED" },
      { course_id: 300, completed: false, progress_status: "IN_PROGRESS" },
    ];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await fetchCompletedCourseIds(1);
    expect(result.has(100)).toBe(true);
    expect(result.has(200)).toBe(true);
    expect(result.has(300)).toBe(false);
  });

  it("returns empty set when no data", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    const result = await fetchCompletedCourseIds(1);
    expect(result.size).toBe(0);
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("progress error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(fetchCompletedCourseIds(1)).rejects.toThrow("progress error");
  });
});

// ---------------------------------------------------------------------------
// fetchStudentCourseProgress
// ---------------------------------------------------------------------------

describe("fetchStudentCourseProgress", () => {
  it("returns course progress rows", async () => {
    const rows = [
      { student_id: 1, course_id: 100, plan_id: 5, term_id: 3, completed: true, grade: "A", progress_status: "COMPLETED" },
    ];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await fetchStudentCourseProgress(1);
    expect(result).toHaveLength(1);
    expect(result[0].course_id).toBe(100);
  });

  it("returns empty array when null data", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    const result = await fetchStudentCourseProgress(1);
    expect(result).toEqual([]);
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("progress error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(fetchStudentCourseProgress(1)).rejects.toThrow("progress error");
  });
});

// ---------------------------------------------------------------------------
// fetchBreadthPackageId
// ---------------------------------------------------------------------------

describe("fetchBreadthPackageId", () => {
  it("returns the breadth_package_id when set", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: { breadth_package_id: "pkg-123" }, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchBreadthPackageId(1);
    expect(result).toBe("pkg-123");
  });

  it("returns null when not set", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchBreadthPackageId(1);
    expect(result).toBeNull();
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: new Error("breadth error") });
    mockFrom.mockReturnValue(chain);

    await expect(fetchBreadthPackageId(1)).rejects.toThrow("breadth error");
  });
});

// ---------------------------------------------------------------------------
// updateBreadthPackageId
// ---------------------------------------------------------------------------

describe("updateBreadthPackageId", () => {
  it("updates the breadth package id", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await expect(updateBreadthPackageId(1, "pkg-abc")).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith("students");
  });

  it("sets breadth package id to null", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await expect(updateBreadthPackageId(1, null)).resolves.toBeUndefined();
  });

  it("throws when update errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("update error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(updateBreadthPackageId(1, "pkg")).rejects.toThrow("update error");
  });
});

// ---------------------------------------------------------------------------
// fetchCourseOfferings
// ---------------------------------------------------------------------------

describe("fetchCourseOfferings", () => {
  it("returns empty array for empty courseIds", async () => {
    const result = await fetchCourseOfferings([]);
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns course offerings", async () => {
    const rows = [{ course_id: 100, term_code: "FA2024" }];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await fetchCourseOfferings([100]);
    expect(result).toEqual(rows);
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("offerings error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(fetchCourseOfferings([100])).rejects.toThrow("offerings error");
  });
});

// ---------------------------------------------------------------------------
// fetchCrossListings
// ---------------------------------------------------------------------------

describe("fetchCrossListings", () => {
  it("returns empty map for empty courseIds", async () => {
    const result = await fetchCrossListings([]);
    expect(result.size).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns empty map when no cross-listings found", async () => {
    mockFrom.mockReturnValue(makeChain([]));
    const result = await fetchCrossListings([100]);
    expect(result.size).toBe(0);
  });

  it("builds equivalence map from cross-listing data", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChainMock();
      if (callCount === 1) {
        // course_crosslistings
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({
            data: [{ course_id: 100, cross_subject: "MATH", cross_number: "101" }],
            error: null,
          })
        );
      } else {
        // courses lookup
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({
            data: [{ id: 200, subject: "MATH", number: "101" }],
            error: null,
          })
        );
      }
      return chain;
    });

    const result = await fetchCrossListings([100]);
    expect(result.has(100)).toBe(true);
    expect(result.get(100)!.has(200)).toBe(true);
    expect(result.has(200)).toBe(true);
    expect(result.get(200)!.has(100)).toBe(true);
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("crosslist error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(fetchCrossListings([100])).rejects.toThrow("crosslist error");
  });
});

// ---------------------------------------------------------------------------
// fetchGenEdBucketsWithCourses
// ---------------------------------------------------------------------------

describe("fetchGenEdBucketsWithCourses", () => {
  it("returns empty array when no buckets", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    const result = await fetchGenEdBucketsWithCourses();
    expect(result).toEqual([]);
  });

  it("returns empty array when data is empty array", async () => {
    mockFrom.mockReturnValue(makeChain([]));
    const result = await fetchGenEdBucketsWithCourses();
    expect(result).toEqual([]);
  });

  it("returns mapped gen-ed buckets with courses", async () => {
    const rows = [
      {
        bucket_id: 1,
        bucket_code: "HUM",
        bucket_name: "Humanities",
        bucket_credits_required: 6,
        courses: [
          { course_id: 100, subject: "ENGL", number: "101", title: "Composition", credits: 3 },
        ],
      },
    ];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await fetchGenEdBucketsWithCourses();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].code).toBe("HUM");
    expect(result[0].credits_required).toBe(6);
    expect(result[0].courses).toHaveLength(1);
    expect(result[0].courses[0].subject).toBe("ENGL");
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("gen-ed error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(fetchGenEdBucketsWithCourses()).rejects.toThrow("gen-ed error");
  });
});
