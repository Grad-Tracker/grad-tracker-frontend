import type { AdvisorToolDependencies } from "../shared/dependencies";
import { normalizeCourseCode } from "../shared/utils";

export type GetFullPrereqChainInput = {
  courseCodes: string[];
};

export const GET_FULL_PREREQ_CHAIN_DEFINITION = {
  name: "get_full_prereq_chain",
  description:
    "Recursively expand the full prerequisite tree for one or more courses, tracing all the way back to courses with no prerequisites. Use when the student asks 'where do I start to eventually take X?' or 'what is the full prerequisite path for X?'. Marks already-completed courses in the chain.",
  input_schema: {
    type: "object" as const,
    required: ["courseCodes"] as const,
    properties: {
      courseCodes: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Course codes to trace the full prereq chain for, e.g. [\"CIS 570\"]",
      },
    },
  },
} as const;

type ChainNode = {
  courseId: number;
  courseCode: string;
  title: string;
  credits: number;
  depth: number;
  directPrereqIds: number[];
};

type ChainEntry = {
  targetCourseCode: string;
  targetCourseId: number | null;
  found: boolean;
  nodes: ChainNode[];
  maxDepth: number;
  alreadyCompleted: number[];
};

export function createGetFullPrereqChainTool(deps: AdvisorToolDependencies) {
  return async function (input: GetFullPrereqChainInput) {
    const codes = (input.courseCodes ?? []).map((c) => normalizeCourseCode(c)).filter(Boolean);
    if (codes.length === 0) {
      return { chains: [], unresolvedCourseCodes: [] };
    }

    const { resolvedIds, resolvedCodes, unresolvedCodes } =
      await deps.resolveCourseIdsByCodes(codes);

    // Get completed course IDs for this student.
    const historyEntries = await deps.getCourseHistory({ completedOnly: true });
    const completedIds = new Set(historyEntries.map((h) => h.courseId));

    const chains: ChainEntry[] = [];

    for (let i = 0; i < resolvedIds.length; i++) {
      const targetId = resolvedIds[i]!;
      const targetCode = resolvedCodes[i] ?? `course #${targetId}`;

      // BFS to collect all prereq course IDs.
      type NodeEntry = { courseId: number; depth: number; directPrereqIds: number[] };
      const nodeMap = new Map<number, NodeEntry>();
      const queue: Array<{ courseId: number; depth: number }> = [{ courseId: targetId, depth: 0 }];
      const visited = new Set<number>();
      const alreadyCompleted: number[] = [];

      while (queue.length > 0) {
        const batch = queue.splice(0, 20); // process in batches of 20
        const unvisited = batch.filter((item) => {
          if (visited.has(item.courseId)) return false;
          visited.add(item.courseId);
          return true;
        });
        if (unvisited.length === 0) continue;

        const batchIds = unvisited.map((u) => u.courseId);
        const prereqDefs = await deps.getCoursePrerequisites(batchIds);

        for (const { courseId, depth } of unvisited) {
          const def = prereqDefs.get(courseId);
          const directPrereqIds = def?.requiredCourseIds ?? [];
          nodeMap.set(courseId, { courseId, depth, directPrereqIds });

          for (const reqId of directPrereqIds) {
            if (completedIds.has(reqId)) {
              alreadyCompleted.push(reqId);
            } else if (!visited.has(reqId)) {
              queue.push({ courseId: reqId, depth: depth + 1 });
            }
          }
        }
      }

      // Look up course info for all discovered IDs.
      const allIds = Array.from(nodeMap.keys());
      const courseInfoMap = await deps.getCoursesByIds(allIds);

      const nodes = Array.from(nodeMap.values())
        .sort((a, b) => b.depth - a.depth) // deepest (furthest prereq) first
        .map((entry) => {
          const info = courseInfoMap.get(entry.courseId);
          return {
            courseId: entry.courseId,
            courseCode: info?.courseCode ?? `course #${entry.courseId}`,
            title: info?.title ?? "",
            credits: info?.credits ?? 0,
            depth: entry.depth,
            directPrereqIds: entry.directPrereqIds,
          };
        });

      const maxDepth = nodes.length > 0 ? Math.max(...nodes.map((n) => n.depth)) : 0;

      chains.push({
        targetCourseCode: targetCode,
        targetCourseId: targetId,
        found: true,
        nodes,
        maxDepth,
        alreadyCompleted: Array.from(new Set(alreadyCompleted)),
      });
    }

    // Add not-found entries for unresolved codes.
    for (const code of unresolvedCodes) {
      chains.push({
        targetCourseCode: code,
        targetCourseId: null,
        found: false,
        nodes: [],
        maxDepth: 0,
        alreadyCompleted: [],
      });
    }

    return { chains, unresolvedCourseCodes: unresolvedCodes };
  };
}
