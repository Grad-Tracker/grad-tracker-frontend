import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdvisorAccess } from "../../programs/server-helpers";
import { requireAdvisorCanViewStudent } from "../server-helpers";
import { getStudentOverview } from "@/lib/supabase/queries/advisor-students";
import StudentOverviewClient from "./StudentOverviewClient";

export default async function AdminStudentOverviewPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const numericId = Number(studentId);
  if (Number.isNaN(numericId)) redirect("/admin/students");

  const supabase = await createClient();
  const { staffId } = await requireAdvisorAccess(supabase);
  await requireAdvisorCanViewStudent(supabase, staffId, numericId);
  const overview = await getStudentOverview(supabase, staffId, numericId);

  return <StudentOverviewClient overview={overview} />;
}
