import type { AdvisorToolDependencies } from "../shared/dependencies";
import type { GetCourseHistoryOptions } from "@/lib/ai-advisor/data";

export type GetCourseHistoryInput = {
  subject?: string;
  completedOnly?: boolean;
  minLevel?: number;
};

export const GET_COURSE_HISTORY_DEFINITION = {
  name: "get_course_history",
  description:
    "Return the student's course history with grades, completion status, and term taken. Use when the student asks what courses they have taken, their GPA inputs, courses by department, or highest-level courses completed. Supports optional filters.",
  input_schema: {
    type: "object" as const,
    properties: {
      subject: { type: "string" as const, description: 'Filter by subject code, e.g. "CSCI" or "MATH"' },
      completedOnly: { type: "boolean" as const, description: "If true, only return completed courses (excludes in-progress)" },
      minLevel: { type: "integer" as const, description: "Minimum course level, e.g. 300 to only return 300+ level courses" },
    },
  },
} as const;

export function createGetCourseHistoryTool(deps: AdvisorToolDependencies) {
  return async function (input?: GetCourseHistoryInput) {
    const options: GetCourseHistoryOptions = {
      subject: input?.subject ?? null,
      completedOnly: input?.completedOnly ?? false,
      minLevel: input?.minLevel ?? null,
    };

    const courses = await deps.getCourseHistory(options);

    const completedCount = courses.filter((c) => c.completed).length;
    const totalCredits = courses
      .filter((c) => c.completed)
      .reduce((s, c) => s + c.credits, 0);

    return {
      total: courses.length,
      completedCount,
      totalCredits,
      courses,
    };
  };
}
