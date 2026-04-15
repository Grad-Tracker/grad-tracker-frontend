import { describe, it, expect, vi, beforeEach } from "vitest";

// All four GT-180 server pages follow the same pattern: create the supabase
// client, resolve auth via requireAdvisorAccess, (optionally) call
// requireAdvisorCanViewStudent, fetch data, then return a client component.
// These are thin wrappers — the meaningful logic lives in the query/auth
// helpers (already tested). The tests below exercise each page function to
// confirm the wiring is correct: correct imports, correct argument passing,
// and the redirect path when studentId is invalid.

const {
  mockSupabaseClient,
  mockRequireAdvisorAccess,
  mockRequireAdvisorCanViewStudent,
  mockListStudents,
  mockGetOverview,
} = vi.hoisted(() => ({
  mockSupabaseClient: { from: vi.fn(), auth: { getUser: vi.fn() } } as any,
  mockRequireAdvisorAccess: vi.fn(),
  mockRequireAdvisorCanViewStudent: vi.fn(),
  mockListStudents: vi.fn(),
  mockGetOverview: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
}));

vi.mock("@/app/admin/(protected)/programs/server-helpers", () => ({
  requireAdvisorAccess: mockRequireAdvisorAccess,
}));

vi.mock("@/app/admin/(protected)/students/server-helpers", () => ({
  requireAdvisorCanViewStudent: mockRequireAdvisorCanViewStudent,
}));

vi.mock("@/lib/supabase/queries/advisor-students", () => ({
  listStudentsForAdvisor: mockListStudents,
  getStudentOverview: mockGetOverview,
}));

// Stub the client components so their internals don't run.
vi.mock("@/app/admin/(protected)/students/StudentsListClient", () => ({
  default: function StudentsListClientStub() { return null; },
}));
vi.mock("@/app/admin/(protected)/students/[studentId]/StudentOverviewClient", () => ({
  default: function StudentOverviewClientStub() { return null; },
}));
vi.mock("@/components/planner/PlannerView", () => ({
  default: function PlannerViewStub() { return null; },
}));

import AdminStudentsPage from "@/app/admin/(protected)/students/page";
import AdminStudentOverviewPage from "@/app/admin/(protected)/students/[studentId]/page";
import AdvisorStudentPlannerPage from "@/app/admin/(protected)/students/[studentId]/planner/page";
import DashboardPlannerPage from "@/app/dashboard/planner/page";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdvisorAccess.mockResolvedValue({ staffId: 1 });
  mockRequireAdvisorCanViewStudent.mockResolvedValue(undefined);
  mockListStudents.mockResolvedValue([]);
  mockGetOverview.mockResolvedValue({
    profile: {
      id: 1,
      firstName: "A",
      lastName: "B",
      email: "a@b.com",
      expectedGradSemester: null,
      expectedGradYear: null,
      breadthPackageId: null,
    },
    programs: [],
    genEdProgress: { progressPct: 0, completed: 0, total: 0 },
    plans: [],
  });
});

describe("AdminStudentsPage (/admin/students)", () => {
  it("calls listStudentsForAdvisor and renders StudentsListClient", async () => {
    const result: any = await AdminStudentsPage();
    expect(mockRequireAdvisorAccess).toHaveBeenCalledWith(mockSupabaseClient);
    expect(mockListStudents).toHaveBeenCalledWith(mockSupabaseClient, 1);
    expect(result.props.students).toEqual([]);
    expect(result.type.name).toBe("StudentsListClientStub");
  });
});

describe("AdminStudentOverviewPage (/admin/students/[studentId])", () => {
  it("redirects when studentId is NaN", async () => {
    await expect(
      AdminStudentOverviewPage({
        params: Promise.resolve({ studentId: "not-a-number" }),
      })
    ).rejects.toThrow("REDIRECT:/admin/students");
  });

  it("calls access check and overview query, then renders the client", async () => {
    const result: any = await AdminStudentOverviewPage({
      params: Promise.resolve({ studentId: "42" }),
    });
    expect(mockRequireAdvisorCanViewStudent).toHaveBeenCalledWith(
      mockSupabaseClient,
      1,
      42
    );
    expect(mockGetOverview).toHaveBeenCalledWith(mockSupabaseClient, 1, 42);
    expect(result.type.name).toBe("StudentOverviewClientStub");
  });
});

describe("AdvisorStudentPlannerPage (/admin/students/[studentId]/planner)", () => {
  it("redirects when studentId is NaN", async () => {
    await expect(
      AdvisorStudentPlannerPage({
        params: Promise.resolve({ studentId: "bogus" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("REDIRECT:/admin/students");
  });

  it("renders PlannerView in readonly mode with numeric studentId", async () => {
    const result: any = await AdvisorStudentPlannerPage({
      params: Promise.resolve({ studentId: "7" }),
      searchParams: Promise.resolve({}),
    });
    expect(mockRequireAdvisorCanViewStudent).toHaveBeenCalledWith(
      mockSupabaseClient,
      1,
      7
    );
    expect(result.props).toMatchObject({ studentId: 7, mode: "readonly" });
    expect(result.props.initialPlanId).toBeUndefined();
  });

  it("passes initialPlanId through when planId search param is a valid number", async () => {
    const result: any = await AdvisorStudentPlannerPage({
      params: Promise.resolve({ studentId: "7" }),
      searchParams: Promise.resolve({ planId: "55" }),
    });
    expect(result.props.initialPlanId).toBe(55);
  });

  it("ignores non-numeric planId search param", async () => {
    const result: any = await AdvisorStudentPlannerPage({
      params: Promise.resolve({ studentId: "7" }),
      searchParams: Promise.resolve({ planId: "abc" }),
    });
    expect(result.props.initialPlanId).toBeUndefined();
  });
});

describe("DashboardPlannerPage (/dashboard/planner)", () => {
  function mockStudentRowQuery(studentRow: { id: number } | null) {
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data: studentRow, error: null });
    mockSupabaseClient.from.mockReturnValue(chain);
  }

  it("redirects to /signin when user is not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null } });
    await expect(DashboardPlannerPage()).rejects.toThrow("REDIRECT:/signin");
  });

  it("redirects to /onboarding when student row not found", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
    });
    mockStudentRowQuery(null);
    await expect(DashboardPlannerPage()).rejects.toThrow("REDIRECT:/onboarding");
  });

  it("renders PlannerView in edit mode with the resolved student id", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
    });
    mockStudentRowQuery({ id: 42 });
    const result: any = await DashboardPlannerPage();
    expect(result.type.name).toBe("PlannerViewStub");
    expect(result.props).toMatchObject({ studentId: 42, mode: "edit" });
  });
});
