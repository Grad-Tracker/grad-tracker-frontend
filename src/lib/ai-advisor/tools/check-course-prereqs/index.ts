import type { AdvisorToolDependencies } from "../shared/dependencies";
import { normalizeCourseCode } from "../shared/utils";

export type CheckCoursePrereqsInput = {
  courseIds?: number[];
  courseCodes?: string[];
};

export const CHECK_COURSE_PREREQS_DEFINITION = {
  name: "check_course_prereqs",
  description: "Check whether a student can take specified courses and list unmet prerequisites.",
  input_schema: {
    type: "object" as const,
    properties: {
      courseIds: { type: "array" as const, items: { type: "integer" as const }, description: "Course IDs" },
      courseCodes: { type: "array" as const, items: { type: "string" as const }, description: "Course codes" },
    },
  },
} as const;

export function createCheckCoursePrereqsTool(deps: AdvisorToolDependencies) {
  return async function (input: CheckCoursePrereqsInput) {
    const normalizedIds = Array.from(
      new Set(
        (input.courseIds ?? [])
          .map(Number)
          .filter((id) => Number.isFinite(id))
      )
    );

    const normalizedCodes = Array.from(
      new Set((input.courseCodes ?? []).map((code) => normalizeCourseCode(code)).filter(Boolean))
    );

    const lookup = normalizedCodes.length
      ? await deps.resolveCourseIdsByCodes(normalizedCodes)
      : { resolvedIds: [], unresolvedCodes: [], resolvedCodes: [] };

    const candidateIds = Array.from(new Set([...normalizedIds, ...lookup.resolvedIds]));
    const prereqMap = await deps.evaluatePrereqs(candidateIds);

    const idToCode = new Map<number, string>();
    lookup.resolvedIds.forEach((id, idx) => {
      const code = lookup.resolvedCodes[idx];
      if (code) idToCode.set(id, code);
    });

    const results = candidateIds
      .map((courseId) => {
        const courseCode = idToCode.get(courseId);
        if (!courseCode) return null;
        const prereq = prereqMap.get(courseId) ?? { unlocked: true, summary: [] };
        return {
          courseId,
          courseCode,
          unlocked: prereq.unlocked,
          summary: prereq.summary,
        };
      })
      .filter((result): result is NonNullable<typeof result> => result !== null);

    return {
      results,
      unresolvedCourseCodes: lookup.unresolvedCodes,
    };
  };
}
