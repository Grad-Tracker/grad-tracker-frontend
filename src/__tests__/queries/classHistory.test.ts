import { describe, it, expect, vi, beforeEach } from "vitest";

interface QueryChainMock {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
  [key: string]: unknown;
}

function createChainMock(overrides: Record<string, unknown> = {}): QueryChainMock {
  const chain = {} as QueryChainMock;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: [], error: null }).then(resolve)
  );
  Object.assign(chain, overrides);
  return chain;
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";
import {
  fetchDefaultTermId,
  fetchMajorRequirementCourses,
  fetchStudentCourseHistory,
  insertCourseHistory,
  deleteCourseHistory,
  searchCourses,
  insertManualCourse,
} from "@/lib/supabase/queries/classHistory";

describe("classHistory queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- fetchDefaultTermId ---

  describe("fetchDefaultTermId", () => {
    it("returns the lowest ID term", async () => {
      const chain = createChainMock();
      chain.single = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await fetchDefaultTermId();

      expect(mockFrom).toHaveBeenCalledWith("terms");
      expect(chain.select).toHaveBeenCalledWith("id");
      expect(chain.order).toHaveBeenCalledWith("id", { ascending: true });
      expect(chain.limit).toHaveBeenCalledWith(1);
      expect(result).toBe(1);
    });

    it("throws on error", async () => {
      const chain = createChainMock();
      chain.single = vi.fn().mockResolvedValue({ data: null, error: new Error("db error") });
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await expect(fetchDefaultTermId()).rejects.toThrow("db error");
    });
  });

  // --- fetchMajorRequirementCourses ---

  describe("fetchMajorRequirementCourses", () => {
    it("returns null when student has no programs", async () => {
      const chain = createChainMock();
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ data: [], error: null })
      );
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await fetchMajorRequirementCourses(1);
      expect(result).toBeNull();
    });

    it("returns null when student has no major program", async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "student_programs") {
          const chain = createChainMock();
          chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
            resolve({ data: [{ program_id: 10 }], error: null })
          );
          return chain;
        }
        if (table === "programs") {
          const chain = createChainMock();
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
          return chain;
        }
        return createChainMock();
      });
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await fetchMajorRequirementCourses(1);
      expect(result).toBeNull();
    });

    it("returns major with blocks and courses", async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "student_programs") {
          const chain = createChainMock();
          chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
            resolve({ data: [{ program_id: 10 }], error: null })
          );
          return chain;
        }
        if (table === "programs") {
          const chain = createChainMock();
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: { id: 10, name: "Computer Science" },
            error: null,
          });
          return chain;
        }
        if (table === "program_requirement_blocks") {
          const chain = createChainMock();
          chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
            resolve({ data: [{ id: 100, name: "Core Courses" }], error: null })
          );
          return chain;
        }
        if (table === "program_requirement_courses") {
          const chain = createChainMock();
          chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
            resolve({
              data: [
                {
                  block_id: 100,
                  course_id: 1,
                  courses: { id: 1, subject: "CS", number: "101", title: "Intro to CS", credits: 3 },
                },
              ],
              error: null,
            })
          );
          return chain;
        }
        return createChainMock();
      });
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await fetchMajorRequirementCourses(1);
      expect(result).toEqual({
        majorName: "Computer Science",
        blocks: [
          {
            id: 100,
            name: "Core Courses",
            courses: [{ id: 1, subject: "CS", number: "101", title: "Intro to CS", credits: 3 }],
          },
        ],
      });
    });

    it("throws when student_programs query fails", async () => {
      const chain = createChainMock();
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ data: null, error: new Error("sp query failed") })
      );
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await expect(fetchMajorRequirementCourses(1)).rejects.toThrow("sp query failed");
    });

    it("throws when programs query fails", async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "student_programs") {
          const chain = createChainMock();
          chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
            resolve({ data: [{ program_id: 10 }], error: null })
          );
          return chain;
        }
        if (table === "programs") {
          const chain = createChainMock();
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: new Error("programs query failed"),
          });
          return chain;
        }
        return createChainMock();
      });
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await expect(fetchMajorRequirementCourses(1)).rejects.toThrow("programs query failed");
    });

    it("throws when requirement blocks query fails", async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "student_programs") {
          const chain = createChainMock();
          chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
            resolve({ data: [{ program_id: 10 }], error: null })
          );
          return chain;
        }
        if (table === "programs") {
          const chain = createChainMock();
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: { id: 10, name: "CS" },
            error: null,
          });
          return chain;
        }
        if (table === "program_requirement_blocks") {
          const chain = createChainMock();
          chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
            resolve({ data: null, error: new Error("blocks query failed") })
          );
          return chain;
        }
        return createChainMock();
      });
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await expect(fetchMajorRequirementCourses(1)).rejects.toThrow("blocks query failed");
    });

    it("throws when requirement courses query fails", async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "student_programs") {
          const chain = createChainMock();
          chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
            resolve({ data: [{ program_id: 10 }], error: null })
          );
          return chain;
        }
        if (table === "programs") {
          const chain = createChainMock();
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: { id: 10, name: "CS" },
            error: null,
          });
          return chain;
        }
        if (table === "program_requirement_blocks") {
          const chain = createChainMock();
          chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
            resolve({ data: [{ id: 100, name: "Core" }], error: null })
          );
          return chain;
        }
        if (table === "program_requirement_courses") {
          const chain = createChainMock();
          chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
            resolve({ data: null, error: new Error("courses query failed") })
          );
          return chain;
        }
        return createChainMock();
      });
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await expect(fetchMajorRequirementCourses(1)).rejects.toThrow("courses query failed");
    });

    it("returns empty blocks when major has no requirements", async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "student_programs") {
          const chain = createChainMock();
          chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
            resolve({ data: [{ program_id: 10 }], error: null })
          );
          return chain;
        }
        if (table === "programs") {
          const chain = createChainMock();
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: { id: 10, name: "Biology" },
            error: null,
          });
          return chain;
        }
        if (table === "program_requirement_blocks") {
          const chain = createChainMock();
          chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
            resolve({ data: [], error: null })
          );
          return chain;
        }
        return createChainMock();
      });
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await fetchMajorRequirementCourses(1);
      expect(result).toEqual({ majorName: "Biology", blocks: [] });
    });
  });

  // --- fetchStudentCourseHistory ---

  describe("fetchStudentCourseHistory", () => {
    it("returns mapped history rows", async () => {
      const chain = createChainMock();
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
        resolve({
          data: [
            {
              course_id: 1,
              term_id: 5,
              completed: true,
              courses: { id: 1, subject: "MATH", number: "101", title: "Calculus I", credits: 4 },
            },
          ],
          error: null,
        })
      );
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await fetchStudentCourseHistory(1);
      expect(result).toEqual([
        {
          course_id: 1,
          term_id: 5,
          completed: true,
          course: { id: 1, subject: "MATH", number: "101", title: "Calculus I", credits: 4 },
        },
      ]);
    });

    it("returns empty array for no history", async () => {
      const chain = createChainMock();
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ data: [], error: null })
      );
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await fetchStudentCourseHistory(1);
      expect(result).toEqual([]);
    });
  });

  // --- insertCourseHistory ---

  describe("insertCourseHistory", () => {
    it("inserts a row successfully", async () => {
      const chain = createChainMock();
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ data: null, error: null })
      );
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await insertCourseHistory(1, 100, 5);

      expect(mockFrom).toHaveBeenCalledWith("student_course_history");
      expect(chain.insert).toHaveBeenCalledWith({
        student_id: 1,
        course_id: 100,
        term_id: 5,
        completed: true,
      });
    });

    it("silently ignores duplicate insert (error code 23505)", async () => {
      const chain = createChainMock();
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ data: null, error: { code: "23505", message: "duplicate" } })
      );
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      // Should not throw
      await expect(insertCourseHistory(1, 100, 5)).resolves.toBeUndefined();
    });

    it("throws on non-duplicate errors", async () => {
      const chain = createChainMock();
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ data: null, error: { code: "42501", message: "permission denied" } })
      );
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await expect(insertCourseHistory(1, 100, 5)).rejects.toEqual({
        code: "42501",
        message: "permission denied",
      });
    });
  });

  // --- deleteCourseHistory ---

  describe("deleteCourseHistory", () => {
    it("deletes by all 3 PK columns", async () => {
      const chain = createChainMock();
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ data: null, error: null })
      );
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await deleteCourseHistory(1, 100, 5);

      expect(mockFrom).toHaveBeenCalledWith("student_course_history");
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith("student_id", 1);
      expect(chain.eq).toHaveBeenCalledWith("course_id", 100);
      expect(chain.eq).toHaveBeenCalledWith("term_id", 5);
    });

    it("throws on error", async () => {
      const chain = createChainMock();
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ data: null, error: new Error("delete failed") })
      );
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await expect(deleteCourseHistory(1, 100, 5)).rejects.toThrow("delete failed");
    });
  });

  // --- searchCourses ---

  describe("searchCourses", () => {
    it("returns empty array for queries shorter than 2 chars", async () => {
      const result = await searchCourses("a");
      expect(result).toEqual([]);
    });

    it("returns search results for valid query", async () => {
      const mockCourses = [
        { id: 1, subject: "MATH", number: "101", title: "Calculus I", credits: 4 },
      ];
      const chain = createChainMock();
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ data: mockCourses, error: null })
      );
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await searchCourses("MATH");
      expect(result).toEqual(mockCourses);
      expect(chain.limit).toHaveBeenCalledWith(20);
    });

    it("escapes SQL wildcards in query", async () => {
      const chain = createChainMock();
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ data: [], error: null })
      );
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await searchCourses("100%");
      expect(chain.or).toHaveBeenCalledWith(
        expect.stringContaining("100\\%")
      );
    });

    it("escapes underscore wildcards in query", async () => {
      const chain = createChainMock();
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      );
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await searchCourses("100_");
      expect(chain.or).toHaveBeenCalledWith(
        expect.stringContaining("100\\_")
      );
    });
  });

  // --- insertManualCourse ---

  describe("insertManualCourse", () => {
    it("inserts and returns the new course", async () => {
      const newCourse = { id: 999, subject: "ART", number: "200", title: "Drawing", credits: 3 };
      const chain = createChainMock();
      chain.single = vi.fn().mockResolvedValue({ data: newCourse, error: null });
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await insertManualCourse("ART", "200", "Drawing", 3);

      expect(mockFrom).toHaveBeenCalledWith("courses");
      expect(chain.insert).toHaveBeenCalledWith({
        subject: "ART",
        number: "200",
        title: "Drawing",
        credits: 3,
      });
      expect(result).toEqual(newCourse);
    });

    it("throws on error", async () => {
      const chain = createChainMock();
      chain.single = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("insert failed"),
      });
      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await expect(insertManualCourse("ART", "200", "Drawing", 3)).rejects.toThrow("insert failed");
    });
  });
});
