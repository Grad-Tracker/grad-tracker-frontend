import type { AdvisorToolDependencies } from "../shared/dependencies";

export type GetPlanSnapshotInput = {
  planId?: number | null;
};

export const GET_PLAN_SNAPSHOT_DEFINITION = {
  name: "get_plan_snapshot",
  description: "Get active plan terms, planned courses, and total planned credits.",
  input_schema: {
    type: "object" as const,
    properties: { planId: { type: "integer" as const, description: "Plan ID" } },
  },
} as const;

export function createGetPlanSnapshotTool(deps: AdvisorToolDependencies) {
  return async function (input?: GetPlanSnapshotInput) {
    return deps.getPlanSnapshot(input?.planId ?? null);
  };
}
