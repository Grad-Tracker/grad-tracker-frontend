import type { AdvisorConfidence } from "@/types/ai-advisor";

export function normalizeCourseCode(raw: string): string {
  return raw.trim().toUpperCase().replaceAll(/\s+/g, " ").replaceAll("-", " ");
}

export function extractCourseCodes(message: string): string[] {
  const matches = message.matchAll(/([A-Za-z]{2,6})[\s-]+([0-9]{2,4}[A-Za-z]?)/g);
  const codes = new Set<string>();
  for (const match of matches) {
    const subject = String(match[1] ?? "").toUpperCase();
    const number = String(match[2] ?? "").toUpperCase();
    if (!subject || !number) continue;
    codes.add(`${subject} ${number}`);
  }
  return Array.from(codes);
}

export function scoreRequirementPriority(blockName: string): number {
  const name = blockName.toLowerCase();
  if (name.includes("core") || name.includes("required")) return 3;
  if (name.includes("elective")) return 2;
  return 1;
}

export function recommendationConfidence(unlocked: boolean, priority: number): AdvisorConfidence {
  if (!unlocked) return "low";
  if (priority >= 3) return "high";
  return "medium";
}

export function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

export function tryParseJson(text: string): unknown {
  const raw = text.trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    // Continue with fallback parsing.
  }

  const fenceOpen = raw.indexOf("```");
  if (fenceOpen >= 0) {
    let contentStart = raw.indexOf("\n", fenceOpen);
    if (contentStart < 0) contentStart = fenceOpen + 3;
    else contentStart += 1;
    const fenceClose = raw.indexOf("```", contentStart);
    if (fenceClose >= 0) {
      try {
        return JSON.parse(raw.slice(contentStart, fenceClose).trim());
      } catch {
        // Continue with fallback parsing.
      }
    }
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const maybe = raw.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(maybe);
    } catch {
      return null;
    }
  }

  return null;
}
