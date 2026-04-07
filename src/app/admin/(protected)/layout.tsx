import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  if (user.user_metadata?.role !== "advisor") {
    redirect("/dashboard");
  }

  return <AdminShell>{children}</AdminShell>;
}
