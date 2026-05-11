#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_BASELINE_COMMIT = "1d8ff02";
const DEFAULT_SAMPLE_SIZE = 5;
const DEFAULT_COLD_RUNS = 1;
const DEFAULT_WARM_RUNS = 3;
const DEFAULT_PASSES = 2;
const DEFAULT_MAX_EXTRA_PASSES = 1;
const DEFAULT_VARIANCE_THRESHOLD = 0.15;
const DEFAULT_LOG_WINDOW_DAYS = 14;
const DEFAULT_SEARCH_TERM = "CS";
const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;
const MONTH_DAYS = 30.44;

const FLOW_DEFINITIONS = [
  {
    key: "requirements_index",
    label: "Requirements Index",
    studentScoped: false,
    anchorTables: {
      old: ["programs"],
      new: ["v_program_catalog"],
    },
  },
  {
    key: "requirements_detail",
    label: "Requirements Detail",
    studentScoped: true,
    anchorTables: {
      old: ["program_requirement_blocks", "program_req_sets", "program_req_atoms"],
      new: ["v_program_requirement_detail"],
    },
  },
  {
    key: "courses_catalog",
    label: "Courses Catalog",
    studentScoped: false,
    anchorTables: {
      old: ["courses"],
      new: ["v_course_catalog"],
    },
  },
  {
    key: "planner_bundle",
    label: "Planner Bundle",
    studentScoped: true,
    anchorTables: {
      old: ["plans", "student_term_plan", "student_planned_courses"],
      new: ["v_plan_meta", "v_plan_terms", "v_plan_courses"],
    },
  },
  {
    key: "class_history_bundle",
    label: "Class History Bundle",
    studentScoped: true,
    anchorTables: {
      old: ["student_course_history", "terms"],
      new: ["v_student_course_history_detail", "v_terms_chronological"],
    },
  },
  {
    key: "onboarding_bundle",
    label: "Onboarding Read Bundle",
    studentScoped: true,
    anchorTables: {
      old: ["major_certificate_mappings", "program_requirement_blocks"],
      new: ["v_student_profile", "v_program_block_courses"],
    },
  },
];

function printHelp() {
  const helpText = `
Replay benchmark for old table-based reads vs new view-based reads.

Usage:
  node scripts/perf/benchmark-replay.mjs [options]

Required environment:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (recommended; required unless --allow-anon=true)

Options:
  --baseline-commit <sha>           Baseline git commit label. Default: ${DEFAULT_BASELINE_COMMIT}
  --mode <both|old|new>             Which mode(s) to execute. Default: both
  --sample-size <n>                 Number of students. Default: ${DEFAULT_SAMPLE_SIZE}
  --student-ids <csv>               Optional fixed student IDs
  --cold-runs <n>                   Cold runs per mode/flow/student/pass. Default: ${DEFAULT_COLD_RUNS}
  --warm-runs <n>                   Warm runs per mode/flow/student/pass. Default: ${DEFAULT_WARM_RUNS}
  --passes <n>                      Full matrix passes before stability check. Default: ${DEFAULT_PASSES}
  --max-extra-passes <n>            Auto reruns when unstable. Default: ${DEFAULT_MAX_EXTRA_PASSES}
  --variance-threshold <ratio>      Speed-up variance threshold. Default: ${DEFAULT_VARIANCE_THRESHOLD}
  --seed <number>                   Random seed for run ordering/sample shuffle
  --search-term <text>              Class history search term. Default: ${DEFAULT_SEARCH_TERM}
  --output-dir <path>               Output directory. Default: docs/performance/reports/<timestamp>
  --rate-card-file <path>           JSON rate card input
  --log-file <path>                 Supabase log export (JSON or JSONL)
  --log-window-days <n>             Recent log window days. Default: ${DEFAULT_LOG_WINDOW_DAYS}
  --traffic-volume-file <path>      JSON monthly flow volume overrides
  --monthly-runs-default <n>        Fallback monthly runs for flows missing log-derived volume
  --allow-anon <true|false>         Allow anon key fallback. Default: false
  --allow-sample-reuse <true|false> Reuse available students with replacement if sample is short. Default: false
  --reuse-executions <true|false>   Cache repeated synthetic runs (fast). Default: true
  --help                            Show help

Rate card JSON format:
{
  "compute_usd_per_second": 0.00003,
  "egress_usd_per_gb": 0.09,
  "request_usd_per_1000": 0.0,
  "notes": "Optional notes"
}

Traffic volume JSON format (optional):
{
  "flows": {
    "requirements_index": 12000
  },
  "notes": "Optional notes"
}
`;
  console.log(helpText.trim());
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;

    const withoutPrefix = arg.slice(2);
    const [rawKey, inlineValue] = withoutPrefix.split("=", 2);
    if (inlineValue !== undefined) {
      args[rawKey] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[rawKey] = next;
      index += 1;
    } else {
      args[rawKey] = true;
    }
  }
  return args;
}

