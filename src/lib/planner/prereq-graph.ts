import { createClient } from "@/lib/supabase/client";

/**
 * Extracts prerequisite edges from the course_req_sets / course_req_nodes / course_req_atoms
 * tree structure. Returns a Map where each key is a course ID and the value is the set of
 * course IDs that must be completed before it.
 *
 * For OR nodes, picks the branch with the fewest prerequisites (greedy heuristic).
 */

type ReqSetRow = { id: number; course_id: number; set_type: string };
type ReqNodeRow = {
  id: number;
  req_set_id: number;
  parent_id: number | null;
  node_type: string;
};
type ReqAtomRow = {
  node_id: number;
  atom_type: string;
  required_course_id: number | null;
};

function normalizeNodeType(raw: string): "AND" | "OR" | "ATOM" {
  const upper = (raw ?? "").toUpperCase().trim();
  if (upper === "AND") return "AND";
  if (upper === "OR") return "OR";
  return "ATOM";
}

/**
 * Walk the prereq tree for a single req_set and extract the set of prerequisite course IDs.
 * For OR nodes: picks the branch with the fewest prerequisites.
 * For AND nodes: unions all branches.
 * For ATOM nodes: returns the required_course_id if it's a COURSE atom.
 */
function extractEdgesFromTree(
  setNodes: ReqNodeRow[],
  atomsByNode: Map<number, ReqAtomRow[]>,
  relevantCourseIds: Set<number>
): Set<number> {
  const nodesById = new Map<number, ReqNodeRow>();
  const childrenByParent = new Map<number | null, number[]>();

  for (const node of setNodes) {
    nodesById.set(node.id, node);
    const parentId = node.parent_id;
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId)!.push(node.id);
  }

  const visiting = new Set<number>();

  function walk(nodeId: number): Set<number> {
    if (visiting.has(nodeId)) return new Set(); // cycle guard
    visiting.add(nodeId);

    const node = nodesById.get(nodeId);
    if (!node) { visiting.delete(nodeId); return new Set(); }

    const childIds = childrenByParent.get(nodeId) ?? [];
    const atoms = atomsByNode.get(nodeId) ?? [];
    const nodeType = atoms.length > 0 && childIds.length === 0
      ? "ATOM"
      : normalizeNodeType(node.node_type);

    let result: Set<number>;

    if (nodeType === "ATOM") {
      result = new Set<number>();
      for (const atom of atoms) {
        if (
          (atom.atom_type ?? "").toUpperCase() === "COURSE" &&
          atom.required_course_id != null
        ) {
          result.add(atom.required_course_id);
        }
      }
    } else if (nodeType === "OR") {
      // Pick the branch with fewest prereqs, preferring branches within our relevant set
      let bestBranch: Set<number> | null = null;
      for (const childId of childIds) {
        const branch = walk(childId);
        // Filter to only prereqs in our relevant set
        const relevantBranch = new Set(
          [...branch].filter((id) => relevantCourseIds.has(id))
        );
        if (
          bestBranch === null ||
          relevantBranch.size < bestBranch.size
        ) {
          bestBranch = relevantBranch;
        }
      }
      result = bestBranch ?? new Set();
    } else {
      // AND: union all children
      result = new Set<number>();
      for (const childId of childIds) {
        for (const prereq of walk(childId)) {
          result.add(prereq);
        }
      }
    }

    visiting.delete(nodeId);
    return result;
  }

  // Walk from root nodes (parent_id = null)
  const rootIds = childrenByParent.get(null) ?? [];
  const allPrereqs = new Set<number>();

  if (rootIds.length === 0) {
    // Fallback: treat nodes with no valid parent as roots
    for (const [id, node] of nodesById) {
      if (node.parent_id == null || !nodesById.has(node.parent_id)) {
        for (const prereq of walk(id)) allPrereqs.add(prereq);
      }
    }
  } else {
    for (const rootId of rootIds) {
      for (const prereq of walk(rootId)) allPrereqs.add(prereq);
    }
  }

  return allPrereqs;
}

/**
 * For a given set of course IDs, fetch the prerequisite tree from Supabase
 * and return a map of courseId → Set<prerequisite courseIds>.
 *
 * Only returns edges where the prerequisite is in the given courseIds set
 * (i.e., only edges between courses we're scheduling).
 */
export async function extractPrereqEdges(
  courseIds: number[]
): Promise<Map<number, Set<number>>> {
  const result = new Map<number, Set<number>>();
  if (courseIds.length === 0) return result;

  const courseIdSet = new Set(courseIds);
  const supabase = createClient();

  // Fetch all PREREQ req_sets for our courses
  const { data: reqSetsData, error: reqSetsErr } = await supabase
    .from("course_req_sets")
    .select("id, course_id, set_type")
    .eq("set_type", "PREREQ")
    .in("course_id", courseIds);

  if (reqSetsErr) throw reqSetsErr;
  const reqSets = (reqSetsData ?? []) as ReqSetRow[];
  if (reqSets.length === 0) return result;

  const setIds = reqSets.map((s) => s.id);

  // Fetch nodes first, then atoms filtered by node IDs
  const nodesRes = await supabase
    .from("course_req_nodes")
    .select("id, req_set_id, parent_id, node_type")
    .in("req_set_id", setIds);

  if (nodesRes.error) throw nodesRes.error;
  const allNodes = (nodesRes.data ?? []) as ReqNodeRow[];

  const nodeIds = allNodes.map((n) => n.id);
  if (nodeIds.length === 0) return result;

  const atomsRes = await supabase
    .from("course_req_atoms")
    .select("node_id, atom_type, required_course_id")
    .in("node_id", nodeIds);

  if (atomsRes.error) throw atomsRes.error;
  const relevantAtoms = (atomsRes.data ?? []) as ReqAtomRow[];

  // Group nodes by req_set_id
  const nodesBySet = new Map<number, ReqNodeRow[]>();
  for (const node of allNodes) {
    if (!nodesBySet.has(node.req_set_id)) nodesBySet.set(node.req_set_id, []);
    nodesBySet.get(node.req_set_id)!.push(node);
  }

  // Group atoms by node_id
  const atomsByNode = new Map<number, ReqAtomRow[]>();
  for (const atom of relevantAtoms) {
    if (!atomsByNode.has(atom.node_id)) atomsByNode.set(atom.node_id, []);
    atomsByNode.get(atom.node_id)!.push(atom);
  }

  // For each course's req_sets, extract edges
  for (const reqSet of reqSets) {
    const courseId = reqSet.course_id;
    const setNodes = nodesBySet.get(reqSet.id) ?? [];
    if (setNodes.length === 0) continue;

    const prereqs = extractEdgesFromTree(setNodes, atomsByNode, courseIdSet);

    // Only keep prereqs that are in our set of courses to schedule
    const filtered = new Set([...prereqs].filter((id) => courseIdSet.has(id)));

    // Remove self-references
    filtered.delete(courseId);

    if (filtered.size > 0) {
      const existing = result.get(courseId);
      if (existing) {
        for (const id of filtered) existing.add(id);
      } else {
        result.set(courseId, filtered);
      }
    }
  }

  // Break cycles: if A requires B and B requires A, remove the edge to the higher-numbered course
  for (const [courseId, prereqs] of result) {
    for (const prereqId of prereqs) {
      const reversePrereqs = result.get(prereqId);
      if (reversePrereqs?.has(courseId)) {
        // Break cycle by removing edge to higher-numbered course
        if (courseId > prereqId) {
          prereqs.delete(prereqId);
        } else {
          reversePrereqs.delete(courseId);
        }
      }
    }
  }

  return result;
}
