import { createClient } from "@/lib/supabase/server";
import { requireAdvisorAccess } from "@/app/admin/(protected)/programs/server-helpers";
import { DB_TABLES } from "@/lib/supabase/queries/schema";
import AssignmentsClient from "./AssignmentsClient";

type Program = {
  id: number;
  name: string;
  program_type: string;
  catalog_year: number | null;
};

export default async function AssignmentsPage() {
  const supabase = await createClient();
  const { staffId } = await requireAdvisorAccess(supabase);

  // Fetch all programs
  const { data: allPrograms } = await supabase
    .from(DB_TABLES.programs)
    .select("id, name, program_type, catalog_year")
    .order("program_type")
    .order("name");

  // Fetch current advisor's assignments
  const { data: assignments } = await supabase
    .from(DB_TABLES.programAdvisors)
    .select("program_id")
    .eq("advisor_id", staffId);

  const programs: Program[] = (allPrograms ?? []).map((p: any) => ({
    id: Number(p.id),
    name: p.name,
    program_type: p.program_type,
    catalog_year: p.catalog_year,
  }));

  const assignedIds: number[] = (assignments ?? []).map((a: any) =>
    Number(a.program_id)
  );

  return (
    <AssignmentsClient
      programs={programs}
      initialAssignedIds={assignedIds}
      advisorId={staffId}
    />
  );
}
