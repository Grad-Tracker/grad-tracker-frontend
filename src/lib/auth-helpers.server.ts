import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Require an authenticated user in a server-side API route.
 * Returns the user, supabase client, and an optional error response.
 *
 * Usage:
 * ```
 * const { user, supabase, errorResponse } = await requireAuthUser();
 * if (errorResponse) return errorResponse;
 * // user is guaranteed non-null after the guard
 * ```
 */
export async function requireAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null as null, supabase, errorResponse: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) as NextResponse };
  }
  return { user, supabase, errorResponse: null as null };
}
