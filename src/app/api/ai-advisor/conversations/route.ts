import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveStudentProfile } from "@/lib/ai-advisor/data";
import { createConversation, listConversations } from "@/lib/ai-advisor/persistence";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await resolveStudentProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.slice(0, 100) : null;
    const id = await createConversation(supabase, profile.studentId, title);
    return NextResponse.json({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to create conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation", details: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await resolveStudentProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  try {
    const conversations = await listConversations(supabase, profile.studentId);
    return NextResponse.json({ conversations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to list conversations:", error);
    return NextResponse.json(
      { error: "Failed to list conversations", details: message },
      { status: 500 }
    );
  }
}