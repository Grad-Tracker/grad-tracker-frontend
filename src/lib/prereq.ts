import { createClient } from "@/lib/supabase/client";
import { DB_VIEWS } from "@/lib/supabase/queries/schema";

export type PrereqEvaluation = {
  unlocked: boolean;
  summary: string[];
};

export type PrereqEvaluationMap = Map<number, PrereqEvaluation>;

type ReqSetRow = {
  id?: unknown;
  course_id?: unknown;
  set_type?: unknown;
};

type ReqNodeRow = {
  id?: unknown;
  req_set_id?: unknown;
  parent_id?: unknown;
  node_type?: unknown;
  type?: unknown;
  operator?: unknown;
  kind?: unknown;
};

type ReqAtomRow = {
  id?: unknown;
  node_id?: unknown;
  atom_type?: unknown;
  type?: unknown;
  required_course_id?: unknown;
  course_id?: unknown;
  min_grade?: unknown;
};

type StudentHistoryRow = {
  student?: unknown;
  student_id?: unknown;
  course?: unknown;
  course_id?: unknown;
  grade?: unknown;
  completed?: unknown;
};

type EvalResult = {
  ok: boolean;
  summary: string[];
};

type SupabasePrereqClient = {
  from: (table: string) => any;
};

const GRADE_RANK: Record<string, number> = {
  "A+": 12,
  A: 12,
  "A-": 11,
  "B+": 10,
  B: 9,
  "B-": 8,
  "C+": 7,
  C: 6,
  "C-": 5,
  "D+": 4,
  D: 3,
  "D-": 2,
  F: 0,
};

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNodeType(node: ReqNodeRow, hasAtoms: boolean): "AND" | "OR" | "ATOM" {
  const raw = normText(node.node_type ?? node.type ?? node.operator ?? node.kind).toUpperCase();
  if (raw === "AND") return "AND";
  if (raw === "OR") return "OR";
  if (raw === "ATOM" || raw === "LEAF") return "ATOM";
  return hasAtoms ? "ATOM" : "AND";
}

function normalizeAtomType(atom: ReqAtomRow): "COURSE" | "CONSENT" | "UNKNOWN" {
  const raw = normText(atom.atom_type ?? atom.type).toUpperCase();
  if (raw === "COURSE") return "COURSE";
  if (raw === "CONSENT") return "CONSENT";
  return "UNKNOWN";
}

function normalizeGrade(grade: unknown): string | null {
  const raw = normText(grade).toUpperCase();
  if (!raw) return null;
  const match = raw.match(/^[ABCDF][+-]?/);
  if (!match) return null;
  const g = match[0];
  return Object.prototype.hasOwnProperty.call(GRADE_RANK, g) ? g : null;
}

function gradeMeetsMinimum(studentGrade: unknown, minGrade: unknown): boolean {
  const min = normalizeGrade(minGrade);
  if (!min) return true;

  const student = normalizeGrade(studentGrade);
  if (!student) return false;

  return GRADE_RANK[student] >= GRADE_RANK[min];
}

function formatCourseRequirement(
  requiredCourseId: number,
  minGrade: unknown,
  courseCodeMap: Map<number, string>
): string {
  const code = courseCodeMap.get(requiredCourseId) ?? `course #${requiredCourseId}`;
  const min = normalizeGrade(minGrade);
  if (min) {
    return `Requires ${code} (${min} or better)`;
  }
  return `Requires ${code}`;
}

function dedupeSummary(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
}

async function fetchCompletedHistoryRows(supabase: SupabasePrereqClient, studentId: number) {
  const res = await supabase
    .from(DB_VIEWS.studentCourseProgress)
    .select("student_id, course_id, grade, completed, progress_status")
    .eq("student_id", studentId)
    .eq("completed", true);

  if (res.error) return { data: null, error: res.error };

  return {
    data: (res.data ?? []).map((row: any) => ({
      student_id: row.student_id,
      course_id: row.course_id,
      grade: row.grade,
      completed: row.completed,
    })),
    error: null,
  };
}

