import "server-only";

import { compareTerms } from "@/types/planner";
import { DB_TABLES, PROGRAM_TYPES, STUDENT_COLUMNS } from "@/lib/supabase/queries/schema";

export interface SupabaseTableClient {
  from: (table: string) => any;
}

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

function isMissingColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== "object") return false;
  const message = String((error as { message?: unknown }).message ?? "");
  return message.includes(columnName) && message.includes("column");
}

function buildFullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  legacyName: string | null | undefined,
  email: string | null | undefined
): string {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (legacyName?.trim()) return legacyName.trim();
  if (email?.trim()) return email.trim();
  return "Student";
}

function normalizeCourseCode(subject: string, number: string): string {
  return `${subject} ${number}`.replace(/\s+/g, " ").trim().toUpperCase();
}

function parseCourseCode(raw: string): { subject: string; number: string } | null {
  const cleaned = raw.trim().toUpperCase().replace(/-/g, " ");
  const match = cleaned.match(/^([A-Z]{2,6})\s+([0-9]{2,4}[A-Z]?)$/);
  if (!match) return null;
  return { subject: match[1], number: match[2] };
}

async function fetchProgramsForStudent(
  supabase: SupabaseTableClient,
  studentId: number
): Promise<AdvisorProgramInfo[]> {
  const { data: studentPrograms, error: spError } = await supabase
    .from(DB_TABLES.studentPrograms)
    .select("program_id")
    .eq("student_id", studentId);

  if (spError) throw spError;
  const programIds = (studentPrograms ?? []).map((sp: any) => Number(sp.program_id));
  if (programIds.length === 0) return [];

  const { data: programs, error: programsError } = await supabase
    .from(DB_TABLES.programs)
    .select("id, name, catalog_year, program_type")
    .in("id", programIds);

  if (programsError) throw programsError;

  const orderMap = new Map<number, number>();
  programIds.forEach((id: number, idx: number) => orderMap.set(id, idx));

  return (programs ?? [])
    .map((p: any) => ({
      id: Number(p.id),
      name: String(p.name ?? ""),
      catalogYear: p.catalog_year ? String(p.catalog_year) : null,
      programType: String(p.program_type ?? ""),
    }))
    .sort((a: AdvisorProgramInfo, b: AdvisorProgramInfo) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
}

export async function resolveStudentProfile(
  supabase: SupabaseTableClient,
  authUserId: string
): Promise<AdvisorStudentProfile | null> {
  const { data: studentNew, error: studentNewError } = await supabase
    .from(DB_TABLES.students)
    .select(
      "id, first_name, last_name, email, has_completed_onboarding, expected_graduation_semester, expected_graduation_year"
    )
    .eq(STUDENT_COLUMNS.authUserId, authUserId)
    .maybeSingle();

  let studentData = studentNew as any;
  let studentError = studentNewError;

  if (
    studentNewError &&
    (isMissingColumnError(studentNewError, STUDENT_COLUMNS.firstName) ||
      isMissingColumnError(studentNewError, STUDENT_COLUMNS.lastName))
  ) {
    const { data: studentLegacy, error: legacyError } = await supabase
      .from(DB_TABLES.students)
      .select("id, name, email, has_completed_onboarding, expected_graduation_term, expected_graduation_year")
      .eq(STUDENT_COLUMNS.authUserId, authUserId)
      .maybeSingle();

    studentError = legacyError;
    studentData = studentLegacy
      ? {
          id: studentLegacy.id,
          first_name: null,
          last_name: null,
          name: studentLegacy.name,
          email: studentLegacy.email,
          has_completed_onboarding: studentLegacy.has_completed_onboarding,
          expected_graduation_semester: studentLegacy.expected_graduation_term,
          expected_graduation_year: studentLegacy.expected_graduation_year,
        }
      : null;
  }

  if (studentError) throw studentError;
  if (!studentData) return null;

  const studentId = Number(studentData.id);
  const programs = await fetchProgramsForStudent(supabase, studentId);
  const primaryProgram =
    programs.find((p) => p.programType === PROGRAM_TYPES.major) ?? programs[0] ?? null;

  const expectedGradSemester = studentData.expected_graduation_semester
    ? String(studentData.expected_graduation_semester)
    : null;
  const expectedGradYear =
    studentData.expected_graduation_year == null
      ? null
      : Number(studentData.expected_graduation_year);
  const expectedGraduation =
    [expectedGradSemester, expectedGradYear].filter(Boolean).join(" ").trim() || null;

  return {
    studentId,
    fullName: buildFullName(
      studentData.first_name,
      studentData.last_name,
      studentData.name,
      studentData.email
    ),
    email: studentData.email ? String(studentData.email) : null,
    hasCompletedOnboarding: Boolean(studentData.has_completed_onboarding),
    expectedGradSemester,
    expectedGradYear,
    expectedGraduation,
    programs,
    primaryProgram,
  };
}

interface PlanRecord {
  id: number;
  name: string;
  description: string | null;
}

async function resolvePlan(
  supabase: SupabaseTableClient,
  studentId: number,
  planId?: number | null
): Promise<PlanRecord | null> {
  const { data: plans, error } = await supabase
    .from(DB_TABLES.plans)
    .select("id, name, description, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!plans?.length) return null;

  const selected = planId
    ? plans.find((p: any) => Number(p.id) === Number(planId)) ?? plans[0]
    : plans[0];

  return {
    id: Number(selected.id),
    name: String(selected.name ?? "Plan"),
    description: selected.description ? String(selected.description) : null,
  };
}

async function getProgramIdsForScope(
  supabase: SupabaseTableClient,
  studentId: number,
  planId?: number | null
): Promise<number[]> {
  if (planId) {
    const { data: planPrograms, error: ppError } = await supabase
      .from(DB_TABLES.planPrograms)
      .select("program_id")
      .eq("plan_id", planId);

    if (ppError) throw ppError;
    const planProgramIds = (planPrograms ?? []).map((pp: any) => Number(pp.program_id));
    if (planProgramIds.length > 0) return planProgramIds;
  }

  const { data: studentPrograms, error: spError } = await supabase
    .from(DB_TABLES.studentPrograms)
    .select("program_id")
    .eq("student_id", studentId);

  if (spError) throw spError;
  return (studentPrograms ?? []).map((sp: any) => Number(sp.program_id));
}

async function fetchRequirementBlocks(
  supabase: SupabaseTableClient,
  programIds: number[]
): Promise<RequirementBlockRecord[]> {
  if (programIds.length === 0) return [];

  const { data: blocks, error: blocksError } = await supabase
    .from(DB_TABLES.programRequirementBlocks)
    .select("id, name, credits_required")
    .in("program_id", programIds)
    .order("name");

  if (blocksError) throw blocksError;
  if (!blocks?.length) return [];

  const blockIds = blocks.map((b: any) => Number(b.id));
  const { data: mappings, error: mappingsError } = await supabase
    .from(DB_TABLES.programRequirementCourses)
    .select("block_id, course_id")
    .in("block_id", blockIds);

  if (mappingsError) throw mappingsError;

  const courseIds = Array.from(
    new Set((mappings ?? []).map((m: any) => Number(m.course_id)).filter((id: number) => Number.isFinite(id)))
  );

  const courseMap = new Map<number, CourseRecord>();
  if (courseIds.length > 0) {
    const { data: courses, error: coursesError } = await supabase
      .from(DB_TABLES.courses)
      .select("id, subject, number, title, credits")
      .in("id", courseIds)
      .order("subject")
      .order("number");

    if (coursesError) throw coursesError;

    for (const course of courses ?? []) {
      const id = Number(course.id);
      if (!Number.isFinite(id)) continue;
      const subject = String(course.subject ?? "").trim().toUpperCase();
      const number = String(course.number ?? "").trim().toUpperCase();
      courseMap.set(id, {
        id,
        subject,
        number,
        title: String(course.title ?? "Untitled course"),
        credits: Number(course.credits ?? 0),
      });
    }
  }

  return (blocks ?? []).map((block: any) => {
    const blockId = Number(block.id);
    const uniqueIds: number[] = Array.from(
      new Set(
        (mappings ?? [])
          .filter((m: any) => Number(m.block_id) === blockId)
          .map((m: any) => Number(m.course_id))
          .filter((id: number) => Number.isFinite(id))
      )
    );

    const courses = uniqueIds
      .map((id) => courseMap.get(id))
      .filter((course): course is CourseRecord => course !== undefined);

    return {
      id: blockId,
      name: String(block.name ?? "Requirement Block"),
      credits_required:
        block.credits_required == null ? null : Number(block.credits_required),
      courses,
    } as RequirementBlockRecord;
  });
}

async function fetchCompletedCourseIdSet(
  supabase: SupabaseTableClient,
  studentId: number
): Promise<Set<number>> {
  const { data, error } = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .select("course_id")
    .eq("student_id", studentId);

  if (error) throw error;
  return new Set(
    (data ?? [])
      .map((row: any) => Number(row.course_id))
      .filter((id: number) => Number.isFinite(id))
  );
}

async function fetchInProgressCourseIdSet(
  supabase: SupabaseTableClient,
  studentId: number,
  planId?: number | null
): Promise<Set<number>> {
  let query = supabase
    .from(DB_TABLES.studentPlannedCourses)
    .select("course_id, status")
    .eq("student_id", studentId);

  if (planId) {
    query = query.eq("plan_id", planId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const ids = (data ?? [])
    .filter((row: any) => {
      const status = String(row.status ?? "").toLowerCase();
      return status === "planned" || status === "enrolled" || status === "waitlist";
    })
    .map((row: any) => Number(row.course_id))
    .filter((id: number) => Number.isFinite(id));

  return new Set(ids);
}

function totalCreditsForBlock(block: RequirementBlockRecord): number {
  if (block.credits_required != null && Number.isFinite(Number(block.credits_required))) {
    return Number(block.credits_required);
  }
  return block.courses.reduce((sum, c) => sum + Number(c.credits ?? 0), 0);
}

export async function getPlanSnapshot(
  supabase: SupabaseTableClient,
  studentId: number,
  planId?: number | null
): Promise<AdvisorPlanSnapshot | null> {
  const selectedPlan = await resolvePlan(supabase, studentId, planId);
  if (!selectedPlan) return null;

  const { data: planPrograms, error: planProgramsError } = await supabase
    .from(DB_TABLES.planPrograms)
    .select("program_id")
    .eq("plan_id", selectedPlan.id);
  if (planProgramsError) throw planProgramsError;

  const [termsRes, plannedCoursesRes] = await Promise.all([
    supabase
      .from(DB_TABLES.studentTermPlan)
      .select("term_id, terms:term_id (id, season, year)")
      .eq("student_id", studentId)
      .eq("plan_id", selectedPlan.id),
    supabase
      .from(DB_TABLES.studentPlannedCourses)
      .select("course_id, term_id, status, courses:course_id (id, subject, number, title, credits)")
      .eq("student_id", studentId)
      .eq("plan_id", selectedPlan.id),
  ]);

  if (termsRes.error) throw termsRes.error;
  if (plannedCoursesRes.error) throw plannedCoursesRes.error;

  const terms = (termsRes.data ?? [])
    .map((row: any) => ({
      id: Number(row.terms?.id),
      season: row.terms?.season as "Fall" | "Spring" | "Summer",
      year: Number(row.terms?.year),
    }))
    .filter((term: AdvisorTermSnapshot) => Number.isFinite(term.id))
    .sort(compareTerms);

  const plannedCourses = (plannedCoursesRes.data ?? [])
    .map((row: any) => {
      const course = row.courses ?? {};
      const subject = String(course.subject ?? "").trim().toUpperCase();
      const number = String(course.number ?? "").trim().toUpperCase();
      return {
        courseId: Number(row.course_id),
        courseCode: normalizeCourseCode(subject, number),
        title: String(course.title ?? "Untitled course"),
        credits: Number(course.credits ?? 0),
        status: String(row.status ?? "PLANNED"),
        termId: row.term_id == null ? null : Number(row.term_id),
      } as AdvisorPlannedCourseSnapshot;
    })
    .filter((course: AdvisorPlannedCourseSnapshot) => Number.isFinite(course.courseId));

  const totalPlannedCredits = plannedCourses.reduce((sum: number, c: AdvisorPlannedCourseSnapshot) => sum + c.credits, 0);

  return {
    planId: selectedPlan.id,
    planName: selectedPlan.name,
    planDescription: selectedPlan.description,
    programIds: (planPrograms ?? []).map((pp: any) => Number(pp.program_id)),
    terms,
    plannedCourses,
    totalPlannedCredits,
  };
}

export async function getDegreeProgress(
  supabase: SupabaseTableClient,
  studentId: number,
  planId?: number | null
): Promise<AdvisorDegreeProgress> {
  const selectedPlan = await resolvePlan(supabase, studentId, planId);
  const activePlanId = selectedPlan?.id ?? null;
  const programIds = await getProgramIdsForScope(supabase, studentId, activePlanId);

  const [blocks, completedIds, inProgressIds] = await Promise.all([
    fetchRequirementBlocks(supabase, programIds),
    fetchCompletedCourseIdSet(supabase, studentId),
    fetchInProgressCourseIdSet(supabase, studentId, activePlanId),
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

export async function getRemainingRequirements(
  supabase: SupabaseTableClient,
  studentId: number,
  planId?: number | null,
  limit = 25
): Promise<AdvisorRemainingRequirements> {
  const selectedPlan = await resolvePlan(supabase, studentId, planId);
  const activePlanId = selectedPlan?.id ?? null;
  const programIds = await getProgramIdsForScope(supabase, studentId, activePlanId);

  const [blocks, completedIds, inProgressIds] = await Promise.all([
    fetchRequirementBlocks(supabase, programIds),
    fetchCompletedCourseIdSet(supabase, studentId),
    fetchInProgressCourseIdSet(supabase, studentId, activePlanId),
  ]);

  const maxItems = Math.max(1, Math.min(limit, 100));
  let remainingBudget = maxItems;
  let totalRemainingCourses = 0;

  const grouped = blocks.map((block) => {
    const remainingCourses = block.courses
      .filter((course) => !completedIds.has(course.id) && !inProgressIds.has(course.id))
      .sort((a, b) => normalizeCourseCode(a.subject, a.number).localeCompare(normalizeCourseCode(b.subject, b.number)));

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
    return {
      resolvedIds: [],
      unresolvedCodes: [],
      resolvedCodes: [],
    };
  }

  const parsed = normalized
    .map((code) => ({ raw: code, parsed: parseCourseCode(code) }))
    .filter((entry): entry is { raw: string; parsed: { subject: string; number: string } } => entry.parsed !== null);

  const unresolvedFromParse = normalized.filter(
    (code) => !parsed.some((entry) => entry.raw === code)
  );

  const subjects = Array.from(new Set(parsed.map((entry) => entry.parsed.subject)));
  if (subjects.length === 0) {
    return {
      resolvedIds: [],
      unresolvedCodes: unresolvedFromParse,
      resolvedCodes: [],
    };
  }

  const { data: courses, error } = await supabase
    .from(DB_TABLES.courses)
    .select("id, subject, number")
    .in("subject", subjects);

  if (error) throw error;

  const codeToId = new Map<string, number>();
  for (const course of courses ?? []) {
    const subject = String(course.subject ?? "").toUpperCase().trim();
    const number = String(course.number ?? "").toUpperCase().trim();
    const code = normalizeCourseCode(subject, number);
    codeToId.set(code, Number(course.id));
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
