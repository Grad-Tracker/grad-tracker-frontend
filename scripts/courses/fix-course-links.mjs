#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const AUDIT_JSON_RELATIVE = ".playwright-cli/courses-link-audit/course-link-audit-2026-04-20.json";
const CHUNK_SIZE = 100;

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    dryRun: args.has("--dry-run"),
  };
}

function loadEnvFromFile(envPath) {
  const text = fs.readFileSync(envPath, "utf8");
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const sep = line.indexOf("=");
    if (sep < 0) continue;
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim();
    result[key] = value;
  }
  return result;
}

function requireEnvValue(env, key) {
  const value = env[key];
  if (!value) throw new Error(`Missing required env value: ${key}`);
  return value;
}

function createSupabase(env) {
  return createClient(
    requireEnvValue(env, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnvValue(env, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
}

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value) {
  return normalizeWhitespace(value).toUpperCase();
}

function stripPrereqPrefix(value) {
  const text = normalizeWhitespace(value);
  return text.replace(/^Prerequisites?\s*:\s*/i, "").trim();
}

async function loadCourseMap(supabase) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("courses")
      .select("id, subject, number")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  const courseIdByCode = new Map();
  for (const row of rows) {
    const code = normalizeCode(`${row.subject} ${row.number}`);
    if (!code) continue;
    courseIdByCode.set(code, Number(row.id));
  }
  return courseIdByCode;
}

async function loadBucketMap(supabase) {
  const { data, error } = await supabase
    .from("gen_ed_buckets")
    .select("id, code");
  if (error) throw error;

  const bucketIdByCode = new Map();
  for (const row of data ?? []) {
    bucketIdByCode.set(normalizeWhitespace(row.code), Number(row.id));
  }
  return bucketIdByCode;
}

async function loadExistingBucketMappings(supabase) {
  const { data, error } = await supabase
    .from("gen_ed_bucket_courses")
    .select("bucket_id, course_id");
  if (error) throw error;

  const mapping = new Set();
  for (const row of data ?? []) {
    mapping.add(`${Number(row.bucket_id)}:${Number(row.course_id)}`);
  }
  return mapping;
}

async function loadReqStructureForCourses(supabase, courseIds) {
  if (courseIds.length === 0) {
    return {
      setsByCourseId: new Map(),
      nodesBySetId: new Map(),
      atomsByNodeId: new Map(),
    };
  }

  const setRows = [];
  for (let i = 0; i < courseIds.length; i += CHUNK_SIZE) {
    const chunk = courseIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("course_req_sets")
      .select("id, course_id, set_type, eval_policy, note")
      .eq("set_type", "PREREQ")
      .in("course_id", chunk);
    if (error) throw error;
    setRows.push(...(data ?? []));
  }

  const setIds = setRows.map((row) => Number(row.id));
  const nodeRows = [];
  for (let i = 0; i < setIds.length; i += CHUNK_SIZE) {
    const chunk = setIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("course_req_nodes")
      .select("id, req_set_id, node_type, parent_id, sort_order")
      .in("req_set_id", chunk);
    if (error) throw error;
    nodeRows.push(...(data ?? []));
  }

  const nodeIds = nodeRows.map((row) => Number(row.id));
  const atomRows = [];
  for (let i = 0; i < nodeIds.length; i += CHUNK_SIZE) {
    const chunk = nodeIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("course_req_atoms")
      .select("node_id, atom_type, required_course_id")
      .in("node_id", chunk);
    if (error) throw error;
    atomRows.push(...(data ?? []));
  }

  const setsByCourseId = new Map();
  for (const row of setRows) {
    const courseId = Number(row.course_id);
    if (!setsByCourseId.has(courseId)) setsByCourseId.set(courseId, []);
    setsByCourseId.get(courseId).push({
      id: Number(row.id),
      eval_policy: row.eval_policy,
      note: row.note,
    });
  }
  for (const list of setsByCourseId.values()) {
    list.sort((a, b) => a.id - b.id);
  }

  const nodesBySetId = new Map();
  for (const row of nodeRows) {
    const setId = Number(row.req_set_id);
    if (!nodesBySetId.has(setId)) nodesBySetId.set(setId, []);
    nodesBySetId.get(setId).push({
      id: Number(row.id),
      req_set_id: setId,
      node_type: normalizeWhitespace(row.node_type).toUpperCase(),
      parent_id: row.parent_id == null ? null : Number(row.parent_id),
      sort_order: Number(row.sort_order ?? 0),
    });
  }

  const atomsByNodeId = new Map();
  for (const row of atomRows) {
    const nodeId = Number(row.node_id);
    if (!atomsByNodeId.has(nodeId)) atomsByNodeId.set(nodeId, []);
    atomsByNodeId.get(nodeId).push({
      atom_type: normalizeWhitespace(row.atom_type).toUpperCase(),
      required_course_id:
        row.required_course_id == null ? null : Number(row.required_course_id),
    });
  }

  return { setsByCourseId, nodesBySetId, atomsByNodeId };
}

function pickRootNode(nodes) {
  const roots = nodes.filter((node) => node.parent_id == null).sort((a, b) => a.id - b.id);
  return roots[0] ?? null;
}

function hasCourseAtom(atomsByNodeId, nodeId, prereqCourseId) {
  const atoms = atomsByNodeId.get(nodeId) ?? [];
  return atoms.some(
    (atom) => atom.atom_type === "COURSE" && atom.required_course_id === prereqCourseId
  );
}

function inferGroupNodeType(catalogPrereqText) {
  const text = normalizeWhitespace(catalogPrereqText).toLowerCase();
  if (!text) return "AND";
  const hasComma = text.includes(",") || text.includes(";");
  const hasAnd = /\band\b/.test(text);
  const hasOr = /\bor\b/.test(text);
  if (hasOr && !hasComma && !hasAnd) return "OR";
  return "AND";
}

async function ensurePrereqSet({
  supabase,
  dryRun,
  setsByCourseId,
  courseId,
  note,
  counters,
}) {
  const existing = setsByCourseId.get(courseId) ?? [];
  if (existing.length > 0) return existing[0].id;

  if (dryRun) {
    const fakeId = -1_000_000 - counters.createdSets;
    counters.createdSets += 1;
    setsByCourseId.set(courseId, [{ id: fakeId, eval_policy: "BEFORE_ONLY", note }]);
    return fakeId;
  }

  const payload = {
    course_id: courseId,
    set_type: "PREREQ",
    eval_policy: "BEFORE_ONLY",
    note: note || null,
  };
  const { data, error } = await supabase
    .from("course_req_sets")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;

  const setId = Number(data.id);
  setsByCourseId.set(courseId, [{ id: setId, eval_policy: "BEFORE_ONLY", note }]);
  counters.createdSets += 1;
  return setId;
}

async function ensureRootNode({
  supabase,
  dryRun,
  nodesBySetId,
  setId,
  counters,
}) {
  const nodes = nodesBySetId.get(setId) ?? [];
  const existingRoot = pickRootNode(nodes);
  if (existingRoot) return existingRoot;

  if (dryRun) {
    const fakeId = -2_000_000 - counters.createdNodes;
    counters.createdNodes += 1;
    const node = {
      id: fakeId,
      req_set_id: setId,
      node_type: "ATOM",
      parent_id: null,
      sort_order: 0,
    };
    nodesBySetId.set(setId, [...nodes, node]);
    return node;
  }

  const { data, error } = await supabase
    .from("course_req_nodes")
    .insert({
      req_set_id: setId,
      node_type: "ATOM",
      parent_id: null,
      sort_order: 0,
    })
    .select("id, req_set_id, node_type, parent_id, sort_order")
    .single();
  if (error) throw error;

  const node = {
    id: Number(data.id),
    req_set_id: Number(data.req_set_id),
    node_type: normalizeWhitespace(data.node_type).toUpperCase(),
    parent_id: data.parent_id == null ? null : Number(data.parent_id),
    sort_order: Number(data.sort_order ?? 0),
  };
  nodesBySetId.set(setId, [...nodes, node]);
  counters.createdNodes += 1;
  return node;
}

async function insertCourseAtom({
  supabase,
  dryRun,
  atomsByNodeId,
  nodeId,
  prereqCourseId,
  counters,
}) {
  if (hasCourseAtom(atomsByNodeId, nodeId, prereqCourseId)) return false;

  if (!dryRun) {
    const payload = {
      node_id: nodeId,
      atom_type: "COURSE",
      required_course_id: prereqCourseId,
      min_grade: null,
      test_name: null,
      min_score: null,
      min_gpa: null,
      group_subject: null,
      group_min_level: null,
      group_max_level: null,
    };
    const { error } = await supabase.from("course_req_atoms").insert(payload);
    if (error) throw error;
  }

  const existing = atomsByNodeId.get(nodeId) ?? [];
  atomsByNodeId.set(nodeId, [
    ...existing,
    { atom_type: "COURSE", required_course_id: prereqCourseId },
  ]);
  counters.insertedAtoms += 1;
  return true;
}

async function ensureChildAtomNode({
  supabase,
  dryRun,
  nodesBySetId,
  setId,
  parentId,
  counters,
}) {
  const nodes = nodesBySetId.get(setId) ?? [];
  const siblings = nodes.filter((node) => node.parent_id === parentId);
  const nextSort = siblings.length > 0 ? Math.max(...siblings.map((n) => n.sort_order)) + 1 : 0;

  if (dryRun) {
    const fakeId = -3_000_000 - counters.createdNodes;
    counters.createdNodes += 1;
    const node = {
      id: fakeId,
      req_set_id: setId,
      node_type: "ATOM",
      parent_id: parentId,
      sort_order: nextSort,
    };
    nodesBySetId.set(setId, [...nodes, node]);
    return node;
  }

  const { data, error } = await supabase
    .from("course_req_nodes")
    .insert({
      req_set_id: setId,
      node_type: "ATOM",
      parent_id: parentId,
      sort_order: nextSort,
    })
    .select("id, req_set_id, node_type, parent_id, sort_order")
    .single();
  if (error) throw error;

  const node = {
    id: Number(data.id),
    req_set_id: Number(data.req_set_id),
    node_type: normalizeWhitespace(data.node_type).toUpperCase(),
    parent_id: data.parent_id == null ? null : Number(data.parent_id),
    sort_order: Number(data.sort_order ?? 0),
  };
  nodesBySetId.set(setId, [...nodes, node]);
  counters.createdNodes += 1;
  return node;
}

async function updateNodeParentAndSort({
  supabase,
  dryRun,
  nodesBySetId,
  setId,
  nodeId,
  parentId,
  sortOrder,
}) {
  if (!dryRun) {
    const { error } = await supabase
      .from("course_req_nodes")
      .update({ parent_id: parentId, sort_order: sortOrder })
      .eq("id", nodeId);
    if (error) throw error;
  }

  const nodes = nodesBySetId.get(setId) ?? [];
  const idx = nodes.findIndex((node) => node.id === nodeId);
  if (idx >= 0) {
    nodes[idx] = { ...nodes[idx], parent_id: parentId, sort_order: sortOrder };
    nodesBySetId.set(setId, [...nodes]);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const rootDir = process.cwd();
  const env = loadEnvFromFile(path.join(rootDir, ".env"));
  const supabase = createSupabase(env);

  const auditPath = path.join(rootDir, AUDIT_JSON_RELATIVE);
  const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));

  const courseIdByCode = await loadCourseMap(supabase);
  const bucketIdByCode = await loadBucketMap(supabase);
  const existingBucketMappings = await loadExistingBucketMappings(supabase);

  const affectedCourseCodes = new Set();
  for (const row of audit.prereqMismatches ?? []) affectedCourseCodes.add(normalizeCode(row.code));
  const affectedCourseIds = Array.from(affectedCourseCodes)
    .map((code) => courseIdByCode.get(code))
    .filter((id) => Number.isFinite(id));

  const prereqState = await loadReqStructureForCourses(supabase, affectedCourseIds);

  const counters = {
    insertedBucketMappings: 0,
    createdSets: 0,
    createdNodes: 0,
    insertedAtoms: 0,
    skippedRows: 0,
  };

  for (const row of audit.bucketMismatches ?? []) {
    const courseCode = normalizeCode(row.code);
    const courseId = courseIdByCode.get(courseCode);
    if (!Number.isFinite(courseId)) {
      counters.skippedRows += 1;
      console.log(`[courses:link-fix] skip bucket row: missing DB course ${courseCode}`);
      continue;
    }

    for (const bucketCodeRaw of row.missingInDb ?? []) {
      const bucketCode = normalizeWhitespace(bucketCodeRaw);
      const bucketId = bucketIdByCode.get(bucketCode);
      if (!Number.isFinite(bucketId)) {
        counters.skippedRows += 1;
        console.log(`[courses:link-fix] skip bucket row: unknown bucket ${bucketCode}`);
        continue;
      }

      const key = `${bucketId}:${courseId}`;
      if (existingBucketMappings.has(key)) continue;

      if (!args.dryRun) {
        const { error } = await supabase
          .from("gen_ed_bucket_courses")
          .insert({ bucket_id: bucketId, course_id: courseId });
        if (error) throw error;
      }

      existingBucketMappings.add(key);
      counters.insertedBucketMappings += 1;
    }
  }

  for (const row of audit.prereqMismatches ?? []) {
    const targetCourseCode = normalizeCode(row.code);
    const targetCourseId = courseIdByCode.get(targetCourseCode);
    if (!Number.isFinite(targetCourseId)) {
      counters.skippedRows += 1;
      console.log(`[courses:link-fix] skip prereq row: missing DB course ${targetCourseCode}`);
      continue;
    }

    const setId = await ensurePrereqSet({
      supabase,
      dryRun: args.dryRun,
      setsByCourseId: prereqState.setsByCourseId,
      courseId: targetCourseId,
      note: stripPrereqPrefix(row.catalogPrereqText ?? ""),
      counters,
    });

    let root = await ensureRootNode({
      supabase,
      dryRun: args.dryRun,
      nodesBySetId: prereqState.nodesBySetId,
      setId,
      counters,
    });

    const rootHasAnyAtom = (prereqState.atomsByNodeId.get(root.id) ?? []).length > 0;
    const needsExpansion =
      root.node_type === "ATOM" && rootHasAnyAtom && (row.missingInDb?.length ?? 0) > 0;

    if (needsExpansion) {
      const groupType = inferGroupNodeType(row.catalogPrereqText ?? "");
      const promotedRoot = await ensureChildAtomNode({
        supabase,
        dryRun: args.dryRun,
        nodesBySetId: prereqState.nodesBySetId,
        setId,
        parentId: null,
        counters,
      });

      if (!args.dryRun) {
        const { error } = await supabase
          .from("course_req_nodes")
          .update({ node_type: groupType })
          .eq("id", promotedRoot.id);
        if (error) throw error;
      }

      const nodes = prereqState.nodesBySetId.get(setId) ?? [];
      const promotedIdx = nodes.findIndex((node) => node.id === promotedRoot.id);
      if (promotedIdx >= 0) {
        nodes[promotedIdx] = { ...nodes[promotedIdx], node_type: groupType };
        prereqState.nodesBySetId.set(setId, [...nodes]);
      }

      await updateNodeParentAndSort({
        supabase,
        dryRun: args.dryRun,
        nodesBySetId: prereqState.nodesBySetId,
        setId,
        nodeId: root.id,
        parentId: promotedRoot.id,
        sortOrder: 0,
      });

      root = promotedRoot;
    }

    for (const prereqCodeRaw of row.missingInDb ?? []) {
      const prereqCode = normalizeCode(prereqCodeRaw);
      const prereqCourseId = courseIdByCode.get(prereqCode);
      if (!Number.isFinite(prereqCourseId)) {
        counters.skippedRows += 1;
        console.log(
          `[courses:link-fix] skip prereq atom: ${targetCourseCode} -> missing prereq course ${prereqCode}`
        );
        continue;
      }

      if (root.node_type === "OR" || root.node_type === "AND") {
        const children = (prereqState.nodesBySetId.get(setId) ?? [])
          .filter((node) => node.parent_id === root.id);
        let exists = false;
        for (const child of children) {
          if (hasCourseAtom(prereqState.atomsByNodeId, child.id, prereqCourseId)) {
            exists = true;
            break;
          }
        }
        if (exists) continue;

        const childNode = await ensureChildAtomNode({
          supabase,
          dryRun: args.dryRun,
          nodesBySetId: prereqState.nodesBySetId,
          setId,
          parentId: root.id,
          counters,
        });

        await insertCourseAtom({
          supabase,
          dryRun: args.dryRun,
          atomsByNodeId: prereqState.atomsByNodeId,
          nodeId: childNode.id,
          prereqCourseId,
          counters,
        });
      } else {
        const rootHasAtom = (prereqState.atomsByNodeId.get(root.id) ?? []).length > 0;
        if (rootHasAtom) {
          const childNode = await ensureChildAtomNode({
            supabase,
            dryRun: args.dryRun,
            nodesBySetId: prereqState.nodesBySetId,
            setId,
            parentId: root.id,
            counters,
          });

          await insertCourseAtom({
            supabase,
            dryRun: args.dryRun,
            atomsByNodeId: prereqState.atomsByNodeId,
            nodeId: childNode.id,
            prereqCourseId,
            counters,
          });
          continue;
        }

        await insertCourseAtom({
          supabase,
          dryRun: args.dryRun,
          atomsByNodeId: prereqState.atomsByNodeId,
          nodeId: root.id,
          prereqCourseId,
          counters,
        });
      }
    }
  }

  console.log(
    `[courses:link-fix] Done. insertedBucketMappings=${counters.insertedBucketMappings}, createdSets=${counters.createdSets}, createdNodes=${counters.createdNodes}, insertedAtoms=${counters.insertedAtoms}, skipped=${counters.skippedRows}, dryRun=${args.dryRun}`
  );
}

main().catch((error) => {
  console.error("[courses:link-fix] Fatal error:", error);
  process.exit(1);
});
