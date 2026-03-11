import fs from "node:fs";
import path from "node:path";

const checkMode = process.argv.includes("--check");
const repoRoot = process.cwd();
const canonicalSkillsRoot = path.join(repoRoot, ".agents", "skills");
const manifestPath = path.join(canonicalSkillsRoot, "manifest.json");
const claudeSkillsRoot = path.join(repoRoot, ".claude", "skills");

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing manifest at ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.skills)) {
    throw new Error("manifest.json must contain a 'skills' array");
  }
  return manifest;
}

function readFileIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const manifest = readManifest();
const drifts = [];

ensureDir(path.join(repoRoot, ".claude"));
ensureDir(claudeSkillsRoot);

const existingSkillDirs = fs
  .readdirSync(claudeSkillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

for (const existing of existingSkillDirs) {
  if (!manifest.skills.includes(existing)) {
    drifts.push(
      `Unexpected generated skill folder '.claude/skills/${existing}' is present but not in manifest`
    );
    if (!checkMode) {
      fs.rmSync(path.join(claudeSkillsRoot, existing), { recursive: true, force: true });
    }
  }
}

for (const skill of manifest.skills) {
  const srcPath = path.join(canonicalSkillsRoot, skill, "SKILL.md");
  const destDir = path.join(claudeSkillsRoot, skill);
  const destPath = path.join(destDir, "SKILL.md");

  if (!fs.existsSync(srcPath)) {
    throw new Error(`Source SKILL.md missing for '${skill}' at ${srcPath}`);
  }

  const source = fs.readFileSync(srcPath, "utf8");
  const target = readFileIfExists(destPath);

  if (target !== source) {
    drifts.push(`Drift in '.claude/skills/${skill}/SKILL.md'`);
    if (!checkMode) {
      ensureDir(destDir);
      fs.writeFileSync(destPath, source, "utf8");
    }
  }
}

if (checkMode) {
  if (drifts.length > 0) {
    console.error("Skill sync check failed:");
    for (const drift of drifts) {
      console.error(`- ${drift}`);
    }
    console.error("Run: npm run skills:sync");
    process.exit(1);
  }
  console.log("Skill sync check passed.");
} else {
  if (drifts.length > 0) {
    console.log("Skills synced to .claude/skills.");
    for (const drift of drifts) {
      console.log(`- ${drift}`);
    }
  } else {
    console.log("No skill changes detected. .claude/skills already up to date.");
  }
}
