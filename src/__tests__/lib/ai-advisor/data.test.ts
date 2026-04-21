import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChainMock } from "../../helpers/mocks";
import {
  resolveStudentProfile,
  getPlanSnapshot,
  getDegreeProgress,
  getRemainingRequirements,
  resolveCourseIdsByCodes,
} from "@/lib/ai-advisor/data";

// ---------------------------------------------------------------------------
// Mock supabase builder
// ---------------------------------------------------------------------------

/**
 * Build a mock supabase client where `from()` returns a chain.
 * `responses` is keyed by view/table name.  Each value is either
 *  - `{ data, error }` for thenable resolution (list queries), or
 *  - a function that receives the chain and wires up custom behavior
 *    (e.g. maybeSingle).
 */
function makeMockSupabase(
  responses: Record<
    string,
    | { data: unknown; error: unknown }
    | ((chain: ReturnType<typeof createChainMock>) => void)
  > = {}
) {
  const mockSupabase = {
    from: vi.fn().mockImplementation((table: string) => {
      const chain = createChainMock();
      const entry = responses[table];
      if (typeof entry === "function") {
        entry(chain);
      } else if (entry) {
        chain.then = vi
          .fn()
          .mockImplementation((resolve: (v: unknown) => void) =>
            resolve({ data: entry.data, error: entry.error })
          );
      }
      return chain;
    }),
  };
  return mockSupabase;
}

// ---------------------------------------------------------------------------
// normalizeCourseCode & parseCourseCode are not exported — they are tested
// indirectly via exported functions.  We test their behavior through
// resolveCourseIdsByCodes which exercises both.
// ---------------------------------------------------------------------------

describe("resolveCourseIdsByCodes (also covers normalizeCourseCode & parseCourseCode)", () => {
  it("returns empty results for empty input", async () => {
    const supabase = makeMockSupabase();
    const result = await resolveCourseIdsByCodes(supabase as any, []);
    expect(result).toEqual({
      resolvedIds: [],
      unresolvedCodes: [],
      resolvedCodes: [],
    });
    // Should never hit the database
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns empty results for whitespace-only codes", async () => {
    const supabase = makeMockSupabase();
    const result = await resolveCourseIdsByCodes(supabase as any, ["  ", ""]);
    expect(result).toEqual({
      resolvedIds: [],
      unresolvedCodes: [],
      resolvedCodes: [],
    });
  });

  it("resolves valid course codes from catalog", async () => {
    const supabase = makeMockSupabase({
      v_course_catalog: {
        data: [
          { course_id: 100, subject: "CSCI", number: "340" },
          { course_id: 200, subject: "MATH", number: "280" },
        ],
        error: null,
      },
    });

    const result = await resolveCourseIdsByCodes(supabase as any, [
      "CSCI 340",
      "MATH 280",
    ]);

    expect(result.resolvedIds).toEqual(expect.arrayContaining([100, 200]));
    expect(result.resolvedCodes).toEqual(
      expect.arrayContaining(["CSCI 340", "MATH 280"])
    );
    expect(result.unresolvedCodes).toEqual([]);
  });

  it("handles dash-separated codes (CSCI-340)", async () => {
    const supabase = makeMockSupabase({
      v_course_catalog: {
        data: [{ course_id: 100, subject: "CSCI", number: "340" }],
        error: null,
      },
    });

    const result = await resolveCourseIdsByCodes(supabase as any, [
      "CSCI-340",
    ]);

    expect(result.resolvedIds).toContain(100);
    expect(result.resolvedCodes).toContain("CSCI 340");
  });

  it("handles lowercase input", async () => {
    const supabase = makeMockSupabase({
      v_course_catalog: {
        data: [{ course_id: 100, subject: "CSCI", number: "340" }],
        error: null,
      },
    });

    const result = await resolveCourseIdsByCodes(supabase as any, [
      "csci 340",
    ]);

    expect(result.resolvedIds).toContain(100);
  });

  it("marks unparseable codes as unresolved", async () => {
    const supabase = makeMockSupabase({
      v_course_catalog: { data: [], error: null },
    });

    const result = await resolveCourseIdsByCodes(supabase as any, [
      "INVALID",
      "123",
      "AB",
    ]);

    expect(result.resolvedIds).toEqual([]);
    expect(result.unresolvedCodes).toEqual(
      expect.arrayContaining(["INVALID", "123", "AB"])
    );
  });

  it("marks parseable but unmatched codes as unresolved", async () => {
    const supabase = makeMockSupabase({
      v_course_catalog: { data: [], error: null },
    });

    const result = await resolveCourseIdsByCodes(supabase as any, [
      "CSCI 999",
    ]);

    expect(result.resolvedIds).toEqual([]);
    expect(result.unresolvedCodes).toContain("CSCI 999");
  });

  it("deduplicates identical codes", async () => {
    const supabase = makeMockSupabase({
      v_course_catalog: {
        data: [{ course_id: 100, subject: "CSCI", number: "340" }],
        error: null,
      },
    });

    const result = await resolveCourseIdsByCodes(supabase as any, [
      "CSCI 340",
      "csci 340",
      "CSCI  340",
    ]);

    expect(result.resolvedIds).toEqual([100]);
    expect(result.resolvedCodes).toEqual(["CSCI 340"]);
  });

  it("throws on supabase error", async () => {
    const supabase = makeMockSupabase({
      v_course_catalog: { data: null, error: new Error("db failure") },
    });

    await expect(
      resolveCourseIdsByCodes(supabase as any, ["CSCI 340"])
    ).rejects.toThrow("db failure");
  });

  it("handles course codes with letter suffixes (CSCI 340A)", async () => {
    const supabase = makeMockSupabase({
      v_course_catalog: {
        data: [{ course_id: 150, subject: "CSCI", number: "340A" }],
        error: null,
      },
    });

    const result = await resolveCourseIdsByCodes(supabase as any, [
      "CSCI 340A",
    ]);

    expect(result.resolvedIds).toContain(150);
  });

  it("handles extra whitespace in input", async () => {
    const supabase = makeMockSupabase({
      v_course_catalog: {
        data: [{ course_id: 100, subject: "CSCI", number: "340" }],
        error: null,
      },
    });

    const result = await resolveCourseIdsByCodes(supabase as any, [
      "  CSCI   340  ",
    ]);

    expect(result.resolvedIds).toContain(100);
  });

  it("returns empty when all parsed subjects yield no catalog matches", async () => {
    const supabase = makeMockSupabase({
      v_course_catalog: { data: null, error: null },
    });

    const result = await resolveCourseIdsByCodes(supabase as any, [
      "ZZZZ 100",
    ]);
    expect(result.resolvedIds).toEqual([]);
    expect(result.unresolvedCodes).toContain("ZZZZ 100");
  });
});

