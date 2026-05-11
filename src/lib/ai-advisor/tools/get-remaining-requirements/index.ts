import type { AdvisorToolDependencies } from "../shared/dependencies";

export type GetRemainingRequirementsInput = {
  planId?: number | null;
  limit?: number;
};

export const GET_REMAINING_REQUIREMENTS_DEFINITION = {
  name: "get_remaining_requirements",
  description: "Get remaining requirement courses grouped by block.",
  input_schema: {
    type: "object" as const,
    properties: {
      planId: { type: "integer" as const, description: "Plan ID" },
      limit: { type: "integer" as const, description: "Max courses to return" },
    },
  },
} as const;

export function createGetRemainingRequirementsTool(deps: AdvisorToolDependencies) {
  return async function (input?: GetRemainingRequirementsInput) {
    return deps.getRemainingRequirements(input?.planId ?? null, input?.limit ?? 25);
  };
}
