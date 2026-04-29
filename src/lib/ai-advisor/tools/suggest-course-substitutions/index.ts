import type { AdvisorToolDependencies } from "../shared/dependencies";
import { normalizeCourseCode } from "../shared/utils";

export type SuggestCourseSubstitutionsInput = {
  courseCode: string;
  programIds?: number[];
};

export const SUGGEST_COURSE_SUBSTITUTIONS_DEFINITION = {
  name: "suggest_course_substitutions",
  description:
    "If a required course is unavailable or the student can't take it, suggest catalog alternatives that satisfy the same requirement block. Use when a student asks 'what else can I take instead of X?'",
  input_schema: {
    type: "object" as const,
    required: ["courseCode"] as const,
    properties: {
      courseCode: { type: "string" as const, description: 'The course the student cannot take, e.g. "CSCI 340"' },
      programIds: {
        type: "array" as const,
        items: { type: "integer" as const },
        description: "Program IDs to check. Omit to use the student's enrolled programs.",
      },
    },
  },
} as const;

export function createSuggestCourseSubstitutionsTool(deps: AdvisorToolDependencies) {
  return async function (input: SuggestCourseSubstitutionsInput) {
    const code = normalizeCourseCode(input.courseCode);
    const resolved = await deps.resolveCourseIdsByCodes([code]);
    const targetId = resolved.resolvedIds[0] ?? null;

    if (targetId == null) {
      return {
        targetCourseCode: code,
        targetCourseId: null,
        blocks: [],
        notFound: true,
        message: `Course "${code}" was not found in the catalog.`,
      };
    }

    // Get the student's enrolled program IDs.
    const profile = await deps.getStudentProfile();
    const programIds = (input.programIds ?? []).length > 0
      ? (input.programIds as number[])
      : profile.programs.map((p) => p.id);

    if (programIds.length === 0) {
      return {
        targetCourseCode: code,
        targetCourseId: targetId,
        blocks: [],
        notFound: false,
        message: `No programs found. Please specify program IDs.`,
      };
    }

    // Find which blocks the target course belongs to.
    const allBlocks = await deps.getProgramRequirements(programIds);
    const matchingBlocks = allBlocks.filter((b) => b.courses.some((c) => c.courseId === targetId));

    if (matchingBlocks.length === 0) {
      return {
        targetCourseCode: code,
        targetCourseId: targetId,
        blocks: [],
        notFound: false,
        message: `${code} was found in the catalog but does not appear in any of the student's requirement blocks. No substitutions available.`,
      };
    }

    // For each block, return all other courses in the block as alternatives.
    const blockResults = matchingBlocks.map((block) => ({
      blockId: block.blockId,
      blockName: block.blockName,
      programName: block.programName,
      alternatives: block.courses
        .filter((c) => c.courseId !== targetId)
        .map((c) => ({ courseId: c.courseId, courseCode: c.courseCode, title: c.title, credits: c.credits })),
    }));

    const totalAlts = blockResults.reduce((s, b) => s + b.alternatives.length, 0);
    const msg = totalAlts > 0
      ? `Found ${totalAlts} alternative(s) for ${code} across ${matchingBlocks.length} requirement block(s).`
      : `${code} is the only course in its requirement block(s) — no substitutions are available.`;

    return {
      targetCourseCode: code,
      targetCourseId: targetId,
      blocks: blockResults,
      notFound: false,
      message: msg,
    };
  };
}
