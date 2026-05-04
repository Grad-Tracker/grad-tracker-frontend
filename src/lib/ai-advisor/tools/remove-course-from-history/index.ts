import type { AdvisorToolDependencies } from "../shared/dependencies";
import { normalizeCourseCode } from "../shared/utils";

export type RemoveCourseFromHistoryInput = {
  courseCode: string;
  confirm: boolean;
};

export const REMOVE_COURSE_FROM_HISTORY_DEFINITION = {
  name: "remove_course_from_history",
  description:
    "Remove a course from the student's academic history. Use when the student says a course was logged by mistake or they want to correct their record. Before calling, tell the student which course will be removed and require explicit confirmation. Requires confirm: true.",
  input_schema: {
    type: "object" as const,
    required: ["courseCode", "confirm"] as const,
    properties: {
      courseCode: { type: "string" as const, description: 'Course code to remove, e.g. "CSCI 340"' },
      confirm: { type: "boolean" as const, description: "Must be true — the student must explicitly confirm the removal before this is called" },
    },
  },
} as const;

export function createRemoveCourseFromHistoryTool(deps: AdvisorToolDependencies) {
  return async function (input: RemoveCourseFromHistoryInput) {
    if (!input.confirm) {
      return {
        success: false,
        courseCode: input.courseCode,
        error: "Removal requires confirm: true. Tell the student which course will be removed from their history and ask them to confirm.",
      };
    }

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

    // Verify the course is actually in the student's history.
    const history = await deps.getCourseHistory();
    const inHistory = history.some((h) => h.courseId === courseId);
    if (!inHistory) {
      return {
        success: false,
        courseCode: normalizedCode,
        error: `${normalizedCode} is not in your course history.`,
      };
    }

    try {
      await deps.removeCourseFromHistory(courseId);
      return { success: true, courseCode: normalizedCode };
    } catch (err) {
      return {
        success: false,
        courseCode: normalizedCode,
        error: err instanceof Error ? err.message : "Failed to remove course from history.",
      };
    }
  };
}
