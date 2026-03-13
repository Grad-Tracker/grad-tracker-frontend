import { createAdminClient } from "@/lib/supabase/admin";
import { DB_TABLES } from "@/lib/supabase/queries/schema";
import type { Course } from "@/types/course";
import type { PlannedCourseWithDetails, Term } from "@/types/planner";
import type {
  ComparablePlanDetail,
  OwnPlanSummary,
  SharedPlanDetail,
  SharedPlanSummary,
} from "@/types/shared-plan";

const PLAN_SHARES_TABLE = "plan_shares";

function isActiveShare(share: { is_active?: boolean | null; expires_at?: string | null }) {
  if (share.is_active === false) {
    return false;
  }

  if (share.expires_at) {
    return new Date(share.expires_at).getTime() > Date.now();
  }

  return true;
}

function mapPlannedCourses(rows: any[] | null | undefined): PlannedCourseWithDetails[] {
  return (rows ?? []).map((row: any) => ({
    student_id: row.student_id,
    term_id: row.term_id,
    course_id: row.course_id,
    status: row.status,
    plan_id: row.plan_id,
    course: row.courses as Course,
  }));
}

function normalizeFirstName(value: string | null | undefined) {
  return value?.trim() || "Student";
}

async function fetchComparablePlanDetail(
  supabase: any,
  planId: number,
  ownerLabel: string
): Promise<(ComparablePlanDetail & { studentId: number }) | null> {
  const { data: plan, error: planError } = await supabase
    .from(DB_TABLES.plans)
    .select("id, student_id, name, description")
    .eq("id", planId)
    .maybeSingle();

  if (planError || !plan) {
    return null;
  }

  const [programRes, termsRes, coursesRes, completedRes] = await Promise.all([
    supabase
      .from(DB_TABLES.planPrograms)
      .select("plan_id, programs:program_id (name)")
      .eq("plan_id", plan.id),
    supabase
      .from(DB_TABLES.studentTermPlan)
      .select("term_id, terms:term_id (id, season, year)")
      .eq("plan_id", plan.id),
    supabase
      .from(DB_TABLES.studentPlannedCourses)
      .select(
        `
          student_id,
          term_id,
          course_id,
          status,
          plan_id,
          courses:course_id (id, subject, number, title, credits)
        `
      )
      .eq("plan_id", plan.id),
    supabase
      .from(DB_TABLES.studentCourseHistory)
      .select("courses:course_id (credits)")
      .eq("student_id", plan.student_id),
  ]);

  const programNames = (programRes.data ?? [])
    .map((row: any) => row.programs?.name)
    .filter((name: string | undefined): name is string => Boolean(name));

  const terms = (termsRes.data ?? [])
    .map((row: any) => row.terms as Term)
    .filter(Boolean);

  const plannedCourses = mapPlannedCourses(coursesRes.data);
  const totalPlannedCredits = plannedCourses.reduce(
    (sum, item) => sum + (item.course?.credits ?? 0),
    0
  );
  const completedCredits = (completedRes.data ?? []).reduce((sum: number, row: any) => {
    return sum + Number(row.courses?.credits ?? 0);
  }, 0);

  return {
    planId: plan.id,
    planName: plan.name,
    description: plan.description,
    ownerLabel,
    studentId: plan.student_id,
    programNames,
    terms,
    plannedCourses,
    totalPlannedCredits,
    completedCredits,
  };
}

