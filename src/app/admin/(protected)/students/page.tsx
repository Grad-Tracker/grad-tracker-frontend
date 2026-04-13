import { createClient } from "@/lib/supabase/server";
import { requireAdvisorAccess } from "../programs/server-helpers";
import { listStudentsForAdvisor } from "@/lib/supabase/queries/advisor-students";
import StudentsListClient from "./StudentsListClient";

export default async function AdminStudentsPage() {
  const supabase = await createClient();
  const { staffId } = await requireAdvisorAccess(supabase);
  const students = await listStudentsForAdvisor(supabase, staffId);
  return <StudentsListClient students={students} />;
}
