import type { AdvisorToolDependencies } from "../shared/dependencies";
import { normalizeCourseCode } from "../shared/utils";

export type AddCourseToHistoryInput = {
  courseCode: string;
  season: string;
  year: number;
  grade?: string | null;
  completed?: boolean;
};

export const ADD_COURSE_TO_HISTORY_DEFINITION = {
  name: "add_course_to_history",
  description:
    "Log a course directly to the student's academic history without navigating to the history tab. Use when the student says they have already taken a course and wants it recorded. Ask for the grade if they know it.",
  input_schema: {
    type: "object" as const,
    required: ["courseCode", "season", "year"] as const,
    properties: {
      courseCode: { type: "string" as const, description: 'Course code, e.g. "CSCI 340"' },
      season: {
        type: "string" as const,
        enum: ["Fall", "Spring", "Summer"] as const,
        description: "Season the course was taken",
      },
      year: { type: "integer" as const, description: "4-digit year the course was taken, e.g. 2024" },
      grade: { type: "string" as const, description: 'Letter grade, e.g. "A", "B+". Optional.' },
      completed: { type: "boolean" as const, description: "Whether the course is completed (true) or in-progress (false). Defaults to true." },
    },
  },
} as const;

export function createAddCourseToHistoryTool(deps: AdvisorToolDependencies) {
  return async function (input: AddCourseToHistoryInput) {
    const normalizedCode = normalizeCourseCode(input.courseCode);
    const { resolvedIds, unresolvedCodes } = await deps.resolveCourseIdsByCodes([normalizedCode]);

    if (unresolvedCodes.length > 0 || resolvedIds.length === 0) {
      return {
        success: false,
        courseCode: normalizedCode,
        term: `${input.season} ${input.year}`,
        error: `Course "${input.courseCode}" was not found in the course catalog.`,
      };
    }

    const season = input.season;
    const year = Number(input.year);
    const validSeasons = ["Fall", "Spring", "Summer"];

    if (!validSeasons.includes(season)) {
      return { success: false, courseCode: normalizedCode, term: `${season} ${year}`, error: `Invalid season "${season}".` };
    }
    if (!Number.isFinite(year) || year < 1900 || year > 2100) {
      return { success: false, courseCode: normalizedCode, term: `${season} ${year}`, error: `Invalid year: ${year}.` };
    }

    const courseId = resolvedIds[0]!;
    const completed = input.completed !== false;
    const { added, alreadyExists } = await deps.addCourseToHistory(
      courseId,
      season,
      year,
      input.grade ?? null,
      completed
    );

    return {
      success: true,
      courseCode: normalizedCode,
      term: `${season} ${year}`,
      alreadyExists,
      ...(added ? {} : { alreadyExists: true }),
    };
  };
}
