import { createClient } from "@/app/utils/supabase/server";
import GenEdRequirements from "@/components/requirements/GenEdRequirements";

export default async function RequirementsPage() {
  const supabase = await createClient();

  // 1) Get logged-in user
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    // middleware likely redirects already, but safe fallback
    return null;
  }

  // 2) Find matching student row
  const { data: student, error: studentErr } = await supabase
    .from("students")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (studentErr || !student) {
    return (
      <div style={{ padding: 24 }}>
        No student profile found for this account.
      </div>
    );
  }

  // 3) Pass the correct studentId to the client component
  return <GenEdRequirements studentId={student.id} />;
}