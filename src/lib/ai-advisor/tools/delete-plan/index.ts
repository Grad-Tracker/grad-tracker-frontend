import type { AdvisorToolDependencies } from "../shared/dependencies";

export type DeletePlanInput = {
  planId: number;
  confirm: boolean;
};

export const DELETE_PLAN_DEFINITION = {
  name: "delete_plan",
  description:
    "Permanently delete a graduation plan and all its courses. This is irreversible. Requires confirm: true — always ask the student to explicitly confirm before calling.",
  input_schema: {
    type: "object" as const,
    required: ["planId", "confirm"] as const,
    properties: {
      planId: { type: "integer" as const, description: "The plan ID to delete" },
      confirm: { type: "boolean" as const, description: "Must be true — student must confirm deletion before this is called" },
    },
  },
} as const;

export function createDeletePlanTool(deps: AdvisorToolDependencies) {
  return async function (input: DeletePlanInput) {
    if (!input.confirm) {
      return { success: false, planId: input.planId, error: "Deletion requires confirm: true. Ask the student to explicitly confirm before deleting." };
    }

    // Guard: cannot delete the only remaining plan.
    const allPlans = await deps.listPlans();
    if (allPlans.length <= 1) {
      return {
        success: false,
        planId: input.planId,
        error: "Cannot delete your only plan. Create a new plan first, then delete this one.",
      };
    }

    try {
      await deps.deletePlan(input.planId);
      return { success: true, planId: input.planId };
    } catch (err) {
      return { success: false, planId: input.planId, error: err instanceof Error ? err.message : "Failed to delete plan." };
    }
  };
}
