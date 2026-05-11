import type { AdvisorChatResponse, AdvisorRecommendation } from "@/types/ai-advisor";
import { dedupeStrings } from "./utils";

export function normalizeAdvisorResponse(payload: unknown): AdvisorChatResponse | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const answer = typeof obj.answer === "string" ? obj.answer.trim() : "";
  if (!answer) return null;

  const recommendations: AdvisorRecommendation[] = Array.isArray(obj.recommendations)
    ? obj.recommendations
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const candidate = item as Record<string, unknown>;
          const courseCode = typeof candidate.courseCode === "string" ? candidate.courseCode.trim() : "";
          const reason = typeof candidate.reason === "string" ? candidate.reason.trim() : "";
          const confidence =
            candidate.confidence === "high" ||
            candidate.confidence === "medium" ||
            candidate.confidence === "low"
              ? candidate.confidence
              : null;
          if (!courseCode || !reason || !confidence) return null;
          return { courseCode, reason, confidence } as AdvisorRecommendation;
        })
        .filter((value): value is AdvisorRecommendation => value !== null)
    : [];

  const risks = Array.isArray(obj.risks)
    ? obj.risks.map(String).filter(Boolean)
    : [];
  const missingData = Array.isArray(obj.missingData)
    ? obj.missingData.map(String).filter(Boolean)
    : [];
  const citations = Array.isArray(obj.citations)
    ? obj.citations.map(String).filter(Boolean)
    : [];

  return {
    answer,
    recommendations,
    risks: dedupeStrings(risks),
    missingData: dedupeStrings(missingData),
    citations: dedupeStrings(citations),
  };
}

export function makeFallbackResponse(answer: string): AdvisorChatResponse {
  return {
    answer,
    recommendations: [],
    risks: [],
    missingData: [],
    citations: [],
  };
}

export function classifyIntent(message: string): "next_semester" | "remaining" | "prereq" | "progress" | "unknown" {
  const lower = message.toLowerCase();
  if (
    lower.includes("next semester") ||
    lower.includes("what should i take") ||
    lower.includes("recommend") ||
    lower.includes("schedule")
  ) {
    return "next_semester";
  }
  if (lower.includes("remaining requirement") || lower.includes("remaining classes") || lower.includes("remaining courses")) {
    return "remaining";
  }
  if (lower.includes("prereq") || lower.includes("can i take")) {
    return "prereq";
  }
  if (
    lower.includes("on track") ||
    lower.includes("how many credits") ||
    lower.includes("graduate") ||
    lower.includes("progress")
  ) {
    return "progress";
  }
  return "unknown";
}
