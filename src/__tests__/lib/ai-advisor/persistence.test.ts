import { beforeEach, describe, expect, it, vi } from "vitest";

// Build a mock supabase client that chains .from().select().eq().order() etc.
function createMockSupabase(resolvedData: unknown, resolvedError: unknown = null) {
  function makeChain(): any {
    const chain: any = {};
    const terminalResult = { data: resolvedData, error: resolvedError };
    // Make chain itself thenable for queries that don't end with .single()
    chain.then = (resolve: any) =>
      resolve({
        data: Array.isArray(resolvedData) ? resolvedData : [resolvedData],
        error: resolvedError,
      });
    chain.single = vi.fn().mockResolvedValue(terminalResult);
    for (const method of ["select", "insert", "update", "eq", "order", "limit", "in"]) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
    return chain;
  }

  const from = vi.fn().mockImplementation(() => makeChain());
  return { from };
}

import {
  createConversation,
  saveMessage,
  loadMessages,
  listConversations,
  updateConversationTitle,
} from "@/lib/ai-advisor/persistence";

describe("AI advisor persistence", () => {
  it("creates a conversation and returns its id", async () => {
    const { from } = createMockSupabase({ id: 42 });
    const supabase = { from } as any;
    const id = await createConversation(supabase, 10, "Test chat");
    expect(id).toBe(42);
    expect(from).toHaveBeenCalledWith("ai_conversations");
  });

  it("saves a message and returns its id", async () => {
    const { from } = createMockSupabase({ id: 101 });
    const supabase = { from } as any;
    const id = await saveMessage(supabase, 42, "user", "Hello", {});
    expect(id).toBe(101);
    expect(from).toHaveBeenCalledWith("ai_messages");
  });

  it("loads messages for a conversation", async () => {
    const messages = [
      { id: 1, conversation_id: 42, role: "user", content: "Hi", metadata: {}, created_at: "2026-01-01T00:00:00Z" },
      { id: 2, conversation_id: 42, role: "assistant", content: "Hello!", metadata: {}, created_at: "2026-01-01T00:00:01Z" },
    ];
    const { from } = createMockSupabase(messages);
    const supabase = { from } as any;
    const result = await loadMessages(supabase, 42);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
    expect(result[1].content).toBe("Hello!");
  });

  it("lists conversations for a student", async () => {
    const convos = [
      { id: 42, student_id: 10, title: "Chat 1", created_at: "2026-01-01", updated_at: "2026-01-01" },
    ];
    const { from } = createMockSupabase(convos);
    const supabase = { from } as any;
    const result = await listConversations(supabase, 10);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(42);
    expect(result[0].title).toBe("Chat 1");
  });
});
