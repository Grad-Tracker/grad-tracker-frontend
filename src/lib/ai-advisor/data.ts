import "server-only";

import { compareTerms } from "@/types/planner";
import { DB_VIEWS, PROGRAM_TYPES } from "@/lib/supabase/queries/schema";
import type {
  ViewStudentProfileRow,
  ViewStudentMajorProgramRow,
  ViewStudentCourseProgressRow,
  ViewProgramBlockCoursesRow,
  ViewProgramBlockCourseItem,
  ViewPlanMetaRow,
  ViewPlanTermRow,
  ViewPlanCourseRow,
} from "@/lib/supabase/queries/view-types";

export type SupabaseTableClient = any;

export interface AdvisorProgramInfo {
  id: number;
  name: string;
  catalogYear: string | null;
  programType: string;
}

export interface AdvisorStudentProfile {
  studentId: number;
  fullName: string;
  email: string | null;
  hasCompletedOnboarding: boolean;
  expectedGradSemester: string | null;
  expectedGradYear: number | null;
  expectedGraduation: string | null;
  programs: AdvisorProgramInfo[];
  primaryProgram: AdvisorProgramInfo | null;
}

export interface AdvisorTermSnapshot {
  id: number;
  season: "Fall" | "Spring" | "Summer";
  year: number;
}

export interface AdvisorPlannedCourseSnapshot {
  courseId: number;
  courseCode: string;
  title: string;
  credits: number;
  status: string;
  termId: number | null;
}

export interface AdvisorPlanSnapshot {
  planId: number;
  planName: string;
  planDescription: string | null;
  programIds: number[];
  terms: AdvisorTermSnapshot[];
  plannedCourses: AdvisorPlannedCourseSnapshot[];
  totalPlannedCredits: number;
}

export interface AdvisorCourseBrief {
  id: number;
  courseCode: string;
  title: string;
  credits: number;
}

export interface AdvisorProgressBlock {
  blockId: number;
  blockName: string;
  completedCredits: number;
  inProgressCredits: number;
  remainingCredits: number;
  totalCreditsRequired: number;
  percentage: number;
}

export interface AdvisorDegreeProgress {
  planId: number | null;
  overall: {
    completedCredits: number;
    inProgressCredits: number;
    remainingCredits: number;
    totalCreditsRequired: number;
    percentage: number;
  };
  blocks: AdvisorProgressBlock[];
}

export interface AdvisorRemainingRequirementBlock {
  blockId: number;
  blockName: string;
  remainingCourses: AdvisorCourseBrief[];
}

export interface AdvisorRemainingRequirements {
  planId: number | null;
  totalRemainingCourses: number;
  blocks: AdvisorRemainingRequirementBlock[];
}

export interface AdvisorCourseCodeLookup {
  resolvedIds: number[];
  unresolvedCodes: string[];
  resolvedCodes: string[];
}

type CourseRecord = {
  id: number;
  subject: string;
  number: string;
  title: string;
  credits: number;
};

type RequirementBlockRecord = {
  id: number;
  name: string;
  credits_required: number | null;
  courses: CourseRecord[];
};

function normalizeCourseCode(subject: string, number: string): string {
  return `${subject} ${number}`.replace(/\s+/g, " ").trim().toUpperCase();
}

function parseCourseCode(raw: string): { subject: string; number: string } | null {
  const cleaned = raw.trim().toUpperCase().replace(/-/g, " ");
  const match = cleaned.match(/^([A-Z]{2,6})\s+([0-9]{2,4}[A-Z]?)$/);
  if (!match) return null;
  return { subject: match[1], number: match[2] };
}

// ── Profile ────────────────────────────────────────────────

