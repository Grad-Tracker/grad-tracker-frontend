import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveMessage } from "@/lib/ai-advisor/persistence";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { conversationId, role, content, metadata } = body;
  if (!conversationId || !role || !content) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const id = await saveMessage(supabase, conversationId, role, content, metadata ?? {});
  return NextResponse.json({ id });
}
