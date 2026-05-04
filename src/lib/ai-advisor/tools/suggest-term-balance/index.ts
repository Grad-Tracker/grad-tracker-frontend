import type { AdvisorToolDependencies } from "../shared/dependencies";

export type SuggestTermBalanceInput = {
  planId?: number | null;
  /** Deviation threshold (fraction of average) before a term is flagged. Default 0.4 (40%). */
  threshold?: number;
};

export const SUGGEST_TERM_BALANCE_DEFINITION = {
  name: "suggest_term_balance",
  description:
    "Analyze all terms in a plan and flag outliers — terms with significantly more or fewer credits than the student's average planned load. Returns suggestions for which terms to rebalance.",
  input_schema: {
    type: "object" as const,
    properties: {
      planId: { type: "integer" as const, description: "Plan ID to analyze. Omit to use the active plan." },
      threshold: { type: "number" as const, description: "Fraction deviation from average before a term is flagged. Default 0.4 (40%)." },
    },
  },
} as const;

export function createSuggestTermBalanceTool(deps: AdvisorToolDependencies) {
  return async function (input?: SuggestTermBalanceInput) {
    const planId = input?.planId ?? null;
    const threshold = Math.max(0.05, Math.min(Number(input?.threshold ?? 0.4), 1.0));

    const snapshot = await deps.getPlanSnapshot(planId);
    const terms = snapshot?.terms ?? [];
    const plannedCourses = snapshot?.plannedCourses ?? [];

    if (terms.length === 0) {
      return { averageCredits: 0, terms: [], outlierTerms: 0, suggestions: ["No terms in the plan yet."] };
    }

    // Tally credits per term.
    const creditsByTerm = new Map<number, number>();
    for (const t of terms) creditsByTerm.set(t.id, 0);
    for (const pc of plannedCourses) {
      if (pc.termId == null) continue;
      creditsByTerm.set(pc.termId, (creditsByTerm.get(pc.termId) ?? 0) + pc.credits);
    }

    const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
    const sortedTerms = [...terms].sort(
      (a, b) => a.year * 10 + (SEASON_ORDER[a.season] ?? 0) - (b.year * 10 + (SEASON_ORDER[b.season] ?? 0))
    );

    const creditValues = sortedTerms.map((t) => creditsByTerm.get(t.id) ?? 0);
    const totalCredits = creditValues.reduce((a, b) => a + b, 0);
    const averageCredits = totalCredits / sortedTerms.length;

    const termResults = sortedTerms.map((t, i) => {
      const tc = creditValues[i] ?? 0;
      const deviation = averageCredits > 0 ? (tc - averageCredits) / averageCredits : 0;
      let status: "balanced" | "overloaded" | "underloaded" = "balanced";
      if (deviation > threshold) status = "overloaded";
      else if (deviation < -threshold) status = "underloaded";
      return { season: t.season, year: t.year, totalCredits: tc, status, deviation: Math.round(deviation * 100) / 100 };
    });

    const outliers = termResults.filter((t) => t.status !== "balanced");

    const suggestions: string[] = [];
    for (const t of termResults) {
      if (t.status === "overloaded") {
        suggestions.push(`${t.season} ${t.year} has ${t.totalCredits} credits (${Math.round(t.deviation * 100)}% above average). Consider moving a course to a lighter term.`);
      } else if (t.status === "underloaded") {
        suggestions.push(`${t.season} ${t.year} has ${t.totalCredits} credits (${Math.round(Math.abs(t.deviation) * 100)}% below average). Consider adding a course here.`);
      }
    }
    if (suggestions.length === 0) suggestions.push("Term credit loads look balanced.");

    return {
      averageCredits: Math.round(averageCredits * 10) / 10,
      terms: termResults,
      outlierTerms: outliers.length,
      suggestions,
    };
  };
}
