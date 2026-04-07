import { redirect } from "next/navigation";

import { DB_TABLES } from "@/lib/supabase/queries/schema";

type SupabaseLike = {
  auth: {
    getUser: () => Promise<{ data: { user: any | null }; error?: any }>;
  };
  from: (table: string) => any;
};

export type AdminProgram = {
  id: number;
  name: string;
  catalog_year: number | null;
  program_type: string;
};

export type AdminProgramSummary = AdminProgram & {
  blockCount: number;
  courseCount: number;
};

export type AdminCourse = {
  id: number;
  subject: string | null;
  number: string | null;
  title: string | null;
  credits: number | null;
};

export type AdminBlock = {
  id: number;
  program_id: number;
  name: string;
  rule: string;
  n_required: number | null;
  credits_required: number | null;
  display_order: number | null;
  courses: AdminCourse[];
};

function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") return false;
  const message = String((error as { message?: unknown }).message ?? "");
  return message.includes(columnName) && message.includes("column");
}

async function fetchAdvisorAssignments(
  supabase: SupabaseLike,
  staffId: number,
  programId?: number
) {
  const fetchByColumn = async (column: string) => {
    let query = supabase
      .from(DB_TABLES.programAdvisors)
      .select("program_id")
      .eq(column, staffId);

    if (programId != null) {
      query = query.eq("program_id", programId);
    }

    return query;
  };

  const primary = await fetchByColumn("staff_id");
  if (!primary.error || !isMissingColumnError(primary.error, "staff_id")) {
    return primary;
  }

  return fetchByColumn("advisor_id");
}

export async function requireAdvisorAccess(supabase: SupabaseLike) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  if (user.user_metadata?.role !== "advisor") {
    redirect("/dashboard");
  }

  const { data: staff, error: staffError } = await supabase
    .from(DB_TABLES.staff)
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (staffError || !staff) {
    redirect("/dashboard");
  }

  return { user, staffId: Number(staff.id) };
}

export async function fetchAssignedPrograms(
  supabase: SupabaseLike,
  staffId: number
): Promise<AdminProgramSummary[]> {
  const { data: assignments, error: assignmentError } =
    await fetchAdvisorAssignments(supabase, staffId);

  if (assignmentError) {
    throw new Error(`Failed to load advisor assignments: ${assignmentError.message}`);
  }

  const programIds = (assignments ?? [])
    .map((row: any) => Number(row.program_id))
    .filter((id: number) => !Number.isNaN(id));

  if (programIds.length === 0) return [];

  const { data: programs, error: programsError } = await supabase
    .from(DB_TABLES.programs)
    .select("id, name, catalog_year, program_type")
    .in("id", programIds)
    .order("program_type")
    .order("name");

  if (programsError) {
    throw new Error(`Failed to load programs: ${programsError.message}`);
  }

  const { data: blocks, error: blocksError } = await supabase
    .from(DB_TABLES.programRequirementBlocks)
    .select("id, program_id")
    .in("program_id", programIds);

  if (blocksError) {
    throw new Error(`Failed to load requirement blocks: ${blocksError.message}`);
  }

  const blockIds = (blocks ?? []).map((block: any) => Number(block.id));
  const { data: mappings, error: mappingsError } = blockIds.length
    ? await supabase
        .from(DB_TABLES.programRequirementCourses)
        .select("block_id, course_id")
        .in("block_id", blockIds)
    : { data: [], error: null };

  if (mappingsError) {
    throw new Error(`Failed to load requirement courses: ${mappingsError.message}`);
  }

  const blockCountByProgram = new Map<number, number>();
  for (const block of blocks ?? []) {
    const programId = Number((block as any).program_id);
    blockCountByProgram.set(programId, (blockCountByProgram.get(programId) ?? 0) + 1);
  }

  const blockToProgramId = new Map<number, number>();
  for (const block of blocks ?? []) {
    blockToProgramId.set(Number((block as any).id), Number((block as any).program_id));
  }

  const courseCountByProgram = new Map<number, number>();
  for (const mapping of mappings ?? []) {
    const programId = blockToProgramId.get(Number((mapping as any).block_id));
    if (programId == null) continue;
    courseCountByProgram.set(programId, (courseCountByProgram.get(programId) ?? 0) + 1);
  }

  return (programs ?? []).map((program: any) => ({
    id: Number(program.id),
    name: program.name,
    catalog_year: program.catalog_year,
    program_type: program.program_type,
    blockCount: blockCountByProgram.get(Number(program.id)) ?? 0,
    courseCount: courseCountByProgram.get(Number(program.id)) ?? 0,
  }));
}

export async function requireAssignedProgram(
  supabase: SupabaseLike,
  staffId: number,
  programId: number
) {
  const { data: assignment, error: assignmentError } =
    await fetchAdvisorAssignments(supabase, staffId, programId);

  if (assignmentError) {
    throw new Error(`Failed to verify advisor assignment: ${assignmentError.message}`);
  }

  if (!assignment || assignment.length === 0) {
    redirect("/admin/programs");
  }
}

export async function fetchProgramWithBlocks(
  supabase: SupabaseLike,
  programId: number
): Promise<{ program: AdminProgram; blocks: AdminBlock[] }> {
  const { data: program, error: programError } = await supabase
    .from(DB_TABLES.programs)
    .select("id, name, catalog_year, program_type")
    .eq("id", programId)
    .single();

  if (programError || !program) {
    throw new Error("Program not found");
  }

  const withDisplayOrder = await supabase
    .from(DB_TABLES.programRequirementBlocks)
    .select(`
      id,
      program_id,
      name,
      rule,
      n_required,
      credits_required,
      display_order,
      program_requirement_courses (
        course_id,
        courses:course_id (
          id,
          subject,
          number,
          title,
          credits
        )
      )
    `)
    .eq("program_id", programId)
    .order("display_order")
    .order("id");

  const fallback = isMissingColumnError(withDisplayOrder.error, "display_order")
    ? await supabase
        .from(DB_TABLES.programRequirementBlocks)
        .select(`
          id,
          program_id,
          name,
          rule,
          n_required,
          credits_required,
          program_requirement_courses (
            course_id,
            courses:course_id (
              id,
              subject,
              number,
              title,
              credits
            )
          )
        `)
        .eq("program_id", programId)
        .order("id")
    : null;

  const blocksResult = fallback ?? withDisplayOrder;

  if (blocksResult.error) {
    throw new Error(`Failed to load program blocks: ${blocksResult.error.message}`);
  }

  const blocks: AdminBlock[] = (blocksResult.data ?? []).map((block: any) => ({
    id: Number(block.id),
    program_id: Number(block.program_id),
    name: block.name,
    rule: block.rule,
    n_required: block.n_required,
    credits_required: block.credits_required,
    display_order:
      "display_order" in block && block.display_order != null
        ? Number(block.display_order)
        : null,
    courses: (block.program_requirement_courses ?? [])
      .map((row: any) => row.courses)
      .filter(Boolean)
      .map((course: any) => ({
        id: Number(course.id),
        subject: course.subject,
        number: course.number,
        title: course.title,
        credits: course.credits,
      })),
  }));

  return {
    program: {
      id: Number(program.id),
      name: program.name,
      catalog_year: program.catalog_year,
      program_type: program.program_type,
    },
    blocks,
  };
}
