import type { AdvisorToolDependencies } from "../shared/dependencies";

export type ClearPlanTermInput = {
  planId: number;
  season: string;
  year: number;
};

export const CLEAR_PLAN_TERM_DEFINITION = {
  name: "clear_plan_term",
  description:
    "Remove all courses from a specific term in a plan at once. Use when the student wants to clear out a semester and start over. Confirm before calling — this removes all planned courses for that term.",
  input_schema: {
    type: "object" as const,
    required: ["planId", "season", "year"] as const,
    properties: {
      planId: { type: "integer" as const, description: "The plan ID" },
      season: {
        type: "string" as const,
        enum: ["Fall", "Spring", "Summer"] as const,
        description: "Season of the term to clear",
      },
      year: { type: "integer" as const, description: "4-digit year of the term to clear, e.g. 2026" },
    },
  },
} as const;

export function createClearPlanTermTool(deps: AdvisorToolDependencies) {
  return async function (input: ClearPlanTermInput) {
    const season = input.season;
    const year = Number(input.year);

    const validSeasons = ["Fall", "Spring", "Summer"];
    if (!validSeasons.includes(season)) {
      return { success: false, season, year, coursesRemoved: 0, error: `Invalid season "${season}".` };
    }
    if (!Number.isFinite(year) || year < 2020 || year > 2040) {
      return { success: false, season, year, coursesRemoved: 0, error: `Invalid year: ${year}.` };
    }

    try {
      const { coursesRemoved } = await deps.clearPlanTerm(input.planId, season, year);
      return { success: true, season, year, coursesRemoved };
    } catch (err) {
      return {
        success: false,
        season,
        year,
        coursesRemoved: 0,
        error: err instanceof Error ? err.message : "Failed to clear term.",
      };
    }
  };
}
