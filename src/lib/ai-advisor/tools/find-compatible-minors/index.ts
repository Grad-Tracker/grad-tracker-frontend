import type { AdvisorToolDependencies } from "../shared/dependencies";

export type FindCompatibleMinorsInput = {
  topN?: number;
};

export const FIND_COMPATIBLE_MINORS_DEFINITION = {
  name: "find_compatible_minors",
  description:
    "Given the student's course history and current plan, find which available minors they could complete with the fewest additional courses. Use when a student wants to explore adding a minor without extending their timeline.",
  input_schema: {
    type: "object" as const,
    properties: {
      topN: { type: "integer" as const, description: "Return top N most compatible minors. Default 5, max 20." },
    },
  },
} as const;

export function createFindCompatibleMinorsTool(deps: AdvisorToolDependencies) {
  return async function (input?: FindCompatibleMinorsInput) {
    const topN = Math.max(1, Math.min(Number(input?.topN ?? 5), 20));

    const [allMinors, history] = await Promise.all([
      deps.getAvailablePrograms("MINOR"),
      deps.getCourseHistory(),
    ]);

    if (allMinors.length === 0) {
      return { minors: [], topN };
    }

    const completedIds = new Set(history.map((h) => h.courseId));

    // For each minor, fetch its requirements and compute completion.
    const results: Array<{
      programId: number;
      programName: string;
      totalRequirements: number;
      alreadySatisfied: number;
      remaining: number;
      percentComplete: number;
    }> = [];

    // Batch-fetch requirements for all minors to avoid N+1.
    const allMinorIds = allMinors.map((m) => m.id);
    const blocks = await deps.getProgramRequirements(allMinorIds);

    // Group blocks by programId.
    const blocksByProgram = new Map<number, typeof blocks>();
    for (const block of blocks) {
      if (!blocksByProgram.has(block.programId)) blocksByProgram.set(block.programId, []);
      blocksByProgram.get(block.programId)!.push(block);
    }

    for (const minor of allMinors) {
      const minorBlocks = blocksByProgram.get(minor.id) ?? [];
      const totalCourses = new Set(minorBlocks.flatMap((b) => b.courses.map((c) => c.courseId)));
      const satisfied = Array.from(totalCourses).filter((id) => completedIds.has(id)).length;
      const total = totalCourses.size;

      results.push({
        programId: minor.id,
        programName: minor.name,
        totalRequirements: total,
        alreadySatisfied: satisfied,
        remaining: total - satisfied,
        percentComplete: total > 0 ? Math.round((satisfied / total) * 100) : 0,
      });
    }

    // Sort by remaining courses ascending (fewest left = most compatible).
    const sorted = results
      .filter((r) => r.totalRequirements > 0)
      .sort((a, b) => a.remaining - b.remaining || b.percentComplete - a.percentComplete)
      .slice(0, topN);

    return { minors: sorted, topN };
  };
}
