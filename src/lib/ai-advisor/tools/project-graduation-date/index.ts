import type { AdvisorToolDependencies } from "../shared/dependencies";

export type ProjectGraduationDateInput = {
  planId?: number | null;
  creditsPerTerm?: number;
  startSeason?: string;
  startYear?: number;
};

export const PROJECT_GRADUATION_DATE_DEFINITION = {
  name: "project_graduation_date",
  description:
    "Estimate when the student will finish all degree requirements based on how many credits they plan to take per term. Accounts for already-scheduled credits in the plan and projects forward to fill the remaining gap. Use when the student asks 'when will I graduate?' or 'how long will it take to finish?'.",
  input_schema: {
    type: "object" as const,
    properties: {
      planId: { type: "integer" as const, description: "Plan ID to use for already-scheduled credits (defaults to active plan)" },
      creditsPerTerm: { type: "number" as const, description: "Credits per term to assume for unscheduled remaining credits (default 15)" },
      startSeason: {
        type: "string" as const,
        enum: ["Fall", "Spring", "Summer"] as const,
        description: "Override the starting season for the projection (defaults to last planned term or current term)",
      },
      startYear: { type: "integer" as const, description: "Override the starting year for the projection" },
    },
  },
} as const;

export function createProjectGraduationDateTool(deps: AdvisorToolDependencies) {
  return async function (input?: ProjectGraduationDateInput) {
    const planId = input?.planId ?? null;
    const creditsPerTerm = Math.max(1, Math.min(Number(input?.creditsPerTerm ?? 15), 21));

    const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
    const SEASON_NAMES = ["Spring", "Summer", "Fall"] as const;
    const termKey = (season: string, year: number) => year * 10 + (SEASON_ORDER[season] ?? 0);

    const now = new Date();
    const month = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentSeason = month <= 5 ? "Spring" : month <= 7 ? "Summer" : "Fall";
    const currentKey = termKey(currentSeason, currentYear);

    const [progress, snapshot] = await Promise.all([
      deps.getDegreeProgress(planId),
      deps.getPlanSnapshot(planId),
    ]);

    const remainingCredits = progress.overall.remainingCredits;

    // Sum future scheduled credits.
    const terms = snapshot?.terms ?? [];
    const plannedCourses = snapshot?.plannedCourses ?? [];
    let alreadyScheduledCredits = 0;
    let lastTermKey = currentKey;
    let lastSeason = currentSeason;
    let lastYear = currentYear;

    for (const term of terms) {
      const key = termKey(term.season, term.year);
      if (key < currentKey) continue;
      const credits = plannedCourses
        .filter((c) => c.termId === term.id)
        .reduce((s, c) => s + c.credits, 0);
      if (credits > 0) {
        alreadyScheduledCredits += credits;
        if (key > lastTermKey) {
          lastTermKey = key;
          lastSeason = term.season;
          lastYear = term.year;
        }
      }
    }

    const creditsStillNeeded = Math.max(0, remainingCredits - alreadyScheduledCredits);
    const termsNeeded = creditsStillNeeded > 0 ? Math.ceil(creditsStillNeeded / creditsPerTerm) : 0;

    // Advance from the last planned term (or start term input / current term).
    let projSeason = input?.startSeason ?? lastSeason;
    let projYear = input?.startYear ?? lastYear;

    // If still-needed credits > 0, project forward from last planned (or current) term.
    if (termsNeeded > 0) {
      let seasonIdx = SEASON_ORDER[projSeason] ?? 0;
      for (let t = 0; t < termsNeeded; t++) {
        seasonIdx += 1;
        if (seasonIdx > 2) { seasonIdx = 0; projYear += 1; }
      }
      projSeason = SEASON_NAMES[seasonIdx] ?? "Fall";
    }

    const warnings: string[] = [];
    if (creditsPerTerm > 18) warnings.push("A credits-per-term value above 18 may be unrealistic.");
    if (remainingCredits === 0) warnings.push("No remaining credits — you may already be done.");
    if (termsNeeded > 12) warnings.push("Projection spans more than 4 years; consider increasing credits per term.");

    return {
      projectedSeason: projSeason,
      projectedYear: projYear,
      remainingCredits,
      alreadyScheduledCredits,
      creditsStillNeeded,
      termsNeeded,
      creditsPerTerm,
      warnings,
    };
  };
}
