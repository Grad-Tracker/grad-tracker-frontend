import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChainMock } from "@/__tests__/helpers/mocks";

const { mockCreateAdminClient } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import {
  fetchOwnedPlanForUser,
  fetchPublicSharedPlans,
  fetchSharedPlanByToken,
  fetchStudentPlanSummariesForUser,
} from "@/lib/supabase/queries/shared-plans";

describe("shared-plans queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["cs-4yr", "Computer Science Major 4 Year Plan"],
    ["acct-4yr", "Accounting Major 4 Year Plan"],
    ["econ-general-4yr", "Economics - General Economics 4 Year Plan"],
    ["history-4yr", "History Major 4 Year Plan"],
    ["communication-4yr", "Communication Major 4 Year Plan"],
    ["sociology-4yr", "Sociology Major 4 Year Plan"],
  ])("returns fallback shared plan data for %s", async (shareToken, expectedName) => {
    mockCreateAdminClient.mockReturnValue(null);

    const plan = await fetchSharedPlanByToken(shareToken);

    expect(plan).not.toBeNull();
    expect(plan?.planName).toBe(expectedName);
    expect(plan?.ownerLabel).toBe("Shared plan");
    expect(plan?.terms).toHaveLength(8);
    expect(plan?.plannedCourses.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown fallback share token", async () => {
    mockCreateAdminClient.mockReturnValue(null);

    await expect(fetchSharedPlanByToken("missing-plan")).resolves.toBeNull();
  });

  it("returns null for an inactive shared plan from Supabase", async () => {
    const sharesChain = createChainMock({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { plan_id: 77, share_token: "db-share", is_active: false, expires_at: null },
        error: null,
      }),
    });

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "plan_shares") return sharesChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await expect(fetchSharedPlanByToken("db-share")).resolves.toBeNull();
  });

  it("returns alphabetized fallback shared plan summaries", async () => {
    mockCreateAdminClient.mockReturnValue(null);

    const plans = await fetchPublicSharedPlans();

    expect(plans.map((plan) => plan.planName)).toEqual([
      "Accounting Major 4 Year Plan",
      "Communication Major 4 Year Plan",
      "Computer Science Major 4 Year Plan",
      "Economics - General Economics 4 Year Plan",
      "History Major 4 Year Plan",
      "Sociology Major 4 Year Plan",
    ]);
  });

  it("returns an empty list when no active public shares remain after filtering", async () => {
    const sharesChain = createChainMock({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              plan_id: 1,
              share_token: "expired-share",
              is_active: true,
              expires_at: "2000-01-01T00:00:00.000Z",
              updated_at: "2000-01-01T00:00:00.000Z",
            },
          ],
          error: null,
        }),
      }),
    });

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "plan_shares") return sharesChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await expect(fetchPublicSharedPlans()).resolves.toEqual([]);
  });

  it("builds student plan summaries from Supabase rows", async () => {
    const studentsChain = createChainMock({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 42 }, error: null }),
    });
    const plansChain = createChainMock({
      order: vi.fn().mockResolvedValue({
        data: [{ id: 7, name: "My Plan", description: "Primary plan" }],
        error: null,
      }),
    });
    const programsChain = createChainMock({
      then: vi.fn().mockImplementation((resolve: (value: unknown) => void) =>
        resolve({
          data: [{ plan_id: 7, programs: { name: "B.S. Computer Science" } }],
          error: null,
        })
      ),
    });
    const termsChain = createChainMock({
      then: vi.fn().mockImplementation((resolve: (value: unknown) => void) =>
        resolve({
          data: [{ plan_id: 7 }, { plan_id: 7 }],
          error: null,
        })
      ),
    });
    const coursesChain = createChainMock({
      then: vi.fn().mockImplementation((resolve: (value: unknown) => void) =>
        resolve({
          data: [
            { plan_id: 7, courses: { credits: 3 } },
            { plan_id: 7, courses: { credits: 4 } },
          ],
          error: null,
        })
      ),
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "students") return studentsChain;
        if (table === "plans") return plansChain;
        if (table === "plan_programs") return programsChain;
        if (table === "student_term_plan") return termsChain;
        if (table === "student_planned_courses") return coursesChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const summaries = await fetchStudentPlanSummariesForUser(supabase, "auth-user-1");

    expect(summaries).toEqual([
      {
        planId: 7,
        planName: "My Plan",
        description: "Primary plan",
        programNames: ["B.S. Computer Science"],
        totalPlannedCredits: 7,
        termCount: 2,
      },
    ]);
  });

  it("returns an owned comparable plan when the plan belongs to the current user", async () => {
    const studentsChain = createChainMock({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 42 }, error: null }),
    });
    const ownedPlanChain = createChainMock({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 7 }, error: null }),
    });
    const planDetailChain = createChainMock({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 7, student_id: 42, name: "My Plan", description: "Primary plan" },
        error: null,
      }),
    });
    const programsChain = createChainMock({
      then: vi.fn().mockImplementation((resolve: (value: unknown) => void) =>
        resolve({
          data: [{ plan_id: 7, programs: { name: "B.S. Computer Science" } }],
          error: null,
        })
      ),
    });
    const termsChain = createChainMock({
      then: vi.fn().mockImplementation((resolve: (value: unknown) => void) =>
        resolve({
          data: [{ term_id: 1, terms: { id: 1, season: "Fall", year: 2026 } }],
          error: null,
        })
      ),
    });
    const plannedCoursesChain = createChainMock({
      then: vi.fn().mockImplementation((resolve: (value: unknown) => void) =>
        resolve({
          data: [
            {
              student_id: 42,
              term_id: 1,
              course_id: 100,
              status: "planned",
              plan_id: 7,
              courses: { id: 100, subject: "CSCI", number: "241", title: "Computer Science I", credits: 5 },
            },
          ],
          error: null,
        })
      ),
    });
    const historyChain = createChainMock({
      then: vi.fn().mockImplementation((resolve: (value: unknown) => void) =>
        resolve({
          data: [{ courses: { credits: 3 } }],
          error: null,
        })
      ),
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "students") return studentsChain;
        if (table === "plans") {
          return supabase.from.mock.calls.filter(([called]) => called === "plans").length === 1
            ? ownedPlanChain
            : planDetailChain;
        }
        if (table === "plan_programs") return programsChain;
        if (table === "student_term_plan") return termsChain;
        if (table === "student_planned_courses") return plannedCoursesChain;
        if (table === "student_course_history") return historyChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await fetchOwnedPlanForUser(supabase, "auth-user-1", 7);

    expect(result).toEqual({
      planId: 7,
      planName: "My Plan",
      description: "Primary plan",
      ownerLabel: "My plan",
      programNames: ["B.S. Computer Science"],
      terms: [{ id: 1, season: "Fall", year: 2026 }],
      plannedCourses: [
        {
          student_id: 42,
          term_id: 1,
          course_id: 100,
          status: "planned",
          plan_id: 7,
          course: { id: 100, subject: "CSCI", number: "241", title: "Computer Science I", credits: 5 },
          requirementLabel: null,
        },
      ],
      totalPlannedCredits: 5,
      completedCredits: 3,
    });
  });
});
