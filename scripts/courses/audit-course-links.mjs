#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { JSDOM } from "jsdom";

const CATALOG_YEAR = "2025-2026";
const CATALOG_SRCDB = "2025";
const CATALOG_API_BASE = "https://catalog.uwp.edu/course-search/api/?page=fose";
const DETAILS_ROUTE = "details";
const REQUEST_CONCURRENCY = 8;
const PAGE_SIZE = 1000;

const COURSE_CODE_PATTERN = /\b([A-Z]{2,8})\s*(\d{2,4}[A-Z]?)\b/g;
const BUCKET_CODE_BY_ATTR_PATTERN = [
  { pattern: /humanities\s+and\s+the\s+arts/i, bucketCode: "HUM_ART" },
  { pattern: /social\s*&\s*behavioral\s+science|social\s+and\s+behavioral\s+science/i, bucketCode: "SOC_BEH" },
  { pattern: /natural\s+science/i, bucketCode: "NAT_SCI" },
];

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

function normalizeCourseCode(value) {
  return normalizeWhitespace(value).toUpperCase();
}

function courseCodeFromRow(row) {
  return normalizeCourseCode(`${row.subject ?? ""} ${row.number ?? ""}`);
}

function htmlToText(value) {
  const fragment = JSDOM.fragment(String(value ?? ""));
  return normalizeWhitespace(fragment.textContent ?? "");
}

function extractCourseCodesFromText(value) {
  const normalized = normalizeCourseCode(value).replace(
    /\b([A-Z]{2,8})\s*(\d{2,4}[A-Z]?)(?=WITH\b)/g,
    "$1 $2 "
  );
  const out = new Set();
  for (const match of normalized.matchAll(COURSE_CODE_PATTERN)) {
    const code = normalizeCourseCode(`${match[1]} ${match[2]}`);
    if (code) out.add(code);
  }
  return out;
}

function expectedBucketCodesFromAttrs(attrsText) {
  const out = new Set();
  for (const rule of BUCKET_CODE_BY_ATTR_PATTERN) {
    if (rule.pattern.test(attrsText)) out.add(rule.bucketCode);
  }
  return out;
}

