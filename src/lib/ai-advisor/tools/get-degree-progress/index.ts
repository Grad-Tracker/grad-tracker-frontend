import type { AdvisorToolDependencies } from "../shared/dependencies";

export type GetDegreeProgressInput = {
  planId?: number | null;
};

export const GET_DEGREE_PROGRESS_DEFINITION = {
  name: "get_degree_progress",
  description: "Get degree progress by requirement block and overall completion metrics.",
  input_schema: {
    type: "object" as const,
    properties: { planId: { type: "integer" as const, description: "Plan ID" } },
  },
} as const;

export function createGetDegreeProgressTool(deps: AdvisorToolDependencies) {
  return async function (input?: GetDegreeProgressInput) {
    return deps.getDegreeProgress(input?.planId ?? null);
  };
}
