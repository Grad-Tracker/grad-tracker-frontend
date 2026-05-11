import type { AdvisorToolDependencies } from "../shared/dependencies";

export type GetUnfulfillableRequirementsInput = {
  planId?: number | null;
};

export const GET_UNFULFILLABLE_REQUIREMENTS_DEFINITION = {
  name: "get_unfulfillable_requirements",
  description:
    "Analyze the current plan and return every degree requirement that cannot be completed before graduation: required courses missing from the plan, blocks with nothing planned, and courses scheduled before their prerequisites. Use when the student asks what they're missing, what's blocking graduation, or wants to know if their plan is completable.",
  input_schema: {
    type: "object" as const,
    properties: {
      planId: { type: "integer" as const, description: "Plan ID to analyze. Omit to use the active plan." },
    },
  },
} as const;

export function createGetUnfulfillableRequirementsTool(deps: AdvisorToolDependencies) {
  return async function (input?: GetUnfulfillableRequirementsInput) {
    const planId = input?.planId ?? null;

    const [remaining, snapshot] = await Promise.all([
      deps.getRemainingRequirements(planId),
      deps.getPlanSnapshot(planId),
    ]);

    const unfulfillable: Array<{
      type: "missing_from_plan" | "prereq_violation" | "no_block_coverage";
      blockId?: number;
      blockName?: string;
      courseId?: number;
      courseCode?: string;
      message: string;
    }> = [];

    const plannedCourses = snapshot?.plannedCourses ?? [];
    const plannedCourseIds = new Set(plannedCourses.map((c) => c.courseId));

    // Build term ordering map (termId → sort key).
    const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
    const terms = snapshot?.terms ?? [];
    const termKey = new Map<number, number>();
    for (const t of terms) {
      termKey.set(t.id, t.year * 10 + (SEASON_ORDER[t.season] ?? 0));
    }

    // Per-block analysis.
    for (const block of remaining.blocks) {
      const blockCourseIds = new Set(block.remainingCourses.map((c) => c.id));
      const plannedInBlock = block.remainingCourses.filter((c) => plannedCourseIds.has(c.id));
      const unplannedInBlock = block.remainingCourses.filter((c) => !plannedCourseIds.has(c.id));

      // Flag courses that are required but missing from the plan entirely.
      for (const course of unplannedInBlock) {
        unfulfillable.push({
          type: "missing_from_plan",
          blockId: block.blockId,
          blockName: block.blockName,
          courseId: course.id,
          courseCode: course.courseCode,
          message: `${course.courseCode} is required for "${block.blockName}" but has not been added to the plan.`,
        });
      }

      // Flag block if NONE of its courses are planned.
      if (plannedInBlock.length === 0 && block.remainingCourses.length > 0) {
        unfulfillable.push({
          type: "no_block_coverage",
          blockId: block.blockId,
          blockName: block.blockName,
          message: `"${block.blockName}" has ${block.remainingCourses.length} unfulfilled requirement(s) and no courses are planned for it.`,
        });
      }

      // Suppress the per-course missing entries if we already emitted a block-level one
      // (they are redundant; keep only block-level for all-missing blocks).
      if (plannedInBlock.length === 0 && block.remainingCourses.length > 0) {
        // Remove the per-course entries we just added for this block.
        const redundant = new Set(block.remainingCourses.map((c) => c.id));
        for (let i = unfulfillable.length - 1; i >= 0; i -= 1) {
          const entry = unfulfillable[i];
          if (entry.type === "missing_from_plan" && entry.blockId === block.blockId && entry.courseId != null && redundant.has(entry.courseId)) {
            unfulfillable.splice(i, 1);
          }
        }
      }

      // Check prereq ordering for courses in this block that ARE planned.
      const allPlannedIds = Array.from(plannedCourseIds);
      if (allPlannedIds.length > 0) {
        const prereqMap = await deps.getCoursePrerequisites(
          plannedInBlock.map((c) => c.id)
        );

        for (const course of plannedInBlock) {
          const prereqDef = prereqMap.get(course.id);
          if (!prereqDef?.hasPrereqs) continue;

          const coursePlanned = plannedCourses.find((p) => p.courseId === course.id);
          if (!coursePlanned) continue;
          const courseKey = coursePlanned.termId != null ? (termKey.get(coursePlanned.termId) ?? Infinity) : Infinity;

          for (const reqId of prereqDef.requiredCourseIds) {
            // Prereq must be in history OR planned before this course.
            const prereqPlanned = plannedCourses.find((p) => p.courseId === reqId);
            if (!prereqPlanned) {
              // Not planned anywhere → prereq is missing, course is blocked.
              if (!blockCourseIds.has(reqId)) {
                // Only flag if not already handled as missing_from_plan in a different block.
                unfulfillable.push({
                  type: "prereq_violation",
                  blockId: block.blockId,
                  blockName: block.blockName,
                  courseId: course.id,
                  courseCode: course.courseCode,
                  message: `${course.courseCode} (in "${block.blockName}") is missing a prerequisite (course ID ${reqId}) that is not in the plan.`,
                });
              }
            } else {
              const prereqKey = prereqPlanned.termId != null ? (termKey.get(prereqPlanned.termId) ?? Infinity) : Infinity;
              if (prereqKey >= courseKey) {
                unfulfillable.push({
                  type: "prereq_violation",
                  blockId: block.blockId,
                  blockName: block.blockName,
                  courseId: course.id,
                  courseCode: course.courseCode,
                  message: `${course.courseCode} (in "${block.blockName}") is scheduled before or in the same term as its prerequisite (course ID ${reqId}).`,
                });
              }
            }
          }
        }
      }
    }

    return {
      unfulfillable,
      totalCount: unfulfillable.length,
      canGraduate: unfulfillable.length === 0,
    };
  };
}
