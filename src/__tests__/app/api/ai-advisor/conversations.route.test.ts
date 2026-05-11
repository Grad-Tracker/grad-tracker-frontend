import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAuthUser,
  mockResolveStudentProfile,
  mockCreateConversation,
  mockListConversations,
} = vi.hoisted(() => ({
  mockRequireAuthUser: vi.fn(),
  mockResolveStudentProfile: vi.fn(),
  mockCreateConversation: vi.fn(),
  mockListConversations: vi.fn(),
}));

vi.mock("@/lib/auth-helpers.server", () => ({
  requireAuthUser: mockRequireAuthUser,
}));

vi.mock("@/lib/ai-advisor/data", () => ({
  resolveStudentProfile: mockResolveStudentProfile,
}));

vi.mock("@/lib/ai-advisor/persistence", () => ({
  createConversation: mockCreateConversation,
  listConversations: mockListConversations,
}));

import { GET, POST } from "@/app/api/ai-advisor/conversations/route";

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/ai-advisor/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/ai-advisor/conversations route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error response", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: null,
      supabase: null,
      errorResponse: new Response(null, { status: 401 }),
    });

    const postResponse = await POST(makePostRequest({ title: "Plan" }));
    const getResponse = await GET();

    expect(postResponse.status).toBe(401);
    expect(getResponse.status).toBe(401);
  });

  it("returns 404 when profile is missing", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue(null);

    const postResponse = await POST(makePostRequest({ title: "Plan" }));
    const getResponse = await GET();

    expect(postResponse.status).toBe(404);
    expect(getResponse.status).toBe(404);
  });

  it("creates conversation with truncated title", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue({ studentId: 5 });
    mockCreateConversation.mockResolvedValue(42);

    const longTitle = "x".repeat(120);
    const response = await POST(makePostRequest({ title: longTitle }));

    expect(response.status).toBe(200);
    expect(mockCreateConversation).toHaveBeenCalledWith({}, 5, longTitle.slice(0, 100));
    await expect(response.json()).resolves.toEqual({ id: 42 });
  });

  it("returns 500 when conversation creation fails", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue({ studentId: 5 });
    mockCreateConversation.mockRejectedValue(new Error("insert failed"));

    const response = await POST(makePostRequest({ title: "Test" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Failed to create conversation",
    });
  });

  it("lists conversations when request succeeds", async () => {
    const conversations = [{ id: 1, title: "One" }];

    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue({ studentId: 5 });
    mockListConversations.mockResolvedValue(conversations);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ conversations });
  });

  it("returns 500 when listing conversations fails", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });
    mockResolveStudentProfile.mockResolvedValue({ studentId: 5 });
    mockListConversations.mockRejectedValue(new Error("query failed"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Failed to list conversations",
    });
  });
});
