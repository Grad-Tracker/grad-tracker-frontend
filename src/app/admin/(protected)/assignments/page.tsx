import { createClient } from "@/lib/supabase/server";
import { requireAdvisorAccess } from "@/app/admin/(protected)/programs/server-helpers";
import { DB_TABLES } from "@/lib/supabase/queries/schema";
import AssignmentsClient, { type Program } from "./AssignmentsClient";

function isMissingColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== "object") return false;
  const message = String((error as { message?: unknown }).message ?? "");
  return message.includes(columnName) && message.includes("column");
}

export default async function AssignmentsPage() {
  const supabase = await createClient();
  const { staffId } = await requireAdvisorAccess(supabase);

  // Fetch all programs
  const { data: allPrograms, error: programsError } = await supabase
    .from(DB_TABLES.programs)
    .select("id, name, program_type, catalog_year")
    .order("program_type")
    .order("name");

  if (programsError) {
    console.error("Failed to load programs:", programsError);
    throw new Error(`Failed to load programs: ${programsError.message}`);
  }

  // Fetch current advisor's assignments
  const primaryAssignments = await supabase
    .from(DB_TABLES.programAdvisors)
    .select("program_id")
    .eq("staff_id", staffId);

  const fallbackAssignments =
    primaryAssignments.error &&
    isMissingColumnError(primaryAssignments.error, "staff_id")
      ? await supabase
          .from(DB_TABLES.programAdvisors)
          .select("program_id")
          .eq("advisor_id", staffId)
      : null;

  const assignments = fallbackAssignments?.data ?? primaryAssignments.data;
  const assignmentsError =
    fallbackAssignments?.error ?? primaryAssignments.error;

  if (assignmentsError) {
    console.error("Failed to load advisor assignments:", assignmentsError);
    throw new Error(
      `Failed to load advisor assignments: ${assignmentsError.message}`
    );
  }

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
