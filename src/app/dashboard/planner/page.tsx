import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlannerView from "@/components/planner/PlannerView";

export default async function PlannerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: studentRow } = await supabase
    .from("students")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!studentRow) redirect("/onboarding");

  return <PlannerView studentId={Number(studentRow.id)} mode="edit" />;
}