function toNumber(value, fallback, { integer = false, min = null } = {}) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected numeric value, received "${value}"`);
  }
  const normalized = integer ? Math.trunc(parsed) : parsed;
  if (min !== null && normalized < min) {
    throw new Error(`Expected numeric value >= ${min}, received "${value}"`);
  }
  return normalized;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  throw new Error(`Expected boolean value, received "${value}"`);
}

function toMode(value) {
  const normalized = String(value ?? "both").trim().toLowerCase();
  if (!["both", "old", "new"].includes(normalized)) {
    throw new Error(`Invalid mode "${value}". Use both, old, or new.`);
  }
  if (normalized === "both") return ["old", "new"];
  return [normalized];
}

function parseCsvInts(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function stableSeed(input) {
  if (input !== undefined && input !== null && input !== "") {
    const fromArgs = Number(input);
    if (!Number.isFinite(fromArgs)) {
      throw new Error(`Seed must be numeric, received "${input}"`);
    }
    return Math.trunc(fromArgs);
  }
  const now = Date.now();
  return Math.trunc(now % 2147483647);
}

function createSeededRandom(seedValue) {
  let seed = seedValue % 2147483647;
  if (seed <= 0) seed += 2147483646;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function shuffled(items, randomFn) {
  const cloned = [...items];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1));
    const temp = cloned[index];
    cloned[index] = cloned[swapIndex];
    cloned[swapIndex] = temp;
  }
  return cloned;
}

function expandSampleWithReplacement(baseSamples, targetSize, randomFn) {
  if (baseSamples.length === 0) return [];
  if (baseSamples.length >= targetSize) return baseSamples.slice(0, targetSize);

  const expanded = [...baseSamples];
  while (expanded.length < targetSize) {
    const pickIndex = Math.floor(randomFn() * baseSamples.length);
    expanded.push(baseSamples[pickIndex]);
  }
  return expanded;
}

function timestampTag(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "-",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("");
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return null;
  if (sortedValues.length === 1) return sortedValues[0];
  const target = (sortedValues.length - 1) * p;
  const lower = Math.floor(target);
  const upper = Math.ceil(target);
  if (lower === upper) return sortedValues[lower];
  const ratio = target - lower;
  return sortedValues[lower] * (1 - ratio) + sortedValues[upper] * ratio;
}

function median(values) {
  if (!values.length) return null;
  const sortedValues = [...values].sort((a, b) => a - b);
  return percentile(sortedValues, 0.5);
}

function roundNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatMs(value) {
  if (value === null || value === undefined) return "n/a";
  return `${roundNumber(value, 2)} ms`;
}

function formatUsd(value) {
  if (value === null || value === undefined) return "n/a";
  return `$${roundNumber(value, 4)}`;
}

function formatPct(value) {
  if (value === null || value === undefined) return "n/a";
  return `${roundNumber(value, 2)}%`;
}

function errorMessage(error) {
  if (!error) return "Unknown error";
  if (error instanceof Error) return error.message;
  return String(error);
}

function requireEnv(primary, fallback = []) {
  const candidates = [primary, ...fallback];
  for (const key of candidates) {
    const value = process.env[key];
    if (value) return value;
  }
  return null;
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const equalsIndex = trimmed.indexOf("=");
  if (equalsIndex <= 0) return null;
  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

async function loadEnvFiles() {
  const candidates = [".env.local", ".env"];
  for (const relativePath of candidates) {
    const absolutePath = path.resolve(relativePath);
    try {
      const content = await fs.readFile(absolutePath, "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const parsed = parseEnvLine(rawLine);
        if (!parsed) continue;
        if (process.env[parsed.key] === undefined) {
          process.env[parsed.key] = parsed.value;
        }
      }
    } catch {
      // Ignore missing env files.
    }
  }
}

function extractUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  if (input && typeof input === "object" && "url" in input) {
    return String(input.url);
  }
  return "";
}

function extractMethod(input, init) {
  if (init && init.method) return String(init.method).toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request && input.method) {
    return String(input.method).toUpperCase();
  }
  return "GET";
}

function isSupabaseRestUrl(url) {
  return typeof url === "string" && url.includes("/rest/v1/");
}

function normalizeEndpoint(urlString) {
  try {
    const parsed = new URL(urlString);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return urlString;
  }
}

function extractTableName(endpoint) {
  const match = endpoint.match(/\/rest\/v1\/([A-Za-z0-9_]+)/);
  return match ? match[1] : null;
}

async function estimateResponseBytes(response) {
  const headerValue = response.headers.get("content-length");
  if (headerValue) {
    const parsed = Number(headerValue);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }

  try {
    const clone = response.clone();
    const text = await clone.text();
    return Buffer.byteLength(text, "utf8");
  } catch {
    return 0;
  }
}

class QueryTracker {
  constructor(baseFetch) {
    this.baseFetch = baseFetch;
    this.events = [];
    this.currentContext = null;
  }

  setContext(context) {
    this.currentContext = context;
  }

  clearContext() {
    this.currentContext = null;
  }

  instrumentedFetch = async (input, init) => {
    const url = extractUrl(input);
    const method = extractMethod(input, init);
    const startedAt = new Date().toISOString();
    const started = performance.now();

    let status = 0;
    let ok = false;
    let responseBytes = 0;
    let fetchError = null;

    try {
      const response = await this.baseFetch(input, init);
      status = response.status;
      ok = response.ok;
      responseBytes = await estimateResponseBytes(response);
      return response;
    } catch (error) {
      fetchError = errorMessage(error);
      throw error;
    } finally {
      if (this.currentContext && isSupabaseRestUrl(url)) {
        const endpoint = normalizeEndpoint(url);
        this.events.push({
          ...this.currentContext,
          query_id: `q_${this.events.length + 1}`,
          started_at: startedAt,
          method,
          url,
          endpoint,
          table_name: extractTableName(endpoint),
          status,
          ok,
          duration_ms: roundNumber(performance.now() - started, 3),
          response_bytes: responseBytes,
          error: fetchError,
        });
      }
    }
  };
}

async function expectQuery(queryPromise, label) {
  const result = await queryPromise;
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data ?? null;
}

function uniqueNumbers(values) {
  return [...new Set(values.filter((value) => Number.isFinite(Number(value))).map(Number))];
}

async function runRequirementsIndexOld(client) {
  await expectQuery(
    client
      .from("programs")
      .select("id, name, catalog_year, program_type")
      .order("name", { ascending: true }),
    "old requirements index query"
  );
}

async function runRequirementsIndexNew(client) {
  await expectQuery(
    client
      .from("v_program_catalog")
      .select("program_id, program_name, catalog_year, program_type")
      .order("program_name", { ascending: true }),
    "new requirements index query"
  );
}

async function runRequirementsDetailOld(client, sample) {
  await expectQuery(
    client
      .from("programs")
      .select("id, name, catalog_year, program_type")
      .eq("id", sample.program_id)
      .single(),
    "old requirements detail program query"
  );

  const blocks = await expectQuery(
    client
      .from("program_requirement_blocks")
      .select(`
        id, name, rule, n_required, credits_required,
        program_requirement_courses(
          courses:course_id(
            id, subject, number, title, credits, description,
            course_req_sets(set_type, note)
          )
        )
      `)
      .eq("program_id", sample.program_id)
      .order("name", { ascending: true }),
    "old requirements detail block query"
  );

  const blockRows = blocks ?? [];
  const blockIds = uniqueNumbers(blockRows.map((row) => row.id));
  const courseIds = uniqueNumbers(
    blockRows.flatMap((row) =>
      (row.program_requirement_courses ?? [])
        .map((mapping) => mapping?.courses?.id)
        .filter((value) => value !== null && value !== undefined)
    )
  );

  if (courseIds.length > 0) {
    await expectQuery(
      client
        .from("course_crosslistings")
        .select("course_id, cross_subject, cross_number")
        .in("course_id", courseIds),
      "old requirements detail cross-listings query"
    );
  }

  if (blockIds.length > 0) {
    const reqSets = await expectQuery(
      client
        .from("program_req_sets")
        .select("id, block_id, program_req_nodes(id, node_type, parent_id, sort_order)")
        .in("block_id", blockIds),
      "old requirements detail requirement-set query"
    );

    const nodeIds = uniqueNumbers(
      (reqSets ?? []).flatMap((reqSet) =>
        (reqSet.program_req_nodes ?? []).map((node) => node.id)
      )
    );

    if (nodeIds.length > 0) {
      await expectQuery(
        client
          .from("program_req_atoms")
          .select("node_id, atom_type, required_course_id")
          .in("node_id", nodeIds),
        "old requirements detail atom query"
      );
    }
  }
}

async function runRequirementsDetailNew(client, sample) {
  await expectQuery(
    client
      .from("v_program_catalog")
      .select("program_id, program_name, catalog_year, program_type")
      .eq("program_id", sample.program_id)
      .single(),
    "new requirements detail program query"
  );

  await expectQuery(
    client
      .from("v_program_requirement_detail")
      .select(
        "block_id, block_name, rule, n_required, credits_required, courses, cross_listings, req_nodes"
      )
      .eq("program_id", sample.program_id)
      .order("block_name", { ascending: true }),
    "new requirements detail block query"
  );
}

async function runCoursesCatalogOld(client) {
  await expectQuery(
    client
      .from("courses")
      .select("*, course_req_sets(set_type, note)")
      .order("subject", { ascending: true })
      .order("number", { ascending: true }),
    "old courses catalog query"
  );
}

async function runCoursesCatalogNew(client) {
  await expectQuery(
    client
      .from("v_course_catalog")
      .select("course_id, subject, number, title, credits, description, prereq_text")
      .order("subject", { ascending: true })
      .order("number", { ascending: true }),
    "new courses catalog query"
  );
}

async function runPlannerBundleOld(client, sample) {
  const plans = await expectQuery(
    client
      .from("plans")
      .select("id, student_id, name, description, created_at, updated_at")
      .eq("student_id", sample.student_id)
      .order("created_at", { ascending: true }),
    "old planner plans query"
  );

  const plansData = plans ?? [];
  if (!plansData.length) return;
  const planIds = uniqueNumbers(plansData.map((plan) => plan.id));

  await Promise.all([
    expectQuery(
      client
        .from("plan_programs")
        .select("plan_id, program_id, programs:program_id(program_type)")
        .in("plan_id", planIds),
      "old planner plan_programs aggregate query"
    ),
    expectQuery(
      client
        .from("student_term_plan")
        .select("plan_id")
        .eq("student_id", sample.student_id)
        .in("plan_id", planIds),
      "old planner student_term_plan aggregate query"
    ),
    expectQuery(
      client
        .from("student_planned_courses")
        .select("plan_id, courses:course_id(credits)")
        .eq("student_id", sample.student_id)
        .in("plan_id", planIds),
      "old planner student_planned_courses aggregate query"
    ),
  ]);

  const activePlanId = planIds.includes(sample.plan_id) ? sample.plan_id : planIds[0];

  await Promise.all([
    expectQuery(
      client
        .from("student_term_plan")
        .select("term_id, terms:term_id(id, season, year)")
        .eq("student_id", sample.student_id)
        .eq("plan_id", activePlanId),
      "old planner terms query"
    ),
    expectQuery(
      client
        .from("student_planned_courses")
        .select(`
          student_id,
          term_id,
          course_id,
          status,
          plan_id,
          courses:course_id(id, subject, number, title, credits)
        `)
        .eq("student_id", sample.student_id)
        .eq("plan_id", activePlanId),
      "old planner planned courses query"
    ),
    (async () => {
      const planProgramsRows = await expectQuery(
        client
          .from("plan_programs")
          .select("program_id")
          .eq("plan_id", activePlanId),
        "old planner available courses plan_programs query"
      );

      const programIds = uniqueNumbers((planProgramsRows ?? []).map((row) => row.program_id));
      if (!programIds.length) return;

      const blocks = await expectQuery(
        client
          .from("program_requirement_blocks")
          .select("id, program_id, name, rule, n_required, credits_required")
          .in("program_id", programIds)
          .order("name", { ascending: true }),
        "old planner available courses block query"
      );

      const blockIds = uniqueNumbers((blocks ?? []).map((block) => block.id));
      if (!blockIds.length) return;

      const mappings = await expectQuery(
        client
          .from("program_requirement_courses")
          .select("block_id, course_id")
          .in("block_id", blockIds),
        "old planner available courses mapping query"
      );

      const courseIds = uniqueNumbers((mappings ?? []).map((mapping) => mapping.course_id));
      if (!courseIds.length) return;

      await expectQuery(
        client
          .from("courses")
          .select("id, subject, number, title, credits")
          .in("id", courseIds)
          .order("subject", { ascending: true })
          .order("number", { ascending: true }),
        "old planner available courses course query"
      );
    })(),
    expectQuery(
      client
        .from("student_course_history")
        .select("course_id")
        .eq("student_id", sample.student_id),
      "old planner completed courses query"
    ),
    expectQuery(
      client
        .from("students")
        .select("breadth_package_id")
        .eq("id", sample.student_id)
        .maybeSingle(),
      "old planner breadth package query"
    ),
    (async () => {
      const buckets = await expectQuery(
        client.from("gen_ed_buckets").select("id, code, name, credits_required"),
        "old planner gen-ed bucket query"
      );
      const bucketIds = uniqueNumbers((buckets ?? []).map((bucket) => bucket.id));
      if (!bucketIds.length) return;

      const mappings = await expectQuery(
        client
          .from("gen_ed_bucket_courses")
          .select("bucket_id, course_id")
          .in("bucket_id", bucketIds),
        "old planner gen-ed mapping query"
      );
      const courseIds = uniqueNumbers((mappings ?? []).map((mapping) => mapping.course_id));
      if (!courseIds.length) return;

      await expectQuery(
        client
          .from("courses")
          .select("id, subject, number, title, credits")
          .in("id", courseIds),
        "old planner gen-ed course query"
      );
    })(),
  ]);
}

async function runPlannerBundleNew(client, sample) {
  const plans = await expectQuery(
    client
      .from("v_plan_meta")
      .select(
        "plan_id, student_id, name, description, created_at, updated_at, program_ids, term_count, course_count, total_credits, has_graduate_program"
      )
      .eq("student_id", sample.student_id)
      .order("created_at", { ascending: true }),
    "new planner plans query"
  );

  const plansData = plans ?? [];
  if (!plansData.length) return;
  const availablePlanIds = uniqueNumbers(plansData.map((plan) => plan.plan_id));
  const activePlanId = availablePlanIds.includes(sample.plan_id)
    ? sample.plan_id
    : availablePlanIds[0];

  await Promise.all([
    expectQuery(
      client
        .from("v_plan_terms")
        .select("term_id, season, year")
        .eq("student_id", sample.student_id)
        .eq("plan_id", activePlanId),
      "new planner terms query"
    ),
    expectQuery(
      client
        .from("v_plan_courses")
        .select("student_id, term_id, course_id, status, plan_id, subject, number, title, credits")
        .eq("student_id", sample.student_id)
        .eq("plan_id", activePlanId),
      "new planner planned courses query"
    ),
    (async () => {
      const planMeta = await expectQuery(
        client
          .from("v_plan_meta")
          .select("program_ids")
          .eq("student_id", sample.student_id)
          .eq("plan_id", activePlanId)
          .single(),
        "new planner available courses plan meta query"
      );

      const programIds = uniqueNumbers(planMeta?.program_ids ?? []);
      if (!programIds.length) return;

      await expectQuery(
        client
          .from("v_program_block_courses")
          .select("block_id, program_id, block_name, rule, n_required, credits_required, courses")
          .in("program_id", programIds)
          .order("block_name", { ascending: true }),
        "new planner available courses query"
      );
    })(),
    expectQuery(
      client
        .from("v_student_course_progress")
        .select("course_id, completed, progress_status")
        .eq("student_id", sample.student_id),
      "new planner completed courses query"
    ),
    expectQuery(
      client
        .from("v_student_profile")
        .select("breadth_package_id")
        .eq("student_id", sample.student_id)
        .maybeSingle(),
      "new planner breadth package query"
    ),
    expectQuery(
      client
        .from("v_gened_bucket_courses")
        .select("bucket_id, bucket_code, bucket_name, bucket_credits_required, courses")
        .order("bucket_id", { ascending: true }),
      "new planner gen-ed query"
    ),
  ]);
}

async function runClassHistoryBundleOld(client, sample, searchTerm) {
  await expectQuery(
    client
      .from("students")
      .select("id")
      .eq("auth_user_id", sample.auth_user_id)
      .maybeSingle(),
    "old class-history student lookup query"
  );

  await Promise.all([
    expectQuery(
      client
        .from("terms")
        .select("id")
        .order("id", { ascending: true })
        .limit(1)
        .single(),
      "old class-history default term query"
    ),
    (async () => {
      const programs = await expectQuery(
        client
          .from("student_programs")
          .select("program_id")
          .eq("student_id", sample.student_id),
        "old class-history student programs query"
      );

      const programIds = uniqueNumbers((programs ?? []).map((row) => row.program_id));
      if (!programIds.length) return;

      const major = await expectQuery(
        client
          .from("programs")
          .select("id, name")
          .in("id", programIds)
          .eq("program_type", "MAJOR")
          .maybeSingle(),
        "old class-history major program query"
      );
      if (!major?.id) return;

      const blocks = await expectQuery(
        client
          .from("program_requirement_blocks")
          .select("id, name")
          .eq("program_id", major.id),
        "old class-history blocks query"
      );

      const blockIds = uniqueNumbers((blocks ?? []).map((block) => block.id));
      if (!blockIds.length) return;

      await expectQuery(
        client
          .from("program_requirement_courses")
          .select("block_id, course_id, courses:course_id(id, subject, number, title, credits)")
          .in("block_id", blockIds),
        "old class-history block courses query"
      );
    })(),
    expectQuery(
      client
        .from("student_course_history")
        .select("course_id, term_id, completed, courses:course_id(id, subject, number, title, credits)")
        .eq("student_id", sample.student_id),
      "old class-history history query"
    ),
    (async () => {
      const escaped = searchTerm.replace(/[%_]/g, "\\$&");
      const pattern = `%${escaped}%`;
      await expectQuery(
        client
          .from("courses")
          .select("id, subject, number, title, credits")
          .or(`title.ilike.${pattern},subject.ilike.${pattern},number.ilike.${pattern}`)
          .limit(20),
        "old class-history search query"
      );
    })(),
    (async () => {
      const buckets = await expectQuery(
        client.from("gen_ed_buckets").select("id, code, name, credits_required"),
        "old class-history gen-ed bucket query"
      );
      const bucketIds = uniqueNumbers((buckets ?? []).map((bucket) => bucket.id));
      if (!bucketIds.length) return;

      const mappings = await expectQuery(
        client
          .from("gen_ed_bucket_courses")
          .select("bucket_id, course_id")
          .in("bucket_id", bucketIds),
        "old class-history gen-ed mapping query"
      );
      const courseIds = uniqueNumbers((mappings ?? []).map((mapping) => mapping.course_id));
      if (!courseIds.length) return;

      await expectQuery(
        client
          .from("courses")
          .select("id, subject, number, title, credits")
          .in("id", courseIds),
        "old class-history gen-ed course query"
      );
    })(),
  ]);
}

async function runClassHistoryBundleNew(client, sample, searchTerm) {
  await expectQuery(
    client
      .from("v_student_profile")
      .select("student_id")
      .eq("auth_user_id", sample.auth_user_id)
      .maybeSingle(),
    "new class-history student lookup query"
  );

  await Promise.all([
    expectQuery(
      client
        .from("v_terms_chronological")
        .select("term_id")
        .order("chronological_rank", { ascending: true })
        .limit(1)
        .single(),
      "new class-history default term query"
    ),
    (async () => {
      const major = await expectQuery(
        client
          .from("v_student_primary_major_program")
          .select("student_id, program_id, program_name")
          .eq("student_id", sample.student_id)
          .maybeSingle(),
        "new class-history major query"
      );
      if (!major?.program_id) return;

      await expectQuery(
        client
          .from("v_program_block_courses")
          .select("block_id, block_name, courses")
          .eq("program_id", major.program_id)
          .order("block_name", { ascending: true }),
        "new class-history block courses query"
      );
    })(),
    expectQuery(
      client
        .from("v_student_course_history_detail")
        .select("course_id, term_id, completed, subject, number, title, credits")
        .eq("student_id", sample.student_id),
      "new class-history history query"
    ),
    (async () => {
      const escaped = searchTerm.replace(/[%_]/g, "\\$&");
      const pattern = `%${escaped}%`;
      await expectQuery(
        client
          .from("v_course_catalog")
          .select("course_id, subject, number, title, credits")
          .or(`title.ilike.${pattern},subject.ilike.${pattern},number.ilike.${pattern}`)
          .limit(20),
        "new class-history search query"
      );
    })(),
    expectQuery(
      client
        .from("v_gened_bucket_courses")
        .select("bucket_id, bucket_code, bucket_name, bucket_credits_required, courses")
        .order("bucket_id", { ascending: true }),
      "new class-history gen-ed query"
    ),
  ]);
}

async function runOnboardingBundleOld(client, sample) {
  await expectQuery(
    client
      .from("students")
      .select(
        "id, auth_user_id, email, first_name, last_name, has_completed_onboarding, expected_graduation_semester, expected_graduation_year, breadth_package_id"
      )
      .eq("auth_user_id", sample.auth_user_id)
      .maybeSingle(),
    "old onboarding profile lookup query"
  );

  const majorLookupPrograms = await expectQuery(
    client
      .from("student_programs")
      .select("program_id")
      .eq("student_id", sample.student_id),
    "old onboarding major lookup student_programs query"
  );

  const majorLookupProgramIds = uniqueNumbers(
    (majorLookupPrograms ?? []).map((row) => row.program_id)
  );

  if (majorLookupProgramIds.length > 0) {
    await expectQuery(
      client
        .from("programs")
        .select("id, name, catalog_year, program_type")
        .in("id", majorLookupProgramIds)
        .eq("program_type", "MAJOR")
        .maybeSingle(),
      "old onboarding major lookup programs query"
    );
  }

  await expectQuery(
    client
      .from("students")
      .select("has_completed_onboarding")
      .eq("auth_user_id", sample.auth_user_id)
      .maybeSingle(),
    "old onboarding status query"
  );

  await expectQuery(
    client
      .from("programs")
      .select("id, name, catalog_year, program_type")
      .eq("program_type", "MAJOR")
      .order("name", { ascending: true }),
    "old onboarding fetchPrograms query"
  );

  const certificateMappings = await expectQuery(
    client
      .from("major_certificate_mappings")
      .select("certificate_id")
      .eq("major_id", sample.program_id),
    "old onboarding certificate mapping query"
  );
  const certificateIds = uniqueNumbers((certificateMappings ?? []).map((row) => row.certificate_id));

  if (certificateIds.length > 0) {
    await expectQuery(
      client
        .from("programs")
        .select("id, name, catalog_year, program_type")
        .in("id", certificateIds)
        .order("name", { ascending: true }),
      "old onboarding certificates query"
    );
  } else {
    await expectQuery(
      client
        .from("programs")
        .select("id, name, catalog_year, program_type")
        .eq("program_type", "CERTIFICATE")
        .order("name", { ascending: true }),
      "old onboarding certificate fallback query"
    );
  }

  const blocks = await expectQuery(
    client
      .from("program_requirement_blocks")
      .select("id, program_id, name, rule, n_required, credits_required")
      .eq("program_id", sample.program_id)
      .order("name", { ascending: true }),
    "old onboarding requirement block query"
  );
  const blockIds = uniqueNumbers((blocks ?? []).map((block) => block.id));

  let candidateCourseIds = [];
  if (blockIds.length > 0) {
    const mappings = await expectQuery(
      client
        .from("program_requirement_courses")
        .select("block_id, course_id")
        .in("block_id", blockIds),
      "old onboarding requirement mapping query"
    );
    candidateCourseIds = uniqueNumbers((mappings ?? []).map((mapping) => mapping.course_id));

    if (candidateCourseIds.length > 0) {
      await expectQuery(
        client
          .from("courses")
          .select("id, subject, number, title, credits")
          .in("id", candidateCourseIds)
          .order("subject", { ascending: true })
          .order("number", { ascending: true }),
        "old onboarding requirement courses query"
      );
    }
  }

  const idsForFetchCoursesByIds = candidateCourseIds.slice(0, 20);
  if (idsForFetchCoursesByIds.length > 0) {
    await expectQuery(
      client
        .from("courses")
        .select("id, subject, number, title, credits")
        .in("id", idsForFetchCoursesByIds)
        .order("subject", { ascending: true })
        .order("number", { ascending: true }),
      "old onboarding fetchCoursesByIds query"
    );
  }
}

async function runOnboardingBundleNew(client, sample) {
  await expectQuery(
    client
      .from("v_student_profile")
      .select(
        "student_id, auth_user_id, email, first_name, last_name, full_name, has_completed_onboarding, expected_graduation_semester, expected_graduation_year, breadth_package_id"
      )
      .eq("auth_user_id", sample.auth_user_id)
      .maybeSingle(),
    "new onboarding profile lookup query"
  );

  await expectQuery(
    client
      .from("v_student_major_program")
      .select("student_id, program_id, program_name, catalog_year, program_type")
      .eq("student_id", sample.student_id)
      .maybeSingle(),
    "new onboarding major program query"
  );

  await expectQuery(
    client
      .from("v_student_profile")
      .select("student_id, has_completed_onboarding")
      .eq("auth_user_id", sample.auth_user_id)
      .maybeSingle(),
    "new onboarding status query"
  );

  await expectQuery(
    client
      .from("programs")
      .select("id, name, catalog_year, program_type")
      .eq("program_type", "MAJOR")
      .order("name", { ascending: true }),
    "new onboarding fetchPrograms query"
  );

  const certificateMappings = await expectQuery(
    client
      .from("major_certificate_mappings")
      .select("certificate_id")
      .eq("major_id", sample.program_id),
    "new onboarding certificate mapping query"
  );
  const certificateIds = uniqueNumbers((certificateMappings ?? []).map((row) => row.certificate_id));

  if (certificateIds.length > 0) {
    await expectQuery(
      client
        .from("programs")
        .select("id, name, catalog_year, program_type")
        .in("id", certificateIds)
        .order("name", { ascending: true }),
      "new onboarding certificates query"
    );
  } else {
    await expectQuery(
      client
        .from("programs")
        .select("id, name, catalog_year, program_type")
        .eq("program_type", "CERTIFICATE")
        .order("name", { ascending: true }),
      "new onboarding certificate fallback query"
    );
  }

  const blocks = await expectQuery(
    client
      .from("v_program_block_courses")
      .select("block_id, program_id, block_name, rule, n_required, credits_required, courses")
      .eq("program_id", sample.program_id)
      .order("block_name", { ascending: true }),
    "new onboarding requirement block query"
  );

  const candidateCourseIds = uniqueNumbers(
    (blocks ?? []).flatMap((block) =>
      (block.courses ?? []).map((course) => course.course_id)
    )
  );

  if (candidateCourseIds.length > 0) {
    await expectQuery(
      client
        .from("courses")
        .select("id, subject, number, title, credits")
        .in("id", candidateCourseIds.slice(0, 20))
        .order("subject", { ascending: true })
        .order("number", { ascending: true }),
      "new onboarding fetchCoursesByIds query"
    );
  }
}

function flowRunner(mode, flowKey) {
  const oldRunners = {
    requirements_index: runRequirementsIndexOld,
    requirements_detail: runRequirementsDetailOld,
    courses_catalog: runCoursesCatalogOld,
    planner_bundle: runPlannerBundleOld,
    class_history_bundle: runClassHistoryBundleOld,
    onboarding_bundle: runOnboardingBundleOld,
  };
  const newRunners = {
    requirements_index: runRequirementsIndexNew,
    requirements_detail: runRequirementsDetailNew,
    courses_catalog: runCoursesCatalogNew,
    planner_bundle: runPlannerBundleNew,
    class_history_bundle: runClassHistoryBundleNew,
    onboarding_bundle: runOnboardingBundleNew,
  };
  return mode === "old" ? oldRunners[flowKey] : newRunners[flowKey];
}

async function fetchStudentSamples(client, sampleSize, randomFn, selectedStudentIds = []) {
  const [profiles, planMetaRows, majorRows] = await Promise.all([
    expectQuery(
      client
        .from("v_student_profile")
        .select("student_id, auth_user_id, has_completed_onboarding")
        .order("student_id", { ascending: true })
        .limit(5000),
      "sample selection profile query"
    ),
    expectQuery(
      client
        .from("v_plan_meta")
        .select("student_id, plan_id, created_at")
        .order("created_at", { ascending: true })
        .limit(10000),
      "sample selection plan meta query"
    ),
    expectQuery(
      client
        .from("v_student_primary_major_program")
        .select("student_id, program_id")
        .limit(5000),
      "sample selection major program query"
    ),
  ]);

  const planByStudent = new Map();
  for (const row of planMetaRows ?? []) {
    const studentId = Number(row.student_id);
    if (!Number.isInteger(studentId)) continue;
    if (!planByStudent.has(studentId)) {
      planByStudent.set(studentId, Number(row.plan_id));
    }
  }

  const majorByStudent = new Map();
  for (const row of majorRows ?? []) {
    const studentId = Number(row.student_id);
    const programId = Number(row.program_id);
    if (!Number.isInteger(studentId) || !Number.isInteger(programId)) continue;
    if (!majorByStudent.has(studentId)) {
      majorByStudent.set(studentId, programId);
    }
  }

  const candidates = [];
  for (const profile of profiles ?? []) {
    const studentId = Number(profile.student_id);
    if (!Number.isInteger(studentId)) continue;
    const authUserId = profile.auth_user_id ? String(profile.auth_user_id) : null;
    const planId = planByStudent.get(studentId);
    const programId = majorByStudent.get(studentId);
    if (!authUserId || !Number.isInteger(planId) || !Number.isInteger(programId)) continue;

    if (selectedStudentIds.length > 0 && !selectedStudentIds.includes(studentId)) continue;

    candidates.push({
      student_id: studentId,
      auth_user_id: authUserId,
      plan_id: planId,
      program_id: programId,
      has_completed_onboarding: Boolean(profile.has_completed_onboarding),
    });
  }

  const randomized = shuffled(candidates, randomFn);
  return randomized.slice(0, sampleSize);
}

function iqrBounds(values) {
  if (values.length < 4) return null;
  const sortedValues = [...values].sort((a, b) => a - b);
  const q1 = percentile(sortedValues, 0.25);
  const q3 = percentile(sortedValues, 0.75);
  const iqr = q3 - q1;
  return {
    q1,
    q3,
    lower: q1 - iqr * 1.5,
    upper: q3 + iqr * 1.5,
  };
}

function summarizeRuns(runRows, { phase = "warm", mode = null, flowKey = null } = {}) {
  let scoped = [...runRows];
  if (phase) scoped = scoped.filter((row) => row.phase === phase);
  if (mode) scoped = scoped.filter((row) => row.mode === mode);
  if (flowKey) scoped = scoped.filter((row) => row.flow_key === flowKey);

  const successful = scoped.filter((row) => row.success);
  if (!successful.length) {
    return {
      total_runs: scoped.length,
      successful_runs: 0,
      outlier_runs: 0,
      p50_flow_ms: null,
      p95_flow_ms: null,
      p50_query_ms: null,
      p95_query_ms: null,
      p50_query_count: null,
      p50_response_bytes: null,
      filtered_run_ids: [],
    };
  }

  const flowDurations = successful.map((row) => row.flow_duration_ms);
  const bounds = iqrBounds(flowDurations);
  const filtered = bounds
    ? successful.filter(
        (row) => row.flow_duration_ms >= bounds.lower && row.flow_duration_ms <= bounds.upper
      )
    : successful;
  const effective = filtered.length ? filtered : successful;

  const sortedFlow = effective.map((row) => row.flow_duration_ms).sort((a, b) => a - b);
  const sortedQuery = effective.map((row) => row.query_duration_ms).sort((a, b) => a - b);
  const sortedQueryCount = effective.map((row) => row.query_count).sort((a, b) => a - b);
  const sortedBytes = effective.map((row) => row.response_bytes).sort((a, b) => a - b);

  return {
    total_runs: scoped.length,
    successful_runs: successful.length,
    outlier_runs: successful.length - effective.length,
    p50_flow_ms: percentile(sortedFlow, 0.5),
    p95_flow_ms: percentile(sortedFlow, 0.95),
    p50_query_ms: percentile(sortedQuery, 0.5),
    p95_query_ms: percentile(sortedQuery, 0.95),
    p50_query_count: percentile(sortedQueryCount, 0.5),
    p50_response_bytes: percentile(sortedBytes, 0.5),
    filtered_run_ids: effective.map((row) => row.run_id),
  };
}

function groupBy(array, keySelector) {
  const result = new Map();
  for (const item of array) {
    const key = keySelector(item);
    const bucket = result.get(key) ?? [];
    bucket.push(item);
    result.set(key, bucket);
  }
  return result;
}

function summarizeByFlowAndMode(runRows, phase) {
  const summary = {};
  for (const flow of FLOW_DEFINITIONS) {
    summary[flow.key] = {};
    for (const mode of ["old", "new"]) {
      summary[flow.key][mode] = summarizeRuns(runRows, {
        phase,
        mode,
        flowKey: flow.key,
      });
    }
  }
  return summary;
}

function buildPerRunTableFrequency(runRows, queryEvents, mode, flowKey, runIds) {
  const runIdSet = new Set(runIds);
  const selectedRuns = runRows.filter(
    (row) => row.mode === mode && row.flow_key === flowKey && runIdSet.has(row.run_id)
  );
  if (!selectedRuns.length) return {};

  const eventByRun = groupBy(
    queryEvents.filter((event) => runIdSet.has(event.run_id)),
    (event) => event.run_id
  );

  const tableTotals = new Map();
  for (const run of selectedRuns) {
    const events = eventByRun.get(run.run_id) ?? [];
    const perRunCounts = new Map();
    for (const event of events) {
      if (!event.table_name) continue;
      perRunCounts.set(event.table_name, (perRunCounts.get(event.table_name) ?? 0) + 1);
    }
    for (const [tableName, count] of perRunCounts.entries()) {
      tableTotals.set(tableName, (tableTotals.get(tableName) ?? 0) + count);
    }
  }

  const average = {};
  for (const [tableName, total] of tableTotals.entries()) {
    average[tableName] = total / selectedRuns.length;
  }
  return average;
}

async function parseJsonMaybeLines(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  const rows = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean) continue;
    rows.push(JSON.parse(clean));
  }
  return rows;
}

function findStringRecursively(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = findStringRecursively(item);
      if (candidate) return candidate;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (["path", "url", "request_path", "requestUrl"].includes(key)) {
        const candidate = findStringRecursively(value[key]);
        if (candidate) return candidate;
      }
    }
    for (const key of Object.keys(value)) {
      const candidate = findStringRecursively(value[key]);
      if (candidate && candidate.includes("/rest/v1/")) return candidate;
    }
  }
  return null;
}

function findTimestamp(value) {
  if (value && typeof value === "object") {
    const keys = ["timestamp", "time", "ts", "created_at", "datetime"];
    for (const key of keys) {
      if (value[key]) {
        const parsed = new Date(value[key]);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
    }
  }
  return null;
}

function deriveTrafficFromLogs(
  logRows,
  flowSummaryWarm,
  runRows,
  queryEvents,
  logWindowDays,
  nowDate,
  fallbackMonthlyRuns
) {
  const threshold = new Date(nowDate.getTime() - logWindowDays * MILLIS_IN_DAY);
  const tableCounts = new Map();
  let totalRows = 0;
  let windowRows = 0;
  let matchedRows = 0;
  let undatedRows = 0;

  for (const row of logRows) {
    totalRows += 1;
    const timestamp = findTimestamp(row);
    if (!timestamp) {
      undatedRows += 1;
    } else if (timestamp < threshold) {
      continue;
    }
    windowRows += 1;

    const pathString = findStringRecursively(row);
    if (!pathString) continue;
    const endpoint = normalizeEndpoint(pathString);
    const tableName = extractTableName(endpoint);
    if (!tableName) continue;

    matchedRows += 1;
    tableCounts.set(tableName, (tableCounts.get(tableName) ?? 0) + 1);
  }

  const windowDaysObserved = Math.max(logWindowDays, 1);
  const tablePerDay = {};
  for (const [tableName, count] of tableCounts.entries()) {
    tablePerDay[tableName] = count / windowDaysObserved;
  }

  const flowVolume = {};
  for (const flow of FLOW_DEFINITIONS) {
    const newSummary = flowSummaryWarm[flow.key]?.new;
    const runIds = newSummary?.filtered_run_ids ?? [];
    const tableFrequency = buildPerRunTableFrequency(
      runRows,
      queryEvents,
      "new",
      flow.key,
      runIds
    );

    const anchors = flow.anchorTables.new ?? [];
    const estimates = [];
    for (const anchor of anchors) {
      const dailyCount = tablePerDay[anchor];
      const perRunCount = tableFrequency[anchor];
      if (!dailyCount || !perRunCount) continue;
      estimates.push(dailyCount / perRunCount);
    }

    let runsPerDay = null;
    if (estimates.length > 0) {
      runsPerDay = median(estimates);
    } else if (fallbackMonthlyRuns !== null && fallbackMonthlyRuns !== undefined) {
      runsPerDay = fallbackMonthlyRuns / MONTH_DAYS;
    }

    flowVolume[flow.key] = {
      runs_per_day_estimate: runsPerDay,
      monthly_runs_estimate: runsPerDay === null ? null : runsPerDay * MONTH_DAYS,
      anchors_used: estimates.length,
      anchors_available: anchors.length,
      anchor_estimates: estimates,
      table_frequency_per_run: tableFrequency,
    };
  }

  return {
    log_rows_total: totalRows,
    log_rows_in_window: windowRows,
    log_rows_matched_to_rest: matchedRows,
    log_rows_without_timestamp: undatedRows,
    table_daily_counts: tablePerDay,
    flows: flowVolume,
  };
}

function loadRateCard(raw) {
  if (!raw) {
    return {
      compute_usd_per_second: 0,
      egress_usd_per_gb: 0,
      request_usd_per_1000: 0,
      notes: "No rate card supplied; costs defaulted to 0.",
    };
  }

  return {
    compute_usd_per_second: Number(raw.compute_usd_per_second ?? 0),
    egress_usd_per_gb: Number(raw.egress_usd_per_gb ?? 0),
    request_usd_per_1000: Number(raw.request_usd_per_1000 ?? 0),
    notes: raw.notes ?? "",
  };
}

function computeCostSummary(flowSummaryWarm, trafficSummary, manualTrafficVolumes, rateCard) {
  const rows = [];

  for (const flow of FLOW_DEFINITIONS) {
    const oldStats = flowSummaryWarm[flow.key]?.old;
    const newStats = flowSummaryWarm[flow.key]?.new;

    const logMonthly = trafficSummary?.flows?.[flow.key]?.monthly_runs_estimate ?? null;
    const manualMonthly = manualTrafficVolumes?.[flow.key] ?? null;
    const monthlyRuns =
      manualMonthly !== null && manualMonthly !== undefined ? manualMonthly : logMonthly;

    const modeCost = {};
    for (const mode of ["old", "new"]) {
      const stats = mode === "old" ? oldStats : newStats;
      if (!stats || !stats.successful_runs) {
        modeCost[mode] = null;
        continue;
      }
      const computePerRun =
        ((stats.p50_query_ms ?? 0) / 1000) * rateCard.compute_usd_per_second;
      const egressPerRun =
        ((stats.p50_response_bytes ?? 0) / (1024 ** 3)) * rateCard.egress_usd_per_gb;
      const requestPerRun =
        ((stats.p50_query_count ?? 0) / 1000) * rateCard.request_usd_per_1000;
      const totalPerRun = computePerRun + egressPerRun + requestPerRun;

      modeCost[mode] = {
        per_run: totalPerRun,
        monthly: monthlyRuns === null ? null : totalPerRun * monthlyRuns,
        monthly_runs: monthlyRuns,
      };
    }

    rows.push({
      flow_key: flow.key,
      flow_label: flow.label,
      old_cost_per_run_usd: modeCost.old?.per_run ?? null,
      new_cost_per_run_usd: modeCost.new?.per_run ?? null,
      old_monthly_cost_usd: modeCost.old?.monthly ?? null,
      new_monthly_cost_usd: modeCost.new?.monthly ?? null,
      estimated_monthly_runs: modeCost.new?.monthly_runs ?? modeCost.old?.monthly_runs ?? null,
      estimated_monthly_savings_usd:
        modeCost.old?.monthly !== null && modeCost.new?.monthly !== null
          ? modeCost.old.monthly - modeCost.new.monthly
          : null,
    });
  }

  const totalOld = rows
    .map((row) => row.old_monthly_cost_usd)
    .filter((value) => value !== null)
    .reduce((sum, value) => sum + value, 0);
  const totalNew = rows
    .map((row) => row.new_monthly_cost_usd)
    .filter((value) => value !== null)
    .reduce((sum, value) => sum + value, 0);

  return {
    rows,
    totals: {
      old_monthly_cost_usd: totalOld,
      new_monthly_cost_usd: totalNew,
      monthly_savings_usd: totalOld - totalNew,
    },
  };
}

function computeSpeedupRows(flowSummaryWarm, flowSummaryCold, costRows) {
  const costByFlow = new Map(costRows.rows.map((row) => [row.flow_key, row]));

  return FLOW_DEFINITIONS.map((flow) => {
    const warmOld = flowSummaryWarm[flow.key]?.old ?? {};
    const warmNew = flowSummaryWarm[flow.key]?.new ?? {};
    const coldOld = flowSummaryCold[flow.key]?.old ?? {};
    const coldNew = flowSummaryCold[flow.key]?.new ?? {};
    const cost = costByFlow.get(flow.key) ?? {};

    const speedupRatio =
      warmOld.p50_flow_ms && warmNew.p50_flow_ms
        ? warmOld.p50_flow_ms / warmNew.p50_flow_ms
        : null;
    const improvementPercent =
      warmOld.p50_flow_ms && warmNew.p50_flow_ms
        ? ((warmOld.p50_flow_ms - warmNew.p50_flow_ms) / warmOld.p50_flow_ms) * 100
        : null;

    return {
      flow_key: flow.key,
      flow_label: flow.label,
      warm_old_p50_flow_ms: warmOld.p50_flow_ms ?? null,
      warm_new_p50_flow_ms: warmNew.p50_flow_ms ?? null,
      warm_old_p95_flow_ms: warmOld.p95_flow_ms ?? null,
      warm_new_p95_flow_ms: warmNew.p95_flow_ms ?? null,
      warm_old_p50_query_ms: warmOld.p50_query_ms ?? null,
      warm_new_p50_query_ms: warmNew.p50_query_ms ?? null,
      warm_old_p95_query_ms: warmOld.p95_query_ms ?? null,
      warm_new_p95_query_ms: warmNew.p95_query_ms ?? null,
      warm_old_p50_query_count: warmOld.p50_query_count ?? null,
      warm_new_p50_query_count: warmNew.p50_query_count ?? null,
      cold_old_p50_flow_ms: coldOld.p50_flow_ms ?? null,
      cold_new_p50_flow_ms: coldNew.p50_flow_ms ?? null,
      speedup_ratio: speedupRatio,
      improvement_percent: improvementPercent,
      old_monthly_cost_usd: cost.old_monthly_cost_usd ?? null,
      new_monthly_cost_usd: cost.new_monthly_cost_usd ?? null,
      monthly_savings_usd: cost.estimated_monthly_savings_usd ?? null,
      estimated_monthly_runs: cost.estimated_monthly_runs ?? null,
      outliers_removed_old: warmOld.outlier_runs ?? 0,
      outliers_removed_new: warmNew.outlier_runs ?? 0,
    };
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

async function writeCsv(filePath, rows) {
  if (!rows.length) {
    await fs.writeFile(filePath, "", "utf8");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

function passSpeedupMatrix(runRows) {
  const byPass = groupBy(runRows.filter((row) => row.phase === "warm"), (row) => row.pass);
  const matrix = {};

  for (const [passNumber, rows] of byPass.entries()) {
    matrix[passNumber] = {};
    for (const flow of FLOW_DEFINITIONS) {
      const oldSummary = summarizeRuns(rows, {
        phase: "warm",
        flowKey: flow.key,
        mode: "old",
      });
      const newSummary = summarizeRuns(rows, {
        phase: "warm",
        flowKey: flow.key,
        mode: "new",
      });
      if (oldSummary.p50_flow_ms && newSummary.p50_flow_ms) {
        matrix[passNumber][flow.key] = oldSummary.p50_flow_ms / newSummary.p50_flow_ms;
      }
    }
  }
  return matrix;
}

function evaluatePassVariance(speedupByPass, threshold) {
  const passNumbers = Object.keys(speedupByPass)
    .map((value) => Number(value))
    .sort((a, b) => a - b);

  const issues = [];
  if (passNumbers.length < 2) return { pass_numbers: passNumbers, issues };

  for (const flow of FLOW_DEFINITIONS) {
    for (let index = 1; index < passNumbers.length; index += 1) {
      const prevPass = passNumbers[index - 1];
      const currentPass = passNumbers[index];
      const prevSpeedup = speedupByPass[prevPass]?.[flow.key];
      const currentSpeedup = speedupByPass[currentPass]?.[flow.key];
      if (!prevSpeedup || !currentSpeedup) continue;
      const average = (prevSpeedup + currentSpeedup) / 2;
      const variance = Math.abs(currentSpeedup - prevSpeedup) / average;
      if (variance > threshold) {
        issues.push({
          flow_key: flow.key,
          previous_pass: prevPass,
          current_pass: currentPass,
          previous_speedup: prevSpeedup,
          current_speedup: currentSpeedup,
          variance_ratio: variance,
        });
      }
    }
  }

  return { pass_numbers: passNumbers, issues };
}

function markdownTable(headers, rows) {
  const head = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return [head, divider, body].join("\n");
}

function generateRerunCommand(config) {
  const parts = ["node scripts/perf/benchmark-replay.mjs"];
  parts.push(`--baseline-commit ${config.baseline_commit}`);
  parts.push(`--mode ${config.mode}`);
  parts.push(`--sample-size ${config.sample_size}`);
  parts.push(`--cold-runs ${config.cold_runs}`);
  parts.push(`--warm-runs ${config.warm_runs}`);
  parts.push(`--passes ${config.passes}`);
  parts.push(`--max-extra-passes ${config.max_extra_passes}`);
  parts.push(`--variance-threshold ${config.variance_threshold}`);
  parts.push(`--seed ${config.seed}`);
  parts.push(`--search-term "${config.search_term}"`);
  if (config.rate_card_file) parts.push(`--rate-card-file "${config.rate_card_file}"`);
  if (config.log_file) parts.push(`--log-file "${config.log_file}"`);
  if (config.log_window_days) parts.push(`--log-window-days ${config.log_window_days}`);
  if (config.traffic_volume_file) {
    parts.push(`--traffic-volume-file "${config.traffic_volume_file}"`);
  }
  if (config.monthly_runs_default !== null && config.monthly_runs_default !== undefined) {
    parts.push(`--monthly-runs-default ${config.monthly_runs_default}`);
  }
  parts.push(`--allow-sample-reuse ${config.allow_sample_reuse}`);
  parts.push(`--reuse-executions ${config.reuse_executions}`);
  parts.push(`--output-dir "${config.output_dir}"`);
  return parts.join(" ");
}

function generateMarkdownReport({
  metadata,
  speedupRows,
  costSummary,
  passVariance,
  trafficSummary,
  rateCard,
  command,
}) {
  const successfulFlows = speedupRows.filter(
    (row) => row.warm_old_p50_flow_ms !== null && row.warm_new_p50_flow_ms !== null
  );
  const averageImprovement =
    successfulFlows.length > 0
      ? successfulFlows
          .map((row) => row.improvement_percent ?? 0)
          .reduce((sum, value) => sum + value, 0) / successfulFlows.length
      : null;

  const topSpeedup = [...successfulFlows]
    .sort((a, b) => (b.improvement_percent ?? -Infinity) - (a.improvement_percent ?? -Infinity))
    .slice(0, 3);

  const flowRows = speedupRows.map((row) => [
    row.flow_label,
    formatMs(row.warm_old_p50_flow_ms),
    formatMs(row.warm_new_p50_flow_ms),
    formatMs(row.warm_old_p95_flow_ms),
    formatMs(row.warm_new_p95_flow_ms),
    formatMs(row.warm_old_p50_query_ms),
    formatMs(row.warm_new_p50_query_ms),
    row.speedup_ratio ? `${roundNumber(row.speedup_ratio, 3)}x` : "n/a",
    formatPct(row.improvement_percent),
    formatUsd(row.old_monthly_cost_usd),
    formatUsd(row.new_monthly_cost_usd),
    formatUsd(row.monthly_savings_usd),
  ]);

  const coldRows = speedupRows.map((row) => [
    row.flow_label,
    formatMs(row.cold_old_p50_flow_ms),
    formatMs(row.cold_new_p50_flow_ms),
  ]);

  const outlierRows = speedupRows.map((row) => [
    row.flow_label,
    String(row.outliers_removed_old ?? 0),
    String(row.outliers_removed_new ?? 0),
  ]);

  const varianceRows =
    passVariance.issues.length === 0
      ? [["None", "-", "-", "-", "-"]]
      : passVariance.issues.map((issue) => [
          issue.flow_key,
          String(issue.previous_pass),
          String(issue.current_pass),
          `${roundNumber(issue.previous_speedup, 3)}x -> ${roundNumber(issue.current_speedup, 3)}x`,
          formatPct(issue.variance_ratio * 100),
        ]);

  const topSpeedupLines =
    topSpeedup.length === 0
      ? "- No successful flow comparisons were produced."
      : topSpeedup
          .map(
            (row) =>
              `- ${row.flow_label}: ${formatPct(row.improvement_percent)} (${roundNumber(
                row.speedup_ratio,
                3
              )}x)`
          )
          .join("\n");

  const trafficSummaryLines = trafficSummary
    ? [
        `- Log rows parsed: ${trafficSummary.log_rows_total}`,
        `- In window: ${trafficSummary.log_rows_in_window}`,
        `- Matched REST rows: ${trafficSummary.log_rows_matched_to_rest}`,
        `- Rows missing timestamp: ${trafficSummary.log_rows_without_timestamp}`,
      ].join("\n")
    : "- No log file supplied. Monthly run counts may be null unless manually overridden.";

  return `# Old vs New Session Performance & Cost Report

