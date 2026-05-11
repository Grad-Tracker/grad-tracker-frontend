import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAuthUser, mockResolveStudentProfile } = vi.hoisted(() => ({
  mockRequireAuthUser: vi.fn(),
  mockResolveStudentProfile: vi.fn(),
}));

vi.mock("@/lib/auth-helpers.server", () => ({
  requireAuthUser: mockRequireAuthUser,
}));

vi.mock("@/lib/ai-advisor/data", () => ({
  resolveStudentProfile: mockResolveStudentProfile,
}));

import { POST } from "@/app/api/ai-advisor/chat/stream/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/ai-advisor/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai-advisor/chat/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("returns 400 when body is invalid", async () => {
    const response = await POST(makeRequest({ bad: true }));
    expect(response.status).toBe(400);
  });

  it("returns auth error response when unauthenticated", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: null,
      supabase: null,
      errorResponse: new Response(null, { status: 401 }),
    });

    const response = await POST(makeRequest({ message: "hi", history: [] }));
    expect(response.status).toBe(401);
  });

  it("returns 500 when profile resolution throws", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });
    mockResolveStudentProfile.mockRejectedValue(new Error("profile error"));

    const response = await POST(makeRequest({ message: "hi", history: [] }));
    expect(response.status).toBe(500);
  });

  it("returns 409 when student profile is missing", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue(null);

    const response = await POST(makeRequest({ message: "hi", history: [] }));
    expect(response.status).toBe(409);
  });

  it("returns 503 when API key is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue({
      studentId: 10,
      fullName: "Alex",
      expectedGraduation: null,
      hasCompletedOnboarding: true,
      primaryProgram: null,
    });

    const response = await POST(makeRequest({ message: "hi", history: [] }));
    expect(response.status).toBe(503);
  });
});
