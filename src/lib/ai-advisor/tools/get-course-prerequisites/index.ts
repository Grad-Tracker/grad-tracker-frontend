import type { AdvisorToolDependencies } from "../shared/dependencies";
import { normalizeCourseCode } from "../shared/utils";

export type GetCoursePrerequisitesInput = {
  courseCodes: string[];
};

export const GET_COURSE_PREREQUISITES_DEFINITION = {
  name: "get_course_prerequisites",
  description:
    "Return the prerequisite requirements for one or more courses as defined in the catalog — independent of whether the student meets them. Use this when the student asks what a course requires, not whether they qualify.",
  input_schema: {
    type: "object" as const,
    required: ["courseCodes"] as const,
    properties: {
      courseCodes: {
        type: "array" as const,
        items: { type: "string" as const },
        description: 'List of course codes to look up, e.g. ["CIS 570", "CSCI 340"]',
      },
    },
  },
} as const;

export function createGetCoursePrerequisitesTool(deps: AdvisorToolDependencies) {
  return async function (input: GetCoursePrerequisitesInput) {
    const codes = (input.courseCodes ?? []).map((c) => normalizeCourseCode(c));
    const { resolvedIds, resolvedCodes, unresolvedCodes } =
      await deps.resolveCourseIdsByCodes(codes);

    if (resolvedIds.length === 0) {
      return { results: [], unresolvedCourseCodes: unresolvedCodes };
    }

    const defMap = await deps.getCoursePrerequisites(resolvedIds);

    const results = resolvedIds.map((id, i) => {
      const def = defMap.get(id) ?? { hasPrereqs: false, items: [] };
      return {
        courseCode: resolvedCodes[i] ?? `course #${id}`,
        hasPrereqs: def.hasPrereqs,
        items: def.items,
      };
    });

    return { results, unresolvedCourseCodes: unresolvedCodes };
  };
}