export async function resolveStudentProfile(
  supabase: SupabaseTableClient,
  authUserId: string
): Promise<AdvisorStudentProfile | null> {
  const { data: profileRow, error: profileError } = await supabase
    .from(DB_VIEWS.studentProfile)
    .select(
      "student_id, auth_user_id, email, first_name, last_name, full_name, has_completed_onboarding, expected_graduation_semester, expected_graduation_year"
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profileRow) return null;

  const row = profileRow as ViewStudentProfileRow;
  const studentId = Number(row.student_id);

  const { data: programRows, error: programsError } = await supabase
    .from(DB_VIEWS.studentMajorProgram)
    .select("student_id, program_id, program_name, catalog_year, program_type")
    .eq("student_id", studentId);

  if (programsError) throw programsError;

  const programs: AdvisorProgramInfo[] = ((programRows ?? []) as ViewStudentMajorProgramRow[]).map(
    (p) => {
      const programId = Number(p.program_id);
      if (!Number.isFinite(programId)) {
        throw new Error(`Invalid program_id: ${p.program_id}`);
      }
      return {
        id: programId,
        name: String(p.program_name ?? ""),
        catalogYear: p.catalog_year ? String(p.catalog_year) : null,
        programType: String(p.program_type ?? ""),
      };
    }
  );

  const primaryProgram =
    programs.find((p) => p.programType === PROGRAM_TYPES.major) ?? programs[0] ?? null;

  const expectedGradSemester = row.expected_graduation_semester
    ? String(row.expected_graduation_semester)
    : null;
  const expectedGradYear =
    row.expected_graduation_year == null ? null : Number(row.expected_graduation_year);
  const expectedGraduation =
    [expectedGradSemester, expectedGradYear].filter(Boolean).join(" ").trim() || null;

  return {
    studentId,
    fullName: String(row.full_name ?? "Student"),
    email: row.email ? String(row.email) : null,
    hasCompletedOnboarding: Boolean(row.has_completed_onboarding),
    expectedGradSemester,
    expectedGradYear,
    expectedGraduation,
    programs,
    primaryProgram,
  };
}

// ── Plan resolution ────────────────────────────────────────

async function resolvePlanMeta(
  supabase: SupabaseTableClient,
  studentId: number,
  planId?: number | null
): Promise<ViewPlanMetaRow | null> {
  const { data: plans, error } = await supabase
    .from(DB_VIEWS.planMeta)
    .select(
      "plan_id, student_id, name, description, created_at, updated_at, program_ids, term_count, course_count, total_credits, has_graduate_program"
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!plans?.length) return null;

  const rows = plans as ViewPlanMetaRow[];
  if (planId) {
    const numericPlanId = Number(planId);
    if (!Number.isFinite(numericPlanId)) {
      throw new Error(`Invalid planId: ${planId}`);
    }
    const found = rows.find((p) => {
      const rowPlanId = Number(p.plan_id);
      return Number.isFinite(rowPlanId) && rowPlanId === numericPlanId;
    });
    if (!found) {
      return null; // Plan not found - don't fall back to rows[0]
    }
    return found;
  }
  return rows[0];
}

function getProgramIdsFromPlanMeta(planMeta: ViewPlanMetaRow | null): number[] {
  if (!planMeta) return [];
  return (planMeta.program_ids ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id));
}

// ── Requirement blocks ─────────────────────────────────────

async function fetchRequirementBlocks(
  supabase: SupabaseTableClient,
  programIds: number[]
): Promise<RequirementBlockRecord[]> {
  if (programIds.length === 0) return [];

  const { data, error } = await supabase
    .from(DB_VIEWS.programBlockCourses)
    .select(
      "block_id, program_id, program_name, block_name, rule, n_required, credits_required, course_ids, courses"
    )
    .in("program_id", programIds)
    .order("block_name");

  if (error) throw error;
  if (!data?.length) return [];

  return (data as ViewProgramBlockCoursesRow[]).map((row) => {
    const courses: CourseRecord[] = ((row.courses ?? []) as ViewProgramBlockCourseItem[]).map(
      (c) => ({
        id: Number(c.course_id),
        subject: String(c.subject ?? "").trim().toUpperCase(),
        number: String(c.number ?? "").trim().toUpperCase(),
        title: String(c.title ?? "Untitled course"),
        credits: Number(c.credits ?? 0),
      })
    );

    return {
      id: Number(row.block_id),
      name: String(row.block_name ?? "Requirement Block"),
      credits_required: row.credits_required == null ? null : Number(row.credits_required),
      courses,
    };
  });
}

