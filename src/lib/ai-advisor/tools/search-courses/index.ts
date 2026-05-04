import type { AdvisorToolDependencies } from "../shared/dependencies";

export type SearchCoursesInput = {
  query: string;
  subject?: string;
  limit?: number;
};

export const SEARCH_COURSES_DEFINITION = {
  name: "search_courses",
  description:
    "Search the course catalog by keyword, title, or subject code. Use when the student asks about available courses or you need to discover courses before recommending them.",
  input_schema: {
    type: "object" as const,
    required: ["query"] as const,
    properties: {
      query: { type: "string" as const, description: "Search text — matches course title, subject code, or course number" },
      subject: { type: "string" as const, description: 'Optional subject filter, e.g. "CSCI" or "MATH"' },
      limit: { type: "integer" as const, description: "Max results to return (default 15, max 25)" },
    },
  },
} as const;

export function createSearchCoursesTool(deps: AdvisorToolDependencies) {
  return async function (input: SearchCoursesInput) {
    const results = await deps.searchCourses(
      input.query ?? "",
      input.subject ?? null,
      input.limit ?? 15
    );
    return { results, total: results.length };
  };
}
