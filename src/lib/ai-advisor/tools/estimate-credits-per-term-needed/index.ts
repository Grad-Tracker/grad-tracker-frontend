import type { AdvisorToolDependencies } from "../shared/dependencies";

export type EstimateCreditsPerTermNeededInput = {
  planId?: number | null;
  targetSeason?: string;
  targetYear?: number;
};

export const ESTIMATE_CREDITS_PER_TERM_NEEDED_DEFINITION = {
  name: "estimate_credits_per_term_needed",
  description:
    "Given a target graduation term, compute how many credits per remaining semester the student needs to average to finish on time. Alerts if the required pace exceeds 18 credits/term.",
  input_schema: {
    type: "object" as const,
    properties: {
      planId: { type: "integer" as const, description: "Plan ID (defaults to active plan)" },
      targetSeason: { type: "string" as const, enum: ["Fall", "Spring", "Summer"] as const, description: "Target graduation season" },
      targetYear: { type: "integer" as const, description: "Target graduation year" },
    },
  },
} as const;

export function createEstimateCreditsPerTermNeededTool(deps: AdvisorToolDependencies) {
  return async function (input?: EstimateCreditsPerTermNeededInput) {
    const planId = input?.planId ?? null;
    const [progress, snapshot] = await Promise.all([
      deps.getDegreeProgress(planId),
      deps.getPlanSnapshot(planId),
    ]);

    const remaining = progress.overall.remainingCredits;

    const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
    const termKey = (season: string, year: number) => year * 10 + (SEASON_ORDER[season] ?? 0);
    const now = new Date();
    const month = now.getMonth() + 1;
    const currentSeason = month <= 5 ? "Spring" : month <= 7 ? "Summer" : "Fall";
    const currentKey = termKey(currentSeason, now.getFullYear());

    const terms = snapshot?.terms ?? [];
    const plannedCourses = snapshot?.plannedCourses ?? [];
    let scheduledFuture = 0;

    for (const term of terms) {
      const key = termKey(term.season, term.year);
      if (key < currentKey) continue;
      const credits = plannedCourses.filter((c) => c.termId === term.id).reduce((s, c) => s + c.credits, 0);
      scheduledFuture += credits;
    }

    const creditsStillNeeded = Math.max(0, remaining - scheduledFuture);

    let targetTerm: string | null = null;
    let remainingTermsToTarget: number | null = null;
    let creditsPerTermNeeded: number | null = null;

    if (input?.targetSeason && input?.targetYear) {
      const targetKey = termKey(input.targetSeason, Number(input.targetYear));
      targetTerm = `${input.targetSeason} ${input.targetYear}`;
      remainingTermsToTarget = Math.max(
        0,
        terms.filter((t) => {
          const k = termKey(t.season, t.year);
          return k >= currentKey && k <= targetKey;
        }).length
      );
      creditsPerTermNeeded = remainingTermsToTarget > 0
        ? Math.ceil(creditsStillNeeded / remainingTermsToTarget)
        : null;
    }

    const warnings: string[] = [];
    if (creditsPerTermNeeded != null && creditsPerTermNeeded > 18) {
      warnings.push(`Requires ${creditsPerTermNeeded} credits/term — above the recommended max of 18.`);
    }
    if (creditsStillNeeded === 0) {
      warnings.push("All remaining credits already appear to be scheduled.");
    }

    return {
      remainingCredits: remaining,
      alreadyScheduledCredits: scheduledFuture,
      creditsStillNeeded,
      remainingTerms: remainingTermsToTarget,
      creditsPerTermNeeded,
      targetTerm,
      realistic: creditsPerTermNeeded == null || creditsPerTermNeeded <= 18,
      warnings,
    };
  };
}
