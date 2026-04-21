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
  fetchStudentProfileByAuthUserId,
  fetchStudentMajorProgram,
  fetchPrograms,
  fetchProgramRequirements,
  getOrCreateStudent,
  fetchCertificatesForMajor,
  saveOnboardingSelections,
  checkOnboardingStatus,
  fetchCoursesByIds,
} from "@/lib/supabase/queries/onboarding";

function makeChain(data: unknown, error: unknown = null) {
  const chain = createChainMock();
  chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) => r({ data, error }));
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// fetchStudentProfileByAuthUserId
// ---------------------------------------------------------------------------

describe("fetchStudentProfileByAuthUserId", () => {
  it("returns profile when found", async () => {
    const profile = {
      student_id: 1,
      auth_user_id: "uuid-1",
      email: "test@test.com",
      has_completed_onboarding: true,
    };
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchStudentProfileByAuthUserId("uuid-1");
    expect(result).toEqual(profile);
  });

  it("returns null when not found", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchStudentProfileByAuthUserId("uuid-none");
    expect(result).toBeNull();
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: new Error("profile error") });
    mockFrom.mockReturnValue(chain);

    await expect(fetchStudentProfileByAuthUserId("uuid-1")).rejects.toThrow("profile error");
  });
});

// ---------------------------------------------------------------------------
// fetchStudentMajorProgram
// ---------------------------------------------------------------------------

describe("fetchStudentMajorProgram", () => {
  it("returns major program when found", async () => {
    const major = { student_id: 1, program_id: 10, program_name: "CS", catalog_year: "2023", program_type: "MAJOR" };
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: major, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchStudentMajorProgram(1);
    expect(result).toEqual(major);
  });

  it("returns null when no major", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchStudentMajorProgram(1);
    expect(result).toBeNull();
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: new Error("major error") });
    mockFrom.mockReturnValue(chain);

    await expect(fetchStudentMajorProgram(1)).rejects.toThrow("major error");
  });
});

// ---------------------------------------------------------------------------
// fetchPrograms
// ---------------------------------------------------------------------------

describe("fetchPrograms", () => {
  it("returns mapped programs of the given type", async () => {
    const rows = [
      { program_id: 10, program_name: "CS", catalog_year: "2023", program_type: "MAJOR" },
      { program_id: 11, program_name: "Math", catalog_year: "2023", program_type: "MAJOR" },
    ];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await fetchPrograms("MAJOR");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 10, name: "CS", catalog_year: "2023", program_type: "MAJOR" });
  });

  it("returns empty array when none found", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    const result = await fetchPrograms("MINOR");
    expect(result).toEqual([]);
  });

  it("defaults catalog_year to empty string when null", async () => {
    const rows = [{ program_id: 10, program_name: "CS", catalog_year: null, program_type: "MAJOR" }];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await fetchPrograms("MAJOR");
    expect(result[0].catalog_year).toBe("");
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("programs error") })
    );
    mockFrom.mockReturnValue(chain);

    await expect(fetchPrograms("MAJOR")).rejects.toThrow("programs error");
  });
});

// ---------------------------------------------------------------------------
// fetchProgramRequirements
// ---------------------------------------------------------------------------

describe("fetchProgramRequirements", () => {
  it("returns empty array when no data", async () => {
    mockFrom.mockReturnValue(makeChain([]));
    const result = await fetchProgramRequirements(10);
    expect(result).toEqual([]);
  });

  it("returns empty array when data is null", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    const result = await fetchProgramRequirements(10);
    expect(result).toEqual([]);
  });

  it("returns mapped requirement blocks", async () => {
    const rows = [
      {
        block_id: 1,
        program_id: 10,
        block_name: "Core",
        rule: "ALL_OF",
        n_required: null,
        credits_required: 9,
        courses: [
          { course_id: 100, subject: "CSCI", number: "101", title: "Intro", credits: 3 },
        ],
      },
    ];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await fetchProgramRequirements(10);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Core");
    expect(result[0].courses).toHaveLength(1);
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("req error") })
    );
    mockFrom.mockReturnValue(chain);

    await expect(fetchProgramRequirements(10)).rejects.toThrow("req error");
  });
});

// ---------------------------------------------------------------------------
// getOrCreateStudent
// ---------------------------------------------------------------------------

describe("getOrCreateStudent", () => {
  it("returns existing student id when found", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 42 }, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await getOrCreateStudent("uuid-1", "test@test.com", "Alice Smith");
    expect(result).toEqual({ id: 42 });
  });

  it("creates new student when not found", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChainMock();
      if (callCount === 1) {
        // select existing — not found
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      } else {
        // insert new student
        chain.single = vi.fn().mockResolvedValue({ data: { id: 99 }, error: null });
      }
      return chain;
    });

    const result = await getOrCreateStudent("uuid-new", "new@test.com", "Bob Jones");
    expect(result).toEqual({ id: 99 });
  });

  it("splits full name into first and last", async () => {
    let insertedData: unknown;
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChainMock();
      if (callCount === 1) {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      } else {
        chain.insert = vi.fn().mockImplementation((data: unknown) => {
          insertedData = data;
          return chain;
        });
        chain.single = vi.fn().mockResolvedValue({ data: { id: 10 }, error: null });
      }
      return chain;
    });

    await getOrCreateStudent("uuid-1", "e@t.com", "Alice Marie Smith");
    expect(insertedData).toMatchObject({
      first_name: "Alice",
      last_name: "Marie Smith",
    });
  });

  it("handles single-word name", async () => {
    let insertedData: unknown;
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChainMock();
      if (callCount === 1) {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      } else {
        chain.insert = vi.fn().mockImplementation((data: unknown) => {
          insertedData = data;
          return chain;
        });
        chain.single = vi.fn().mockResolvedValue({ data: { id: 11 }, error: null });
      }
      return chain;
    });

    await getOrCreateStudent("uuid-1", "e@t.com", "Madonna");
    expect(insertedData).toMatchObject({ first_name: "Madonna", last_name: "" });
  });

  it("throws when select errors", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: new Error("select error") });
    mockFrom.mockReturnValue(chain);

    await expect(getOrCreateStudent("uuid-1", "e@t.com", "Test")).rejects.toThrow("select error");
  });
});