export async function evaluatePrereqsForCourses(
  targetCourseIds: number[],
  studentId: number,
  supabaseOverride?: SupabasePrereqClient
): Promise<PrereqEvaluationMap> {
  const courseIds = Array.from(
    new Set(targetCourseIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))
  );

  const result: PrereqEvaluationMap = new Map();
  for (const courseId of courseIds) {
    result.set(courseId, { unlocked: true, summary: [] });
  }

  if (courseIds.length === 0) return result;

  const supabase = supabaseOverride ?? createClient();

  const { data: reqSetsData, error: reqSetsErr } = await supabase
    .from("course_req_sets")
    .select("*")
    .eq("set_type", "PREREQ")
    .in("course_id", courseIds);

  if (reqSetsErr) throw reqSetsErr;

  const reqSets = (reqSetsData ?? []) as ReqSetRow[];
  if (reqSets.length === 0) return result;

  const setIds = reqSets
    .map((row) => num(row.id))
    .filter((id): id is number => id != null);

  if (setIds.length === 0) return result;

  const { data: reqNodesData, error: reqNodesErr } = await supabase
    .from("course_req_nodes")
    .select("*")
    .in("req_set_id", setIds);

  if (reqNodesErr) throw reqNodesErr;

  const reqNodes = (reqNodesData ?? []) as ReqNodeRow[];
  const nodeIds = reqNodes
    .map((row) => num(row.id))
    .filter((id): id is number => id != null);

  const [atomsRes, historyRes] = await Promise.all([
    nodeIds.length
      ? supabase.from("course_req_atoms").select("*").in("node_id", nodeIds)
      : Promise.resolve({ data: [], error: null }),
    fetchCompletedHistoryRows(supabase, studentId),
  ]);

  if (atomsRes.error) throw atomsRes.error;
  const reqAtoms = (atomsRes.data ?? []) as ReqAtomRow[];

  if (historyRes.error) throw historyRes.error;
  const historyRows = (historyRes.data ?? []) as StudentHistoryRow[];

  // Build a courseId → "SUBJ NUM" map for all referenced prerequisite courses
  const referencedCourseIds = new Set<number>();
  for (const atom of reqAtoms) {
    const id = num(atom.required_course_id ?? atom.course_id);
    if (id != null) referencedCourseIds.add(id);
  }
  const courseCodeMap = new Map<number, string>();
  if (referencedCourseIds.size > 0) {
    const { data: courseRows } = await supabase
      .from(DB_VIEWS.courseCatalog)
      .select("course_id, subject, number")
      .in("course_id", Array.from(referencedCourseIds));
    for (const row of courseRows ?? []) {
      const id = Number(row.course_id);
      const code = `${String(row.subject ?? "").trim()} ${String(row.number ?? "").trim()}`.trim().toUpperCase();
      if (code) courseCodeMap.set(id, code);
    }
  }

  const completedByCourse = new Map<number, StudentHistoryRow[]>();
  for (const row of historyRows) {
    const courseId = num(row.course ?? row.course_id);
    if (courseId == null) continue;
    if (!completedByCourse.has(courseId)) completedByCourse.set(courseId, []);
    completedByCourse.get(courseId)!.push(row);
  }

  const nodesBySet = new Map<number, ReqNodeRow[]>();
  for (const node of reqNodes) {
    const setId = num(node.req_set_id);
    if (setId == null) continue;
    if (!nodesBySet.has(setId)) nodesBySet.set(setId, []);
    nodesBySet.get(setId)!.push(node);
  }

  const atomsByNode = new Map<number, ReqAtomRow[]>();
  for (const atom of reqAtoms) {
    const nodeId = num(atom.node_id);
    if (nodeId == null) continue;
    if (!atomsByNode.has(nodeId)) atomsByNode.set(nodeId, []);
    atomsByNode.get(nodeId)!.push(atom);
  }

  function evalAtom(atom: ReqAtomRow): EvalResult {
    const atomType = normalizeAtomType(atom);

    if (atomType === "CONSENT") {
      return { ok: false, summary: ["Instructor consent required"] };
    }

    if (atomType === "COURSE") {
      const requiredCourseId = num(atom.required_course_id ?? atom.course_id);
      if (requiredCourseId == null) {
        return { ok: false, summary: ["Missing prerequisite course mapping"] };
      }

      const attempts = completedByCourse.get(requiredCourseId) ?? [];
      // A completed row with no grade means the student marked it done without entering a grade.
      // Trust the completion flag — don't penalize missing grade entries.
      const ok = attempts.some((attempt) =>
        attempt.grade == null
          ? true
          : gradeMeetsMinimum(attempt.grade, atom.min_grade)
      );

      if (ok) return { ok: true, summary: [] };

      const requirement = formatCourseRequirement(requiredCourseId, atom.min_grade, courseCodeMap);
      const code = courseCodeMap.get(requiredCourseId) ?? `course #${requiredCourseId}`;
      let status: string;
      if (attempts.length === 0) {
        status = `Student has not taken ${code}`;
      } else {
        const bestGrade = attempts
          .map((a) => String(a.grade ?? "").toUpperCase().trim())
          .filter(Boolean)
          .join(", ");
        status = `Student took ${code} but grade (${bestGrade || "unknown"}) does not meet minimum`;
      }

      return {
        ok: false,
        summary: [requirement, status],
      };
    }

    return { ok: false, summary: ["Unsupported prerequisite requirement"] };
  }

  function evalNodeFactory(
    nodesById: Map<number, ReqNodeRow>,
    childrenByParent: Map<number | null, number[]>
  ) {
    const visiting = new Set<number>();
    const memo = new Map<number, EvalResult>();

    const evalNode = (nodeId: number): EvalResult => {
      if (memo.has(nodeId)) return memo.get(nodeId)!;
      if (visiting.has(nodeId)) {
        return { ok: false, summary: ["Invalid prerequisite definition (cycle)"] };
      }

      const node = nodesById.get(nodeId);
      if (!node) return { ok: false, summary: ["Missing prerequisite node"] };

      visiting.add(nodeId);

      const childIds = childrenByParent.get(nodeId) ?? [];
      const atoms = atomsByNode.get(nodeId) ?? [];
      const nodeType = normalizeNodeType(node, atoms.length > 0);

      let out: EvalResult;

      if (nodeType === "ATOM") {
        if (atoms.length === 0) {
          out = { ok: false, summary: ["Missing prerequisite atom"] };
        } else {
          const atomResults = atoms.map(evalAtom);
          const ok = atomResults.some((r) => r.ok);
          out = ok
            ? { ok: true, summary: [] }
            : { ok: false, summary: dedupeSummary(atomResults.flatMap((r) => r.summary)) };
        }
      } else {
        const childResults = childIds.map(evalNode);
        if (childResults.length === 0) {
          out = { ok: true, summary: [] };
        } else if (nodeType === "AND") {
          out = {
            ok: childResults.every((r) => r.ok),
            summary: dedupeSummary(childResults.filter((r) => !r.ok).flatMap((r) => r.summary)),
          };
        } else {
          const ok = childResults.some((r) => r.ok);
          out = {
            ok,
            summary: ok
              ? []
              : dedupeSummary(
                  childResults.flatMap((r) => r.summary.length ? r.summary : ["One prerequisite option is required"])
                ),
          };
        }
      }

      visiting.delete(nodeId);
      memo.set(nodeId, out);
      return out;
    };

    return evalNode;
  }

  const reqSetsByCourse = new Map<number, ReqSetRow[]>();
  for (const reqSet of reqSets) {
    const courseId = num(reqSet.course_id);
    const setId = num(reqSet.id);
    if (courseId == null || setId == null) continue;
    if (!reqSetsByCourse.has(courseId)) reqSetsByCourse.set(courseId, []);
    reqSetsByCourse.get(courseId)!.push(reqSet);
  }

  for (const [courseId, setsForCourse] of reqSetsByCourse) {
    const setResults: EvalResult[] = [];

    for (const reqSet of setsForCourse) {
      const setId = num(reqSet.id);
      if (setId == null) continue;

      const setNodes = nodesBySet.get(setId) ?? [];
      if (setNodes.length === 0) {
        setResults.push({ ok: true, summary: [] });
        continue;
      }

      const nodesById = new Map<number, ReqNodeRow>();
      const childrenByParent = new Map<number | null, number[]>();

      for (const node of setNodes) {
        const nodeId = num(node.id);
        if (nodeId == null) continue;
        nodesById.set(nodeId, node);

        const parentId = num(node.parent_id);
        if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
        childrenByParent.get(parentId)!.push(nodeId);
      }

      const rootIds = childrenByParent.get(null) ?? [];
      const evalNode = evalNodeFactory(nodesById, childrenByParent);

      let setResult: EvalResult;
      if (rootIds.length === 0) {
        // Fallback: treat all nodes with no valid parent in this set as roots
        const fallbackRoots = Array.from(nodesById.keys()).filter((id) => {
          const p = num(nodesById.get(id)?.parent_id);
          return p == null || !nodesById.has(p);
        });
        const rootResults = fallbackRoots.map(evalNode);
        setResult = {
          ok: rootResults.every((r) => r.ok),
          summary: dedupeSummary(rootResults.filter((r) => !r.ok).flatMap((r) => r.summary)),
        };
      } else {
        const rootResults = rootIds.map(evalNode);
        setResult = {
          ok: rootResults.every((r) => r.ok),
          summary: dedupeSummary(rootResults.filter((r) => !r.ok).flatMap((r) => r.summary)),
        };
      }

      setResults.push(setResult);
    }

    if (setResults.length === 0) continue;

    result.set(courseId, {
      unlocked: setResults.every((r) => r.ok),
      summary: dedupeSummary(setResults.filter((r) => !r.ok).flatMap((r) => r.summary)),
    });
  }

  return result;
}

