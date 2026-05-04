import type { AdvisorConfidence } from "@/types/ai-advisor";
import type { AdvisorToolDependencies } from "../shared/dependencies";
import {
  scoreRequirementPriority,
  recommendationConfidence,
  dedupeStrings,
} from "../shared/utils";

export type RecommendNextSemesterInput = {
  targetCredits?: number;
  planId?: number | null;
};

export const RECOMMEND_NEXT_SEMESTER_DEFINITION = {
  name: "recommend_next_semester",
  description: "Recommend next-semester courses using requirement priority and prerequisite status.",
  input_schema: {
    type: "object" as const,
    properties: {
      targetCredits: { type: "number" as const, description: "Target credits" },
      planId: { type: "integer" as const, description: "Plan ID" },
    },
  },
} as const;

export function createRecommendNextSemesterTool(deps: AdvisorToolDependencies) {
  return async function (input?: RecommendNextSemesterInput) {
    const rawCredits = Number(input?.targetCredits ?? 15);
    const targetCredits = Number.isFinite(rawCredits) && !isNaN(rawCredits)
      ? Math.max(3, Math.min(rawCredits, 21))
      : 15;
    const remaining = await deps.getRemainingRequirements(input?.planId ?? null, 200);

    const candidates = remaining.blocks.flatMap((block) =>
      block.remainingCourses.map((course) => ({
        ...course,
        blockName: block.blockName,
      }))
    );

    const uniqueCandidates = Array.from(
      new Map(candidates.map((candidate) => [candidate.id, candidate])).values()
    );

    const prereqMap = await deps.evaluatePrereqs(uniqueCandidates.map((candidate) => candidate.id));
    const scored = uniqueCandidates.map((candidate) => {
      const prereq = prereqMap.get(candidate.id) ?? { unlocked: true, summary: [] };
      const priority = scoreRequirementPriority(candidate.blockName);
      const score = (prereq.unlocked ? 100 : 0) + priority * 10 + candidate.credits;
      return { candidate, prereq, priority, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const selected: Array<{
      courseId: number;
      courseCode: string;
      title: string;
      credits: number;
      reason: string;
      confidence: AdvisorConfidence;
      risk: string | null;
    }> = [];

    let creditTotal = 0;
    const risks: string[] = [];

    for (const item of scored) {
      if (creditTotal >= targetCredits) break;
      const unlocked = item.prereq.unlocked;
      if (!unlocked && selected.length >= 3) continue;

      selected.push({
        courseId: item.candidate.id,
        courseCode: item.candidate.courseCode,
        title: item.candidate.title,
        credits: item.candidate.credits,
        reason: unlocked
          ? `Supports ${item.candidate.blockName} progress and fits your current prerequisite status.`
          : `Relevant to ${item.candidate.blockName}, but prerequisites are not fully met yet.`,
        confidence: recommendationConfidence(unlocked, item.priority),
        risk: unlocked ? null : item.prereq.summary.join("; ") || "Prerequisites may not be met.",
      });
      creditTotal += item.candidate.credits;
    }

    for (const rec of selected) {
      if (rec.risk) risks.push(`${rec.courseCode}: ${rec.risk}`);
    }

    return {
      targetCredits,
      totalRecommendedCredits: creditTotal,
      recommendations: selected,
      risks: dedupeStrings(risks),
    };
  };
}
