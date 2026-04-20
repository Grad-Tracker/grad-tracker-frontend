import { DB_TABLES } from "@/lib/supabase/queries/schema";

type SupabaseLike = { from: (t: string) => any };

export function computeProgressPct(
  completed: Set<number>,
  required: Set<number>
): number {
  if (required.size === 0) return 0;
  let hit = 0;
  for (const id of required) if (completed.has(id)) hit++;
  return Math.round((hit / required.size) * 100);
}

export type AdvisorStudentRow = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  primaryProgramId: number | null;
  primaryProgramName: string | null;
  primaryProgramType: string | null;
  expectedGradSemester: string | null;
  expectedGradYear: number | null;
  majorProgressPct: number;
  genEdProgressPct: number;
};

export async function listStudentsForAdvisor(
  supabase: SupabaseLike,
  staffId: number
): Promise<AdvisorStudentRow[]> {
  // 1. Advisor's program ids
  const { data: assignments } = await supabase
    .from(DB_TABLES.programAdvisors)
    .select("program_id")
    .eq("advisor_id", staffId);
  const programIds: number[] = (assignments ?? [])
    .map((r: any) => Number(r.program_id))
    .filter((n: number) => !Number.isNaN(n));
  if (programIds.length === 0) return [];

  // 2. Students enrolled in those programs (sorted by program_id ASC for deterministic primary)
  const { data: enrollments } = await supabase
    .from(DB_TABLES.studentPrograms)
    .select("student_id, program_id")
    .in("program_id", programIds)
    .order("program_id");
  const studentIds: number[] = Array.from(
    new Set((enrollments ?? []).map((r: any) => Number(r.student_id)))
  );
  if (studentIds.length === 0) return [];

  // 3. Student profile rows
  const { data: students } = await supabase
    .from(DB_TABLES.students)
    .select(
      "id, first_name, last_name, email, expected_graduation_semester, expected_graduation_year, breadth_package_id"
    )
    .in("id", studentIds);

  // 4. Program metadata for the primary program lookup
  const { data: programs } = await supabase
    .from(DB_TABLES.programs)
    .select("id, name, program_type")
    .in("id", programIds);
  const programById = new Map<number, { name: string; programType: string }>();
  for (const p of programs ?? []) {
    programById.set(Number(p.id), {
      name: p.name,
      programType: p.program_type,
    });
  }

  // Pick a deterministic "primary program" per student: lowest program_id
  // among the programs they are enrolled in that the advisor manages.
  const primaryByStudent = new Map<number, number>();
  for (const row of enrollments ?? []) {
    const sid = Number(row.student_id);
    const pid = Number(row.program_id);
    if (!primaryByStudent.has(sid) || pid < primaryByStudent.get(sid)!) {
      primaryByStudent.set(sid, pid);
    }
  }

  // 5. Required courses per program (for major progress computation)
  const { data: blocks } = await supabase
    .from(DB_TABLES.programRequirementBlocks)
    .select("id, program_id")
    .in("program_id", programIds);
  const blockToProgram = new Map<number, number>();
  for (const b of blocks ?? []) blockToProgram.set(Number(b.id), Number(b.program_id));

  const blockIds = Array.from(blockToProgram.keys());
  const { data: reqCourses } = blockIds.length
    ? await supabase
        .from(DB_TABLES.programRequirementCourses)
        .select("block_id, course_id")
        .in("block_id", blockIds)
    : { data: [] };

  const requiredByProgram = new Map<number, Set<number>>();
  for (const rc of reqCourses ?? []) {
    const pid = blockToProgram.get(Number(rc.block_id));
    if (pid == null) continue;
    if (!requiredByProgram.has(pid)) requiredByProgram.set(pid, new Set());
    requiredByProgram.get(pid)!.add(Number(rc.course_id));
  }

  // 6. Completed/in-progress course IDs per student (history + planned IN_PROGRESS/COMPLETED)
  const { data: history } = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .select("student_id, course_id, completed")
    .in("student_id", studentIds);
  const { data: planned } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .select("student_id, course_id, status")
    .in("student_id", studentIds);

  const completedByStudent = new Map<number, Set<number>>();
  for (const sid of studentIds) completedByStudent.set(sid, new Set());
  for (const h of history ?? []) {
    if (h.completed === false) continue; // explicitly not completed
    completedByStudent.get(Number(h.student_id))!.add(Number(h.course_id));
  }
  for (const p of planned ?? []) {
    const status = String(p.status ?? "").toUpperCase();
    if (status === "COMPLETED" || status === "IN_PROGRESS") {
      completedByStudent.get(Number(p.student_id))!.add(Number(p.course_id));
    }
  }

  // 7. Gen-ed bucket courses keyed by breadth_package_id
  const breadthPackages = Array.from(
    new Set(
      (students ?? [])
        .map((s: any) => s.breadth_package_id)
        .filter((v: string | null): v is string => !!v)
    )
  );
  const { data: genEdRows } = breadthPackages.length
    ? await supabase
        .from(DB_TABLES.genEdBucketCourses)
        .select("bucket_id, course_id")
    : { data: [] };
  // Without a clear bucket→package join table here, we treat all bucket
  // courses as the gen-ed pool. If the schema has a stricter package→bucket
  // mapping, refine in a follow-up. For now: union of all gen-ed courses.
  const genEdRequired = new Set<number>(
    (genEdRows ?? []).map((r: any) => Number(r.course_id))
  );

  // 8. Build the response
  return (students ?? []).map((s: any) => {
    const sid = Number(s.id);
    const pid = primaryByStudent.get(sid) ?? null;
    const meta = pid != null ? programById.get(pid) ?? null : null;
    const completed = completedByStudent.get(sid) ?? new Set<number>();
    const required = pid != null ? requiredByProgram.get(pid) ?? new Set<number>() : new Set<number>();
    return {
      id: sid,
      firstName: s.first_name,
      lastName: s.last_name,
      email: s.email,
      primaryProgramId: pid,
      primaryProgramName: meta?.name ?? null,
      primaryProgramType: meta?.programType ?? null,
      expectedGradSemester: s.expected_graduation_semester,
      expectedGradYear: s.expected_graduation_year,
      majorProgressPct: computeProgressPct(completed, required),
      genEdProgressPct: computeProgressPct(completed, genEdRequired),
    };
  });
}

