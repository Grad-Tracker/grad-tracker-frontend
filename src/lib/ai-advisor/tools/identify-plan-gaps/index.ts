import type { AdvisorToolDependencies } from "../shared/dependencies";

export type IdentifyPlanGapsInput = {
  planId?: number | null;
};

export const IDENTIFY_PLAN_GAPS_DEFINITION = {
  name: "identify_plan_gaps",
  description:
    "List every degree requirement block that has remaining courses with none of them currently planned. Unlike get_remaining_requirements (which lists all outstanding courses), this focuses on blocks where no planning has started at all. Use when the student asks which requirements they haven't started planning for.",
  input_schema: {
    type: "object" as const,
    properties: {
      planId: { type: "integer" as const, description: "Plan ID to check (defaults to active plan)" },
    },
  },
} as const;

export function createIdentifyPlanGapsTool(deps: AdvisorToolDependencies) {
  return async function (input?: IdentifyPlanGapsInput) {
    const planId = input?.planId ?? null;

    const [snapshot, remaining] = await Promise.all([
      deps.getPlanSnapshot(planId),
      deps.getRemainingRequirements(planId, 200),
    ]);

    const plannedIds = new Set((snapshot?.plannedCourses ?? []).map((c) => c.courseId));

    const gaps = remaining.blocks
      .map((block) => {
        const unplanned = block.remainingCourses.filter((c) => !plannedIds.has(c.id));
        return {
          blockId: block.blockId,
          blockName: block.blockName,
          unplannedCount: unplanned.length,
          unplannedCourses: unplanned.map((c) => ({
            courseId: c.id,
            courseCode: c.courseCode,
            title: c.title,
            credits: c.credits,
          })),
        };
      })
      .filter((gap) => gap.unplannedCount > 0);

    return {
      gaps,
      totalGapBlocks: gaps.length,
    };
  };
}
