import type { AdvisorToolDependencies } from "../shared/dependencies";

export type CreatePlanInput = {
  name: string;
  programIds?: number[];
};

export const CREATE_PLAN_DEFINITION = {
  name: "create_plan",
  description:
    "Create a new blank graduation plan for the student. Returns the new planId. Only call this when the student explicitly requests plan creation. Confirm the plan name first.",
  input_schema: {
    type: "object" as const,
    required: ["name"] as const,
    properties: {
      name: { type: "string" as const, description: "Plan name (max 100 chars)" },
      programIds: {
        type: "array" as const,
        items: { type: "integer" as const },
        description: "Program IDs to associate. Defaults to student's enrolled programs if omitted.",
      },
    },
  },
} as const;

export function createCreatePlanTool(deps: AdvisorToolDependencies) {
  return async function (input: CreatePlanInput) {
    const profile = await deps.getStudentProfile();

    // Default to student's enrolled program IDs if none specified.
    const programIds =
      Array.isArray(input.programIds) && input.programIds.length > 0
        ? input.programIds.map(Number).filter((id) => Number.isFinite(id) && id > 0)
        : profile.programs.map((p) => p.id);

    const name = (input.name ?? "My Plan").trim().slice(0, 100) || "My Plan";

    try {
      const { planId } = await deps.createPlan(name, programIds);
      return {
        planId,
        name,
        message: `Plan "${name}" created (ID: ${planId}). You can now add courses to it using add_course_to_plan.`,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create plan. Check that all program IDs are valid.",
      };
    }
  };
}
