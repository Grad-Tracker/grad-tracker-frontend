import type { AdvisorToolDependencies } from "../shared/dependencies";

export type RenamePlanInput = {
  planId: number;
  newName: string;
};

export const RENAME_PLAN_DEFINITION = {
  name: "rename_plan",
  description:
    "Rename an existing graduation plan. Use when the student asks to rename or update the name of a plan. Confirm the new name with the student before calling.",
  input_schema: {
    type: "object" as const,
    required: ["planId", "newName"] as const,
    properties: {
      planId: { type: "integer" as const, description: "The plan ID to rename" },
      newName: { type: "string" as const, description: "The new plan name (max 100 characters)" },
    },
  },
} as const;

export function createRenamePlanTool(deps: AdvisorToolDependencies) {
  return async function (input: RenamePlanInput) {
    const newName = (input.newName ?? "").trim().slice(0, 100);
    if (!newName) {
      return { success: false, planId: input.planId, newName: input.newName, error: "Plan name cannot be empty." };
    }

    try {
      await deps.renamePlan(input.planId, newName);
      return { success: true, planId: input.planId, newName };
    } catch (err) {
      return {
        success: false,
        planId: input.planId,
        newName,
        error: err instanceof Error ? err.message : "Failed to rename plan.",
      };
    }
  };
}
