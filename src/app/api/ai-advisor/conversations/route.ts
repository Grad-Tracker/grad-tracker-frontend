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

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.slice(0, 100) : null;
  const id = await createConversation(supabase, profile.studentId, title);
  return NextResponse.json({ id });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await resolveStudentProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const conversations = await listConversations(supabase, profile.studentId);
  return NextResponse.json({ conversations });
}
