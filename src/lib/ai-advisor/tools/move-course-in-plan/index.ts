import type { AdvisorToolDependencies } from "../shared/dependencies";
import { normalizeCourseCode } from "../shared/utils";

export type MoveCourseInPlanInput = {
  planId: number;
  courseCode: string;
  toSeason: string;
  toYear: number;
};

export const MOVE_COURSE_IN_PLAN_DEFINITION = {
  name: "move_course_in_plan",
  description:
    "Move a course already in the plan to a different term. Use when the student wants to reschedule a course to another semester.",
  input_schema: {
    type: "object" as const,
    required: ["planId", "courseCode", "toSeason", "toYear"] as const,
    properties: {
      planId: { type: "integer" as const, description: "The plan ID" },
      courseCode: { type: "string" as const, description: 'Course code to move, e.g. "CSCI 340"' },
      toSeason: {
        type: "string" as const,
        enum: ["Fall", "Spring", "Summer"] as const,
        description: "Target semester season",
      },
      toYear: { type: "integer" as const, description: "Target 4-digit year, e.g. 2027" },
    },
  },
} as const;

export function createMoveCourseInPlanTool(deps: AdvisorToolDependencies) {
  return async function (input: MoveCourseInPlanInput) {
    const normalizedCode = normalizeCourseCode(input.courseCode);
    const { resolvedIds, unresolvedCodes } = await deps.resolveCourseIdsByCodes([normalizedCode]);

    if (unresolvedCodes.length > 0 || resolvedIds.length === 0) {
      return { success: false, error: `Course "${input.courseCode}" was not found in the course catalog.` };
    }

    const toSeason = input.toSeason;
    const toYear = Number(input.toYear);

    if (!Number.isFinite(toYear) || toYear < 2020 || toYear > 2040) {
      return { success: false, error: `Invalid year: ${input.toYear}.` };
    }

    const validSeasons = ["Fall", "Spring", "Summer"];
    if (!validSeasons.includes(toSeason)) {
      return { success: false, error: `Invalid season "${toSeason}". Must be Fall, Spring, or Summer.` };
    }

    const courseId = resolvedIds[0]!;
    const { moved } = await deps.moveCourseInPlan(input.planId, courseId, toSeason, toYear);

    if (!moved) {
      return { success: false, error: `${normalizedCode} was not found in this plan.` };
    }

    return {
      success: true,
      moved: true,
      courseCode: normalizedCode,
      toTerm: `${toSeason} ${toYear}`,
    };
  };
}
