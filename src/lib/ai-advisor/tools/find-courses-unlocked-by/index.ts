import type { AdvisorCourseSearchResult } from "@/lib/ai-advisor/data";
import type { AdvisorToolDependencies } from "../shared/dependencies";
import { normalizeCourseCode } from "../shared/utils";

export type FindCoursesUnlockedByInput = {
  courseCodes: string[];
};

export const FIND_COURSES_UNLOCKED_BY_DEFINITION = {
  name: "find_courses_unlocked_by",
  description:
    "Given a course the student has completed or plans to complete, return all courses that become directly available as a result (reverse prereq lookup). Use when the student asks 'what does completing X unlock?' or 'what can I take after X?'.",
  input_schema: {
    type: "object" as const,
    required: ["courseCodes"] as const,
    properties: {
      courseCodes: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Course codes whose direct dependents should be looked up, e.g. [\"CSCI 240\"]",
      },
    },
  },
} as const;

export function createFindCoursesUnlockedByTool(deps: AdvisorToolDependencies) {
  return async function (input: FindCoursesUnlockedByInput) {
    const codes = (input.courseCodes ?? []).map((c) => normalizeCourseCode(c)).filter(Boolean);
    if (codes.length === 0) return { results: [], unresolvedCourseCodes: [] };

    const { resolvedIds, resolvedCodes, unresolvedCodes } = await deps.resolveCourseIdsByCodes(codes);
    if (resolvedIds.length === 0) return { results: [], unresolvedCourseCodes: unresolvedCodes };

    const dependentsMap = await deps.getDirectDependents(resolvedIds);
    const allDependentIds = Array.from(new Set(Array.from(dependentsMap.values()).flat()));
    const courseInfoMap = allDependentIds.length > 0
      ? await deps.getCoursesByIds(allDependentIds)
      : new Map<number, AdvisorCourseSearchResult>();

    const results = resolvedIds.map((id, i) => {
      const directDeps = dependentsMap.get(id) ?? [];
      return {
        prereqCourseCode: resolvedCodes[i] ?? `course #${id}`,
        unlockedCourses: directDeps.map((depId) => {
          const info = courseInfoMap.get(depId);
          return {
            courseId: depId,
            courseCode: info?.courseCode ?? `course #${depId}`,
            title: info?.title ?? "",
            credits: info?.credits ?? 0,
          };
        }),
      };
    });

    return { results, unresolvedCourseCodes: unresolvedCodes };
  };
}
