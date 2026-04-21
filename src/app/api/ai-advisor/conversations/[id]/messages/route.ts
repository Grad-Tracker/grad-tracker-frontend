import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth-helpers.server";
import { resolveStudentProfile } from "@/lib/ai-advisor/data";
import { loadMessages } from "@/lib/ai-advisor/persistence";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, errorResponse } = await requireAuthUser();
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const conversationId = Number(id);
  if (!Number.isFinite(conversationId) || conversationId <= 0) {
    return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
  }

  const profile = await resolveStudentProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  // Verify this conversation belongs to the authenticated student.
  const { data: convo, error: ownerErr } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("student_id", profile.studentId)
    .maybeSingle();

  if (ownerErr) {
    console.error("Failed to verify conversation ownership:", ownerErr);
    return NextResponse.json({ error: "Failed to verify conversation." }, { status: 500 });
  }

  if (!convo) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  try {
    const messages = await loadMessages(supabase, conversationId);
    return NextResponse.json({ messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to load messages:", error);
    return NextResponse.json(
      { error: "Failed to load messages.", details: message },
      { status: 500 }
    );
  }
}