// ---------------------------------------------------------------------------
// resolveStudentProfile
// ---------------------------------------------------------------------------

describe("resolveStudentProfile", () => {
  const authUserId = "auth-uuid-1";

  it("returns null when no profile row is found", async () => {
    const supabase = makeMockSupabase({
      v_student_profile: (chain) => {
        chain.maybeSingle = vi
          .fn()
          .mockResolvedValue({ data: null, error: null });
      },
    });

    const result = await resolveStudentProfile(supabase as any, authUserId);
    expect(result).toBeNull();
  });

  it("returns a fully formed profile with programs", async () => {
    const profileRow = {
      student_id: 1,
      auth_user_id: authUserId,
      email: "alice@test.com",
      first_name: "Alice",
      last_name: "Smith",
      full_name: "Alice Smith",
      has_completed_onboarding: true,
      expected_graduation_semester: "Spring",
      expected_graduation_year: 2026,
    };

    const programRows = [
      {
        student_id: 1,
        program_id: 10,
        program_name: "B.S. Computer Science",
        catalog_year: "2022-2023",
        program_type: "MAJOR",
      },
      {
        student_id: 1,
        program_id: 20,
        program_name: "Data Science Certificate",
        catalog_year: "2022-2023",
        program_type: "CERTIFICATE",
      },
    ];

    // Profile query uses maybeSingle, programs query uses thenable
    let callCount = 0;
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_student_profile") {
          chain.maybeSingle = vi
            .fn()
            .mockResolvedValue({ data: profileRow, error: null });
        } else if (table === "v_student_major_program") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: programRows, error: null })
            );
        }
        return chain;
      }),
    };

    const result = await resolveStudentProfile(supabase as any, authUserId);

    expect(result).not.toBeNull();
    expect(result!.studentId).toBe(1);
    expect(result!.fullName).toBe("Alice Smith");
    expect(result!.email).toBe("alice@test.com");
    expect(result!.hasCompletedOnboarding).toBe(true);
    expect(result!.expectedGradSemester).toBe("Spring");
    expect(result!.expectedGradYear).toBe(2026);
    expect(result!.expectedGraduation).toBe("Spring 2026");
    expect(result!.programs).toHaveLength(2);
    expect(result!.primaryProgram).toEqual({
      id: 10,
      name: "B.S. Computer Science",
      catalogYear: "2022-2023",
      programType: "MAJOR",
    });
  });

  it("falls back to first program when no MAJOR exists", async () => {
    const profileRow = {
      student_id: 2,
      auth_user_id: authUserId,
      email: null,
      full_name: null,
      has_completed_onboarding: false,
      expected_graduation_semester: null,
      expected_graduation_year: null,
    };
    const programRows = [
      {
        student_id: 2,
        program_id: 30,
        program_name: "Minor in Math",
        catalog_year: null,
        program_type: "MINOR",
      },
    ];

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_student_profile") {
          chain.maybeSingle = vi
            .fn()
            .mockResolvedValue({ data: profileRow, error: null });
        } else {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: programRows, error: null })
            );
        }
        return chain;
      }),
    };

    const result = await resolveStudentProfile(supabase as any, authUserId);

    expect(result!.primaryProgram!.id).toBe(30);
    expect(result!.fullName).toBe("Student"); // fallback
    expect(result!.email).toBeNull();
    expect(result!.expectedGraduation).toBeNull();
  });

  it("sets primaryProgram to null when no programs exist", async () => {
    const profileRow = {
      student_id: 3,
      auth_user_id: authUserId,
      email: "nobody@test.com",
      full_name: "Nobody",
      has_completed_onboarding: false,
      expected_graduation_semester: null,
      expected_graduation_year: null,
    };

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_student_profile") {
          chain.maybeSingle = vi
            .fn()
            .mockResolvedValue({ data: profileRow, error: null });
        } else {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: [], error: null })
            );
        }
        return chain;
      }),
    };

    const result = await resolveStudentProfile(supabase as any, authUserId);
    expect(result!.programs).toEqual([]);
    expect(result!.primaryProgram).toBeNull();
  });

  it("throws when profile query errors", async () => {
    const supabase = {
      from: vi.fn().mockImplementation(() => {
        const chain = createChainMock();
        chain.maybeSingle = vi
          .fn()
          .mockResolvedValue({ data: null, error: new Error("Profile error") });
        return chain;
      }),
    };

    await expect(
      resolveStudentProfile(supabase as any, authUserId)
    ).rejects.toThrow("Profile error");
  });

  it("throws when a program has non-finite program_id", async () => {
    const profileRow = {
      student_id: 1,
      auth_user_id: authUserId,
      email: "e@t.com",
      full_name: "E",
      has_completed_onboarding: true,
      expected_graduation_semester: null,
      expected_graduation_year: null,
    };

    const programRows = [
      {
        student_id: 1,
        program_id: "not-a-number",
        program_name: "Bad Program",
        catalog_year: null,
        program_type: "MAJOR",
      },
    ];

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_student_profile") {
          chain.maybeSingle = vi
            .fn()
            .mockResolvedValue({ data: profileRow, error: null });
        } else {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: programRows, error: null })
            );
        }
        return chain;
      }),
    };

    await expect(
      resolveStudentProfile(supabase as any, authUserId)
    ).rejects.toThrow("Invalid program_id");
  });

  it("throws when program query errors", async () => {
    const profileRow = {
      student_id: 1,
      auth_user_id: authUserId,
      email: "e@t.com",
      full_name: "E",
      has_completed_onboarding: true,
      expected_graduation_semester: null,
      expected_graduation_year: null,
    };

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_student_profile") {
          chain.maybeSingle = vi
            .fn()
            .mockResolvedValue({ data: profileRow, error: null });
        } else {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: null, error: new Error("Programs error") })
            );
        }
        return chain;
      }),
    };

    await expect(
      resolveStudentProfile(supabase as any, authUserId)
    ).rejects.toThrow("Programs error");
  });

  it("handles expectedGraduation with only semester (no year)", async () => {
    const profileRow = {
      student_id: 4,
      auth_user_id: authUserId,
      email: null,
      full_name: "Test",
      has_completed_onboarding: true,
      expected_graduation_semester: "Fall",
      expected_graduation_year: null,
    };

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_student_profile") {
          chain.maybeSingle = vi
            .fn()
            .mockResolvedValue({ data: profileRow, error: null });
        } else {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: [], error: null })
            );
        }
        return chain;
      }),
    };

    const result = await resolveStudentProfile(supabase as any, authUserId);
    expect(result!.expectedGradSemester).toBe("Fall");
    expect(result!.expectedGradYear).toBeNull();
    expect(result!.expectedGraduation).toBe("Fall");
  });
});

