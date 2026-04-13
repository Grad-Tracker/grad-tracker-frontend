import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdvisorAccess } from "../../../programs/server-helpers";
import { requireAdvisorCanViewStudent } from "../../server-helpers";
import PlannerView from "@/components/planner/PlannerView";

export default async function AdvisorStudentPlannerPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ planId?: string }>;
}) {
  const { studentId } = await params;
  const { planId } = await searchParams;
  const numericId = Number(studentId);
  if (Number.isNaN(numericId)) redirect("/admin/students");

  const supabase = await createClient();
  const { staffId } = await requireAdvisorAccess(supabase);
  await requireAdvisorCanViewStudent(supabase, staffId, numericId);

  const numericPlanId = planId ? Number(planId) : undefined;

  return (
    <PlannerView
      studentId={numericId}
      mode="readonly"
      initialPlanId={
        numericPlanId != null && !Number.isNaN(numericPlanId) ? numericPlanId : undefined
      }
    />
  );
}
