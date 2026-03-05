import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockCreateClient = vi.fn(async () => ({
  auth: { getUser: mockGetUser },
}));

const mockResolveStudentProfile = vi.fn();
const mockCreateAdvisorToolDependencies = vi.fn();
const mockGenerateAdvisorResponse = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

vi.mock("@/lib/ai-advisor/data", () => ({
  resolveStudentProfile: (...args: any[]) => mockResolveStudentProfile(...args),
}));

vi.mock("@/lib/ai-advisor/tools", () => ({
  createAdvisorToolDependencies: (...args: any[]) =>
    mockCreateAdvisorToolDependencies(...args),
  generateAdvisorResponse: (...args: any[]) => mockGenerateAdvisorResponse(...args),
}));

import { POST } from "@/app/api/ai-advisor/chat/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/ai-advisor/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai-advisor/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid request payload", async () => {
    const response = await POST(makeRequest({ bad: "payload" }));
    expect(response.status).toBe(400);
  });

  it("returns 401 when user is unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await POST(
      makeRequest({
        message: "hello",
        history: [],
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns 409 when student profile is missing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockResolveStudentProfile.mockResolvedValue(null);

    const response = await POST(
      makeRequest({
        message: "hello",
        history: [],
      })
    );

    expect(response.status).toBe(409);
  });

  it("returns 409 when onboarding is not completed", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockResolveStudentProfile.mockResolvedValue({
      studentId: 10,
      fullName: "Alex",
      email: "alex@test.com",
      hasCompletedOnboarding: false,
      expectedGradSemester: null,
      expectedGradYear: null,
      expectedGraduation: null,
      programs: [],
      primaryProgram: null,
    });

    const response = await POST(
      makeRequest({
        message: "hello",
        history: [],
      })
    );

    expect(response.status).toBe(409);
  });

  it("returns 200 and assistant payload for successful requests", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    const profile = {
      studentId: 10,
      fullName: "Alex",
      email: "alex@test.com",
      hasCompletedOnboarding: true,
      expectedGradSemester: "May",
      expectedGradYear: 2026,
      expectedGraduation: "May 2026",
      programs: [],
      primaryProgram: null,
    };
    mockResolveStudentProfile.mockResolvedValue(profile);
    mockCreateAdvisorToolDependencies.mockReturnValue({ dep: true });
    mockGenerateAdvisorResponse.mockResolvedValue({
      answer: "Test answer",
      recommendations: [],
      risks: [],
      missingData: [],
      citations: ["tool:get_student_profile"],
    });

    const response = await POST(
      makeRequest({
        message: "What should I take next semester?",
        history: [],
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.answer).toBe("Test answer");
    expect(mockGenerateAdvisorResponse).toHaveBeenCalledOnce();
  });

  it("returns 200 for partial tool responses with missingData", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    const profile = {
      studentId: 10,
      fullName: "Alex",
      email: "alex@test.com",
      hasCompletedOnboarding: true,
      expectedGradSemester: "May",
      expectedGradYear: 2026,
      expectedGraduation: "May 2026",
      programs: [],
      primaryProgram: null,
    };
    mockResolveStudentProfile.mockResolvedValue(profile);
    mockCreateAdvisorToolDependencies.mockReturnValue({ dep: true });
    mockGenerateAdvisorResponse.mockResolvedValue({
      answer: "Partial answer",
      recommendations: [],
      risks: [],
      missingData: ["tool:get_degree_progress failed"],
      citations: ["tool:get_student_profile"],
    });

    const response = await POST(
      makeRequest({
        message: "Am I on track to graduate?",
        history: [],
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.missingData).toHaveLength(1);
  });
});
