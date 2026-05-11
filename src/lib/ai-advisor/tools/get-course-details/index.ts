import type { AdvisorCourseDetail } from "@/lib/ai-advisor/data";
import type { AdvisorToolDependencies } from "../shared/dependencies";
import { normalizeCourseCode } from "../shared/utils";

export type GetCourseDetailsInput = {
  courseCodes: string[];
};

export const GET_COURSE_DETAILS_DEFINITION = {
  name: "get_course_details",
  description:
    "Return full catalog metadata for one or more courses: description, prerequisite text, credits, and whether the course is active. Use when the student asks for details about a course they're considering.",
  input_schema: {
    type: "object" as const,
    required: ["courseCodes"] as const,
    properties: {
      courseCodes: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Course codes to look up, e.g. [\"CIS 570\", \"CSCI 340\"]",
      },
    },
  },
} as const;

export function createGetCourseDetailsTool(deps: AdvisorToolDependencies) {
  return async function (input: GetCourseDetailsInput) {
    const codes = (input.courseCodes ?? []).map((c) => normalizeCourseCode(c)).filter(Boolean);
    if (codes.length === 0) {
      return { courses: [], unresolvedCourseCodes: [] };
    }

    const { resolvedIds, unresolvedCodes } = await deps.resolveCourseIdsByCodes(codes);

    if (resolvedIds.length === 0) {
      return { courses: [], unresolvedCourseCodes: unresolvedCodes };
    }

    const detailMap = await deps.getCourseDetails(resolvedIds);
    const courses = resolvedIds
      .map((id) => detailMap.get(id))
      .filter((c): c is AdvisorCourseDetail => c !== undefined);

    return { courses, unresolvedCourseCodes: unresolvedCodes };
  };
}
