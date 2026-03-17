import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChainMock } from "../helpers/mocks";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";
import {
  listCourses,
  fetchSubjects,
  fetchCourseById,
  addCourse,
  updateCourse,
  deactivateCourse,
  reactivateCourse,
} from "@/lib/supabase/queries/courses";

/** Chain that resolves as a thenable with optional count */
function mockChain(
  data: unknown = null,
  error: unknown = null,
  count: number | null = null
) {
  return createChainMock({
    then: (resolve: (v: unknown) => void) => resolve({ data, error, count }),
    single: vi.fn().mockResolvedValue({ data, error }),
  });
}

describe("courses queries", () => {
  let mockFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom = vi.fn();
    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);
  });

  // ── listCourses ───────────────────────────────────────────────────────────

  describe("listCourses", () => {
    it("returns data and total with no filters", async () => {
      const rows = [
        { id: 1, subject: "CS", number: "101", title: "Intro", credits: 3, is_active: true },
      ];
      mockFrom.mockReturnValue(mockChain(rows, null, 1));

      const result = await listCourses();
      expect(result.data).toEqual(rows);
      expect(result.total).toBe(1);
    });

    it("returns empty data when query returns null", async () => {
      mockFrom.mockReturnValue(mockChain(null, null, 0));

      const result = await listCourses();
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("calls or() when search is provided", async () => {
      const chain = mockChain([], null, 0);
      mockFrom.mockReturnValue(chain);

      await listCourses({ search: "intro" });
      expect(chain.or).toHaveBeenCalledWith(
        "title.ilike.%intro%,subject.ilike.%intro%,number.ilike.%intro%"
      );
    });

    it("does not call or() when search is blank", async () => {
      const chain = mockChain([], null, 0);
      mockFrom.mockReturnValue(chain);

      await listCourses({ search: "   " });
      expect(chain.or).not.toHaveBeenCalled();
    });

    it("calls eq() when subjectFilter is provided", async () => {
      const chain = mockChain([], null, 0);
      mockFrom.mockReturnValue(chain);

      await listCourses({ subjectFilter: "CS" });
      expect(chain.eq).toHaveBeenCalledWith("subject", "CS");
    });

    it("does not call eq() when subjectFilter is null", async () => {
      const chain = mockChain([], null, 0);
      mockFrom.mockReturnValue(chain);

      await listCourses({ subjectFilter: null });
      expect(chain.eq).not.toHaveBeenCalled();
    });

    it("calculates correct range for page 2 with pageSize 10", async () => {
      const chain = mockChain([], null, 0);
      mockFrom.mockReturnValue(chain);

      await listCourses({ page: 2, pageSize: 10 });
      // page 2, pageSize 10 → range(10, 19)
      expect(chain.range).toHaveBeenCalledWith(10, 19);
    });

    it("throws when query errors", async () => {
      const err = { message: "DB error" };
      mockFrom.mockReturnValue(mockChain(null, err, null));

      await expect(listCourses()).rejects.toEqual(err);
    });
  });

  // ── fetchSubjects ─────────────────────────────────────────────────────────

  describe("fetchSubjects", () => {
    it("returns deduplicated subjects in order", async () => {
      const rows = [
        { subject: "CS" },
        { subject: "CS" },
        { subject: "MATH" },
        { subject: "PHYS" },
      ];
      mockFrom.mockReturnValue(mockChain(rows));

      const result = await fetchSubjects();
      expect(result).toEqual(["CS", "MATH", "PHYS"]);
    });

    it("returns empty array when query returns null", async () => {
      mockFrom.mockReturnValue(mockChain(null));

      const result = await fetchSubjects();
      expect(result).toEqual([]);
    });

    it("throws when query errors", async () => {
      const err = { message: "DB error" };
      mockFrom.mockReturnValue(mockChain(null, err));

      await expect(fetchSubjects()).rejects.toEqual(err);
    });
  });

  // ── fetchCourseById ───────────────────────────────────────────────────────

  describe("fetchCourseById", () => {
    it("returns course detail on success", async () => {
      const course = {
        id: 5,
        subject: "CS",
        number: "301",
        title: "Algorithms",
        credits: 3,
        description: "desc",
        prereq_text: "CS 201",
        is_active: true,
      };
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: course, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      const result = await fetchCourseById(5);
      expect(result).toEqual(course);
    });

    it("returns null when row not found (PGRST116)", async () => {
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "not found" },
        }),
      });
      mockFrom.mockReturnValue(chain);

      const result = await fetchCourseById(999);
      expect(result).toBeNull();
    });

    it("throws when query errors with non-PGRST116 code", async () => {
      const err = { code: "42P01", message: "relation does not exist" };
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: null, error: err }),
      });
      mockFrom.mockReturnValue(chain);

      await expect(fetchCourseById(1)).rejects.toEqual(err);
    });
  });

  // ── addCourse ─────────────────────────────────────────────────────────────

  describe("addCourse", () => {
    it("returns new id on success", async () => {
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: { id: 42 }, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      const result = await addCourse({
        subject: "cs",
        number: " 101 ",
        title: "Intro",
        credits: 3,
      });
      expect(result).toEqual({ id: 42 });
    });

    it("normalizes subject to uppercase and trims number", async () => {
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      await addCourse({ subject: "math", number: " 200 ", title: "Calc", credits: 4 });
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "MATH", number: "200" })
      );
    });

    it("sets is_active true on insert", async () => {
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      await addCourse({ subject: "CS", number: "101", title: "Intro", credits: 3 });
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: true })
      );
    });

    it("throws when insert errors", async () => {
      const err = { code: "23505", message: "duplicate key" };
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: null, error: err }),
      });
      mockFrom.mockReturnValue(chain);

      await expect(
        addCourse({ subject: "CS", number: "101", title: "Intro", credits: 3 })
      ).rejects.toEqual(err);
    });
  });

  // ── updateCourse ──────────────────────────────────────────────────────────

  describe("updateCourse", () => {
    it("returns updated id on success", async () => {
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: { id: 5 }, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      const result = await updateCourse(5, {
        subject: "CS",
        number: "301",
        title: "Algorithms",
        credits: 3,
      });
      expect(result).toEqual({ id: 5 });
    });

    it("normalizes subject and number on update", async () => {
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: { id: 5 }, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      await updateCourse(5, { subject: "phys", number: " 110 ", title: "Physics", credits: 4 });
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "PHYS", number: "110" })
      );
    });

    it("does not include is_active in update payload", async () => {
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: { id: 5 }, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      await updateCourse(5, { subject: "CS", number: "101", title: "Intro", credits: 3 });
      const payload = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(payload).not.toHaveProperty("is_active");
    });

    it("throws when update errors", async () => {
      const err = { message: "DB error" };
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: null, error: err }),
      });
      mockFrom.mockReturnValue(chain);

      await expect(
        updateCourse(5, { subject: "CS", number: "101", title: "Intro", credits: 3 })
      ).rejects.toEqual(err);
    });
  });

  // ── deactivateCourse ──────────────────────────────────────────────────────

  describe("deactivateCourse", () => {
    it("returns id on success", async () => {
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: { id: 7 }, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      const result = await deactivateCourse(7);
      expect(result).toEqual({ id: 7 });
    });

    it("sets is_active false", async () => {
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: { id: 7 }, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      await deactivateCourse(7);
      expect(chain.update).toHaveBeenCalledWith({ is_active: false });
    });

    it("throws when update errors", async () => {
      const err = { message: "DB error" };
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: null, error: err }),
      });
      mockFrom.mockReturnValue(chain);

      await expect(deactivateCourse(7)).rejects.toEqual(err);
    });
  });

  // ── reactivateCourse ──────────────────────────────────────────────────────

  describe("reactivateCourse", () => {
    it("returns id on success", async () => {
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: { id: 3 }, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      const result = await reactivateCourse(3);
      expect(result).toEqual({ id: 3 });
    });

    it("sets is_active true", async () => {
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: { id: 3 }, error: null }),
      });
      mockFrom.mockReturnValue(chain);

      await reactivateCourse(3);
      expect(chain.update).toHaveBeenCalledWith({ is_active: true });
    });

    it("throws when update errors", async () => {
      const err = { message: "DB error" };
      const chain = createChainMock({
        single: vi.fn().mockResolvedValue({ data: null, error: err }),
      });
      mockFrom.mockReturnValue(chain);

      await expect(reactivateCourse(3)).rejects.toEqual(err);
    });
  });
});
