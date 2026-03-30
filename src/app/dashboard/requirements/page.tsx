import { createClient } from "@/lib/supabase/server";
import { DB_TABLES } from "@/lib/supabase/queries/schema";
import ProgramsClient, { type Program } from "./ProgramsClient";

export default async function RequirementsPage() {
  const supabase = await createClient();

  const { data: programs, error } = await supabase
    .from(DB_TABLES.programs)
    .select("id, name, catalog_year, program_type")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching programs:", error);
  }

  return <ProgramsClient programs={(programs as Program[]) || []} />;
}