// ── Prerequisite definition (no student context) ───────────

export type PrereqDefinition = {
  hasPrereqs: boolean;
  /** Human-readable list of requirements, e.g. ["Requires CSCI 200", "One of: CSCI 300, MATH 280"] */
  items: string[];
  /** All course IDs directly required (flattened, for programmatic ordering checks). */
  requiredCourseIds: number[];
};

export type PrereqDefinitionMap = Map<number, PrereqDefinition>;

/**
 * Returns the prerequisite *definition* for each requested course without
 * evaluating whether any student meets them.  Reuses the same DB tables and
 * normalizer helpers as evaluatePrereqsForCourses.
 */
export async function fetchPrereqDefinitions(
  targetCourseIds: number[],
  supabaseOverride?: SupabasePrereqClient
): Promise<PrereqDefinitionMap> {
  const courseIds = Array.from(
    new Set(targetCourseIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))
  );

  const result: PrereqDefinitionMap = new Map();
  for (const courseId of courseIds) {
    result.set(courseId, { hasPrereqs: false, items: [], requiredCourseIds: [] });
  }

  if (courseIds.length === 0) return result;

  const supabase = supabaseOverride ?? createClient();

  const { data: reqSetsData, error: reqSetsErr } = await supabase
    .from("course_req_sets")
    .select("*")
    .eq("set_type", "PREREQ")
    .in("course_id", courseIds);

  if (reqSetsErr) throw reqSetsErr;

  const reqSets = (reqSetsData ?? []) as ReqSetRow[];
  if (reqSets.length === 0) return result;

  const setIds = reqSets
    .map((row) => num(row.id))
    .filter((id): id is number => id != null);

  if (setIds.length === 0) return result;

  const { data: reqNodesData, error: reqNodesErr } = await supabase
    .from("course_req_nodes")
    .select("*")
    .in("req_set_id", setIds);

  if (reqNodesErr) throw reqNodesErr;

  const reqNodes = (reqNodesData ?? []) as ReqNodeRow[];
  const nodeIds = reqNodes
    .map((row) => num(row.id))
    .filter((id): id is number => id != null);

  const atomsRes = nodeIds.length
    ? await supabase.from("course_req_atoms").select("*").in("node_id", nodeIds)
    : { data: [], error: null };

  if (atomsRes.error) throw atomsRes.error;
  const reqAtoms = (atomsRes.data ?? []) as ReqAtomRow[];

  // Build course code map for all referenced courses.
  const referencedCourseIds = new Set<number>();
  for (const atom of reqAtoms) {
    const id = num(atom.required_course_id ?? atom.course_id);
    if (id != null) referencedCourseIds.add(id);
  }

  const courseCodeMap = new Map<number, string>();
  if (referencedCourseIds.size > 0) {
    const { data: courseRows } = await supabase
      .from(DB_VIEWS.courseCatalog)
      .select("course_id, subject, number")
      .in("course_id", Array.from(referencedCourseIds));
    for (const row of courseRows ?? []) {
      const id = Number(row.course_id);
      const code = `${String(row.subject ?? "").trim()} ${String(row.number ?? "").trim()}`.trim().toUpperCase();
      if (code) courseCodeMap.set(id, code);
    }
  }

  // Index nodes and atoms.
  const nodesBySet = new Map<number, ReqNodeRow[]>();
  for (const node of reqNodes) {
    const setId = num(node.req_set_id);
    if (setId == null) continue;
    if (!nodesBySet.has(setId)) nodesBySet.set(setId, []);
    nodesBySet.get(setId)!.push(node);
  }

  const atomsByNode = new Map<number, ReqAtomRow[]>();
  for (const atom of reqAtoms) {
    const nodeId = num(atom.node_id);
    if (nodeId == null) continue;
    if (!atomsByNode.has(nodeId)) atomsByNode.set(nodeId, []);
    atomsByNode.get(nodeId)!.push(atom);
  }

  // Build setId → courseId and nodeId → courseId maps for collecting requiredCourseIds.
  const setToCourseId = new Map<number, number>();
  for (const reqSet of reqSets) {
    const setId = num(reqSet.id);
    const courseId = num(reqSet.course_id);
    if (setId != null && courseId != null) setToCourseId.set(setId, courseId);
  }
  const nodeToCourseId = new Map<number, number>();
  for (const node of reqNodes) {
    const nodeId = num(node.id);
    const setId = num(node.req_set_id);
    if (nodeId == null || setId == null) continue;
    const courseId = setToCourseId.get(setId);
    if (courseId != null) nodeToCourseId.set(nodeId, courseId);
  }
  const reqCourseIdsByCourse = new Map<number, Set<number>>();
  for (const atom of reqAtoms) {
    if (normalizeAtomType(atom) !== "COURSE") continue;
    const nodeId = num(atom.node_id);
    if (nodeId == null) continue;
    const courseId = nodeToCourseId.get(nodeId);
    if (courseId == null) continue;
    const reqId = num(atom.required_course_id ?? atom.course_id);
    if (reqId == null) continue;
    if (!reqCourseIdsByCourse.has(courseId)) reqCourseIdsByCourse.set(courseId, new Set());
    reqCourseIdsByCourse.get(courseId)!.add(reqId);
  }

  // Describe a single atom as a short phrase.
  function describeAtomEntry(atom: ReqAtomRow): string | null {
    const atomType = normalizeAtomType(atom);
    if (atomType === "CONSENT") return "Instructor consent";
    if (atomType === "COURSE") {
      const id = num(atom.required_course_id ?? atom.course_id);
      if (id == null) return null;
      const code = courseCodeMap.get(id) ?? `course #${id}`;
      const min = normalizeGrade(atom.min_grade);
      return min ? `${code} (${min} or better)` : code;
    }
    return null;
  }

  // Recursively describe a node as a list of requirement strings.
  function describeNode(
    nodeId: number,
    nodesById: Map<number, ReqNodeRow>,
    childrenByParent: Map<number | null, number[]>
  ): string[] {
    const node = nodesById.get(nodeId);
    if (!node) return [];

    const atoms = atomsByNode.get(nodeId) ?? [];
    const childIds = childrenByParent.get(nodeId) ?? [];
    const nodeType = normalizeNodeType(node, atoms.length > 0);

    if (nodeType === "ATOM") {
      return atoms.map(describeAtomEntry).filter((d): d is string => d !== null);
    }

    const childLines = childIds.flatMap((cid) => describeNode(cid, nodesById, childrenByParent));

    if (nodeType === "AND") {
      return childLines; // All required — list each separately.
    } else {
      // OR — wrap in a single "one of:" phrase.
      if (childLines.length === 0) return [];
      if (childLines.length === 1) return childLines;
      return [`One of: ${childLines.join(", ")}`];
    }
  }

  // Group req sets by course.
  const reqSetsByCourse = new Map<number, ReqSetRow[]>();
  for (const reqSet of reqSets) {
    const courseId = num(reqSet.course_id);
    if (courseId == null) continue;
    if (!reqSetsByCourse.has(courseId)) reqSetsByCourse.set(courseId, []);
    reqSetsByCourse.get(courseId)!.push(reqSet);
  }

  for (const [courseId, setsForCourse] of reqSetsByCourse) {
    const allItems: string[] = [];

    for (const reqSet of setsForCourse) {
      const setId = num(reqSet.id);
      if (setId == null) continue;

      const setNodes = nodesBySet.get(setId) ?? [];
      if (setNodes.length === 0) continue;

      const nodesById = new Map<number, ReqNodeRow>();
      const childrenByParent = new Map<number | null, number[]>();

      for (const node of setNodes) {
        const nodeId = num(node.id);
        if (nodeId == null) continue;
        nodesById.set(nodeId, node);
        const parentId = num(node.parent_id);
        if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
        childrenByParent.get(parentId)!.push(nodeId);
      }

      const rootIds = childrenByParent.get(null) ?? [];
      const roots = rootIds.length > 0
        ? rootIds
        : Array.from(nodesById.keys()).filter((id) => {
            const p = num(nodesById.get(id)?.parent_id);
            return p == null || !nodesById.has(p);
          });

      for (const rootId of roots) {
        const lines = describeNode(rootId, nodesById, childrenByParent);
        allItems.push(...lines);
      }
    }

    const deduped = dedupeSummary(allItems);
    const requiredCourseIds = Array.from(reqCourseIdsByCourse.get(courseId) ?? []);
    result.set(courseId, { hasPrereqs: deduped.length > 0, items: deduped, requiredCourseIds });
  }

  return result;
}