export async function fetchSharedPlanByToken(
  shareToken: string
): Promise<SharedPlanDetail | null> {
  const supabase = createAdminClient();

  if (!supabase || !shareToken) {
    return null;
  }

  try {
    const { data: share, error: shareError } = await supabase
      .from(PLAN_SHARES_TABLE)
      .select("plan_id, share_token, is_active, expires_at")
      .eq("share_token", shareToken)
      .maybeSingle();

    if (shareError || !share || !isActiveShare(share)) {
      return null;
    }

    const comparable = await fetchComparablePlanDetail(
      supabase,
      share.plan_id,
      "Shared plan"
    );

    if (!comparable) {
      return null;
    }

    const studentRes = await supabase
      .from(DB_TABLES.students)
      .select("id, first_name")
      .eq("id", comparable.studentId)
      .maybeSingle();

    const { studentId: _studentId, ...sharedComparable } = comparable;

    return {
      ...sharedComparable,
      shareToken: share.share_token,
      studentFirstName: normalizeFirstName(studentRes.data?.first_name),
      expiresAt: share.expires_at ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchStudentPlanSummariesForUser(
  supabase: any,
  authUserId: string
): Promise<OwnPlanSummary[]> {
  const { data: student } = await supabase
    .from(DB_TABLES.students)
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!student) {
    return [];
  }

  const { data: plans, error } = await supabase
    .from(DB_TABLES.plans)
    .select("id, name, description")
    .eq("student_id", student.id)
    .order("updated_at", { ascending: false });

  if (error || !plans?.length) {
    return [];
  }

  const planIds = plans.map((plan: any) => plan.id);

  const [programsRes, termsRes, coursesRes] = await Promise.all([
    supabase
      .from(DB_TABLES.planPrograms)
      .select("plan_id, programs:program_id (name)")
      .in("plan_id", planIds),
    supabase
      .from(DB_TABLES.studentTermPlan)
      .select("plan_id")
      .in("plan_id", planIds),
    supabase
      .from(DB_TABLES.studentPlannedCourses)
      .select("plan_id, courses:course_id (credits)")
      .in("plan_id", planIds),
  ]);

  return plans.map((plan: any) => ({
    planId: plan.id,
    planName: plan.name,
    description: plan.description,
    programNames: (programsRes.data ?? [])
      .filter((row: any) => row.plan_id === plan.id)
      .map((row: any) => row.programs?.name)
      .filter((name: string | undefined): name is string => Boolean(name)),
    totalPlannedCredits: (coursesRes.data ?? [])
      .filter((row: any) => row.plan_id === plan.id)
      .reduce((sum: number, row: any) => sum + Number(row.courses?.credits ?? 0), 0),
    termCount: (termsRes.data ?? []).filter((row: any) => row.plan_id === plan.id).length,
  }));
}

export async function fetchOwnedPlanForUser(
  supabase: any,
  authUserId: string,
  planId: number
): Promise<ComparablePlanDetail | null> {
  const { data: student } = await supabase
    .from(DB_TABLES.students)
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!student) {
    return null;
  }

  const { data: plan } = await supabase
    .from(DB_TABLES.plans)
    .select("id")
    .eq("id", planId)
    .eq("student_id", student.id)
    .maybeSingle();

  if (!plan) {
    return null;
  }

  const ownPlan = await fetchComparablePlanDetail(supabase, plan.id, "My plan");
  if (!ownPlan) {
    return null;
  }

  const { studentId: _studentId, ...comparable } = ownPlan;
  return comparable;
}

export async function fetchPublicSharedPlans(limit = 24): Promise<SharedPlanSummary[]> {
  const supabase = createAdminClient();

  if (!supabase) {
    return [];
  }

  try {
    const { data: shares, error: sharesError } = await supabase
      .from(PLAN_SHARES_TABLE)
      .select("plan_id, share_token, is_active, expires_at, updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (sharesError || !shares?.length) {
      return [];
    }

    const activeShares = shares.filter(isActiveShare);
    if (activeShares.length === 0) {
      return [];
    }

    const planIds = activeShares.map((share: any) => share.plan_id);

    const [plansRes, programsRes, termsRes, coursesRes, studentsRes] = await Promise.all([
      supabase
        .from(DB_TABLES.plans)
        .select("id, student_id, name, description, updated_at")
        .in("id", planIds),
      supabase
        .from(DB_TABLES.planPrograms)
        .select("plan_id, programs:program_id (name)")
        .in("plan_id", planIds),
      supabase
        .from(DB_TABLES.studentTermPlan)
        .select("plan_id")
        .in("plan_id", planIds),
      supabase
        .from(DB_TABLES.studentPlannedCourses)
        .select("plan_id, courses:course_id (credits)")
        .in("plan_id", planIds),
      supabase.from(DB_TABLES.students).select("id, first_name"),
    ]);

    if (plansRes.error) {
      return [];
    }

    const studentsById = new Map<number, string>(
      (studentsRes.data ?? []).map((student: any) => [
        student.id,
        normalizeFirstName(student.first_name),
      ])
    );

    return activeShares
      .map((share: any) => {
        const plan = (plansRes.data ?? []).find((item: any) => item.id === share.plan_id);
        if (!plan) {
          return null;
        }

        const programNames = (programsRes.data ?? [])
          .filter((row: any) => row.plan_id === plan.id)
          .map((row: any) => row.programs?.name)
          .filter((name: string | undefined): name is string => Boolean(name));

        const termCount = (termsRes.data ?? []).filter((row: any) => row.plan_id === plan.id).length;
        const totalPlannedCredits = (coursesRes.data ?? [])
          .filter((row: any) => row.plan_id === plan.id)
          .reduce((sum: number, row: any) => sum + Number(row.courses?.credits ?? 0), 0);

        return {
          shareToken: share.share_token,
          planId: plan.id,
          planName: plan.name,
          description: plan.description,
          studentFirstName: studentsById.get(plan.student_id) ?? "Student",
          programNames,
          termCount,
          totalPlannedCredits,
          updatedAt: share.updated_at ?? plan.updated_at ?? null,
        } satisfies SharedPlanSummary;
      })
      .filter((item): item is SharedPlanSummary => item !== null);
  } catch {
    return [];
  }
}
