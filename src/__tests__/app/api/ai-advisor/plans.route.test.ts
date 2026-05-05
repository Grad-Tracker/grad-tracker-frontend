import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAuthUser,
  mockResolveStudentProfile,
  mockServerListStudentPlans,
} = vi.hoisted(() => ({
  mockRequireAuthUser: vi.fn(),
  mockResolveStudentProfile: vi.fn(),
  mockServerListStudentPlans: vi.fn(),
}));

vi.mock("@/lib/auth-helpers.server", () => ({
  requireAuthUser: mockRequireAuthUser,
}));

vi.mock("@/lib/ai-advisor/data", () => ({
  resolveStudentProfile: mockResolveStudentProfile,
}));

vi.mock("@/lib/ai-advisor/plan-mutations", () => ({
  serverListStudentPlans: mockServerListStudentPlans,
}));

import { GET } from "@/app/api/ai-advisor/plans/route";

describe("GET /api/ai-advisor/plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error response", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: null,
      supabase: null,
      errorResponse: new Response(null, { status: 401 }),
    });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns 404 when profile is missing", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(404);
  });

  it("returns plans when request succeeds", async () => {
    const plans = [{ id: 1, name: "Main Plan" }];

    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue({ studentId: 10 });
    mockServerListStudentPlans.mockResolvedValue(plans);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ plans });
  });

  it("returns 500 when listing plans fails", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue({ studentId: 10 });
    mockServerListStudentPlans.mockRejectedValue(new Error("query failed"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Failed to list plans.",
    });
  });
});
