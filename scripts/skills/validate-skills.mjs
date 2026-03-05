import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const skillsRoot = path.join(repoRoot, ".agents", "skills");
const manifestPath = path.join(skillsRoot, "manifest.json");

const errors = [];

function fail(message) {
  errors.push(message);
}

function parseFrontmatter(raw, filePath) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    fail(`${filePath}: missing YAML frontmatter block`);
    return {};
  }

  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const pair = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!pair) continue;
    let value = pair[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fields[pair[1]] = value;
  }

  return fields;
}

if (!fs.existsSync(manifestPath)) {
  fail(`Missing manifest: ${manifestPath}`);
}

let manifest = null;
if (errors.length === 0) {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`Invalid JSON in ${manifestPath}: ${error.message}`);
  }
}

const skillNamePattern = /^[a-z0-9-]+$/;

if (manifest) {
  if (typeof manifest.version !== "number") {
    fail("manifest.json: 'version' must be a number");
  }

  if (!Array.isArray(manifest.targets)) {
    fail("manifest.json: 'targets' must be an array");
  } else if (!manifest.targets.includes("claude")) {
    fail("manifest.json: 'targets' must include 'claude'");
  }

  if (!Array.isArray(manifest.skills) || manifest.skills.length === 0) {
    fail("manifest.json: 'skills' must be a non-empty array");
  } else {
    for (const skill of manifest.skills) {
      if (typeof skill !== "string" || !skillNamePattern.test(skill)) {
        fail(
          `manifest.json: invalid skill '${skill}' (expected lowercase letters, digits, hyphens)`
        );
      }
    }
  }
}

if (manifest?.skills) {
  const diskSkillDirs = fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const manifestSkills = [...manifest.skills].sort();

  for (const skill of manifestSkills) {
    const skillDir = path.join(skillsRoot, skill);
    const skillPath = path.join(skillDir, "SKILL.md");

    if (!fs.existsSync(skillDir) || !fs.statSync(skillDir).isDirectory()) {
      fail(`Skill directory missing: ${skillDir}`);
      continue;
    }
    if (!fs.existsSync(skillPath)) {
      fail(`Missing SKILL.md: ${skillPath}`);
      continue;
    }

    const fields = parseFrontmatter(fs.readFileSync(skillPath, "utf8"), skillPath);
    if (!fields.name) {
      fail(`${skillPath}: frontmatter is missing required field 'name'`);
    }
    if (!fields.description) {
      fail(`${skillPath}: frontmatter is missing required field 'description'`);
    }
    if (fields.name && fields.name !== skill) {
      fail(`${skillPath}: frontmatter name '${fields.name}' does not match folder '${skill}'`);
    }
  }

  for (const skillDir of diskSkillDirs) {
    if (!manifestSkills.includes(skillDir)) {
      fail(`Skill folder exists but is not listed in manifest.json: ${skillDir}`);
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Skills validation passed.");