export type StudentOverview = {
  profile: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    expectedGradSemester: string | null;
    expectedGradYear: number | null;
    breadthPackageId: string | null;
  };
  programs: {
    id: number;
    name: string;
    programType: string;
    progressPct: number;
    completedReqs: number;
    totalReqs: number;
  }[];
  genEdProgress: { progressPct: number; completed: number; total: number };
  plans: {
    id: number;
    name: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
    totalCredits: number;
    termCount: number;
  }[];
};

export async function getStudentOverview(
  supabase: SupabaseLike,
  _staffId: number, // already authorized via requireAdvisorCanViewStudent
  studentId: number
): Promise<StudentOverview> {
  // Profile
  const { data: studentRows } = await supabase
    .from(DB_TABLES.students)
    .select(
      "id, first_name, last_name, email, expected_graduation_semester, expected_graduation_year, breadth_package_id"
    )
    .eq("id", studentId);
  const s = (studentRows ?? [])[0];
  if (!s) throw new Error(`Student ${studentId} not found`);

  // Enrolled programs
  const { data: enrollments } = await supabase
    .from(DB_TABLES.studentPrograms)
    .select("program_id")
    .eq("student_id", studentId);
  const programIds = (enrollments ?? []).map((r: any) => Number(r.program_id));

  const { data: programRows } = programIds.length
    ? await supabase
        .from(DB_TABLES.programs)
        .select("id, name, program_type")
        .in("id", programIds)
    : { data: [] };

  // Required courses per program
  const { data: blocks } = programIds.length
    ? await supabase
        .from(DB_TABLES.programRequirementBlocks)
        .select("id, program_id")
        .in("program_id", programIds)
    : { data: [] };
  const blockToProgram = new Map<number, number>();
  for (const b of blocks ?? []) blockToProgram.set(Number(b.id), Number(b.program_id));
  const blockIds = Array.from(blockToProgram.keys());
  const { data: reqCourses } = blockIds.length
    ? await supabase
        .from(DB_TABLES.programRequirementCourses)
        .select("block_id, course_id")
        .in("block_id", blockIds)
    : { data: [] };
  const requiredByProgram = new Map<number, Set<number>>();
  for (const rc of reqCourses ?? []) {
    const pid = blockToProgram.get(Number(rc.block_id));
    if (pid == null) continue;
    if (!requiredByProgram.has(pid)) requiredByProgram.set(pid, new Set());
    requiredByProgram.get(pid)!.add(Number(rc.course_id));
  }

  // Completed / in-progress courses for this student
  const { data: history } = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .select("course_id, completed")
    .eq("student_id", studentId);
  const { data: planned } = await supabase
    .from(DB_TABLES.studentPlannedCourses)
    .select("course_id, status")
    .eq("student_id", studentId);
  const completed = new Set<number>();
  for (const h of history ?? []) {
    if (h.completed !== false) completed.add(Number(h.course_id));
  }
  for (const p of planned ?? []) {
    const status = String(p.status ?? "").toUpperCase();
    if (status === "COMPLETED" || status === "IN_PROGRESS") {
      completed.add(Number(p.course_id));
    }
  }

  // Gen-ed
  const { data: genEdRows } = s.breadth_package_id
    ? await supabase
        .from(DB_TABLES.genEdBucketCourses)
        .select("course_id")
    : { data: [] };
  const genEdRequired = new Set<number>(
    (genEdRows ?? []).map((r: any) => Number(r.course_id))
  );
  let genEdHit = 0;
  for (const c of genEdRequired) if (completed.has(c)) genEdHit++;

  // Plans + term counts
  const { data: planRows } = await supabase
    .from(DB_TABLES.plans)
    .select("id, name, description, created_at, updated_at")
    .eq("student_id", studentId)
    .order("updated_at");
  const planIds = (planRows ?? []).map((p: any) => Number(p.id));
  const { data: termPlans } = planIds.length
    ? await supabase
        .from(DB_TABLES.studentTermPlan)
        .select("plan_id, term_id")
        .in("plan_id", planIds)
    : { data: [] };
  const termCountByPlan = new Map<number, number>();
  for (const tp of termPlans ?? []) {
    const pid = Number(tp.plan_id);
    termCountByPlan.set(pid, (termCountByPlan.get(pid) ?? 0) + 1);
  }

  return {
    profile: {
      id: Number(s.id),
      firstName: s.first_name,
      lastName: s.last_name,
      email: s.email,
      expectedGradSemester: s.expected_graduation_semester,
      expectedGradYear: s.expected_graduation_year,
      breadthPackageId: s.breadth_package_id,
    },
    programs: (programRows ?? []).map((p: any) => {
      const required = requiredByProgram.get(Number(p.id)) ?? new Set();
      let hit = 0;
      for (const c of required) if (completed.has(c)) hit++;
      return {
        id: Number(p.id),
        name: p.name,
        programType: p.program_type,
        progressPct: computeProgressPct(completed, required),
        completedReqs: hit,
        totalReqs: required.size,
      };
    }),
    genEdProgress: {
      progressPct: computeProgressPct(completed, genEdRequired),
      completed: genEdHit,
      total: genEdRequired.size,
    },
    plans: (planRows ?? [])
      .slice()
      .reverse() // updated_at DESC
      .map((p: any) => ({
        id: Number(p.id),
        name: p.name,
        description: p.description,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        totalCredits: 0, // intentionally 0 in v1 — credit total is a follow-up enhancement
        termCount: termCountByPlan.get(Number(p.id)) ?? 0,
      })),
  };
}