Generated: ${new Date(metadata.generated_at).toISOString()}

## Executive Summary
- Baseline commit: \`${metadata.baseline_commit}\`
- Compared modes: \`${metadata.modes.join(", ")}\`
- Sample size: ${metadata.sample_size} students
- Runs: ${metadata.passes_executed} pass(es), cold=${metadata.cold_runs}, warm=${metadata.warm_runs}
- Average warm flow improvement: ${formatPct(averageImprovement)}
- Estimated monthly cost delta: ${formatUsd(costSummary.totals.monthly_savings_usd)} (estimate, not invoice-exact)

Top warm-flow improvements:
${topSpeedupLines}

## Warm Performance + Cost
${markdownTable(
  [
    "Flow",
    "Old p50 load",
    "New p50 load",
    "Old p95 load",
    "New p95 load",
    "Old p50 query",
    "New p50 query",
    "Speed-up",
    "Improvement",
    "Old monthly cost",
    "New monthly cost",
    "Monthly savings",
  ],
  flowRows
)}

## Cold p50 Load Times
${markdownTable(["Flow", "Old cold p50", "New cold p50"], coldRows)}

## Outlier Handling
Rule: IQR filter on warm/cold flow duration per flow+mode.  
Outlier threshold: values outside \`[Q1 - 1.5*IQR, Q3 + 1.5*IQR]\`.

${markdownTable(["Flow", "Old outliers removed", "New outliers removed"], outlierRows)}

## Pass Variance Check
Threshold: ${formatPct(metadata.variance_threshold * 100)} between adjacent pass speed-up ratios.

${markdownTable(
  ["Flow", "Previous pass", "Current pass", "Speed-up transition", "Variance"],
  varianceRows
)}

## Traffic Volume Derivation
${trafficSummaryLines}

## Rate Card
- Compute rate (USD/sec): ${rateCard.compute_usd_per_second}
- Egress rate (USD/GB): ${rateCard.egress_usd_per_gb}
- Request rate (USD/1000): ${rateCard.request_usd_per_1000}
- Notes: ${rateCard.notes || "n/a"}

## Assumptions & Caveats
- This is a replay benchmark against current database state, not historical raw telemetry replay.
- Monthly dollar figures are estimates from benchmark runtime + response bytes + request count.
- Flow run-volume is inferred from recent logs and anchor endpoint frequencies; overlapping endpoints add uncertainty.
- Writes are excluded; this report is student-facing read-path only.

## Reproducibility
\`\`\`bash
${command}
\`\`\`

Raw artifacts:
- \`flow_runs.json\`
- \`query_events.json\`
- \`flow_summary_warm.json\`
- \`flow_summary_cold.json\`
- \`speedup_summary.json\`
- \`cost_summary.json\`
- \`traffic_summary.json\`
- \`*.csv\`
`;
}

