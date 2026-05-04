import type { AdvisorToolDependencies } from "../shared/dependencies";
import { normalizeCourseCode } from "../shared/utils";

export type RemoveCourseFromPlanInput = {
  planId: number;
  courseCode: string;
};

export const REMOVE_COURSE_FROM_PLAN_DEFINITION = {
  name: "remove_course_from_plan",
  description:
    "Remove a specific course from a plan. Use when the student asks to delete or remove a course. Removes the course from all terms it appears in within the plan.",
  input_schema: {
    type: "object" as const,
    required: ["planId", "courseCode"] as const,
    properties: {
      planId: { type: "integer" as const, description: "The plan ID to remove the course from" },
      courseCode: { type: "string" as const, description: 'Course code to remove, e.g. "INTS 100"' },
    },
  },
} as const;

export function createRemoveCourseFromPlanTool(deps: AdvisorToolDependencies) {
  return async function (input: RemoveCourseFromPlanInput) {
    const normalizedCode = normalizeCourseCode(input.courseCode);
    const { resolvedIds, unresolvedCodes } = await deps.resolveCourseIdsByCodes([normalizedCode]);

    if (unresolvedCodes.length > 0 || resolvedIds.length === 0) {
      return {
        success: false,
        error: `Course "${input.courseCode}" was not found in the course catalog.`,
      };
    }

    const courseId = resolvedIds[0]!;
    const { removed } = await deps.removeCourseFromPlan(input.planId, courseId);

    return {
      success: true,
      removed,
      courseCode: normalizedCode,
    };
  };
}
