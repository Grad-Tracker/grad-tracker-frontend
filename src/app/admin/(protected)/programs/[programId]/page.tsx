import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import ProgramAdminDetailClient from "./ProgramAdminDetailClient";
import {
  fetchProgramWithBlocks,
  requireAdvisorAccess,
  requireAssignedProgram,
} from "../server-helpers";

export default async function AdminProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const numericProgramId = Number(programId);

  if (Number.isNaN(numericProgramId)) {
    redirect("/admin/programs");
  }

  const supabase = await createClient();
  const { staffId } = await requireAdvisorAccess(supabase);
  await requireAssignedProgram(supabase, staffId, numericProgramId);

  const { program, blocks } = await fetchProgramWithBlocks(supabase, numericProgramId);

  return <ProgramAdminDetailClient initialProgram={program} initialBlocks={blocks} />;
}
