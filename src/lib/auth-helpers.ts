import { createClient } from "@/lib/supabase/client";
import { toaster } from "@/components/ui/toaster";

/**
 * Sign out the current user, show a toast, and redirect to sign-in.
 */
export async function signOutAndRedirect(push: (url: string) => void) {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Sign-out error:", error);
    toaster.create({ title: "Sign-out failed", description: error.message, type: "error" });
    return;
  }
  toaster.create({
    title: "Signed out",
    description: "You've been signed out successfully.",
    type: "success",
  });
  push("/signin");
}