function mkdirp(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function writeJson(targetPath, payload) {
  fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function resolveDateStamp(isoString) {
  return isoString.slice(0, 10);
}

async function fetchCatalogApi(route, payload) {
  const url = new URL(CATALOG_API_BASE);
  url.searchParams.set("route", route);
  const body = encodeURIComponent(JSON.stringify(payload));
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!response.ok) {
    throw new Error(`Catalog API request failed (${route}): ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      results[current] = await mapper(items[current], current);
    }
  }
  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function loadDbSnapshot(supabase) {
  const { data: courseRows, error: courseError } = await supabase
    .from("courses")
    .select("id, subject, number, is_active")
    .order("subject")
    .order("number");
  if (courseError) throw courseError;

  const activeCourseRows = (courseRows ?? []).filter((row) => row.is_active !== false);

  const { data: bucketRows, error: bucketError } = await supabase
    .from("gen_ed_buckets")
    .select("id, code, name")
    .order("id");
  if (bucketError) throw bucketError;

  const { data: bucketCourseRows, error: bucketCourseError } = await supabase
    .from("gen_ed_bucket_courses")
    .select("bucket_id, course_id");
  if (bucketCourseError) throw bucketCourseError;

  const activeCourseIds = activeCourseRows.map((row) => Number(row.id));

  const reqSetRows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("course_req_sets")
      .select("id, course_id, set_type")
      .eq("set_type", "PREREQ")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    reqSetRows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  const activeCourseIdSet = new Set(activeCourseIds);
  const filteredReqSetRows = reqSetRows.filter((row) =>
    activeCourseIdSet.has(Number(row.course_id))
  );

  const reqSetIdSet = new Set(filteredReqSetRows.map((row) => Number(row.id)));

  const reqNodeRows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("course_req_nodes")
      .select("id, req_set_id")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []).filter((row) => reqSetIdSet.has(Number(row.req_set_id)));
    reqNodeRows.push(...page);
    if ((data ?? []).length < PAGE_SIZE) break;
  }

  const reqNodeIdSet = new Set(reqNodeRows.map((row) => Number(row.id)));

  const reqAtomRows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("course_req_atoms")
      .select("node_id, atom_type, required_course_id")
      .eq("atom_type", "COURSE")
      .order("node_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []).filter((row) => reqNodeIdSet.has(Number(row.node_id)));
    reqAtomRows.push(...page);
    if ((data ?? []).length < PAGE_SIZE) break;
  }

  return {
    courseRows: courseRows ?? [],
    activeCourseRows,
    bucketRows: bucketRows ?? [],
    bucketCourseRows: bucketCourseRows ?? [],
    reqSetRows: filteredReqSetRows,
    reqNodeRows,
    reqAtomRows,
  };
}

function buildIndexes(snapshot) {
  const courseCodeById = new Map();
  const courseIdByCode = new Map();
  for (const row of snapshot.courseRows) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    const code = courseCodeFromRow(row);
    if (!code) continue;
    courseCodeById.set(id, code);
    if (!courseIdByCode.has(code)) courseIdByCode.set(code, id);
  }

  const bucketCodeById = new Map();
  for (const row of snapshot.bucketRows) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    bucketCodeById.set(id, normalizeWhitespace(row.code));
  }

  const bucketCodesByCourseId = new Map();
  for (const row of snapshot.bucketCourseRows) {
    const courseId = Number(row.course_id);
    const bucketId = Number(row.bucket_id);
    if (!Number.isFinite(courseId) || !Number.isFinite(bucketId)) continue;
    const bucketCode = bucketCodeById.get(bucketId);
    if (!bucketCode) continue;
    if (!bucketCodesByCourseId.has(courseId)) bucketCodesByCourseId.set(courseId, new Set());
    bucketCodesByCourseId.get(courseId).add(bucketCode);
  }

  const nodeReqSetById = new Map();
  for (const node of snapshot.reqNodeRows) {
    const nodeId = Number(node.id);
    const reqSetId = Number(node.req_set_id);
    if (!Number.isFinite(nodeId) || !Number.isFinite(reqSetId)) continue;
    nodeReqSetById.set(nodeId, reqSetId);
  }

  const courseByReqSetId = new Map();
  for (const reqSet of snapshot.reqSetRows) {
    const reqSetId = Number(reqSet.id);
    const courseId = Number(reqSet.course_id);
    if (!Number.isFinite(reqSetId) || !Number.isFinite(courseId)) continue;
    courseByReqSetId.set(reqSetId, courseId);
  }

  const prereqCourseIdsByCourseId = new Map();
  for (const atom of snapshot.reqAtomRows) {
    const nodeId = Number(atom.node_id);
    const prereqCourseId = Number(atom.required_course_id);
    if (!Number.isFinite(nodeId) || !Number.isFinite(prereqCourseId)) continue;
    const reqSetId = nodeReqSetById.get(nodeId);
    if (!Number.isFinite(reqSetId)) continue;
    const ownerCourseId = courseByReqSetId.get(reqSetId);
    if (!Number.isFinite(ownerCourseId)) continue;
    if (!prereqCourseIdsByCourseId.has(ownerCourseId)) {
      prereqCourseIdsByCourseId.set(ownerCourseId, new Set());
    }
    prereqCourseIdsByCourseId.get(ownerCourseId).add(prereqCourseId);
  }

  return {
    courseCodeById,
    courseIdByCode,
    bucketCodesByCourseId,
    prereqCourseIdsByCourseId,
  };
}

function setDifference(source, target) {
  const out = [];
  for (const item of source) {
    if (!target.has(item)) out.push(item);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function renderReport({
  generatedAtIso,
  catalogYear,
  rawPath,
  summary,
  prereqMismatches,
  bucketMismatches,
  catalogLookupFailures,
}) {
  const lines = [];
  lines.push(`# Course Link Audit Report (${catalogYear})`);
  lines.push("");
  lines.push(`Generated: ${generatedAtIso}`);
  lines.push(`Raw artifact: \`${rawPath}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Active DB courses audited | ${summary.activeCourseCount} |`);
  lines.push(`| Catalog lookup failures | ${summary.catalogLookupFailureCount} |`);
  lines.push(`| Prereq link mismatches | ${summary.prereqMismatchCount} |`);
  lines.push(`| Gen-Ed bucket mismatches | ${summary.bucketMismatchCount} |`);
  lines.push("");

  lines.push("## Catalog Lookup Failures");
  lines.push("");
  if (catalogLookupFailures.length === 0) {
    lines.push("_None._");
    lines.push("");
  } else {
    for (const row of catalogLookupFailures) {
      lines.push(`- ${row.code}: ${row.error}`);
    }
    lines.push("");
  }

  lines.push("## Prerequisite Link Mismatches");
  lines.push("");
  if (prereqMismatches.length === 0) {
    lines.push("_None._");
    lines.push("");
  } else {
    for (const row of prereqMismatches) {
      lines.push(`### ${row.code}`);
      lines.push("");
      lines.push(`- Catalog prereq text: ${row.catalogPrereqText || "_none_"}`);
      lines.push(`- Missing DB prereq links: ${row.missingInDb.join(", ") || "_none_"}`);
      lines.push(`- Extra DB prereq links: ${row.extraInDb.join(", ") || "_none_"}`);
      lines.push("");
    }
  }

  lines.push("## Gen-Ed Bucket Mismatches");
  lines.push("");
  if (bucketMismatches.length === 0) {
    lines.push("_None._");
    lines.push("");
  } else {
    for (const row of bucketMismatches) {
      lines.push(`### ${row.code}`);
      lines.push("");
      lines.push(`- Catalog attributes: ${row.catalogAttrsText || "_none_"}`);
      lines.push(`- Missing DB bucket links: ${row.missingInDb.join(", ") || "_none_"}`);
      lines.push(`- Extra DB bucket links: ${row.extraInDb.join(", ") || "_none_"}`);
      lines.push("");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

async function main() {
  const args = parseArgs(process.argv);
  const nowIso = new Date().toISOString();
  const dateStamp = resolveDateStamp(nowIso);
  const rootDir = process.cwd();

  const env = loadEnvFromFile(path.join(rootDir, ".env"));
  const supabase = createSupabase(env);

  const outDir = path.join(rootDir, ".playwright-cli", "courses-link-audit");
  const reportDir = path.join(rootDir, "docs", "reports");
  mkdirp(outDir);
  mkdirp(reportDir);

  const rawPath = path.join(outDir, `course-link-audit-${dateStamp}.json`);
  const reportPath = path.join(reportDir, `course-link-audit-${dateStamp}.md`);

  console.log("[courses:link-audit] Loading DB snapshot.");
  const snapshot = await loadDbSnapshot(supabase);
  const indexes = buildIndexes(snapshot);

  const activeCourses = snapshot.activeCourseRows
    .map((row) => {
      const id = Number(row.id);
      const code = courseCodeFromRow(row);
      return { id, code };
    })
    .filter((row) => Number.isFinite(row.id) && row.code);

  console.log(`[courses:link-audit] Auditing ${activeCourses.length} active courses against course-search details.`);

  const perCourse = await mapWithConcurrency(activeCourses, REQUEST_CONCURRENCY, async (course) => {
    const payload = {
      srcdb: CATALOG_SRCDB,
      group: `code:${course.code}`,
    };

    let details;
    try {
      details = await fetchCatalogApi(DETAILS_ROUTE, payload);
    } catch (error) {
      return {
        code: course.code,
        courseId: course.id,
        fatal: `Request failed: ${error.message}`,
      };
    }

    if (details?.fatal) {
      return {
        code: course.code,
        courseId: course.id,
        fatal: String(details.fatal),
      };
    }

    const catalogPrereqText = htmlToText(details.prereq ?? "");
    const catalogAttrsText = htmlToText(details.attrs ?? "");

    const extractedPrereqCodes = extractCourseCodesFromText(catalogPrereqText);
    const catalogPrereqCodes = new Set(
      Array.from(extractedPrereqCodes).filter((code) => indexes.courseIdByCode.has(code))
    );
    catalogPrereqCodes.delete(course.code);

    const expectedBucketCodes = expectedBucketCodesFromAttrs(catalogAttrsText);

    const dbBucketCodes = indexes.bucketCodesByCourseId.get(course.id) ?? new Set();

    const dbPrereqIds = indexes.prereqCourseIdsByCourseId.get(course.id) ?? new Set();
    const dbPrereqCodes = new Set();
    for (const prereqId of dbPrereqIds) {
      const code = indexes.courseCodeById.get(prereqId);
      if (code) dbPrereqCodes.add(code);
    }

    const missingPrereqLinks = setDifference(catalogPrereqCodes, dbPrereqCodes);
    const extraPrereqLinks = setDifference(dbPrereqCodes, catalogPrereqCodes);

    const missingBucketLinks = setDifference(expectedBucketCodes, dbBucketCodes);
    const extraBucketLinks = setDifference(dbBucketCodes, expectedBucketCodes);

    return {
      code: course.code,
      courseId: course.id,
      catalogPrereqText: catalogPrereqText || null,
      catalogAttrsText: catalogAttrsText || null,
      catalogPrereqCodes: Array.from(catalogPrereqCodes).sort((a, b) => a.localeCompare(b)),
      dbPrereqCodes: Array.from(dbPrereqCodes).sort((a, b) => a.localeCompare(b)),
      expectedBucketCodes: Array.from(expectedBucketCodes).sort((a, b) => a.localeCompare(b)),
      dbBucketCodes: Array.from(dbBucketCodes).sort((a, b) => a.localeCompare(b)),
      prereqMismatch:
        missingPrereqLinks.length > 0 || extraPrereqLinks.length > 0
          ? {
              missingInDb: missingPrereqLinks,
              extraInDb: extraPrereqLinks,
            }
          : null,
      bucketMismatch:
        missingBucketLinks.length > 0 || extraBucketLinks.length > 0
          ? {
              missingInDb: missingBucketLinks,
              extraInDb: extraBucketLinks,
            }
          : null,
    };
  });

  const catalogLookupFailures = perCourse
    .filter((row) => row.fatal)
    .map((row) => ({ code: row.code, error: row.fatal }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const prereqMismatches = perCourse
    .filter((row) => row.prereqMismatch)
    .map((row) => ({
      code: row.code,
      catalogPrereqText: row.catalogPrereqText,
      missingInDb: row.prereqMismatch.missingInDb,
      extraInDb: row.prereqMismatch.extraInDb,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const bucketMismatches = perCourse
    .filter((row) => row.bucketMismatch)
    .map((row) => ({
      code: row.code,
      catalogAttrsText: row.catalogAttrsText,
      missingInDb: row.bucketMismatch.missingInDb,
      extraInDb: row.bucketMismatch.extraInDb,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const summary = {
    activeCourseCount: activeCourses.length,
    catalogLookupFailureCount: catalogLookupFailures.length,
    prereqMismatchCount: prereqMismatches.length,
    bucketMismatchCount: bucketMismatches.length,
    dryRun: args.dryRun,
  };

  const rawPayload = {
    generatedAt: nowIso,
    catalogYear: CATALOG_YEAR,
    catalogSrcDb: CATALOG_SRCDB,
    summary,
    catalogLookupFailures,
    prereqMismatches,
    bucketMismatches,
    perCourse,
  };

  writeJson(rawPath, rawPayload);

  const report = renderReport({
    generatedAtIso: nowIso,
    catalogYear: CATALOG_YEAR,
    rawPath,
    summary,
    prereqMismatches,
    bucketMismatches,
    catalogLookupFailures,
  });
  fs.writeFileSync(reportPath, report, "utf8");

  console.log(`[courses:link-audit] Wrote raw result: ${rawPath}`);
  console.log(`[courses:link-audit] Wrote report: ${reportPath}`);
  console.log(
    `[courses:link-audit] Summary => failures=${summary.catalogLookupFailureCount}, prereqMismatches=${summary.prereqMismatchCount}, bucketMismatches=${summary.bucketMismatchCount}`
  );
}

main().catch((error) => {
  console.error("[courses:link-audit] Fatal error:", error);
  process.exit(1);
});
