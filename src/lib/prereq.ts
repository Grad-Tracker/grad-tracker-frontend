import { createClient } from "@/lib/supabase/client";

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

function formatCourseRequirement(requiredCourseId: number, minGrade: unknown): string {
  const min = normalizeGrade(minGrade);
  if (min) {
    return `Requires course ${requiredCourseId} (${min} or better)`;
  }
  return `Requires course ${requiredCourseId}`;
}

function dedupeSummary(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
}

async function fetchCompletedHistoryRows(supabase: ReturnType<typeof createClient>, studentId: number) {
  const tryColumns = ["student", "student_id"] as const;
  let lastError: unknown = null;

  for (const studentCol of tryColumns) {
    const res = await supabase
      .from("student_course_history")
      .select("*")
      .eq(studentCol, studentId)
      .eq("completed", true);

    if (!res.error) {
      return res;
    }
    lastError = res.error;
  }

  return { data: null, error: lastError };
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
      const ok = attempts.some((attempt) => gradeMeetsMinimum(attempt.grade, atom.min_grade));

      if (ok) return { ok: true, summary: [] };
      return {
        ok: false,
        summary: [formatCourseRequirement(requiredCourseId, atom.min_grade)],
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