// ---------------------------------------------------------------------------
// fetchCertificatesForMajor
// ---------------------------------------------------------------------------

describe("fetchCertificatesForMajor", () => {
  it("returns certificates from mapped IDs when mappings exist", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChainMock();
      if (callCount === 1) {
        // major_certificate_mappings
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({ data: [{ certificate_id: 20 }], error: null })
        );
      } else {
        // v_program_catalog
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({
            data: [{ program_id: 20, program_name: "Data Science Cert", catalog_year: "2023", program_type: "CERTIFICATE" }],
            error: null,
          })
        );
      }
      return chain;
    });

    const result = await fetchCertificatesForMajor(10);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Data Science Cert");
  });

  it("falls back to all certificates when no mappings", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChainMock();
      if (callCount === 1) {
        // major_certificate_mappings — empty
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({ data: [], error: null })
        );
      } else {
        // fallback fetchPrograms call
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({
            data: [{ program_id: 30, program_name: "All Certs", catalog_year: null, program_type: "CERTIFICATE" }],
            error: null,
          })
        );
      }
      return chain;
    });

    const result = await fetchCertificatesForMajor(10);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("All Certs");
  });

  it("throws when mappings query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("mappings error") })
    );
    mockFrom.mockReturnValue(chain);

    await expect(fetchCertificatesForMajor(10)).rejects.toThrow("mappings error");
  });
});

// ---------------------------------------------------------------------------
// saveOnboardingSelections
// ---------------------------------------------------------------------------

describe("saveOnboardingSelections", () => {
  function makeOkChain() {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) => r({ data: null, error: null }));
    (chain as any).upsert = vi.fn().mockReturnValue(chain);
    return chain;
  }

  it("completes without error for valid inputs", async () => {
    mockFrom.mockImplementation((table: string) => {
      const chain = makeOkChain();
      if (table === "v_terms_chronological") {
        chain.single = vi.fn().mockResolvedValue({ data: { term_id: 1 }, error: null });
      }
      return chain;
    });

    await expect(
      saveOnboardingSelections(1, 10, [20], [100], "Spring", 2026)
    ).resolves.toBeUndefined();

    expect(mockSafeLogActivity).toHaveBeenCalledWith(
      1,
      "onboarding_completed",
      "Completed onboarding setup",
      expect.objectContaining({ major_id: 10 })
    );
  });

  it("succeeds with no certificates and no courses", async () => {
    mockFrom.mockImplementation(() => makeOkChain());

    await expect(
      saveOnboardingSelections(1, 10, [], [])
    ).resolves.toBeUndefined();
  });

  it("throws and attempts rollback when program upsert fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let callCount = 0;

    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = makeOkChain();
      if (callCount === 3) {
        // The upsert for student_programs fails
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({ data: null, error: new Error("upsert programs failed") })
        );
        (chain as any).upsert = vi.fn().mockReturnValue(chain);
      }
      return chain;
    });

    await expect(
      saveOnboardingSelections(1, 10, [], [])
    ).rejects.toThrow("upsert programs failed");

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// checkOnboardingStatus
// ---------------------------------------------------------------------------

describe("checkOnboardingStatus", () => {
  it("returns true when onboarding complete", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: { has_completed_onboarding: true },
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const result = await checkOnboardingStatus("uuid-1");
    expect(result).toBe(true);
  });

  it("returns false when profile not found", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await checkOnboardingStatus("uuid-none");
    expect(result).toBe(false);
  });

  it("returns false when onboarding not complete", async () => {
    const chain = createChainMock();
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: { has_completed_onboarding: false },
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const result = await checkOnboardingStatus("uuid-1");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fetchCoursesByIds
// ---------------------------------------------------------------------------

describe("fetchCoursesByIds", () => {
  it("returns empty array for empty courseIds", async () => {
    const result = await fetchCoursesByIds([]);
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns mapped courses", async () => {
    const rows = [
      { course_id: 100, subject: "CSCI", number: "101", title: "Intro", credits: 3 },
      { course_id: 200, subject: "MATH", number: "280", title: "Discrete", credits: 3 },
    ];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await fetchCoursesByIds([100, 200]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 100, subject: "CSCI", number: "101", title: "Intro", credits: 3 });
  });

  it("defaults credits to 0 when null", async () => {
    const rows = [{ course_id: 100, subject: "CSCI", number: "101", title: "Intro", credits: null }];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await fetchCoursesByIds([100]);
    expect(result[0].credits).toBe(0);
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("courses error") })
    );
    mockFrom.mockReturnValue(chain);

    await expect(fetchCoursesByIds([100])).rejects.toThrow("courses error");
  });
});
