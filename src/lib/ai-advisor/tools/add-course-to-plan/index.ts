import type { AdvisorToolDependencies } from "../shared/dependencies";
import { normalizeCourseCode } from "../shared/utils";

export type AddCourseToPlanInput = {
  planId: number;
  courseCode: string;
  season: string;
  year: number;
};

export const ADD_COURSE_TO_PLAN_DEFINITION = {
  name: "add_course_to_plan",
  description:
    "Add a specific course to a term in an existing plan. Use after create_plan or when the student asks to add a course. Always verify the course exists via check_course_prereqs before adding.",
  input_schema: {
    type: "object" as const,
    required: ["planId", "courseCode", "season", "year"] as const,
    properties: {
      planId: { type: "integer" as const, description: "The plan ID to add the course to" },
      courseCode: { type: "string" as const, description: 'Course code, e.g. "CSCI 340"' },
      season: {
        type: "string" as const,
        enum: ["Fall", "Spring", "Summer"] as const,
        description: "Semester season",
      },
      year: { type: "integer" as const, description: "4-digit year, e.g. 2026" },
    },
  },
} as const;

export function createAddCourseToPlanTool(deps: AdvisorToolDependencies) {
  return async function (input: AddCourseToPlanInput) {
    const normalizedCode = normalizeCourseCode(input.courseCode);
    const { resolvedIds, unresolvedCodes } = await deps.resolveCourseIdsByCodes([normalizedCode]);

    if (unresolvedCodes.length > 0 || resolvedIds.length === 0) {
      return {
        success: false,
        error: `Course "${input.courseCode}" was not found in the course catalog.`,
      };
    }

    const courseId = resolvedIds[0]!;
    const season = input.season;
    const year = Number(input.year);

    if (!Number.isFinite(year) || year < 2020 || year > 2040) {
      return { success: false, error: `Invalid year: ${input.year}.` };
    }

    const validSeasons = ["Fall", "Spring", "Summer"];
    if (!validSeasons.includes(season)) {
      return { success: false, error: `Invalid season "${season}". Must be Fall, Spring, or Summer.` };
    }

    const { alreadyPlanned } = await deps.addCourseToPlan(input.planId, courseId, season, year);

    if (alreadyPlanned) {
      return {
        success: true,
        alreadyPlanned: true,
        courseCode: normalizedCode,
        term: `${season} ${year}`,
      };
    }

    return {
      success: true,
      alreadyPlanned: false,
      courseCode: normalizedCode,
      term: `${season} ${year}`,
    };
  };
}
