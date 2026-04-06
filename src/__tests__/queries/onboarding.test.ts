import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase client
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();

function createChainMock(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, any> = {};

  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);

  // ✅ Added for new onboarding implementation:
  // saveOnboardingSelections now uses delete().eq(...) and upsert(...)
  chain.delete = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
  chain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });

  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

  // Spread overrides for the final resolution
  Object.assign(chain, overrides);
  return chain;
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/queries/activity", () => ({
  logStudentActivity: vi.fn().mockResolvedValue(undefined),
}));

import { createClient } from "@/lib/supabase/client";
import {
  fetchPrograms,
  fetchProgramRequirements,
  fetchCertificatesForMajor,
  getOrCreateStudent,
  saveOnboardingSelections,
  checkOnboardingStatus,
  fetchCoursesByIds,
} from "@/lib/supabase/queries/onboarding";

describe("onboarding queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchPrograms", () => {
    it("fetches majors ordered by name", async () => {
      const mockData = [
        { id: 1, name: "Biology", catalog_year: "2025-2026", program_type: "MAJOR" },
        { id: 2, name: "Computer Science", catalog_year: "2025-2026", program_type: "MAJOR" },
      ];

      const chain = createChainMock();
      // Make the chain itself resolve as a promise (for the final await)
      chain.order = vi.fn().mockResolvedValue({ data: mockData, error: null });

      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await fetchPrograms("MAJOR");

      expect(mockFrom).toHaveBeenCalledWith("programs");
      expect(chain.select).toHaveBeenCalledWith("id, name, catalog_year, program_type");
      expect(chain.eq).toHaveBeenCalledWith("program_type", "MAJOR");
      expect(result).toEqual(mockData);
    });

    it("throws on Supabase error", async () => {
      const chain = createChainMock();
      chain.order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DB error" },
      });

      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await expect(fetchPrograms("CERTIFICATE")).rejects.toEqual({
        message: "DB error",
      });
    });
  });

  describe("fetchProgramRequirements", () => {
    it("returns empty array when no blocks exist", async () => {
      const chain = createChainMock();
      chain.order = vi.fn().mockResolvedValue({ data: [], error: null });

      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await fetchProgramRequirements(999);
      expect(result).toEqual([]);
    });

    it("assembles blocks with their courses", async () => {
      const viewRows = [
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

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_program_block_courses") {
          chain.order = vi.fn().mockResolvedValue({ data: viewRows, error: null });
        }

        return chain;
      });

      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await fetchProgramRequirements(1);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Core");
      expect(result[0].courses).toHaveLength(2);
      expect(result[0].courses[0].subject).toBe("CS");
    });
  });

  describe("getOrCreateStudent", () => {
    it("returns existing student if found", async () => {
      const chain = createChainMock();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { id: 42 },
        error: null,
      });

      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await getOrCreateStudent("auth-uuid", "test@test.com", "Test");
      expect(result).toEqual({ id: 42 });
    });

    it("creates new student if not found", async () => {
      let callCount = 0;
      const mockFrom = vi.fn().mockImplementation(() => {
        callCount++;
        const chain = createChainMock();

        if (callCount === 1) {
          // First call: SELECT (returns null = not found)
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
          });
        } else {
          // Second call: INSERT
          chain.single = vi.fn().mockResolvedValue({
            data: { id: 99 },
            error: null,
          });
        }

        return chain;
      });

      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await getOrCreateStudent("auth-uuid", "new@test.com", "New User");
      expect(result).toEqual({ id: 99 });
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });
  });

  describe("checkOnboardingStatus", () => {
    it("returns true when student has completed onboarding", async () => {
      const chain = createChainMock();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { has_completed_onboarding: true },
        error: null,
      });

      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await checkOnboardingStatus("auth-uuid");
      expect(result).toBe(true);
    });

    it("returns false when no student record exists", async () => {
      const chain = createChainMock();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await checkOnboardingStatus("auth-uuid");
      expect(result).toBe(false);
    });

    it("returns false when onboarding not completed", async () => {
      const chain = createChainMock();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { has_completed_onboarding: false },
        error: null,
      });

      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await checkOnboardingStatus("auth-uuid");
      expect(result).toBe(false);
    });
  });

  describe("fetchCoursesByIds", () => {
    it("returns empty array for empty input", async () => {
      const result = await fetchCoursesByIds([]);
      expect(result).toEqual([]);
    });

    it("fetches courses by IDs", async () => {
      const courses = [
        { id: 1, subject: "CS", number: "101", title: "Intro", credits: 3 },
      ];

      const chain = createChainMock();
      chain.order = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: courses, error: null }),
      });

      const mockFrom = vi.fn().mockReturnValue(chain);
      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await fetchCoursesByIds([1]);
      expect(result).toEqual(courses);
    });
  });

  describe("fetchCertificatesForMajor", () => {
    it("returns mapped certificates when mappings exist", async () => {
      const mappings = [{ certificate_id: 20 }, { certificate_id: 30 }];
      const certs = [
        { id: 20, name: "Data Science", catalog_year: "2025-2026", program_type: "CERTIFICATE" },
        { id: 30, name: "Cybersecurity", catalog_year: "2025-2026", program_type: "CERTIFICATE" },
      ];

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();

        if (table === "major_certificate_mappings") {
          chain.eq = vi.fn().mockResolvedValue({ data: mappings, error: null });
        } else if (table === "programs") {
          chain.order = vi.fn().mockResolvedValue({ data: certs, error: null });
        }

        return chain;
      });

      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await fetchCertificatesForMajor(10);
      expect(result).toEqual(certs);
      expect(mockFrom).toHaveBeenCalledWith("major_certificate_mappings");
      expect(mockFrom).toHaveBeenCalledWith("programs");
    });

    it("falls back to all certificates when no mappings exist", async () => {
      const allCerts = [
        { id: 20, name: "Data Science", catalog_year: "2025-2026", program_type: "CERTIFICATE" },
      ];

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();

        if (table === "major_certificate_mappings") {
          chain.eq = vi.fn().mockResolvedValue({ data: [], error: null });
        } else if (table === "programs") {
          // fallback fetchPrograms("CERTIFICATE") call
          chain.order = vi.fn().mockResolvedValue({ data: allCerts, error: null });
        }

        return chain;
      });

      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      const result = await fetchCertificatesForMajor(10);
      expect(result).toEqual(allCerts);
    });
  });

  describe("saveOnboardingSelections", () => {
    it("inserts programs, courses, and updates onboarding flag", async () => {
      const deleteCalls: Array<{ table: string; column: string; value: unknown }> = [];
      const upsertCalls: Array<{ table: string; data: unknown; options?: unknown }> = [];
      let studentUpdatePayload: Record<string, unknown> = {};

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();

        // delete is always called first on both tables before upsert
        chain.delete = vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((column: string, value: unknown) => {
            deleteCalls.push({ table, column, value });
            return Promise.resolve({ error: null });
          }),
        });

        if (table === "student_programs" || table === "student_course_history") {
          chain.upsert = vi.fn().mockImplementation((data: unknown, options?: unknown) => {
            upsertCalls.push({ table, data, options });
            return { error: null };
          });
        } else if (table === "students") {
          chain.update = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
            studentUpdatePayload = payload;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          });
        }

        return chain;
      });

      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await saveOnboardingSelections(1, 10, [20, 30], [100, 101]);

      // cleanup deletes happen for BOTH tables
      expect(deleteCalls).toEqual([
        { table: "student_programs", column: "student_id", value: 1 },
        { table: "student_course_history", column: "student_id", value: 1 },
      ]);

      // student_programs upsert called with major + certificates
      const programsUpsert = upsertCalls.find((c) => c.table === "student_programs");
      expect(programsUpsert).toBeTruthy();
      expect(programsUpsert?.data).toEqual([
        { student_id: 1, program_id: 10 },
        { student_id: 1, program_id: 20 },
        { student_id: 1, program_id: 30 },
      ]);
      expect(programsUpsert?.options).toEqual({
        onConflict: "student_id,program_id",
        ignoreDuplicates: false,
      });

      // student_course_history upsert called with completed courses
      const coursesUpsert = upsertCalls.find((c) => c.table === "student_course_history");
      expect(coursesUpsert).toBeTruthy();
      expect(coursesUpsert?.data).toEqual([
        { student_id: 1, course_id: 100, completed: true },
        { student_id: 1, course_id: 101, completed: true },
      ]);
      expect(coursesUpsert?.options).toEqual({
        onConflict: "student_id,course_id",
        ignoreDuplicates: false,
      });

      // student update should happen
      expect(studentUpdatePayload).toEqual({
        has_completed_onboarding: true,
      });

      // Should call from() for programs, course_history, and students
      expect(mockFrom).toHaveBeenCalledWith("student_programs");
      expect(mockFrom).toHaveBeenCalledWith("student_course_history");
      expect(mockFrom).toHaveBeenCalledWith("students");
    });

    it("includes graduation fields in student update", async () => {
      // ✅ Updated: now includes deletes + upsert + update
      let updatePayload: Record<string, unknown> = {};
      const upsertCalls: Array<{ table: string; data: unknown; options?: unknown }> = [];

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();

        // delete is always called before upsert
        chain.delete = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });

        if (table === "student_programs" || table === "student_course_history") {
          chain.upsert = vi.fn().mockImplementation((data: unknown, options?: unknown) => {
            upsertCalls.push({ table, data, options });
            return { error: null };
          });
        } else if (table === "students") {
          chain.update = vi.fn().mockImplementation((payload) => {
            updatePayload = payload;
            return {
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          });
        }

        return chain;
      });

      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await saveOnboardingSelections(1, 10, [], [], "Fall", 2027);

      expect(updatePayload).toEqual({
        has_completed_onboarding: true,
        expected_graduation_semester: "Fall",
        expected_graduation_year: 2027,
      });

      // student_programs still upserts the major even if no certs
      const programsUpsert = upsertCalls.find((c) => c.table === "student_programs");
      expect(programsUpsert?.data).toEqual([{ student_id: 1, program_id: 10 }]);
    });

    it("skips course history upsert when no courses selected", async () => {
      const historyUpsertCalled = { value: false };

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();

        // delete is always called on both tables
        chain.delete = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });

        if (table === "student_programs") {
          chain.upsert = vi.fn().mockReturnValue({ error: null });
        } else if (table === "student_course_history") {
          chain.upsert = vi.fn().mockImplementation(() => {
            historyUpsertCalled.value = true;
            return { error: null };
          });
        } else if (table === "students") {
          chain.update = vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          });
        }

        return chain;
      });

      vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

      await saveOnboardingSelections(1, 10, [], []);

      // delete IS called on student_course_history (to clear old data),
      // but upsert should NOT be called since there are no courses to insert
      expect(historyUpsertCalled.value).toBe(false);
    });
  });
});
