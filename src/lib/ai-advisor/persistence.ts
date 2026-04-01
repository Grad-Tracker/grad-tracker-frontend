import { DB_TABLES } from "@/lib/supabase/queries/schema";
import type { SupabaseTableClient } from "@/lib/ai-advisor/data";
import type { AdvisorConversation, AdvisorPersistedMessage } from "@/types/ai-advisor";

export async function createConversation(
  supabase: SupabaseTableClient,
  studentId: number,
  title?: string | null
): Promise<number> {
  const { data, error } = await supabase
    .from(DB_TABLES.aiConversations)
    .insert({ student_id: studentId, title: title ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return Number(data.id);
}

export async function saveMessage(
  supabase: SupabaseTableClient,
  conversationId: number,
  role: "user" | "assistant",
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<number> {
  const { data, error } = await supabase
    .from(DB_TABLES.aiMessages)
    .insert({ conversation_id: conversationId, role, content, metadata })
    .select("id")
    .single();
  if (error) throw error;

  // Touch updated_at on conversation
  await supabase
    .from(DB_TABLES.aiConversations)
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return Number(data.id);
}

export async function loadMessages(
  supabase: SupabaseTableClient,
  conversationId: number
): Promise<AdvisorPersistedMessage[]> {
  const { data, error } = await supabase
    .from(DB_TABLES.aiMessages)
    .select("id, conversation_id, role, content, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: Number(row.id),
    conversationId: Number(row.conversation_id),
    role: row.role as "user" | "assistant",
    content: String(row.content),
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
  }));
}

export async function listConversations(
  supabase: SupabaseTableClient,
  studentId: number
): Promise<AdvisorConversation[]> {
  const { data, error } = await supabase
    .from(DB_TABLES.aiConversations)
    .select("id, student_id, title, created_at, updated_at")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: Number(row.id),
    studentId: Number(row.student_id),
    title: row.title ? String(row.title) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function updateConversationTitle(
  supabase: SupabaseTableClient,
  conversationId: number,
  title: string
): Promise<void> {
  const { error } = await supabase
    .from(DB_TABLES.aiConversations)
    .update({ title })
    .eq("id", conversationId);
  if (error) throw error;
}
