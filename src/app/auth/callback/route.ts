import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Validate the "next" param to prevent open-redirect attacks.
  const raw = searchParams.get("next") ?? "/dashboard";
  const nextParam =
    raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // ✅ role-based redirect after session exists
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const role = (user?.user_metadata?.role as string | undefined) ?? "student";

      if (role === "advisor") {
        return NextResponse.redirect(`${origin}/admin`);
      }

      // students (or missing role) keep existing behavior
      return NextResponse.redirect(`${origin}${nextParam}`);
    }
  }

  return NextResponse.redirect(`${origin}/signin`);
}