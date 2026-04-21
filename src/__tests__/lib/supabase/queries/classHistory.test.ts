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
  fetchDefaultTermId,
  fetchMajorRequirementCourses,
  fetchStudentCourseHistory,
  insertCourseHistory,
  deleteCourseHistory,
  searchCourses,
  insertManualCourse,
} from "@/lib/supabase/queries/classHistory";

function makeChain(data: unknown, error: unknown = null) {
  const chain = createChainMock();
  chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) => r({ data, error }));
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// fetchDefaultTermId
// ---------------------------------------------------------------------------

describe("fetchDefaultTermId", () => {
  it("returns the term_id from the first chronological term", async () => {
    const chain = createChainMock();
    chain.single = vi.fn().mockResolvedValue({ data: { term_id: 3 }, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchDefaultTermId();
    expect(result).toBe(3);
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.single = vi.fn().mockResolvedValue({ data: null, error: new Error("no term") });
    mockFrom.mockReturnValue(chain);

    await expect(fetchDefaultTermId()).rejects.toThrow("no term");
  });
});

// ---------------------------------------------------------------------------
// fetchMajorRequirementCourses
// ---------------------------------------------------------------------------

describe("fetchMajorRequirementCourses", () => {
  it("returns null when student has no major program", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchMajorRequirementCourses(1);
    expect(result).toBeNull();
  });

  it("returns structured major with blocks", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChainMock();
      if (callCount === 1) {
        // v_student_primary_major_program
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { student_id: 1, program_id: 10, program_name: "B.S. Computer Science" },
          error: null,
        });
      } else {
        // v_program_block_courses
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({
            data: [
              {
                block_id: 1,
                block_name: "Core",
                courses: [{ course_id: 100, subject: "CSCI", number: "101", title: "Intro", credits: 3 }],
              },
            ],
            error: null,
          })
        );
      }
      return chain;
    });

    const result = await fetchMajorRequirementCourses(1);
    expect(result).not.toBeNull();
    expect(result!.majorName).toBe("B.S. Computer Science");
    expect(result!.blocks).toHaveLength(1);
    expect(result!.blocks[0].name).toBe("Core");
    expect(result!.blocks[0].courses).toHaveLength(1);
  });

  it("throws when major query errors", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: new Error("major error") });
    mockFrom.mockReturnValue(chain);

    await expect(fetchMajorRequirementCourses(1)).rejects.toThrow("major error");
  });
});

// ---------------------------------------------------------------------------
// fetchStudentCourseHistory
// ---------------------------------------------------------------------------

describe("fetchStudentCourseHistory", () => {
  it("returns mapped course history rows", async () => {
    const rows = [
      { course_id: 100, term_id: 5, completed: true, subject: "CSCI", number: "101", title: "Intro", credits: 3 },
    ];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await fetchStudentCourseHistory(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      course_id: 100,
      term_id: 5,
      completed: true,
      course: { id: 100, subject: "CSCI", number: "101", title: "Intro", credits: 3 },
    });
  });

  it("returns empty array when no history", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    const result = await fetchStudentCourseHistory(1);
    expect(result).toEqual([]);
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("history error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(fetchStudentCourseHistory(1)).rejects.toThrow("history error");
  });
});

// ---------------------------------------------------------------------------
// insertCourseHistory
// ---------------------------------------------------------------------------

