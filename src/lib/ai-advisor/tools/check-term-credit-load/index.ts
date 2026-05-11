import type { AdvisorToolDependencies } from "../shared/dependencies";

export type CheckTermCreditLoadInput = {
  planId?: number | null;
  season?: string;
  year?: number;
  maxCredits?: number;
};

export const CHECK_TERM_CREDIT_LOAD_DEFINITION = {
  name: "check_term_credit_load",
  description:
    "Return the total planned credits for each term in the active plan and flag terms over a configurable limit (default 18). Optionally filter to a single term. Use when the student asks how many credits they have planned in a specific semester, or when checking if a term is overloaded.",
  input_schema: {
    type: "object" as const,
    properties: {
      planId: { type: "integer" as const, description: "Plan ID (defaults to active plan)" },
      season: { type: "string" as const, enum: ["Fall", "Spring", "Summer"] as const, description: "Filter to a specific season" },
      year: { type: "integer" as const, description: "Filter to a specific year" },
      maxCredits: { type: "integer" as const, description: "Credit threshold for overload flag (default 18)" },
    },
  },
} as const;

export function createCheckTermCreditLoadTool(deps: AdvisorToolDependencies) {
  return async function (input?: CheckTermCreditLoadInput) {
    const planId = input?.planId ?? null;
    const maxCredits = Math.max(1, Number(input?.maxCredits ?? 18));
    const filterSeason = input?.season ?? null;
    const filterYear = input?.year != null ? Number(input.year) : null;

    const snapshot = await deps.getPlanSnapshot(planId);
    const terms = snapshot?.terms ?? [];
    const plannedCourses = snapshot?.plannedCourses ?? [];

    const result: Array<{
      season: string;
      year: number;
      totalCredits: number;
      courseCount: number;
      overloaded: boolean;
      courses: Array<{ courseCode: string; credits: number }>;
    }> = [];

    for (const term of terms) {
      if (filterSeason && term.season !== filterSeason) continue;
      if (filterYear != null && term.year !== filterYear) continue;

      const termCourses = plannedCourses.filter((c) => c.termId === term.id);
      const totalCredits = termCourses.reduce((s, c) => s + c.credits, 0);

      result.push({
        season: term.season,
        year: term.year,
        totalCredits,
        courseCount: termCourses.length,
        overloaded: totalCredits > maxCredits,
        courses: termCourses.map((c) => ({ courseCode: c.courseCode, credits: c.credits })),
      });
    }

    result.sort((a, b) => {
      const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
      return (a.year * 10 + (SEASON_ORDER[a.season] ?? 0)) - (b.year * 10 + (SEASON_ORDER[b.season] ?? 0));
    });

    return {
      terms: result,
      maxCredits,
      overloadedTerms: result.filter((t) => t.overloaded).length,
    };
  };
}
