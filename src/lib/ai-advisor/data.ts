import "server-only";

import { compareTerms } from "@/types/planner";
import { DB_VIEWS, DB_TABLES, PROGRAM_TYPES } from "@/lib/supabase/queries/schema";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;
export type SupabaseTableClient = SupabaseClient;

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
  program_id: number;
  program_name: string;
  rule: string;
  n_required: number | null;
  credits_required: number | null;
  courses: CourseRecord[];
};

function normalizeCourseCode(subject: string, number: string): string {
  return `${subject} ${number}`.replace(/\s+/g, " ").trim().toUpperCase();
}

function parseCourseCode(raw: string): { subject: string; number: string } | null {
  const cleaned = raw.trim().toUpperCase().replace(/-/g, " ");
  const match = /^([A-Z]{2,6})\s+(\d{2,4}[A-Z]?)$/.exec(cleaned);
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
  return (planMeta.program_ids ?? []).map(Number).filter((id) => Number.isFinite(id));
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

  return data.map((row: ViewProgramBlockCoursesRow) => {
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
      program_id: Number(row.program_id ?? 0),
      program_name: String(row.program_name ?? ""),
      rule: String(row.rule ?? "ALL_OF"),
      n_required: row.n_required == null ? null : Number(row.n_required),
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

  const rule = (block.rule ?? "ALL_OF").toUpperCase();

  if (rule === "N_OF" && block.n_required != null && block.courses.length > 0) {
    const avg =
      block.courses.reduce((s, c) => s + Number(c.credits ?? 0), 0) / block.courses.length;
    return Math.round(block.n_required * avg);
  }

  if (rule === "ANY_OF" && block.courses.length > 0) {
    return Math.min(...block.courses.map((c) => Number(c.credits ?? 3)));
  }

  // ALL_OF or CREDITS_OF without explicit credits_required — sum all courses
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
      .filter((id: number) => Number.isFinite(id) && !Number.isNaN(id));
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
      .filter((id: number) => Number.isFinite(id) && !Number.isNaN(id));
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

// ── Course history ─────────────────────────────────────────

export interface AdvisorCourseHistoryEntry {
  courseId: number;
  courseCode: string;
  title: string;
  credits: number;
  grade: string | null;
  completed: boolean;
  term: string | null; // e.g. "Fall 2024", null if term unknown
}

export interface GetCourseHistoryOptions {
  subject?: string | null;
  completedOnly?: boolean;
  minLevel?: number | null; // e.g. 300 → only 300+ courses
}

export async function getCourseHistory(
  supabase: SupabaseTableClient,
  studentId: number,
  options: GetCourseHistoryOptions = {}
): Promise<AdvisorCourseHistoryEntry[]> {
  let q = supabase
    .from(DB_VIEWS.studentCourseHistoryDetail)
    .select("course_id, term_id, completed, grade, subject, number, title, credits")
    .eq("student_id", studentId);

  if (options.completedOnly) {
    q = q.eq("completed", true);
  }

  if (options.subject) {
    q = q.ilike("subject", options.subject.trim());
  }

  const { data, error } = await q;
  if (error) throw new Error(`Failed to fetch course history: ${error.message}`);

  let rows = (data ?? []) as Array<{
    course_id: number;
    term_id: number;
    completed: boolean;
    grade: string | null;
    subject: string;
    number: string;
    title: string;
    credits: number;
  }>;

  // Apply minLevel filter (course number prefix as integer).
  if (options.minLevel != null) {
    const min = Number(options.minLevel);
    rows = rows.filter((row) => {
      const level = parseInt(String(row.number), 10);
      return Number.isFinite(level) && level >= min;
    });
  }

  // Resolve term_ids → season/year in a single batch query.
  const termIds = Array.from(new Set(rows.map((r) => r.term_id).filter(Boolean)));
  const termMap = new Map<number, string>();

  if (termIds.length > 0) {
    const { data: termRows } = await supabase
      .from(DB_TABLES.terms)
      .select("id, season, year")
      .in("id", termIds);

    for (const t of termRows ?? []) {
      termMap.set(Number(t.id), `${t.season} ${t.year}`);
    }
  }

  return rows.map((row) => {
    const sub = String(row.subject ?? "").trim().toUpperCase();
    const num = String(row.number ?? "").trim().toUpperCase();
    return {
      courseId: Number(row.course_id),
      courseCode: `${sub} ${num}`.trim(),
      title: String(row.title ?? ""),
      credits: Number(row.credits ?? 0),
      grade: row.grade ?? null,
      completed: Boolean(row.completed),
      term: termMap.get(Number(row.term_id)) ?? null,
    };
  });
}

// ── Course search ──────────────────────────────────────────

export interface AdvisorCourseSearchResult {
  courseId: number;
  courseCode: string;
  title: string;
  credits: number;
}

// Matches "CIS 570", "CSCI 340L", "MATH 280" — subject letters + space + course number.
const COURSE_CODE_RE = /^([A-Za-z]{2,8})\s+(\S+)$/;

export async function searchCourses(
  supabase: SupabaseTableClient,
  query: string,
  subject?: string | null,
  limit = 15
): Promise<AdvisorCourseSearchResult[]> {
  const trimmed = query.trim();
  const cap = Math.min(Math.max(1, limit), 25);

  let q = supabase
    .from(DB_VIEWS.courseCatalog)
    .select("course_id, subject, number, title, credits");

  // When the query looks like a course code (e.g. "CIS 570") split it into
  // subject + number so each column is matched individually. A full-string
  // ILIKE against individual columns would never match because no single
  // column contains the full "SUBJ NUM" string.
  const codeMatch = !subject ? trimmed.match(COURSE_CODE_RE) : null;
  if (codeMatch) {
    q = q.ilike("subject", codeMatch[1]!).ilike("number", codeMatch[2]!);
  } else {
    if (subject) {
      q = q.ilike("subject", subject.trim());
    }
    if (trimmed) {
      const escaped = trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_");
      const pattern = `%${escaped}%`;
      q = q.or(`title.ilike.${pattern},subject.ilike.${pattern},number.ilike.${pattern}`);
    }
  }

  const { data, error } = await q.order("subject").order("number").limit(cap);
  if (error) throw new Error(`Course search failed: ${error.message}`);

  return (data ?? []).map((row: any) => {
    const sub = String(row.subject ?? "").trim().toUpperCase();
    const num = String(row.number ?? "").trim().toUpperCase();
    return {
      courseId: Number(row.course_id),
      courseCode: `${sub} ${num}`.trim(),
      title: String(row.title ?? ""),
      credits: Number(row.credits ?? 0),
    };
  });
}

// ── Course code resolution ─────────────────────────────────

export async function resolveCourseIdsByCodes(
  supabase: SupabaseTableClient,
  courseCodes: string[]
): Promise<AdvisorCourseCodeLookup> {
  const normalized = Array.from(
    new Set(
      courseCodes
        .map((code) => code.trim().toUpperCase().replaceAll(/\s+/g, " "))
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

// ── Course lookup by IDs ──────────────────────────────────

export interface AdvisorCourseDetail {
  courseId: number;
  courseCode: string;
  title: string;
  credits: number;
  description: string | null;
  prereqText: string | null;
  isActive: boolean;
}

export async function getCourseDetails(
  supabase: SupabaseTableClient,
  courseIds: number[]
): Promise<Map<number, AdvisorCourseDetail>> {
  if (courseIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from(DB_VIEWS.courseCatalog)
    .select("course_id, subject, number, title, credits, description, prereq_text, is_active")
    .in("course_id", courseIds);
  if (error) throw new Error(`Course details lookup failed: ${error.message}`);

  const map = new Map<number, AdvisorCourseDetail>();
  for (const row of data ?? []) {
    const sub = String(row.subject ?? "").trim().toUpperCase();
    const num = String(row.number ?? "").trim().toUpperCase();
    map.set(Number(row.course_id), {
      courseId: Number(row.course_id),
      courseCode: `${sub} ${num}`.trim(),
      title: String(row.title ?? ""),
      credits: Number(row.credits ?? 0),
      description: row.description ?? null,
      prereqText: row.prereq_text ?? null,
      isActive: Boolean(row.is_active),
    });
  }
  return map;
}

export async function getCoursesByIds(
  supabase: SupabaseTableClient,
  courseIds: number[]
): Promise<Map<number, AdvisorCourseSearchResult>> {
  if (courseIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from(DB_VIEWS.courseCatalog)
    .select("course_id, subject, number, title, credits")
    .in("course_id", courseIds);
  if (error) throw new Error(`Course lookup failed: ${error.message}`);

  const map = new Map<number, AdvisorCourseSearchResult>();
  for (const row of data ?? []) {
    const sub = String(row.subject ?? "").trim().toUpperCase();
    const num = String(row.number ?? "").trim().toUpperCase();
    map.set(Number(row.course_id), {
      courseId: Number(row.course_id),
      courseCode: `${sub} ${num}`.trim(),
      title: String(row.title ?? ""),
      credits: Number(row.credits ?? 0),
    });
  }
  return map;
}

// ── Gen-ed options ────────────────────────────────────────

export interface AdvisorGenEdBucket {
  bucketId: number;
  bucketCode: string;
  bucketName: string;
  creditsRequired: number;
  courses: AdvisorRequirementCourse[];
}

export async function getGenEdOptions(
  supabase: SupabaseTableClient,
  bucketFilter?: string | null,
  bucketId?: number | null
): Promise<AdvisorGenEdBucket[]> {
  let q = supabase
    .from(DB_VIEWS.genEdBucketCourses)
    .select("bucket_id, bucket_code, bucket_name, bucket_credits_required, courses");

  if (bucketId != null) {
    q = q.eq("bucket_id", bucketId);
  } else if (bucketFilter) {
    q = q.ilike("bucket_name", `%${bucketFilter.trim()}%`);
  }

  const { data, error } = await q.order("bucket_name");
  if (error) throw new Error(`Failed to fetch gen-ed options: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    bucketId: Number(row.bucket_id),
    bucketCode: String(row.bucket_code ?? ""),
    bucketName: String(row.bucket_name ?? ""),
    creditsRequired: Number(row.bucket_credits_required ?? 0),
    courses: ((row.courses ?? []) as Array<{ course_id: number; subject: string | null; number: string | null; title: string | null; credits: number | null }>).map((c) => {
      const sub = String(c.subject ?? "").trim().toUpperCase();
      const num = String(c.number ?? "").trim().toUpperCase();
      return {
        courseId: Number(c.course_id),
        courseCode: `${sub} ${num}`.trim(),
        title: String(c.title ?? ""),
        credits: Number(c.credits ?? 0),
      };
    }),
  }));
}

// ── Reverse prereq lookup ─────────────────────────────────

export async function getDirectDependentCourseIds(
  supabase: SupabaseTableClient,
  courseIds: number[]
): Promise<Map<number, number[]>> {
  // Returns: prerequisiteId → array of course IDs that directly require it
  if (courseIds.length === 0) return new Map();

  const { data: atomRows, error: atomErr } = await supabase
    .from("course_req_atoms")
    .select("required_course_id, node_id")
    .in("required_course_id", courseIds);

  if (atomErr) throw new Error(`Failed to fetch reverse prereqs: ${atomErr.message}`);
  if (!atomRows?.length) return new Map(courseIds.map((id) => [id, []]));

  const nodeIds = Array.from(new Set((atomRows as Array<{ required_course_id: number; node_id: number }>).map((r) => Number(r.node_id))));

  const { data: nodeRows, error: nodeErr } = await supabase
    .from("course_req_nodes")
    .select("id, req_set_id")
    .in("id", nodeIds);

  if (nodeErr) throw new Error(`Failed to fetch req nodes: ${nodeErr.message}`);

  const nodeToSetId = new Map<number, number>();
  for (const node of nodeRows ?? []) {
    nodeToSetId.set(Number(node.id), Number(node.req_set_id));
  }

  const setIds = Array.from(new Set(Array.from(nodeToSetId.values())));
  const { data: setRows, error: setErr } = await supabase
    .from("course_req_sets")
    .select("id, course_id")
    .in("id", setIds)
    .eq("set_type", "PREREQ");

  if (setErr) throw new Error(`Failed to fetch req sets: ${setErr.message}`);

  const setToCourseId = new Map<number, number>();
  for (const s of setRows ?? []) {
    setToCourseId.set(Number(s.id), Number(s.course_id));
  }

  const result = new Map<number, number[]>(courseIds.map((id) => [id, []]));
  for (const atom of atomRows as Array<{ required_course_id: number; node_id: number }>) {
    const reqId = Number(atom.required_course_id);
    const nodeId = Number(atom.node_id);
    const setId = nodeToSetId.get(nodeId);
    if (setId == null) continue;
    const dependentCourseId = setToCourseId.get(setId);
    if (dependentCourseId == null) continue;
    result.get(reqId)?.push(dependentCourseId);
  }

  // Deduplicate
  for (const [id, deps] of result) {
    result.set(id, Array.from(new Set(deps)));
  }

  return result;
}

// ── Program requirements ───────────────────────────────────

export interface AdvisorRequirementCourse {
  courseId: number;
  courseCode: string;
  title: string;
  credits: number;
}

export interface AdvisorRequirementBlock {
  blockId: number;
  blockName: string;
  programId: number;
  programName: string;
  rule: string;
  nRequired: number | null;
  creditsRequired: number | null;
  courses: AdvisorRequirementCourse[];
}

export async function getProgramRequirements(
  supabase: SupabaseTableClient,
  programIds: number[]
): Promise<AdvisorRequirementBlock[]> {
  const blocks = await fetchRequirementBlocks(supabase, programIds);
  return blocks.map((block) => ({
    blockId: block.id,
    blockName: block.name,
    programId: block.program_id,
    programName: block.program_name,
    rule: block.rule,
    nRequired: block.n_required,
    creditsRequired: block.credits_required,
    courses: block.courses.map((c) => ({
      courseId: c.id,
      courseCode: `${c.subject} ${c.number}`.trim(),
      title: c.title,
      credits: c.credits,
    })),
  }));
}

export interface AdvisorProgramSummary {
  id: number;
  name: string;
  programType: string;
  catalogYear: string | null;
}

export async function getAvailablePrograms(
  supabase: SupabaseTableClient,
  programType?: string | null
): Promise<AdvisorProgramSummary[]> {
  let q = supabase
    .from(DB_VIEWS.programCatalog)
    .select("program_id, program_name, catalog_year, program_type")
    .order("program_name");

  if (programType) {
    q = q.eq("program_type", programType);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row: { program_id: number; program_name: string; catalog_year: string | null; program_type: string }) => ({
    id: Number(row.program_id),
    name: String(row.program_name ?? ""),
    programType: String(row.program_type ?? ""),
    catalogYear: row.catalog_year ? String(row.catalog_year) : null,
  }));
}