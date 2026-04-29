import type { AdvisorToolDependencies } from "../shared/dependencies";

export type FindCoursesSatisfyingBlockInput = {
  blockName: string;
  programIds?: number[];
};

export const FIND_COURSES_SATISFYING_BLOCK_DEFINITION = {
  name: "find_courses_satisfying_block",
  description:
    "Given a requirement block name, return all courses that count toward it — including already-completed ones. Use when the student asks 'what can I take for my X requirement?' or 'what courses satisfy the social science elective block?'.",
  input_schema: {
    type: "object" as const,
    required: ["blockName"] as const,
    properties: {
      blockName: {
        type: "string" as const,
        description: "Name of the requirement block to look up, e.g. \"Major Core\" or \"Social Sciences Elective\"",
      },
      programIds: {
        type: "array" as const,
        items: { type: "integer" as const },
        description: "Program IDs to search within. Defaults to the student's enrolled programs.",
      },
    },
  },
} as const;

export function createFindCoursesSatisfyingBlockTool(deps: AdvisorToolDependencies) {
  return async function (input: FindCoursesSatisfyingBlockInput) {
    const searchName = (input.blockName ?? "").trim().toLowerCase();

    let programIds: number[] = (input.programIds ?? [])
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0);

    if (programIds.length === 0) {
      const profile = await deps.getStudentProfile();
      programIds = profile.programs.map((p) => p.id);
    }

    const allBlocks = await deps.getProgramRequirements(programIds);

    // Match blocks by exact name first, then partial match.
    const exactMatches = allBlocks.filter(
      (b) => b.blockName.toLowerCase() === searchName
    );
    const matched = exactMatches.length > 0
      ? exactMatches
      : allBlocks.filter((b) => b.blockName.toLowerCase().includes(searchName));

    const totalCourses = matched.reduce((s, b) => s + b.courses.length, 0);

    return {
      blockName: input.blockName,
      matchedBlocks: matched,
      totalCourses,
      notFound: matched.length === 0,
    };
  };
}