// ---------------------------------------------------------------------------
// getPlanSnapshot
// ---------------------------------------------------------------------------

describe("getPlanSnapshot", () => {
  const studentId = 1;

  function makePlanSupabase(
    planMeta: unknown[] | null,
    terms: unknown[] | null = [],
    courses: unknown[] | null = []
  ) {
    return {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_plan_meta") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: planMeta, error: null })
            );
        } else if (table === "v_plan_terms") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: terms, error: null })
            );
        } else if (table === "v_plan_courses") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: courses, error: null })
            );
        }
        return chain;
      }),
    };
  }

  it("returns null when no plans exist for student", async () => {
    const supabase = makePlanSupabase([]);
    const result = await getPlanSnapshot(supabase as any, studentId);
    expect(result).toBeNull();
  });

  it("returns null when plans list is null", async () => {
    const supabase = makePlanSupabase(null);
    const result = await getPlanSnapshot(supabase as any, studentId);
    expect(result).toBeNull();
  });

  it("returns a plan snapshot with terms and courses", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "My Plan",
        description: "A plan",
        created_at: "2024-01-01",
        updated_at: "2024-01-02",
        program_ids: [10, 20],
        term_count: 2,
        course_count: 3,
        total_credits: 12,
        has_graduate_program: false,
      },
    ];

    const terms = [
      { student_id: 1, plan_id: 5, term_id: 100, season: "Fall", year: 2024 },
      {
        student_id: 1,
        plan_id: 5,
        term_id: 101,
        season: "Spring",
        year: 2025,
      },
    ];

    const courses = [
      {
        student_id: 1,
        plan_id: 5,
        term_id: 100,
        course_id: 300,
        subject: "CSCI",
        number: "340",
        title: "Data Structures",
        credits: 3,
      },
      {
        student_id: 1,
        plan_id: 5,
        term_id: 101,
        course_id: 301,
        subject: "MATH",
        number: "280",
        title: "Discrete Math",
        credits: 3,
      },
    ];

    const supabase = makePlanSupabase(planMeta, terms, courses);
    const result = await getPlanSnapshot(supabase as any, studentId);

    expect(result).not.toBeNull();
    expect(result!.planId).toBe(5);
    expect(result!.planName).toBe("My Plan");
    expect(result!.planDescription).toBe("A plan");
    expect(result!.programIds).toEqual([10, 20]);
    expect(result!.terms).toHaveLength(2);
    // Terms should be sorted chronologically
    expect(result!.terms[0].season).toBe("Fall");
    expect(result!.terms[0].year).toBe(2024);
    expect(result!.terms[1].season).toBe("Spring");
    expect(result!.terms[1].year).toBe(2025);
    expect(result!.plannedCourses).toHaveLength(2);
    expect(result!.plannedCourses[0].courseCode).toBe("CSCI 340");
    expect(result!.plannedCourses[0].status).toBe("PLANNED");
    expect(result!.totalPlannedCredits).toBe(6);
  });

  it("selects a specific plan by planId", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan A",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-02",
        program_ids: [10],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
      {
        plan_id: 7,
        student_id: 1,
        name: "Plan B",
        description: null,
        created_at: "2024-02-01",
        updated_at: "2024-02-02",
        program_ids: [20],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const supabase = makePlanSupabase(planMeta, [], []);
    const result = await getPlanSnapshot(supabase as any, studentId, 7);

    expect(result!.planId).toBe(7);
    expect(result!.planName).toBe("Plan B");
    expect(result!.programIds).toEqual([20]);
  });

  it("returns null when specified planId is not found", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Only Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-02",
        program_ids: [],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const supabase = makePlanSupabase(planMeta, [], []);
    const result = await getPlanSnapshot(supabase as any, studentId, 999);
    expect(result).toBeNull();
  });

  it("throws when plan meta query fails", async () => {
    const supabase = {
      from: vi.fn().mockImplementation(() => {
        const chain = createChainMock();
        chain.then = vi
          .fn()
          .mockImplementation((resolve: (v: unknown) => void) =>
            resolve({ data: null, error: new Error("plan meta error") })
          );
        return chain;
      }),
    };

    await expect(
      getPlanSnapshot(supabase as any, studentId)
    ).rejects.toThrow("plan meta error");
  });

  it("throws when terms query fails", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_plan_meta") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: planMeta, error: null })
            );
        } else if (table === "v_plan_terms") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: null, error: new Error("terms error") })
            );
        } else {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: [], error: null })
            );
        }
        return chain;
      }),
    };

    await expect(
      getPlanSnapshot(supabase as any, studentId)
    ).rejects.toThrow("terms error");
  });

  it("handles plan with null program_ids", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Empty Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: null,
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const supabase = makePlanSupabase(planMeta, [], []);
    const result = await getPlanSnapshot(supabase as any, studentId);

    expect(result!.programIds).toEqual([]);
  });

  it("filters out courses with non-finite courseId", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const courses = [
      {
        student_id: 1,
        plan_id: 5,
        term_id: 100,
        course_id: NaN,
        subject: "BAD",
        number: "000",
        title: "Bad Course",
        credits: 3,
      },
      {
        student_id: 1,
        plan_id: 5,
        term_id: 100,
        course_id: 300,
        subject: "CSCI",
        number: "101",
        title: "Intro",
        credits: 3,
      },
    ];

    const supabase = makePlanSupabase(planMeta, [], courses);
    const result = await getPlanSnapshot(supabase as any, studentId);
    expect(result!.plannedCourses).toHaveLength(1);
    expect(result!.plannedCourses[0].courseId).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// getDegreeProgress
// ---------------------------------------------------------------------------

describe("getDegreeProgress", () => {
  const studentId = 1;

  /**
   * Build a supabase mock that can respond to plan_meta, program blocks,
   * course progress, and optionally student_major_program queries.
   */
  function makeProgressSupabase(opts: {
    planMeta?: unknown[];
    blocks?: unknown[];
    progress?: unknown[];
    majorPrograms?: unknown[];
  }) {
    return {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_plan_meta") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: opts.planMeta ?? [], error: null })
            );
        } else if (table === "v_program_block_courses") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: opts.blocks ?? [], error: null })
            );
        } else if (table === "v_student_course_progress") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: opts.progress ?? [], error: null })
            );
        } else if (table === "v_student_major_program") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: opts.majorPrograms ?? [], error: null })
            );
        }
        return chain;
      }),
    };
  }

  it("returns zero progress when no plan exists and no blocks", async () => {
    const supabase = makeProgressSupabase({});
    const result = await getDegreeProgress(supabase as any, studentId);

    expect(result.planId).toBeNull();
    expect(result.overall.completedCredits).toBe(0);
    expect(result.overall.percentage).toBe(0);
    expect(result.blocks).toEqual([]);
  });

  it("computes block-level and overall progress", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [10],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const blocks = [
      {
        block_id: 1,
        program_id: 10,
        program_name: "CS",
        block_name: "Core",
        rule: "ALL_OF",
        n_required: null,
        credits_required: 9,
        course_ids: [100, 200, 300],
        courses: [
          { course_id: 100, subject: "CSCI", number: "101", title: "Intro", credits: 3 },
          { course_id: 200, subject: "CSCI", number: "201", title: "Data Structures", credits: 3 },
          { course_id: 300, subject: "CSCI", number: "301", title: "Algorithms", credits: 3 },
        ],
      },
    ];

    const progress = [
      { student_id: 1, course_id: 100, plan_id: 5, progress_status: "COMPLETED" },
      { student_id: 1, course_id: 200, plan_id: 5, progress_status: "IN_PROGRESS" },
    ];

    const supabase = makeProgressSupabase({ planMeta, blocks, progress });
    const result = await getDegreeProgress(supabase as any, studentId);

    expect(result.planId).toBe(5);
    expect(result.blocks).toHaveLength(1);

    const block = result.blocks[0];
    expect(block.blockName).toBe("Core");
    expect(block.completedCredits).toBe(3);
    expect(block.inProgressCredits).toBe(3);
    expect(block.remainingCredits).toBe(3);
    expect(block.totalCreditsRequired).toBe(9);
    expect(block.percentage).toBe(67); // (3+3)/9 = 67%

    expect(result.overall.completedCredits).toBe(3);
    expect(result.overall.inProgressCredits).toBe(3);
    expect(result.overall.remainingCredits).toBe(3);
    expect(result.overall.percentage).toBe(67);
  });

  it("caps completed credits at totalCreditsRequired", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [10],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    // Block requires 3 credits but student completed 2 courses worth 3 each
    const blocks = [
      {
        block_id: 1,
        program_id: 10,
        program_name: "CS",
        block_name: "Elective",
        rule: "CREDITS_OF",
        n_required: null,
        credits_required: 3,
        course_ids: [100, 200],
        courses: [
          { course_id: 100, subject: "CSCI", number: "101", title: "A", credits: 3 },
          { course_id: 200, subject: "CSCI", number: "201", title: "B", credits: 3 },
        ],
      },
    ];

    const progress = [
      { student_id: 1, course_id: 100, plan_id: 5, progress_status: "COMPLETED" },
      { student_id: 1, course_id: 200, plan_id: 5, progress_status: "COMPLETED" },
    ];

    const supabase = makeProgressSupabase({ planMeta, blocks, progress });
    const result = await getDegreeProgress(supabase as any, studentId);

    const block = result.blocks[0];
    expect(block.completedCredits).toBe(3); // capped at totalCreditsRequired
    expect(block.remainingCredits).toBe(0);
    expect(block.percentage).toBe(100);
  });

  it("falls back to student_major_program when plan has no program_ids", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const majorPrograms = [{ program_id: 10 }];

    const supabase = makeProgressSupabase({ planMeta, majorPrograms });
    const result = await getDegreeProgress(supabase as any, studentId);

    // Should have queried the major program view for fallback
    const fromCalls = supabase.from.mock.calls.map((c: unknown[]) => c[0]);
    expect(fromCalls).toContain("v_student_major_program");
    expect(result.planId).toBe(5);
  });

  it("uses sum of course credits when credits_required is null", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [10],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const blocks = [
      {
        block_id: 1,
        program_id: 10,
        program_name: "CS",
        block_name: "Core",
        rule: "ALL_OF",
        n_required: null,
        credits_required: null, // no explicit credits_required
        course_ids: [100, 200],
        courses: [
          { course_id: 100, subject: "CSCI", number: "101", title: "A", credits: 3 },
          { course_id: 200, subject: "CSCI", number: "201", title: "B", credits: 4 },
        ],
      },
    ];

    const supabase = makeProgressSupabase({ planMeta, blocks });
    const result = await getDegreeProgress(supabase as any, studentId);

    // totalCreditsRequired should be sum of course credits (3+4=7)
    expect(result.blocks[0].totalCreditsRequired).toBe(7);
  });

  it("handles block with zero total credits (percentage = 0)", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [10],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const blocks = [
      {
        block_id: 1,
        program_id: 10,
        program_name: "CS",
        block_name: "Empty Block",
        rule: "ALL_OF",
        n_required: null,
        credits_required: 0,
        course_ids: [],
        courses: [],
      },
    ];

    const supabase = makeProgressSupabase({ planMeta, blocks });
    const result = await getDegreeProgress(supabase as any, studentId);

    expect(result.blocks[0].percentage).toBe(0);
    expect(result.blocks[0].totalCreditsRequired).toBe(0);
  });

  it("filters out NaN course IDs in progress", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [10],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const blocks = [
      {
        block_id: 1,
        program_id: 10,
        program_name: "CS",
        block_name: "Core",
        rule: "ALL_OF",
        n_required: null,
        credits_required: 6,
        course_ids: [100, 200],
        courses: [
          { course_id: 100, subject: "CSCI", number: "101", title: "A", credits: 3 },
          { course_id: 200, subject: "CSCI", number: "201", title: "B", credits: 3 },
        ],
      },
    ];

    const progress = [
      { student_id: 1, course_id: "not-a-number", plan_id: 5, progress_status: "COMPLETED" },
      { student_id: 1, course_id: 100, plan_id: 5, progress_status: "COMPLETED" },
    ];

    const supabase = makeProgressSupabase({ planMeta, blocks, progress });
    const result = await getDegreeProgress(supabase as any, studentId);

    // Only course 100 should count (NaN filtered)
    expect(result.blocks[0].completedCredits).toBe(3);
  });

  it("scopes in-progress to active plan_id", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [10],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const blocks = [
      {
        block_id: 1,
        program_id: 10,
        program_name: "CS",
        block_name: "Core",
        rule: "ALL_OF",
        n_required: null,
        credits_required: 9,
        course_ids: [100, 200, 300],
        courses: [
          { course_id: 100, subject: "CSCI", number: "101", title: "A", credits: 3 },
          { course_id: 200, subject: "CSCI", number: "201", title: "B", credits: 3 },
          { course_id: 300, subject: "CSCI", number: "301", title: "C", credits: 3 },
        ],
      },
    ];

    const progress = [
      // In-progress on a different plan should NOT count
      { student_id: 1, course_id: 200, plan_id: 99, progress_status: "IN_PROGRESS" },
      // In-progress on the active plan SHOULD count
      { student_id: 1, course_id: 300, plan_id: 5, progress_status: "IN_PROGRESS" },
    ];

    const supabase = makeProgressSupabase({ planMeta, blocks, progress });
    const result = await getDegreeProgress(supabase as any, studentId);

    // Only course 300 is in-progress for plan 5
    expect(result.blocks[0].inProgressCredits).toBe(3);
    expect(result.blocks[0].remainingCredits).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// getRemainingRequirements
// ---------------------------------------------------------------------------

describe("getRemainingRequirements", () => {
  const studentId = 1;

  function makeRemainingSupabase(opts: {
    planMeta?: unknown[];
    blocks?: unknown[];
    progress?: unknown[];
    majorPrograms?: unknown[];
  }) {
    return {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_plan_meta") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: opts.planMeta ?? [], error: null })
            );
        } else if (table === "v_program_block_courses") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: opts.blocks ?? [], error: null })
            );
        } else if (table === "v_student_course_progress") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: opts.progress ?? [], error: null })
            );
        } else if (table === "v_student_major_program") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: opts.majorPrograms ?? [], error: null })
            );
        }
        return chain;
      }),
    };
  }

  it("returns empty blocks when no plan or requirements exist", async () => {
    const supabase = makeRemainingSupabase({});
    const result = await getRemainingRequirements(supabase as any, studentId);

    expect(result.planId).toBeNull();
    expect(result.totalRemainingCourses).toBe(0);
    expect(result.blocks).toEqual([]);
  });

  it("returns remaining courses excluding completed and in-progress", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [10],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const blocks = [
      {
        block_id: 1,
        program_id: 10,
        program_name: "CS",
        block_name: "Core",
        rule: "ALL_OF",
        n_required: null,
        credits_required: 12,
        course_ids: [100, 200, 300, 400],
        courses: [
          { course_id: 100, subject: "CSCI", number: "101", title: "Intro", credits: 3 },
          { course_id: 200, subject: "CSCI", number: "201", title: "Data Structures", credits: 3 },
          { course_id: 300, subject: "CSCI", number: "301", title: "Algorithms", credits: 3 },
          { course_id: 400, subject: "CSCI", number: "401", title: "Capstone", credits: 3 },
        ],
      },
    ];

    const progress = [
      { student_id: 1, course_id: 100, plan_id: 5, progress_status: "COMPLETED" },
      { student_id: 1, course_id: 200, plan_id: 5, progress_status: "IN_PROGRESS" },
    ];

    const supabase = makeRemainingSupabase({ planMeta, blocks, progress });
    const result = await getRemainingRequirements(supabase as any, studentId);

    expect(result.planId).toBe(5);
    expect(result.totalRemainingCourses).toBe(2);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].remainingCourses).toHaveLength(2);
    const codes = result.blocks[0].remainingCourses.map((c) => c.courseCode);
    expect(codes).toContain("CSCI 301");
    expect(codes).toContain("CSCI 401");
  });

  it("filters out empty blocks from output", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [10],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const blocks = [
      {
        block_id: 1,
        program_id: 10,
        program_name: "CS",
        block_name: "Core",
        rule: "ALL_OF",
        n_required: null,
        credits_required: 3,
        course_ids: [100],
        courses: [
          { course_id: 100, subject: "CSCI", number: "101", title: "Intro", credits: 3 },
        ],
      },
    ];

    const progress = [
      { student_id: 1, course_id: 100, plan_id: 5, progress_status: "COMPLETED" },
    ];

    const supabase = makeRemainingSupabase({ planMeta, blocks, progress });
    const result = await getRemainingRequirements(supabase as any, studentId);

    // Block has no remaining courses, so it should be filtered out
    expect(result.blocks).toEqual([]);
    expect(result.totalRemainingCourses).toBe(0);
  });

  it("respects the limit parameter", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [10],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const blocks = [
      {
        block_id: 1,
        program_id: 10,
        program_name: "CS",
        block_name: "Big Block",
        rule: "ALL_OF",
        n_required: null,
        credits_required: 15,
        course_ids: [100, 200, 300, 400, 500],
        courses: [
          { course_id: 100, subject: "CSCI", number: "101", title: "A", credits: 3 },
          { course_id: 200, subject: "CSCI", number: "201", title: "B", credits: 3 },
          { course_id: 300, subject: "CSCI", number: "301", title: "C", credits: 3 },
          { course_id: 400, subject: "CSCI", number: "401", title: "D", credits: 3 },
          { course_id: 500, subject: "CSCI", number: "501", title: "E", credits: 3 },
        ],
      },
    ];

    const supabase = makeRemainingSupabase({ planMeta, blocks });
    const result = await getRemainingRequirements(
      supabase as any,
      studentId,
      undefined,
      2
    );

    // totalRemainingCourses reflects ALL remaining, not just sliced
    expect(result.totalRemainingCourses).toBe(5);
    // But the actual returned courses are capped at limit
    expect(result.blocks[0].remainingCourses).toHaveLength(2);
  });

  it("falls back to student_major_program when plan has no program_ids", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: null,
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const majorPrograms = [{ program_id: 10 }];

    const supabase = makeRemainingSupabase({ planMeta, majorPrograms });
    const result = await getRemainingRequirements(supabase as any, studentId);

    const fromCalls = supabase.from.mock.calls.map((c: unknown[]) => c[0]);
    expect(fromCalls).toContain("v_student_major_program");
  });

  it("sorts remaining courses by course code", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [10],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const blocks = [
      {
        block_id: 1,
        program_id: 10,
        program_name: "CS",
        block_name: "Core",
        rule: "ALL_OF",
        n_required: null,
        credits_required: 9,
        course_ids: [300, 100, 200],
        courses: [
          { course_id: 300, subject: "MATH", number: "280", title: "Discrete", credits: 3 },
          { course_id: 100, subject: "CSCI", number: "101", title: "Intro", credits: 3 },
          { course_id: 200, subject: "CSCI", number: "340", title: "DS", credits: 3 },
        ],
      },
    ];

    const supabase = makeRemainingSupabase({ planMeta, blocks });
    const result = await getRemainingRequirements(supabase as any, studentId);

    const codes = result.blocks[0].remainingCourses.map((c) => c.courseCode);
    expect(codes).toEqual(["CSCI 101", "CSCI 340", "MATH 280"]);
  });
});

