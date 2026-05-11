import type { AdvisorToolDependencies } from "../shared/dependencies";

export type FindPrereqBottlenecksInput = {
  planId?: number | null;
  topN?: number;
};

export const FIND_PREREQ_BOTTLENECKS_DEFINITION = {
  name: "find_prereq_bottlenecks",
  description:
    "Identify which unmet prerequisite courses are blocking the most downstream degree requirements. Use when the student asks which courses they should prioritize to unlock the most options.",
  input_schema: {
    type: "object" as const,
    properties: {
      planId: { type: "integer" as const, description: "Plan ID context (defaults to active plan)" },
      topN: { type: "integer" as const, description: "Number of bottleneck courses to return (default 10, max 25)" },
    },
  },
} as const;

export function createFindPrereqBottlenecksTool(deps: AdvisorToolDependencies) {
  return async function (input?: FindPrereqBottlenecksInput) {
    const planId = input?.planId ?? null;
    const topN = Math.max(1, Math.min(Number(input?.topN ?? 10), 25));

    const remaining = await deps.getRemainingRequirements(planId, 200);
    const allRemainingCourses = remaining.blocks.flatMap((b) => b.remainingCourses);
    const remainingIds = allRemainingCourses.map((c) => c.id);

    if (remainingIds.length === 0) {
      return { bottlenecks: [] };
    }

    const prereqDefs = await deps.getCoursePrerequisites(remainingIds);
    const historyEntries = await deps.getCourseHistory({ completedOnly: true });
    const completedIds = new Set(historyEntries.map((h) => h.courseId));

    // Count how many remaining courses each unmet prereq blocks.
    const blockedBy = new Map<number, Set<number>>(); // prereqId → Set of remaining courseIds it blocks

    for (const course of allRemainingCourses) {
      if (completedIds.has(course.id)) continue;
      const def = prereqDefs.get(course.id);
      if (!def || !def.hasPrereqs) continue;

      for (const reqId of def.requiredCourseIds) {
        if (completedIds.has(reqId)) continue;
        if (!blockedBy.has(reqId)) blockedBy.set(reqId, new Set());
        blockedBy.get(reqId)!.add(course.id);
      }
    }

    if (blockedBy.size === 0) return { bottlenecks: [] };

    const bottleneckIds = Array.from(blockedBy.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, topN)
      .map(([id]) => id);

    const courseInfoMap = await deps.getCoursesByIds(bottleneckIds);
    const remainingInfoMap = new Map(allRemainingCourses.map((c) => [c.id, c]));

    return {
      bottlenecks: bottleneckIds.map((id) => {
        const info = courseInfoMap.get(id);
        const blockedSet = blockedBy.get(id) ?? new Set<number>();
        return {
          courseId: id,
          courseCode: info?.courseCode ?? `course #${id}`,
          title: info?.title ?? "",
          blockedCount: blockedSet.size,
          blockedCourses: Array.from(blockedSet).slice(0, 5).map((cid) => {
            const c = remainingInfoMap.get(cid);
            return { courseId: cid, courseCode: c?.courseCode ?? `course #${cid}` };
          }),
        };
      }),
    };
  };
}
