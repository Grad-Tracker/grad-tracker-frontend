#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const AUDIT_RESULT_PATH = ".playwright-cli/majors-audit/audit-result-2026-04-20.json";
const CATALOG_SCRAPE_PATH = ".playwright-cli/majors-audit/catalog-scrape-2026-04-20.json";
const FOUNDATION_CODE_PATTERN = /^(ENGL\s+10\d|MATH\s+(10[2-4]|11[14])|QM\s+110)$/;

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

function tokenize(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function tokenOverlapScore(left, right) {
  const leftSet = new Set(tokenize(left));
  const rightSet = new Set(tokenize(right));
  let overlap = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) overlap += 1;
  }
  return overlap;
}

function parseCourseCode(code) {
  const [subject, number] = normalizeCode(code).split(/\s+/);
  return { subject: subject ?? "", number: number ?? "" };
}

function codeLevel(number) {
  const n = Number(String(number).replace(/[^\d]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return n;
}

function isFoundationCode(code) {
  return FOUNDATION_CODE_PATTERN.test(normalizeCode(code));
}

function foundationBonus(subject, blockName) {
  const name = blockName.toLowerCase();
  if (subject === "MATH" || subject === "QM") {
    if (/math|quantitative|computational/.test(name)) return 8;
    if (/basic skills|fundamental|preparation/.test(name)) return 4;
  }
  if (subject === "ENGL") {
    if (/english|writing/.test(name)) return 8;
    if (/basic skills|fundamental|preparation/.test(name)) return 4;
  }
  return 0;
}

function subjectKeywordBonus(subject, blockName) {
  const name = blockName.toLowerCase();
  const genericBySubject = {
    COMM: /\bcomm|communication|speech|social and behavioral/,
    PSYC: /\bpsyc|psych/,
    SOCA: /\bsoca|soci/,
    PHIL: /\bphil|philos/,
    POLS: /\bpols|polit/,
    SPAN: /\bspan|spanish/,
    ECON: /\becon|econom/,
    MUSI: /\bmusi|music/,
    MUSA: /\bmusa|music|applied music/,
  };

  if (new RegExp(`\\b${subject.toLowerCase()}\\b`).test(name)) return 6;
  const generic = genericBySubject[subject];
  return generic && generic.test(name) ? 5 : 0;
}

function chooseBestBlock({ majorName, code, blocks, contexts }) {
  const { subject, number } = parseCourseCode(code);
  const level = codeLevel(number);
  const contextText = contexts.join(" | ");

  const scored = blocks.map((block) => {
    const blockName = normalizeWhitespace(block.block_name);
    const lowerName = blockName.toLowerCase();
    const courses = Array.isArray(block.courses) ? block.courses : [];
    const sameSubjectCount = courses.filter(
      (course) => normalizeCode(course.subject) === subject
    ).length;

    let score = 0;
    score += sameSubjectCount * 10;
    score += subjectKeywordBonus(subject, blockName);
    score += foundationBonus(subject, blockName);
    score += Math.min(6, tokenOverlapScore(contextText, blockName));

    if (/(elective|option|concentration|track)/.test(lowerName) && level >= 300) score += 2;
    if (/(required|core|requirements|prerequisites|pre-)/.test(lowerName)) score += 1;
    if (/(general education|degree requirements|basic skills|fundamental|preparation)/.test(lowerName)) score += 1;
    if (block.is_plannable) score += 1;

    return {
      blockId: Number(block.block_id),
      blockName,
      score,
      sameSubjectCount,
      isPlannable: block.is_plannable !== false,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];

  if (!best) return { decision: "skip", reason: "NO_BLOCKS" };

  const scoreGap = second ? best.score - second.score : best.score;
  const highConfidence =
    best.score >= 12 ||
    best.sameSubjectCount >= 2 ||
    (best.sameSubjectCount >= 1 && best.score >= 9) ||
    (isFoundationCode(code) && best.score >= 9);

  const ambiguous = second && Math.abs(best.score - second.score) < 2 && best.sameSubjectCount === second.sameSubjectCount;
  if (!highConfidence) {
    return {
      decision: "skip",
      reason: "LOW_CONFIDENCE",
      best,
      second: second ?? null,
    };
  }
  if (ambiguous && best.score < 20) {
    return {
      decision: "skip",
      reason: "AMBIGUOUS",
      best,
      second,
    };
  }

  return {
    decision: "apply",
    best,
    scoreGap,
    majorName,
    code,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const rootDir = process.cwd();
  const env = loadEnvFromFile(path.join(rootDir, ".env"));
  const supabase = createSupabase(env);

  const audit = JSON.parse(fs.readFileSync(path.join(rootDir, AUDIT_RESULT_PATH), "utf8"));
  const catalog = JSON.parse(fs.readFileSync(path.join(rootDir, CATALOG_SCRAPE_PATH), "utf8"));
  const catalogByMajor = new Map(catalog.map((row) => [normalizeWhitespace(row.name), row]));

  const targets = [];
  for (const major of audit.majorResults ?? []) {
    const issue = (major.issues ?? []).find((item) => item.code === "MISSING_REVIEW_COURSE_MAPPING");
    if (!issue?.codes?.length) continue;
    for (const code of issue.codes) {
      targets.push({
        majorName: normalizeWhitespace(major.name),
        code: normalizeCode(code),
      });
    }
  }

  const uniqueTargets = Array.from(
    new Map(targets.map((row) => [`${row.majorName}::${row.code}`, row])).values()
  );

  const majorNames = Array.from(new Set(uniqueTargets.map((row) => row.majorName)));
  const { data: programRows, error: programError } = await supabase
    .from("programs")
    .select("id, name")
    .in("name", majorNames);
  if (programError) throw programError;
  const programByName = new Map((programRows ?? []).map((row) => [normalizeWhitespace(row.name), Number(row.id)]));

  const programIds = Array.from(new Set((programRows ?? []).map((row) => Number(row.id))));
  const { data: blockRows, error: blockError } = await supabase
    .from("v_program_block_courses")
    .select("program_id, block_id, block_name, is_plannable, courses")
    .in("program_id", programIds.length ? programIds : [-1]);
  if (blockError) throw blockError;
  const blocksByProgramId = new Map();
  for (const row of blockRows ?? []) {
    const pid = Number(row.program_id);
    if (!blocksByProgramId.has(pid)) blocksByProgramId.set(pid, []);
    blocksByProgramId.get(pid).push(row);
  }

  const allCodes = Array.from(new Set(uniqueTargets.map((row) => row.code)));
  const subjects = Array.from(new Set(allCodes.map((code) => parseCourseCode(code).subject)));
  const { data: courseRows, error: courseError } = await supabase
    .from("courses")
    .select("id, subject, number")
    .in("subject", subjects.length ? subjects : ["__none__"]);
  if (courseError) throw courseError;
  const courseIdByCode = new Map(
    (courseRows ?? []).map((row) => [normalizeCode(`${row.subject} ${row.number}`), Number(row.id)])
  );

  const decisions = [];
  for (const target of uniqueTargets) {
    const programId = programByName.get(target.majorName);
    if (!Number.isFinite(programId)) {
      decisions.push({ ...target, decision: "skip", reason: "PROGRAM_NOT_FOUND" });
      continue;
    }
    const courseId = courseIdByCode.get(target.code);
    if (!Number.isFinite(courseId)) {
      decisions.push({ ...target, decision: "skip", reason: "COURSE_NOT_FOUND" });
      continue;
    }

    const majorCatalog = catalogByMajor.get(target.majorName);
    const contexts = (majorCatalog?.courseEntries ?? [])
      .filter((entry) => normalizeCode(entry.code) === target.code)
      .map((entry) => normalizeWhitespace(entry.context))
      .filter(Boolean);

    const blockList = blocksByProgramId.get(programId) ?? [];
    const pick = chooseBestBlock({
      majorName: target.majorName,
      code: target.code,
      blocks: blockList,
      contexts,
    });

    decisions.push({
      ...target,
      programId,
      courseId,
      contexts,
      ...pick,
    });
  }

  const applyRows = decisions.filter((row) => row.decision === "apply");
  const skippedRows = decisions.filter((row) => row.decision !== "apply");

  let inserted = 0;
  for (const row of applyRows) {
    if (!args.dryRun) {
      const { error } = await supabase
        .from("program_requirement_courses")
        .insert({
          block_id: row.best.blockId,
          course_id: row.courseId,
        });
      if (error && error.code !== "23505") throw error;
      if (!error) inserted += 1;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    totalTargets: decisions.length,
    autoMappedCount: applyRows.length,
    insertedCount: inserted,
    skippedCount: skippedRows.length,
    applied: applyRows.map((row) => ({
      majorName: row.majorName,
      code: row.code,
      blockId: row.best.blockId,
      blockName: row.best.blockName,
      score: row.best.score,
      scoreGap: row.scoreGap ?? null,
    })),
    skipped: skippedRows.map((row) => ({
      majorName: row.majorName,
      code: row.code,
      reason: row.reason ?? "UNKNOWN",
      best: row.best ?? null,
      second: row.second ?? null,
    })),
  };

  const outDir = path.join(rootDir, ".playwright-cli", "majors-audit");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "major-mapping-fix-result-2026-04-20.json");
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(
    `[majors:link-fix] Done. targets=${report.totalTargets}, autoMapped=${report.autoMappedCount}, inserted=${report.insertedCount}, skipped=${report.skippedCount}, dryRun=${report.dryRun}`
  );
  console.log(`[majors:link-fix] Result: ${outPath}`);
}

main().catch((error) => {
  console.error("[majors:link-fix] Fatal error:", error);
  process.exit(1);
});