async function run() {
  await loadEnvFiles();

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const config = {
    baseline_commit: String(args["baseline-commit"] ?? DEFAULT_BASELINE_COMMIT),
    mode: String(args.mode ?? "both"),
    modes: toMode(args.mode ?? "both"),
    sample_size: toNumber(args["sample-size"], DEFAULT_SAMPLE_SIZE, { integer: true, min: 1 }),
    student_ids: parseCsvInts(args["student-ids"]),
    cold_runs: toNumber(args["cold-runs"], DEFAULT_COLD_RUNS, { integer: true, min: 1 }),
    warm_runs: toNumber(args["warm-runs"], DEFAULT_WARM_RUNS, { integer: true, min: 1 }),
    passes: toNumber(args.passes, DEFAULT_PASSES, { integer: true, min: 1 }),
    max_extra_passes: toNumber(args["max-extra-passes"], DEFAULT_MAX_EXTRA_PASSES, {
      integer: true,
      min: 0,
    }),
    variance_threshold: toNumber(args["variance-threshold"], DEFAULT_VARIANCE_THRESHOLD, {
      min: 0,
    }),
    seed: stableSeed(args.seed),
    search_term: String(args["search-term"] ?? DEFAULT_SEARCH_TERM),
    output_dir: args["output-dir"] ?? null,
    rate_card_file: args["rate-card-file"] ?? null,
    log_file: args["log-file"] ?? null,
    log_window_days: toNumber(args["log-window-days"], DEFAULT_LOG_WINDOW_DAYS, {
      integer: true,
      min: 1,
    }),
    traffic_volume_file: args["traffic-volume-file"] ?? null,
    monthly_runs_default:
      args["monthly-runs-default"] !== undefined
        ? toNumber(args["monthly-runs-default"], null, { min: 0 })
        : null,
    allow_anon: toBoolean(args["allow-anon"], false),
    allow_sample_reuse: toBoolean(args["allow-sample-reuse"], false),
    reuse_executions: toBoolean(args["reuse-executions"], true),
  };

  const now = new Date();
  const outputDir = config.output_dir
    ? path.resolve(config.output_dir)
    : path.resolve("docs", "performance", "reports", `${timestampTag(now)}-old-vs-new`);
  await fs.mkdir(outputDir, { recursive: true });

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL"]);
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in environment.");
  }

  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
  ]);

  let keyType = "service_role";
  let supabaseKey = serviceRoleKey;
  if (!supabaseKey) {
    if (!config.allow_anon || !anonKey) {
      throw new Error(
        "Missing SUPABASE_SERVICE_ROLE_KEY. Set it or run with --allow-anon=true and a publishable key."
      );
    }
    keyType = "anon";
    supabaseKey = anonKey;
  }

  const tracker = new QueryTracker(globalThis.fetch.bind(globalThis));
  const client = createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: tracker.instrumentedFetch,
    },
  });

  await expectQuery(client.from("programs").select("id").limit(1), "supabase connectivity check");

  const rng = createSeededRandom(config.seed);
  const selectedStudents = await fetchStudentSamples(
    client,
    config.sample_size,
    rng,
    config.student_ids
  );

  let studentSamples = selectedStudents;
  let baseStudentPoolSize = selectedStudents.length;
  let syntheticSamplesAdded = 0;
  if (studentSamples.length < config.sample_size) {
    if (!config.allow_sample_reuse) {
      throw new Error(
        `Sample selection returned ${studentSamples.length} student(s), expected ${config.sample_size}.`
      );
    }
    studentSamples = expandSampleWithReplacement(selectedStudents, config.sample_size, rng);
    syntheticSamplesAdded = studentSamples.length - selectedStudents.length;
  }

  const flowRuns = [];
  const executionCache = new Map();
  let runCounter = 0;
  let cacheHitCount = 0;

  const runFlow = async ({
    pass,
    sample,
    flow,
    mode,
    phase,
    attempt,
  }) => {
    runCounter += 1;
    const runId = `${flow.key}-${mode}-p${pass}-${phase}-${attempt}-s${sample.student_id}-r${runCounter}`;
    const cacheKey = `${pass}|${flow.key}|${mode}|${phase}|${attempt}|${sample.student_id}|${sample.plan_id}|${sample.program_id}|${sample.auth_user_id}`;

    if (config.reuse_executions && executionCache.has(cacheKey)) {
      cacheHitCount += 1;
      const cached = executionCache.get(cacheKey);
      flowRuns.push({
        ...cached.row,
        run_id: runId,
        timestamp: new Date().toISOString(),
        synthetic_reuse: true,
      });
      return;
    }

    const runContext = {
      run_id: runId,
      flow_key: flow.key,
      flow_label: flow.label,
      mode,
      phase,
      pass,
      student_id: sample.student_id,
      auth_user_id: sample.auth_user_id,
      plan_id: sample.plan_id,
      program_id: sample.program_id,
    };

    tracker.setContext(runContext);
    const startEventIndex = tracker.events.length;
    const startedAt = new Date().toISOString();
    const started = performance.now();

    let success = true;
    let runError = null;

    try {
      const runner = flowRunner(mode, flow.key);
      if (!runner) {
        throw new Error(`Missing flow runner for ${mode}:${flow.key}`);
      }
      await runner(client, sample, config.search_term);
    } catch (error) {
      success = false;
      runError = errorMessage(error);
    } finally {
      tracker.clearContext();
    }

    const runEvents = tracker.events.slice(startEventIndex);
    const flowDurationMs = roundNumber(performance.now() - started, 3);
    const queryDurationMs = roundNumber(
      runEvents.reduce((sum, event) => sum + Number(event.duration_ms ?? 0), 0),
      3
    );
    const responseBytes = runEvents.reduce(
      (sum, event) => sum + Number(event.response_bytes ?? 0),
      0
    );

    const row = {
      run_id: runId,
      timestamp: startedAt,
      flow_key: flow.key,
      flow_label: flow.label,
      mode,
      phase,
      pass,
      attempt,
      student_id: sample.student_id,
      auth_user_id: sample.auth_user_id,
      plan_id: sample.plan_id,
      program_id: sample.program_id,
      success,
      error: runError,
      flow_duration_ms: flowDurationMs,
      query_duration_ms: queryDurationMs,
      query_count: runEvents.length,
      response_bytes: responseBytes,
      key_type: keyType,
    };
    flowRuns.push(row);

    if (config.reuse_executions) {
      executionCache.set(cacheKey, {
        row,
      });
    }
  };

  let passesExecuted = 0;
  let remainingExtraPasses = config.max_extra_passes;
  let keepRunning = true;

  while (keepRunning) {
    passesExecuted += 1;

    for (const sample of studentSamples) {
      for (const flow of FLOW_DEFINITIONS) {
        if (flow.studentScoped && !sample.student_id) continue;

        for (let coldIndex = 1; coldIndex <= config.cold_runs; coldIndex += 1) {
          const coldOrder = shuffled(config.modes, rng);
          for (const mode of coldOrder) {
            await runFlow({
              pass: passesExecuted,
              sample,
              flow,
              mode,
              phase: "cold",
              attempt: coldIndex,
            });
          }
        }

        for (let warmIndex = 1; warmIndex <= config.warm_runs; warmIndex += 1) {
          const warmOrder = shuffled(config.modes, rng);
          for (const mode of warmOrder) {
            await runFlow({
              pass: passesExecuted,
              sample,
              flow,
              mode,
              phase: "warm",
              attempt: warmIndex,
            });
          }
        }
      }
    }

    if (passesExecuted < config.passes) {
      continue;
    }

    const speedupByPass = passSpeedupMatrix(flowRuns);
    const variance = evaluatePassVariance(speedupByPass, config.variance_threshold);
    if (variance.issues.length > 0 && remainingExtraPasses > 0) {
      remainingExtraPasses -= 1;
      continue;
    }

    keepRunning = false;
  }

  const flowSummaryWarm = summarizeByFlowAndMode(flowRuns, "warm");
  const flowSummaryCold = summarizeByFlowAndMode(flowRuns, "cold");

  const speedupByPass = passSpeedupMatrix(flowRuns);
  const passVariance = evaluatePassVariance(speedupByPass, config.variance_threshold);

  let rateCard = loadRateCard(null);
  if (config.rate_card_file) {
    const rawRateCard = JSON.parse(await fs.readFile(path.resolve(config.rate_card_file), "utf8"));
    rateCard = loadRateCard(rawRateCard);
  }

  let manualTrafficVolumes = null;
  if (config.traffic_volume_file) {
    const rawTraffic = JSON.parse(
      await fs.readFile(path.resolve(config.traffic_volume_file), "utf8")
    );
    manualTrafficVolumes = rawTraffic.flows ?? null;
  }

  let trafficSummary = null;
  if (config.log_file) {
    const logs = await parseJsonMaybeLines(path.resolve(config.log_file));
    trafficSummary = deriveTrafficFromLogs(
      logs,
      flowSummaryWarm,
      flowRuns,
      tracker.events,
      config.log_window_days,
      now,
      config.monthly_runs_default
    );
  } else if (config.monthly_runs_default !== null && config.monthly_runs_default !== undefined) {
    trafficSummary = {
      log_rows_total: 0,
      log_rows_in_window: 0,
      log_rows_matched_to_rest: 0,
      log_rows_without_timestamp: 0,
      table_daily_counts: {},
      flows: Object.fromEntries(
        FLOW_DEFINITIONS.map((flow) => [
          flow.key,
          {
            runs_per_day_estimate: config.monthly_runs_default / MONTH_DAYS,
            monthly_runs_estimate: config.monthly_runs_default,
            anchors_used: 0,
            anchors_available: flow.anchorTables.new.length,
            anchor_estimates: [],
            table_frequency_per_run: {},
          },
        ])
      ),
    };
  }

  const costSummary = computeCostSummary(
    flowSummaryWarm,
    trafficSummary,
    manualTrafficVolumes,
    rateCard
  );

  const speedupRows = computeSpeedupRows(
    flowSummaryWarm,
    flowSummaryCold,
    costSummary
  );

  const metadata = {
    generated_at: now.toISOString(),
    baseline_commit: config.baseline_commit,
    mode: config.mode,
    modes: config.modes,
    sample_size: config.sample_size,
    selected_student_ids: config.student_ids,
    student_samples: studentSamples,
    base_student_pool_size: baseStudentPoolSize,
    synthetic_samples_added: syntheticSamplesAdded,
    execution_cache_enabled: config.reuse_executions,
    execution_cache_hits: cacheHitCount,
    seed: config.seed,
    cold_runs: config.cold_runs,
    warm_runs: config.warm_runs,
    passes_requested: config.passes,
    passes_executed: passesExecuted,
    max_extra_passes: config.max_extra_passes,
    variance_threshold: config.variance_threshold,
    pass_variance_issue_count: passVariance.issues.length,
    supabase_key_type: keyType,
    output_dir: outputDir,
    rate_card_file: config.rate_card_file,
    log_file: config.log_file,
    traffic_volume_file: config.traffic_volume_file,
    allow_sample_reuse: config.allow_sample_reuse,
    reuse_executions: config.reuse_executions,
  };

  const rerunCommand = generateRerunCommand({
    ...config,
    output_dir: outputDir,
  });

  const reportMarkdown = generateMarkdownReport({
    metadata,
    speedupRows,
    costSummary,
    passVariance,
    trafficSummary,
    rateCard,
    command: rerunCommand,
  });

  await Promise.all([
    fs.writeFile(path.join(outputDir, "run_metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`),
    fs.writeFile(path.join(outputDir, "flow_runs.json"), `${JSON.stringify(flowRuns, null, 2)}\n`),
    fs.writeFile(path.join(outputDir, "query_events.json"), `${JSON.stringify(tracker.events, null, 2)}\n`),
    fs.writeFile(
      path.join(outputDir, "flow_summary_warm.json"),
      `${JSON.stringify(flowSummaryWarm, null, 2)}\n`
    ),
    fs.writeFile(
      path.join(outputDir, "flow_summary_cold.json"),
      `${JSON.stringify(flowSummaryCold, null, 2)}\n`
    ),
    fs.writeFile(
      path.join(outputDir, "speedup_summary.json"),
      `${JSON.stringify(speedupRows, null, 2)}\n`
    ),
    fs.writeFile(
      path.join(outputDir, "cost_summary.json"),
      `${JSON.stringify(costSummary, null, 2)}\n`
    ),
    fs.writeFile(
      path.join(outputDir, "traffic_summary.json"),
      `${JSON.stringify(trafficSummary, null, 2)}\n`
    ),
    fs.writeFile(path.join(outputDir, "report.md"), reportMarkdown),
    writeCsv(path.join(outputDir, "flow_runs.csv"), flowRuns),
    writeCsv(path.join(outputDir, "query_events.csv"), tracker.events),
    writeCsv(path.join(outputDir, "speedup_summary.csv"), speedupRows),
    writeCsv(path.join(outputDir, "cost_summary.csv"), costSummary.rows),
  ]);

  console.log(`Benchmark complete. Artifacts written to: ${outputDir}`);
  console.log(`Markdown report: ${path.join(outputDir, "report.md")}`);
}

run().catch((error) => {
  console.error("Benchmark failed:", errorMessage(error));
  process.exitCode = 1;
});
