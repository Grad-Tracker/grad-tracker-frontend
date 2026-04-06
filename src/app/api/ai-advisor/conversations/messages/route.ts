import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveMessage } from "@/lib/ai-advisor/persistence";
import { DB_TABLES } from "@/lib/supabase/queries/schema";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { conversationId, role, content, metadata } = body;
  if (!conversationId || !role || !content) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Validate role
  if (role !== "user" && role !== "assistant") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Verify the authenticated user owns the conversation
  const { data: conversationData, error: conversationError } = await supabase
    .from(DB_TABLES.aiConversations)
    .select("student_id")
    .eq("id", conversationId)
    .single();

  if (conversationError || !conversationData) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Get the student_id for the authenticated user
  const { data: studentData, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (studentError || !studentData) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  // Check ownership
  if (Number(conversationData.student_id) !== Number(studentData.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Save message
  try {
    const id = await saveMessage(supabase, conversationId, role, content, metadata ?? {});
    return NextResponse.json({ id });
  } catch (error) {
    console.error("Failed to save message:", error);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }
}