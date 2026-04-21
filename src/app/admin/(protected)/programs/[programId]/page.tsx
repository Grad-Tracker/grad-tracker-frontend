import { cache } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import ProgramAdminDetailClient from "./ProgramAdminDetailClient";
import {
  fetchProgramWithBlocks,
  requireAdvisorAccess,
  requireAssignedProgram,
} from "../server-helpers";

const FALLBACK_PROGRAM_TITLE = "Program | Programs | Admin | GradTracker";
const PROGRAM_DESCRIPTION = "Review program requirement blocks and courses in the GradTracker admin workspace.";

const getAdminProgramDetail = cache(async (numericProgramId: number) => {
  const supabase = await createClient();
  const { staffId } = await requireAdvisorAccess(supabase);
  await requireAssignedProgram(supabase, staffId, numericProgramId);

  return fetchProgramWithBlocks(supabase, numericProgramId);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ programId: string }>;
}): Promise<Metadata> {
  const { programId } = await params;
  const numericProgramId = Number(programId);

  if (Number.isNaN(numericProgramId)) {
    return {
      title: FALLBACK_PROGRAM_TITLE,
      description: PROGRAM_DESCRIPTION,
    };
  }

  try {
    const { program } = await getAdminProgramDetail(numericProgramId);

    return {
      title: program.name
        ? `${program.name} | Programs | Admin | GradTracker`
        : FALLBACK_PROGRAM_TITLE,
      description: PROGRAM_DESCRIPTION,
    };
  } catch {
    return {
      title: FALLBACK_PROGRAM_TITLE,
      description: PROGRAM_DESCRIPTION,
    };
  }
}

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

  const { program, blocks } = await getAdminProgramDetail(numericProgramId);

  return <ProgramAdminDetailClient initialProgram={program} initialBlocks={blocks} />;
}
