import type { AdvisorToolDependencies } from "../shared/dependencies";

export type DuplicatePlanInput = {
  sourcePlanId: number;
  newName: string;
};

export const DUPLICATE_PLAN_DEFINITION = {
  name: "duplicate_plan",
  description:
    "Copy an existing graduation plan (all terms and courses) into a new plan with a given name. Enables what-if branching — the original plan is not modified. Use when the student wants to try an alternate course sequence without losing their current plan.",
  input_schema: {
    type: "object" as const,
    required: ["sourcePlanId", "newName"] as const,
    properties: {
      sourcePlanId: { type: "integer" as const, description: "Plan ID to copy" },
      newName: { type: "string" as const, description: "Name for the new duplicate plan" },
    },
  },
} as const;

export function createDuplicatePlanTool(deps: AdvisorToolDependencies) {
  return async function (input: DuplicatePlanInput) {
    const newName = (input.newName ?? "").trim().slice(0, 100) || "Copy";
    try {
      const { planId, coursesCloned } = await deps.duplicatePlan(input.sourcePlanId, newName);
      return { success: true, newPlanId: planId, newName, coursesCloned };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Failed to duplicate plan." };
    }
  };
}
