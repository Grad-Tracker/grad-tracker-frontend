import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2] ?? "coverage/coverage-final.json";
const resolvedPath = path.resolve(inputPath);

const coverage = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));

const rows = Object.entries(coverage)
  .map(([file, data]) => {
    const branchCounts = Object.values(data.b ?? {});
    const uncoveredBranches = branchCounts.reduce(
      (sum, counts) => sum + counts.filter((count) => count === 0).length,
      0
    );

    return {
      file: path.relative(process.cwd(), file),
      uncoveredBranches,
    };
  })
  .sort((a, b) => b.uncoveredBranches - a.uncoveredBranches)
  .slice(0, 10);

for (const row of rows) {
  console.log(`${row.uncoveredBranches}\t${row.file}`);
}
