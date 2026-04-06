import { describe, expect, it } from "vitest";
import { PROMPT_VERSION, buildSystemPrompt } from "@/lib/ai-advisor/prompt";

describe("AI advisor prompt", () => {
  it("exports a version string", () => {
    expect(typeof PROMPT_VERSION).toBe("string");
    expect(PROMPT_VERSION.length).toBeGreaterThan(0);
  });

  it("builds a conservative prompt with required rules", () => {
    const prompt = buildSystemPrompt({
      promptVersion: PROMPT_VERSION,
      studentName: "Alex Johnson",
      primaryProgram: "B.S. Computer Science",
      catalogYear: "2022-2023",
      expectedGraduation: "May 2026",
      hasCompletedOnboarding: true,
    });

    expect(prompt).toContain("Use tools for factual claims");
    expect(prompt).toContain("Never invent");
    expect(prompt).toContain("informational support only");
    expect(prompt).toContain("Alex Johnson");
    expect(prompt).toContain("B.S. Computer Science");
  });

  it("falls back to unknown when context fields are null", () => {
    const prompt = buildSystemPrompt({
      promptVersion: PROMPT_VERSION,
      studentName: null,
      primaryProgram: null,
      catalogYear: null,
      expectedGraduation: null,
      hasCompletedOnboarding: false,
    });

    expect(prompt).toContain("Student: unknown");
    expect(prompt).toContain("Primary program: unknown");
    expect(prompt).toContain("Catalog year: unknown");
    expect(prompt).toContain("Expected graduation: unknown");
    expect(prompt).toContain("Onboarding: not completed");
  });
});
