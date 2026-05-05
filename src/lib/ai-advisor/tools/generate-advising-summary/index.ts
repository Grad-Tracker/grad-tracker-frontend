import type { AdvisorToolDependencies } from "../shared/dependencies";

export type GenerateAdvisingSummaryInput = {
  planId?: number | null;
};

export const GENERATE_ADVISING_SUMMARY_DEFINITION = {
  name: "generate_advising_summary",
  description:
    "Produce a structured summary of the student's academic situation: overall progress, plan issues, upcoming requirements, and open questions for their advisor. Use before an advising appointment or when the student wants a full status overview.",
  input_schema: {
    type: "object" as const,
    properties: {
      planId: { type: "integer" as const, description: "Plan ID to summarize. Omit to use the active plan." },
    },
  },
} as const;

export function createGenerateAdvisingSummaryTool(deps: AdvisorToolDependencies) {
  return async function (input?: GenerateAdvisingSummaryInput) {
    const planId = input?.planId ?? null;

    const [profile, progress, remaining, snapshot] = await Promise.all([
      deps.getStudentProfile(),
      deps.getDegreeProgress(planId),
      deps.getRemainingRequirements(planId, 10),
      deps.getPlanSnapshot(planId),
    ]);

    // Plan issues via lightweight validation.
    const planIssues: Array<{ type: string; message: string }> = [];
    const MAX_CREDITS = 18;
    const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
    const terms = snapshot?.terms ?? [];
    const plannedCourses = snapshot?.plannedCourses ?? [];

    // Check credit overloads.
    for (const term of terms) {
      const termCredits = plannedCourses.filter((c) => c.termId === term.id).reduce((s, c) => s + c.credits, 0);
      if (termCredits > MAX_CREDITS) {
        planIssues.push({ type: "credit_overload", message: `${term.season} ${term.year} has ${termCredits} credits (over the ${MAX_CREDITS}-credit limit).` });
      }
    }

    // Check past-due terms.
    const now = new Date();
    const currentKey = now.getFullYear() * 10 + (SEASON_ORDER[now.getMonth() + 1 <= 5 ? "Spring" : now.getMonth() + 1 <= 7 ? "Summer" : "Fall"] ?? 0);
    for (const term of terms) {
      const termKey = term.year * 10 + (SEASON_ORDER[term.season] ?? 0);
      if (termKey < currentKey && plannedCourses.some((c) => c.termId === term.id && c.status === "planned")) {
        planIssues.push({ type: "past_due_term", message: `${term.season} ${term.year} is in the past but still has planned (not completed) courses.` });
      }
    }

    // Upcoming requirements (blocks with remaining courses).
    const upcomingRequirements = remaining.blocks.slice(0, 5).map((block) => ({
      blockName: block.blockName,
      courses: block.remainingCourses.slice(0, 4).map((c) => `${c.courseCode} — ${c.title}`),
    }));

    // Plan gaps (blocks with no courses in the plan at all).
    const plannedIds = new Set(plannedCourses.map((c) => c.courseId));
    const planGaps = remaining.blocks
      .filter((block) => block.remainingCourses.every((c) => !plannedIds.has(c.id)))
      .map((block) => block.blockName)
      .slice(0, 5);

    // Open questions to raise with advisor.
    const openQuestions: string[] = [];
    if (planIssues.length > 0) openQuestions.push(`There are ${planIssues.length} plan issue(s) to review.`);
    if (planGaps.length > 0) openQuestions.push(`${planGaps.length} requirement block(s) have no courses planned.`);
    if (progress.overall.remainingCredits > 0 && terms.length === 0) openQuestions.push("No terms have been planned yet — when do you plan to start?");

    return {
      studentName: profile.fullName,
      programs: profile.programs.map((p) => `${p.name} (${p.programType})`),
      overallProgress: {
        completedCredits: progress.overall.completedCredits,
        remainingCredits: progress.overall.remainingCredits,
        percentage: progress.overall.percentage,
      },
      planIssues,
      upcomingRequirements,
      planGaps,
      openQuestions,
    };
  };
}
