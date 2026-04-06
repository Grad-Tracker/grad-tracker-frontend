import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockCreateClient = vi.fn(async () => ({
  auth: { getUser: mockGetUser },
}));
const mockResolveStudentProfile = vi.fn();
const mockGetDegreeProgress = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));
vi.mock("@/lib/ai-advisor/data", () => ({
  resolveStudentProfile: (...args: any[]) => mockResolveStudentProfile(...args),
  getDegreeProgress: (...args: any[]) => mockGetDegreeProgress(...args),
}));

import { GET } from "@/app/api/ai-advisor/context/route";

function makeRequest() {
  return new Request("http://localhost/api/ai-advisor/context", { method: "GET" });
}

describe("GET /api/ai-advisor/context", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it("returns 404 when profile not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
    mockResolveStudentProfile.mockResolvedValue(null);
    const response = await GET(makeRequest());
    expect(response.status).toBe(404);
  });

  it("returns sidebar data for authenticated student", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
    mockResolveStudentProfile.mockResolvedValue({
      studentId: 10, fullName: "Alex Johnson", email: "alex@test.com",
      hasCompletedOnboarding: true, expectedGraduation: "May 2026",
      programs: [{ id: 1, name: "B.S. Computer Science", catalogYear: "2022-2023", programType: "MAJOR" }],
      primaryProgram: { id: 1, name: "B.S. Computer Science", catalogYear: "2022-2023", programType: "MAJOR" },
    });
    mockGetDegreeProgress.mockResolvedValue({
      planId: 7,
      overall: { completedCredits: 78, inProgressCredits: 12, remainingCredits: 30, totalCreditsRequired: 120, percentage: 75 },
      blocks: [{ blockId: 1, blockName: "Major Core", completedCredits: 30, inProgressCredits: 6, remainingCredits: 6, totalCreditsRequired: 42, percentage: 86 }],
    });
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.studentName).toBe("Alex Johnson");
    expect(data.progress.overall.percentage).toBe(75);
    expect(data.progress.blocks).toHaveLength(1);
  });
});
