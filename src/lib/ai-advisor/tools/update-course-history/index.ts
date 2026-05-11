import type { AdvisorToolDependencies } from "../shared/dependencies";
import { normalizeCourseCode } from "../shared/utils";

export type UpdateCourseHistoryInput = {
  courseCode: string;
  grade?: string | null;
  completed?: boolean;
};

export const UPDATE_COURSE_HISTORY_DEFINITION = {
  name: "update_course_history",
  description:
    "Update the grade or completion status of a course already in the student's history. Use when the student wants to correct a grade or mark a course as completed/in-progress.",
  input_schema: {
    type: "object" as const,
    required: ["courseCode"] as const,
    properties: {
      courseCode: { type: "string" as const, description: 'Course code to update, e.g. "CSCI 340"' },
      grade: { type: "string" as const, description: 'New letter grade, e.g. "A", "B+". Pass null to clear.' },
      completed: { type: "boolean" as const, description: "Set to true if the course is completed, false if in-progress." },
    },
  },
} as const;

export function createUpdateCourseHistoryTool(deps: AdvisorToolDependencies) {
  return async function (input: UpdateCourseHistoryInput) {
    const normalizedCode = normalizeCourseCode(input.courseCode);
    const { resolvedIds, unresolvedCodes } = await deps.resolveCourseIdsByCodes([normalizedCode]);
    if (unresolvedCodes.length > 0 || resolvedIds.length === 0) {
      return {
        success: false,
        courseCode: input.courseCode,
        error: `Course "${input.courseCode}" was not found in the course catalog.`,
      };
    }

    const courseId = resolvedIds[0]!;

    const history = await deps.getCourseHistory();
    const inHistory = history.some((h) => h.courseId === courseId);
    if (!inHistory) {
      return {
        success: false,
        courseCode: normalizedCode,
        error: `${normalizedCode} is not in your course history.`,
      };
    }

    if (input.grade === undefined && input.completed === undefined) {
      return {
        success: false,
        courseCode: normalizedCode,
        error: "No updates provided. Specify grade, completed, or both.",
      };
    }

    try {
      await deps.updateCourseHistory(courseId, input.grade, input.completed);
      return { success: true, courseCode: normalizedCode, updated: true };
    } catch (err) {
      return {
        success: false,
        courseCode: normalizedCode,
        error: err instanceof Error ? err.message : "Failed to update course history.",
      };
    }
  };
}