// ── Course progress (completed + in-progress) ──────────────

async function fetchCourseProgressSets(
  supabase: SupabaseTableClient,
  studentId: number,
  planId?: number | null
): Promise<{ completedIds: Set<number>; inProgressIds: Set<number> }> {
  const { data, error } = await supabase
    .from(DB_VIEWS.studentCourseProgress)
    .select("student_id, course_id, plan_id, progress_status")
    .eq("student_id", studentId);

  if (error) throw error;

  const completedIds = new Set<number>();
  const inProgressIds = new Set<number>();

  for (const raw of (data ?? []) as ViewStudentCourseProgressRow[]) {
    const courseId = Number(raw.course_id);
    if (!Number.isFinite(courseId) || isNaN(courseId)) continue;

    if (raw.progress_status === "COMPLETED") {
      completedIds.add(courseId);
    } else {
      // For in-progress, scope to the active plan if provided
      if (planId != null && raw.plan_id != null && Number(raw.plan_id) !== Number(planId)) {
        continue;
      }
      inProgressIds.add(courseId);
    }
  }

  return { completedIds, inProgressIds };
}

// ── Helpers ────────────────────────────────────────────────

function totalCreditsForBlock(block: RequirementBlockRecord): number {
  if (block.credits_required != null && Number.isFinite(Number(block.credits_required))) {
    return Number(block.credits_required);
  }
  return block.courses.reduce((sum, c) => sum + Number(c.credits ?? 0), 0);
}

// ── Plan snapshot ──────────────────────────────────────────

export async function getPlanSnapshot(
  supabase: SupabaseTableClient,
  studentId: number,
  planId?: number | null
): Promise<AdvisorPlanSnapshot | null> {
  const planMeta = await resolvePlanMeta(supabase, studentId, planId);
  if (!planMeta) return null;

  const activePlanId = Number(planMeta.plan_id);

  const [termsRes, coursesRes] = await Promise.all([
    supabase
      .from(DB_VIEWS.planTerms)
      .select("student_id, plan_id, term_id, season, year")
      .eq("student_id", studentId)
      .eq("plan_id", activePlanId),
    supabase
      .from(DB_VIEWS.planCourses)
      .select("student_id, plan_id, term_id, course_id, subject, number, title, credits")
      .eq("student_id", studentId)
      .eq("plan_id", activePlanId),
  ]);

  if (termsRes.error) throw termsRes.error;
  if (coursesRes.error) throw coursesRes.error;

  const terms = ((termsRes.data ?? []) as ViewPlanTermRow[])
    .map((row) => ({
      id: Number(row.term_id),
      season: row.season,
      year: Number(row.year),
    }))
    .filter((term: AdvisorTermSnapshot) => Number.isFinite(term.id))
    .sort(compareTerms);

  const plannedCourses = ((coursesRes.data ?? []) as ViewPlanCourseRow[])
    .map((row) => ({
      courseId: Number(row.course_id),
      courseCode: normalizeCourseCode(
        String(row.subject ?? "").toUpperCase(),
        String(row.number ?? "").toUpperCase()
      ),
      title: String(row.title ?? "Untitled course"),
      credits: Number(row.credits ?? 0),
      status: "PLANNED", // Status field not in view, default to PLANNED
      termId: row.term_id == null ? null : Number(row.term_id),
    }))
    .filter((course: AdvisorPlannedCourseSnapshot) => Number.isFinite(course.courseId));

  const totalPlannedCredits = plannedCourses.reduce(
    (sum: number, c: AdvisorPlannedCourseSnapshot) => sum + c.credits,
    0
  );

  return {
    planId: activePlanId,
    planName: String(planMeta.name ?? "Plan"),
    planDescription: planMeta.description ? String(planMeta.description) : null,
    programIds: getProgramIdsFromPlanMeta(planMeta),
    terms,
    plannedCourses,
    totalPlannedCredits,
  };
}

