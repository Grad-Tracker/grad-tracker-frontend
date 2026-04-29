import type { AdvisorToolDependencies } from "../shared/dependencies";

export const LIST_PLANS_DEFINITION = {
  name: "list_plans",
  description:
    "List all of the student's graduation plans with name, total planned credits, and last updated date. Use when the student asks what plans they have, or before operations that need a plan ID.",
  input_schema: { type: "object" as const, properties: {} },
} as const;

export function createListPlansTool(deps: AdvisorToolDependencies) {
  return async function () {
    return deps.listPlans();
  };
}
