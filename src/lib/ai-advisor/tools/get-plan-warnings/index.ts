import type { AdvisorToolDependencies } from "../shared/dependencies";

export type GetPlanWarningsInput = {
  planId?: number | null;
  maxCredits?: number;
};

export const GET_PLAN_WARNINGS_DEFINITION = {
  name: "get_plan_warnings",
  description:
    "Return a quick list of structural warnings for the active plan: overloaded terms and courses still in past terms. Lighter-weight than validate_plan — no prereq analysis. Use for ambient status checks.",
  input_schema: {
    type: "object" as const,
    properties: {
      planId: { type: "integer" as const, description: "Plan ID (defaults to active plan)" },
      maxCredits: { type: "integer" as const, description: "Credit threshold to flag as overloaded (default 18)" },
    },
  },
} as const;

export function createGetPlanWarningsTool(deps: AdvisorToolDependencies) {
  return async function (input?: GetPlanWarningsInput) {
    const planId = input?.planId ?? null;
    const maxCredits = Math.max(1, Number(input?.maxCredits ?? 18));

    const snapshot = await deps.getPlanSnapshot(planId);
    const warnings: Array<{ type: string; severity: "error" | "warning"; message: string }> = [];

    if (!snapshot) {
      return { warnings: [{ type: "no_plan", severity: "warning" as const, message: "No plan found." }], totalWarnings: 1 };
    }

    const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
    const termKey = (season: string, year: number) => year * 10 + (SEASON_ORDER[season] ?? 0);
    const now = new Date();
    const month = now.getMonth() + 1;
    const currentSeason = month <= 5 ? "Spring" : month <= 7 ? "Summer" : "Fall";
    const currentKey = termKey(currentSeason, now.getFullYear());

    for (const term of snapshot.terms) {
      const key = termKey(term.season, term.year);
      const termCourses = snapshot.plannedCourses.filter((c) => c.termId === term.id);
      const totalCredits = termCourses.reduce((s, c) => s + c.credits, 0);

      if (totalCredits > maxCredits) {
        warnings.push({
          type: "credit_overload",
          severity: "warning",
          message: `${term.season} ${term.year} has ${totalCredits} credits (max ${maxCredits}).`,
        });
      }

      if (key < currentKey && termCourses.length > 0) {
        warnings.push({
          type: "past_due_term",
          severity: "warning",
          message: `${term.season} ${term.year} is in the past but still has ${termCourses.length} planned course(s).`,
        });
      }
    }

    return { warnings, totalWarnings: warnings.length };
  };
}