// ── Degree progress ────────────────────────────────────────

export async function getDegreeProgress(
  supabase: SupabaseTableClient,
  studentId: number,
  planId?: number | null
): Promise<AdvisorDegreeProgress> {
  const planMeta = await resolvePlanMeta(supabase, studentId, planId);
  const activePlanId = planMeta ? Number(planMeta.plan_id) : null;
  const programIds = getProgramIdsFromPlanMeta(planMeta);

  // If plan had no program_ids, fall back to student_programs via the major program view
  let resolvedProgramIds = programIds;
  if (resolvedProgramIds.length === 0) {
    const { data: majorRows, error: majorError } = await supabase
      .from(DB_VIEWS.studentMajorProgram)
      .select("program_id")
      .eq("student_id", studentId);
    if (majorError) throw majorError;
    resolvedProgramIds = (majorRows ?? [])
      .map((r: any) => Number(r.program_id))
      .filter((id: number) => Number.isFinite(id) && !isNaN(id));
  }

  const [blocks, { completedIds, inProgressIds }] = await Promise.all([
    fetchRequirementBlocks(supabase, resolvedProgramIds),
    fetchCourseProgressSets(supabase, studentId, activePlanId),
  ]);

  const blockSummaries: AdvisorProgressBlock[] = blocks.map((block) => {
    const totalCreditsRequired = Math.max(0, totalCreditsForBlock(block));
    let completedCredits = 0;
    let inProgressCredits = 0;

    for (const course of block.courses) {
      if (completedIds.has(course.id)) {
        completedCredits += Number(course.credits ?? 0);
      } else if (inProgressIds.has(course.id)) {
        inProgressCredits += Number(course.credits ?? 0);
      }
    }

    completedCredits = Math.min(completedCredits, totalCreditsRequired);
    inProgressCredits = Math.min(
      inProgressCredits,
      Math.max(0, totalCreditsRequired - completedCredits)
    );
    const remainingCredits = Math.max(0, totalCreditsRequired - completedCredits - inProgressCredits);
    const percentage =
      totalCreditsRequired > 0
        ? Math.min(
            100,
            Math.round(((completedCredits + inProgressCredits) / totalCreditsRequired) * 100)
          )
        : 0;

    return {
      blockId: block.id,
      blockName: block.name,
      completedCredits,
      inProgressCredits,
      remainingCredits,
      totalCreditsRequired,
      percentage,
    };
  });

  const overall = blockSummaries.reduce(
    (acc, block) => {
      acc.completedCredits += block.completedCredits;
      acc.inProgressCredits += block.inProgressCredits;
      acc.remainingCredits += block.remainingCredits;
      acc.totalCreditsRequired += block.totalCreditsRequired;
      return acc;
    },
    {
      completedCredits: 0,
      inProgressCredits: 0,
      remainingCredits: 0,
      totalCreditsRequired: 0,
    }
  );

  const percentage =
    overall.totalCreditsRequired > 0
      ? Math.min(
          100,
          Math.round(
            ((overall.completedCredits + overall.inProgressCredits) / overall.totalCreditsRequired) *
              100
          )
        )
      : 0;

  return {
    planId: activePlanId,
    overall: {
      ...overall,
      percentage,
    },
    blocks: blockSummaries,
  };
}

// ── Remaining requirements ─────────────────────────────────

