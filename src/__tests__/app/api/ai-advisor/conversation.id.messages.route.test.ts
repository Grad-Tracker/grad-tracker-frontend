import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAuthUser,
  mockResolveStudentProfile,
  mockLoadMessages,
} = vi.hoisted(() => ({
  mockRequireAuthUser: vi.fn(),
  mockResolveStudentProfile: vi.fn(),
  mockLoadMessages: vi.fn(),
}));

vi.mock("@/lib/auth-helpers.server", () => ({
  requireAuthUser: mockRequireAuthUser,
}));

vi.mock("@/lib/ai-advisor/data", () => ({
  resolveStudentProfile: mockResolveStudentProfile,
}));

vi.mock("@/lib/ai-advisor/persistence", () => ({
  loadMessages: mockLoadMessages,
}));

import { GET } from "@/app/api/ai-advisor/conversations/[id]/messages/route";

function paramsPromise(id: string) {
  return Promise.resolve({ id });
}

describe("GET /api/ai-advisor/conversations/[id]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error response", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: null,
      supabase: null,
      errorResponse: new Response(null, { status: 401 }),
    });

    const response = await GET(new Request("http://localhost"), {
      params: paramsPromise("1"),
    });

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid conversation id", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });

    const response = await GET(new Request("http://localhost"), {
      params: paramsPromise("not-a-number"),
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 when profile is missing", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), {
      params: paramsPromise("2"),
    });

    expect(response.status).toBe(404);
  });

  it("returns 500 when ownership check errors", async () => {
    const ownershipQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error("db") }),
    };
    const supabase = {
      from: vi.fn().mockReturnValue(ownershipQuery),
    };

    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase,
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue({ studentId: 7 });

    const response = await GET(new Request("http://localhost"), {
      params: paramsPromise("2"),
    });

    expect(response.status).toBe(500);
  });

  it("returns 404 when conversation is not owned by user", async () => {
    const ownershipQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const supabase = {
      from: vi.fn().mockReturnValue(ownershipQuery),
    };

    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase,
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue({ studentId: 7 });

    const response = await GET(new Request("http://localhost"), {
      params: paramsPromise("2"),
    });

    expect(response.status).toBe(404);
  });

  it("returns messages when request succeeds", async () => {
    const ownershipQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 2 }, error: null }),
    };
    const supabase = {
      from: vi.fn().mockReturnValue(ownershipQuery),
    };
    const messages = [{ id: 1, role: "user", content: "hello" }];

    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase,
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue({ studentId: 7 });
    mockLoadMessages.mockResolvedValue(messages);

    const response = await GET(new Request("http://localhost"), {
      params: paramsPromise("2"),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ messages });
  });

  it("returns 500 when loading messages fails", async () => {
    const ownershipQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 2 }, error: null }),
    };
    const supabase = {
      from: vi.fn().mockReturnValue(ownershipQuery),
    };

    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase,
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue({ studentId: 7 });
    mockLoadMessages.mockRejectedValue(new Error("boom"));

    const response = await GET(new Request("http://localhost"), {
      params: paramsPromise("2"),
    });

    expect(response.status).toBe(500);
  });
});
