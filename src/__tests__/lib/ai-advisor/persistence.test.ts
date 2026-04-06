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

  it("lists conversations with null title", async () => {
    const convos = [
      { id: 1, student_id: 10, title: null, created_at: "2026-01-01", updated_at: "2026-01-01" },
    ];
    const { from } = createMockSupabase(convos);
    const supabase = { from } as any;
    const result = await listConversations(supabase, 10);
    expect(result[0].title).toBeNull();
  });

  it("throws on createConversation error", async () => {
    const { from } = createMockSupabase(null, { message: "insert failed" });
    const supabase = { from } as any;
    await expect(createConversation(supabase, 10, "Test")).rejects.toEqual({ message: "insert failed" });
  });

  it("throws on saveMessage error", async () => {
    const { from } = createMockSupabase(null, { message: "insert failed" });
    const supabase = { from } as any;
    await expect(saveMessage(supabase, 42, "user", "Hi", {})).rejects.toEqual({ message: "insert failed" });
  });

  it("throws on loadMessages error", async () => {
    const { from } = createMockSupabase(null, { message: "query failed" });
    const supabase = { from } as any;
    await expect(loadMessages(supabase, 42)).rejects.toEqual({ message: "query failed" });
  });

  it("throws on listConversations error", async () => {
    const { from } = createMockSupabase(null, { message: "query failed" });
    const supabase = { from } as any;
    await expect(listConversations(supabase, 10)).rejects.toEqual({ message: "query failed" });
  });

  it("updates conversation title", async () => {
    const { from } = createMockSupabase(null);
    const supabase = { from } as any;
    await expect(updateConversationTitle(supabase, 42, "New title")).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledWith("ai_conversations");
  });

  it("throws on updateConversationTitle error", async () => {
    const { from } = createMockSupabase(null, { message: "update failed" });
    const supabase = { from } as any;
    await expect(updateConversationTitle(supabase, 42, "New title")).rejects.toEqual({ message: "update failed" });
  });

  it("returns empty array when loadMessages data is null", async () => {
    // Create a mock that returns null data with no error
    function makeChain(): any {
      const chain: any = {};
      chain.then = (resolve: any) => resolve({ data: null, error: null });
      chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
      for (const method of ["select", "insert", "update", "eq", "order", "limit", "in"]) {
        chain[method] = vi.fn().mockReturnValue(chain);
      }
      return chain;
    }
    const from = vi.fn().mockImplementation(() => makeChain());
    const supabase = { from } as any;
    const result = await loadMessages(supabase, 42);
    expect(result).toEqual([]);
  });
});
