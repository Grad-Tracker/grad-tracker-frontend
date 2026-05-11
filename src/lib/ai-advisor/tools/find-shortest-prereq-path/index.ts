import type { AdvisorToolDependencies } from "../shared/dependencies";
import { normalizeCourseCode } from "../shared/utils";

export type FindShortestPrereqPathInput = {
  courseCode: string;
};

export const FIND_SHORTEST_PREREQ_PATH_DEFINITION = {
  name: "find_shortest_prereq_path",
  description:
    "Given a target course the student wants to reach, compute the minimum number of semesters required to satisfy its entire prerequisite chain given what the student has already completed.",
  input_schema: {
    type: "object" as const,
    required: ["courseCode"] as const,
    properties: {
      courseCode: { type: "string" as const, description: 'Target course code, e.g. "CIS 570"' },
    },
  },
} as const;

export function createFindShortestPrereqPathTool(deps: AdvisorToolDependencies) {
  return async function (input: FindShortestPrereqPathInput) {
    const code = normalizeCourseCode(input.courseCode);
    const resolved = await deps.resolveCourseIdsByCodes([code]);
    const targetId = resolved.resolvedIds[0] ?? null;

    if (targetId == null) {
      return {
        targetCourseCode: code,
        targetCourseId: null,
        found: false,
        alreadyEligible: false,
        requiredFirst: [],
        minimumTermsNeeded: 0,
        message: `Course "${code}" was not found in the catalog.`,
      };
    }

    // Get completed courses.
    const history = await deps.getCourseHistory();
    const completedIds = new Set(history.map((h) => h.courseId));

    // BFS to collect all prerequisite courses not yet completed.
    const neededIds = new Set<number>();
    const queue = [targetId];
    const visited = new Set<number>([targetId]);

    while (queue.length > 0) {
      const batch = queue.splice(0, 20);
      const prereqMap = await deps.getCoursePrerequisites(batch);

      for (const courseId of batch) {
        const def = prereqMap.get(courseId);
        if (!def?.hasPrereqs) continue;

        for (const reqId of def.requiredCourseIds) {
          if (completedIds.has(reqId) || visited.has(reqId)) continue;
          visited.add(reqId);
          neededIds.add(reqId);
          queue.push(reqId);
        }
      }
    }

    const alreadyEligible = neededIds.size === 0;

    if (alreadyEligible) {
      return {
        targetCourseCode: code,
        targetCourseId: targetId,
        found: true,
        alreadyEligible: true,
        requiredFirst: [],
        minimumTermsNeeded: 1,
        message: `You already meet the prerequisites for ${code}. You can take it as soon as it is offered.`,
      };
    }

    // Get course info for needed courses.
    const courseMap = await deps.getCoursesByIds(Array.from(neededIds));
    const requiredFirst = Array.from(neededIds).map((id) => {
      const info = courseMap.get(id);
      return {
        courseId: id,
        courseCode: info?.courseCode ?? `Course ${id}`,
        title: info?.title ?? "",
        credits: info?.credits ?? 0,
      };
    });

    // Estimate minimum terms: each term can take one "level" of the prereq chain.
    // Simple approximation: depth of the prereq chain = minimum terms needed before target.
    // We already have a BFS-derived flat list; depth approximation = ceil(log2(N+1)) is naive.
    // Better: re-run BFS tracking max depth.
    const depthMap = new Map<number, number>();
    depthMap.set(targetId, 0);

    const depthQueue = [{ id: targetId, depth: 0 }];
    const depthVisited = new Set<number>([targetId]);

    while (depthQueue.length > 0) {
      const current = depthQueue.shift()!;
      const batch2 = [current.id];
      const prereqMap2 = await deps.getCoursePrerequisites(batch2);
      const def2 = prereqMap2.get(current.id);
      if (!def2?.hasPrereqs) continue;

      for (const reqId of def2.requiredCourseIds) {
        if (depthVisited.has(reqId)) continue;
        depthVisited.add(reqId);
        const d = current.depth + 1;
        depthMap.set(reqId, Math.max(depthMap.get(reqId) ?? 0, d));
        depthQueue.push({ id: reqId, depth: d });
      }
    }

    const maxDepth = Math.max(0, ...Array.from(depthMap.values()));
    // minimumTermsNeeded = chain depth (terms to satisfy prereqs) + 1 (term for the target itself).
    const minimumTermsNeeded = maxDepth + 1;

    return {
      targetCourseCode: code,
      targetCourseId: targetId,
      found: true,
      alreadyEligible: false,
      requiredFirst,
      minimumTermsNeeded,
      message: `To take ${code} you must first complete ${neededIds.size} prerequisite course(s). Minimum ${minimumTermsNeeded} term(s) needed (including the term you take ${code}).`,
    };
  };
}