// ---------------------------------------------------------------------------
// Edge cases for getProgramIdsFromPlanMeta (tested indirectly)
// ---------------------------------------------------------------------------

describe("getProgramIdsFromPlanMeta (indirect)", () => {
  it("filters NaN values from program_ids", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [10, NaN, "bad", 20],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    // We test via getPlanSnapshot since getProgramIdsFromPlanMeta is not exported
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_plan_meta") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: planMeta, error: null })
            );
        } else {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: [], error: null })
            );
        }
        return chain;
      }),
    };

    const result = await getPlanSnapshot(supabase as any, 1);
    // NaN and "bad" should be filtered out
    expect(result!.programIds).toEqual([10, 20]);
  });
});

// ---------------------------------------------------------------------------
// fetchRequirementBlocks (indirect, tested via getDegreeProgress)
// ---------------------------------------------------------------------------

describe("fetchRequirementBlocks (indirect)", () => {
  it("returns empty when programIds is empty", async () => {
    // If plan has no program_ids AND no fallback programs, blocks should be empty
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_plan_meta") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({
                data: [
                  {
                    plan_id: 5,
                    student_id: 1,
                    name: "Plan",
                    description: null,
                    created_at: "2024-01-01",
                    updated_at: "2024-01-01",
                    program_ids: [],
                    term_count: 0,
                    course_count: 0,
                    total_credits: 0,
                    has_graduate_program: false,
                  },
                ],
                error: null,
              })
            );
        } else if (table === "v_student_major_program") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: [], error: null })
            );
        } else if (table === "v_student_course_progress") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: [], error: null })
            );
        }
        return chain;
      }),
    };

    const result = await getDegreeProgress(supabase as any, 1);
    expect(result.blocks).toEqual([]);
  });

  it("handles blocks with null courses array", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [10],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const blocks = [
      {
        block_id: 1,
        program_id: 10,
        program_name: "CS",
        block_name: "Null Courses Block",
        rule: "ALL_OF",
        n_required: null,
        credits_required: 3,
        course_ids: [],
        courses: null,
      },
    ];

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_plan_meta") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: planMeta, error: null })
            );
        } else if (table === "v_program_block_courses") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: blocks, error: null })
            );
        } else if (table === "v_student_course_progress") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: [], error: null })
            );
        }
        return chain;
      }),
    };

    const result = await getDegreeProgress(supabase as any, 1);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].blockName).toBe("Null Courses Block");
    expect(result.blocks[0].completedCredits).toBe(0);
  });

  it("handles blocks with null block_name", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [10],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const blocks = [
      {
        block_id: 1,
        program_id: 10,
        program_name: "CS",
        block_name: null,
        rule: "ALL_OF",
        n_required: null,
        credits_required: 0,
        course_ids: [],
        courses: [],
      },
    ];

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = createChainMock();
        if (table === "v_plan_meta") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: planMeta, error: null })
            );
        } else if (table === "v_program_block_courses") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: blocks, error: null })
            );
        } else if (table === "v_student_course_progress") {
          chain.then = vi
            .fn()
            .mockImplementation((resolve: (v: unknown) => void) =>
              resolve({ data: [], error: null })
            );
        }
        return chain;
      }),
    };

    const result = await getDegreeProgress(supabase as any, 1);
    expect(result.blocks[0].blockName).toBe("Requirement Block");
  });
});

// ---------------------------------------------------------------------------
// resolvePlanMeta edge cases (indirect, tested via getPlanSnapshot)
// ---------------------------------------------------------------------------

describe("resolvePlanMeta edge cases (indirect)", () => {
  it("throws on invalid (non-finite) planId", async () => {
    const planMeta = [
      {
        plan_id: 5,
        student_id: 1,
        name: "Plan",
        description: null,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        program_ids: [],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
        has_graduate_program: false,
      },
    ];

    const supabase = {
      from: vi.fn().mockImplementation(() => {
        const chain = createChainMock();
        chain.then = vi
          .fn()
          .mockImplementation((resolve: (v: unknown) => void) =>
            resolve({ data: planMeta, error: null })
          );
        return chain;
      }),
    };

    await expect(
      getPlanSnapshot(supabase as any, 1, Infinity)
    ).rejects.toThrow("Invalid planId");
  });
});
