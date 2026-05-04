import type { AdvisorToolDependencies } from "../shared/dependencies";

export type CheckGraduationReadinessInput = {
  planId?: number | null;
  targetGradSemester?: string | null;
  targetGradYear?: number | null;
};

export const CHECK_GRADUATION_READINESS_DEFINITION = {
  name: "check_graduation_readiness",
  description:
    "Check whether the student is on track to graduate. Compares remaining required credits against credits already scheduled in future terms. Use when the student asks if they are on track or when to graduate.",
  input_schema: {
    type: "object" as const,
    properties: {
      planId: { type: "integer" as const, description: "Plan ID to evaluate (defaults to active plan)" },
      targetGradSemester: {
        type: "string" as const,
        enum: ["Fall", "Spring", "Summer"] as const,
        description: "Override target graduation season",
      },
      targetGradYear: { type: "integer" as const, description: "Override target graduation year" },
    },
  },
} as const;

export function createCheckGraduationReadinessTool(deps: AdvisorToolDependencies) {
  return async function (input?: CheckGraduationReadinessInput) {
    const planId = input?.planId ?? null;

    const [progress, snapshot, profile] = await Promise.all([
      deps.getDegreeProgress(planId),
      deps.getPlanSnapshot(planId),
      deps.getStudentProfile(),
    ]);

    const remaining = progress.overall.remainingCredits;

    // Determine current term from today's date.
    const now = new Date();
    const month = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentSeason = month <= 5 ? "Spring" : month <= 7 ? "Summer" : "Fall";

    const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
    const termKey = (season: string, year: number) =>
      year * 10 + (SEASON_ORDER[season] ?? 0);
    const currentKey = termKey(currentSeason, currentYear);

    // Sum planned credits in the current and future terms.
    const terms = snapshot?.terms ?? [];
    const plannedCourses = snapshot?.plannedCourses ?? [];

    let futurePlannedCredits = 0;
    let lastPlannedTerm: string | null = null;
    let lastPlannedKey = -1;

    for (const term of terms) {
      const key = termKey(term.season, term.year);
      if (key < currentKey) continue;
      const credits = plannedCourses
        .filter((c) => c.termId === term.id)
        .reduce((s, c) => s + c.credits, 0);
      futurePlannedCredits += credits;
      if (credits > 0 && key > lastPlannedKey) {
        lastPlannedKey = key;
        lastPlannedTerm = `${term.season} ${term.year}`;
      }
    }

    const creditDeficit = Math.max(0, remaining - futurePlannedCredits);
    const onTrack = creditDeficit === 0;

    // Resolve target graduation (input override > profile default).
    const targetSeason = input?.targetGradSemester ?? null;
    const targetYear = input?.targetGradYear ?? null;
    let targetKey: number | null = null;
    if (targetSeason && targetYear) {
      targetKey = termKey(targetSeason, Number(targetYear));
    }

    const risks: string[] = [];

    if (!onTrack) {
      risks.push(`${creditDeficit} credit(s) are not yet scheduled in any future term.`);
    }

    if (targetKey !== null && lastPlannedKey > targetKey) {
      risks.push(`Last planned term (${lastPlannedTerm}) is after the target graduation of ${targetSeason} ${targetYear}.`);
    }

    if (progress.overall.percentage < 50 && terms.length === 0) {
      risks.push("No terms have been added to this plan yet.");
    }

    return {
      onTrack,
      remainingCredits: remaining,
      futurePlannedCredits,
      creditDeficit,
      expectedGraduation: profile.expectedGraduation,
      lastPlannedTerm,
      risks,
    };
  };
}
