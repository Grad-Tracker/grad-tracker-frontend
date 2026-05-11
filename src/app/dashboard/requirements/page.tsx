import { createClient } from "@/lib/supabase/server";
import { DB_VIEWS } from "@/lib/supabase/queries/schema";
import ProgramsClient, { type Program } from "./ProgramsClient";
import type { ViewProgramCatalogRow } from "@/lib/supabase/queries/view-types";

export const metadata = {
  title: "Requirements | Grad Tracker",
  description: "Track your graduation progress in Grad Tracker.",
};

export default async function RequirementsPage() {
  const supabase = await createClient();

  const { data: programs, error } = await supabase
    .from(DB_VIEWS.programCatalog)
    .select("program_id, program_name, catalog_year, program_type")
    .order("program_name", { ascending: true });

  if (error) {
    console.error("Error fetching programs:", error);
  }

  const mappedPrograms: Program[] = ((programs as ViewProgramCatalogRow[] | null) ?? []).map(
    (program) => ({
      id: String(program.program_id),
      name: program.program_name,
      catalog_year: program.catalog_year ? Number(program.catalog_year) || null : null,
      program_type: String(program.program_type ?? ""),
    })
  );

  return <ProgramsClient programs={mappedPrograms} />;
}
