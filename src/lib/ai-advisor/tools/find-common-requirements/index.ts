import type { AdvisorToolDependencies } from "../shared/dependencies";

export type FindCommonRequirementsInput = {
  programIds?: number[];
};

export const FIND_COMMON_REQUIREMENTS_DEFINITION = {
  name: "find_common_requirements",
  description:
    "Identify courses that count toward multiple requirement blocks simultaneously (double-dipping). Helps students maximize the efficiency of every course they take.",
  input_schema: {
    type: "object" as const,
    properties: {
      programIds: {
        type: "array" as const,
        items: { type: "integer" as const },
        description: "Program IDs to check. Omit to use the student's enrolled programs.",
      },
    },
  },
} as const;

export function createFindCommonRequirementsTool(deps: AdvisorToolDependencies) {
  return async function (input?: FindCommonRequirementsInput) {
    const profile = await deps.getStudentProfile();
    const programIds = (input?.programIds ?? []).length > 0
      ? (input!.programIds as number[])
      : profile.programs.map((p) => p.id);

    if (programIds.length === 0) {
      return { courses: [], totalDoubleCountable: 0 };
    }

    const blocks = await deps.getProgramRequirements(programIds);

    // Map: courseId → list of blocks it appears in.
    const courseBlockMap = new Map<number, Array<{ blockId: number; blockName: string; programId: number; programName: string }>>();

    for (const block of blocks) {
      for (const course of block.courses) {
        if (!courseBlockMap.has(course.courseId)) courseBlockMap.set(course.courseId, []);
        courseBlockMap.get(course.courseId)!.push({
          blockId: block.blockId,
          blockName: block.blockName,
          programId: block.programId,
          programName: block.programName,
        });
      }
    }

    // Only return courses that appear in 2+ blocks.
    const doubleCountable = Array.from(courseBlockMap.entries())
      .filter(([, bl]) => bl.length >= 2)
      .map(([courseId, bl]) => ({ courseId, blocks: bl }));

    if (doubleCountable.length === 0) {
      return { courses: [], totalDoubleCountable: 0 };
    }

    const courseIds = doubleCountable.map((entry) => entry.courseId);
    const courseInfoMap = await deps.getCoursesByIds(courseIds);

    const courses = doubleCountable
      .map((entry) => {
        const info = courseInfoMap.get(entry.courseId);
        return {
          courseId: entry.courseId,
          courseCode: info?.courseCode ?? `Course ${entry.courseId}`,
          title: info?.title ?? "",
          credits: info?.credits ?? 0,
          blocks: entry.blocks,
          blockCount: entry.blocks.length,
        };
      })
      .sort((a, b) => b.blockCount - a.blockCount || a.courseCode.localeCompare(b.courseCode));

    return { courses, totalDoubleCountable: courses.length };
  };
}
