import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAuthUser, mockSaveMessage } = vi.hoisted(() => ({
  mockRequireAuthUser: vi.fn(),
  mockSaveMessage: vi.fn(),
}));

vi.mock("@/lib/auth-helpers.server", () => ({
  requireAuthUser: mockRequireAuthUser,
}));

vi.mock("@/lib/ai-advisor/persistence", () => ({
  saveMessage: mockSaveMessage,
}));

import { POST } from "@/app/api/ai-advisor/conversations/messages/route";
import { DB_TABLES } from "@/lib/supabase/queries/schema";

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/ai-advisor/conversations/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeQueryResult(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

describe("POST /api/ai-advisor/conversations/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error response", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: null,
      supabase: null,
      errorResponse: new Response(null, { status: 401 }),
    });

    const response = await POST(makePostRequest({}));
    expect(response.status).toBe(401);
  });

  it("returns 400 for missing fields", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });

    const response = await POST(makePostRequest({ conversationId: 1 }));
    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid role", async () => {
    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase: {},
      errorResponse: null,
    });

    const response = await POST(
      makePostRequest({ conversationId: 1, role: "system", content: "hello" })
    );
    expect(response.status).toBe(400);
  });

  it("returns 404 when conversation does not exist", async () => {
    const conversationQuery = makeQueryResult({ data: null, error: { message: "missing" } });
    const studentQuery = makeQueryResult({ data: { id: 1 }, error: null });
    const supabase = {
      from: vi.fn((table: string) =>
        table === DB_TABLES.aiConversations ? conversationQuery : studentQuery
      ),
    };

    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase,
      errorResponse: null,
    });

    const response = await POST(
      makePostRequest({ conversationId: 1, role: "user", content: "hello" })
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when user does not own conversation", async () => {
    const conversationQuery = makeQueryResult({ data: { student_id: 99 }, error: null });
    const studentQuery = makeQueryResult({ data: { id: 1 }, error: null });
    const supabase = {
      from: vi.fn((table: string) =>
        table === DB_TABLES.aiConversations ? conversationQuery : studentQuery
      ),
    };

    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase,
      errorResponse: null,
    });

    const response = await POST(
      makePostRequest({ conversationId: 1, role: "assistant", content: "hello" })
    );

    expect(response.status).toBe(403);
  });

  it("returns message id on successful save", async () => {
    const conversationQuery = makeQueryResult({ data: { student_id: 1 }, error: null });
    const studentQuery = makeQueryResult({ data: { id: 1 }, error: null });
    const supabase = {
      from: vi.fn((table: string) =>
        table === DB_TABLES.aiConversations ? conversationQuery : studentQuery
      ),
    };

    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase,
      errorResponse: null,
    });
    mockSaveMessage.mockResolvedValue(777);

    const response = await POST(
      makePostRequest({
        conversationId: 1,
        role: "user",
        content: "hello",
        metadata: { source: "test" },
      })
    );

    expect(response.status).toBe(200);
    expect(mockSaveMessage).toHaveBeenCalledWith(
      supabase,
      1,
      "user",
      "hello",
      { source: "test" }
    );
    await expect(response.json()).resolves.toEqual({ id: 777 });
  });

  it("returns 500 when saveMessage throws", async () => {
    const conversationQuery = makeQueryResult({ data: { student_id: 1 }, error: null });
    const studentQuery = makeQueryResult({ data: { id: 1 }, error: null });
    const supabase = {
      from: vi.fn((table: string) =>
        table === DB_TABLES.aiConversations ? conversationQuery : studentQuery
      ),
    };

    mockRequireAuthUser.mockResolvedValue({
      user: { id: "auth-1" },
      supabase,
      errorResponse: null,
    });
    mockSaveMessage.mockRejectedValue(new Error("insert failed"));

    const response = await POST(
      makePostRequest({ conversationId: 1, role: "user", content: "hello" })
    );

    expect(response.status).toBe(500);
  });
});