describe("insertCourseHistory", () => {
  it("inserts course history and logs activity", async () => {
    mockFrom.mockReturnValue(makeChain(null));

    await insertCourseHistory(1, 100, 5, "CSCI 101");

    expect(mockFrom).toHaveBeenCalledWith("student_course_history");
    expect(mockSafeLogActivity).toHaveBeenCalledWith(
      1,
      "course_added",
      "Added CSCI 101 to completed history",
      expect.objectContaining({ course_id: 100, term_id: 5 })
    );
  });

  it("silently ignores duplicate (23505) and skips activity log", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: { code: "23505", message: "duplicate" } })
    );
    mockFrom.mockReturnValue(chain);

    await expect(insertCourseHistory(1, 100, 5)).resolves.toBeUndefined();
    expect(mockSafeLogActivity).not.toHaveBeenCalled();
  });

  it("throws on non-duplicate error", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("insert error") })
    );
    mockFrom.mockReturnValue(chain);

    await expect(insertCourseHistory(1, 100, 5)).rejects.toThrow("insert error");
  });

  it("uses 'a course' label when courseLabel not provided", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await insertCourseHistory(1, 100, 5);
    expect(mockSafeLogActivity).toHaveBeenCalledWith(
      1,
      "course_added",
      "Added a course to completed history",
      expect.any(Object)
    );
  });
});

// ---------------------------------------------------------------------------
// deleteCourseHistory
// ---------------------------------------------------------------------------

describe("deleteCourseHistory", () => {
  it("deletes course history and logs activity", async () => {
    mockFrom.mockReturnValue(makeChain(null));

    await deleteCourseHistory(1, 100, 5, "CSCI 101");

    expect(mockFrom).toHaveBeenCalledWith("student_course_history");
    expect(mockSafeLogActivity).toHaveBeenCalledWith(
      1,
      "course_removed",
      "Removed CSCI 101 from completed history",
      expect.objectContaining({ course_id: 100, term_id: 5 })
    );
  });

  it("uses 'a course' label when courseLabel not provided", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await deleteCourseHistory(1, 100, 5);
    expect(mockSafeLogActivity).toHaveBeenCalledWith(
      1,
      "course_removed",
      "Removed a course from completed history",
      expect.any(Object)
    );
  });

  it("throws when delete errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("delete error") })
    );
    mockFrom.mockReturnValue(chain);

    await expect(deleteCourseHistory(1, 100, 5)).rejects.toThrow("delete error");
  });
});

// ---------------------------------------------------------------------------
// searchCourses
// ---------------------------------------------------------------------------

describe("searchCourses", () => {
  it("returns empty array for queries shorter than 2 chars", async () => {
    const result = await searchCourses("C");
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns empty array for empty query", async () => {
    const result = await searchCourses("");
    expect(result).toEqual([]);
  });

  it("returns mapped courses for valid query", async () => {
    const rows = [
      { course_id: 100, subject: "CSCI", number: "101", title: "Intro", credits: 3 },
    ];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await searchCourses("CSCI");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 100, subject: "CSCI", number: "101", title: "Intro", credits: 3 });
  });

  it("escapes % and _ in query", async () => {
    mockFrom.mockReturnValue(makeChain([]));
    const result = await searchCourses("100%_test");
    expect(result).toEqual([]);
    const chain = mockFrom.mock.results[0].value;
    // or() should have been called with the escaped pattern
    expect(chain.or).toHaveBeenCalledWith(
      expect.stringContaining("\\%")
    );
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("search error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(searchCourses("CS")).rejects.toThrow("search error");
  });
});

// ---------------------------------------------------------------------------
// insertManualCourse
// ---------------------------------------------------------------------------

describe("insertManualCourse", () => {
  it("inserts and returns the new course", async () => {
    const newCourse = { id: 999, subject: "TEST", number: "000", title: "Manual Course", credits: 3 };
    const chain = createChainMock();
    chain.single = vi.fn().mockResolvedValue({ data: newCourse, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await insertManualCourse("TEST", "000", "Manual Course", 3);
    expect(result).toEqual(newCourse);
  });

  it("throws when insert errors", async () => {
    const chain = createChainMock();
    chain.single = vi.fn().mockResolvedValue({ data: null, error: new Error("insert error") });
    mockFrom.mockReturnValue(chain);

    await expect(insertManualCourse("BAD", "000", "Bad", 0)).rejects.toThrow("insert error");
  });
});