export async function getRemainingRequirements(
  supabase: SupabaseTableClient,
  studentId: number,
  planId?: number | null,
  limit = 25
): Promise<AdvisorRemainingRequirements> {
  const planMeta = await resolvePlanMeta(supabase, studentId, planId);
  const activePlanId = planMeta ? Number(planMeta.plan_id) : null;
  const programIds = getProgramIdsFromPlanMeta(planMeta);

  let resolvedProgramIds = programIds;
  if (resolvedProgramIds.length === 0) {
    const { data: majorRows, error: majorError } = await supabase
      .from(DB_VIEWS.studentMajorProgram)
      .select("program_id")
      .eq("student_id", studentId);
    if (majorError) throw majorError;
    resolvedProgramIds = (majorRows ?? [])
      .map((r: any) => Number(r.program_id))
      .filter((id: number) => Number.isFinite(id) && !isNaN(id));
  }

  const [blocks, { completedIds, inProgressIds }] = await Promise.all([
    fetchRequirementBlocks(supabase, resolvedProgramIds),
    fetchCourseProgressSets(supabase, studentId, activePlanId),
  ]);

  const maxItems = Math.max(1, Math.min(limit, 100));
  let remainingBudget = maxItems;
  let totalRemainingCourses = 0;

  const grouped = blocks.map((block) => {
    const remainingCourses = block.courses
      .filter((course) => !completedIds.has(course.id) && !inProgressIds.has(course.id))
      .sort((a, b) =>
        normalizeCourseCode(a.subject, a.number).localeCompare(
          normalizeCourseCode(b.subject, b.number)
        )
      );

    totalRemainingCourses += remainingCourses.length;

    const sliced = remainingCourses.slice(0, Math.max(0, remainingBudget));
    remainingBudget = Math.max(0, remainingBudget - sliced.length);

    return {
      blockId: block.id,
      blockName: block.name,
      remainingCourses: sliced.map((course) => ({
        id: course.id,
        courseCode: normalizeCourseCode(course.subject, course.number),
        title: course.title,
        credits: Number(course.credits ?? 0),
      })),
    } as AdvisorRemainingRequirementBlock;
  });

  return {
    planId: activePlanId,
    totalRemainingCourses,
    blocks: grouped.filter((group) => group.remainingCourses.length > 0),
  };
}

// ── Course code resolution ─────────────────────────────────

export async function resolveCourseIdsByCodes(
  supabase: SupabaseTableClient,
  courseCodes: string[]
): Promise<AdvisorCourseCodeLookup> {
  const normalized = Array.from(
    new Set(
      courseCodes
        .map((code) => code.trim().toUpperCase().replace(/\s+/g, " "))
        .filter(Boolean)
    )
  );

  if (normalized.length === 0) {
    return { resolvedIds: [], unresolvedCodes: [], resolvedCodes: [] };
  }

  const parsed = normalized
    .map((code) => ({ raw: code, parsed: parseCourseCode(code) }))
    .filter(
      (entry): entry is { raw: string; parsed: { subject: string; number: string } } =>
        entry.parsed !== null
    );

  const unresolvedFromParse = normalized.filter(
    (code) => !parsed.some((entry) => entry.raw === code)
  );

  const subjects = Array.from(new Set(parsed.map((entry) => entry.parsed.subject)));
  if (subjects.length === 0) {
    return { resolvedIds: [], unresolvedCodes: unresolvedFromParse, resolvedCodes: [] };
  }

  const { data: courses, error } = await supabase
    .from(DB_VIEWS.courseCatalog)
    .select("course_id, subject, number")
    .in("subject", subjects);

  if (error) throw error;

  const codeToId = new Map<string, number>();
  for (const course of courses ?? []) {
    const subject = String(course.subject ?? "").toUpperCase().trim();
    const number = String(course.number ?? "").toUpperCase().trim();
    const code = normalizeCourseCode(subject, number);
    codeToId.set(code, Number(course.course_id));
  }

  const resolvedIds: number[] = [];
  const resolvedCodes: string[] = [];
  const unresolvedCodes: string[] = [...unresolvedFromParse];

  for (const entry of parsed) {
    const code = normalizeCourseCode(entry.parsed.subject, entry.parsed.number);
    const id = codeToId.get(code);
    if (id == null || !Number.isFinite(id)) {
      unresolvedCodes.push(entry.raw);
      continue;
    }
    resolvedIds.push(id);
    resolvedCodes.push(code);
  }

  return {
    resolvedIds: Array.from(new Set(resolvedIds)),
    unresolvedCodes: Array.from(new Set(unresolvedCodes)),
    resolvedCodes: Array.from(new Set(resolvedCodes)),
  };
}