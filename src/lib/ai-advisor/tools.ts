import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { evaluatePrereqsForCourses, type PrereqEvaluationMap } from "@/lib/prereq";
import { buildSystemPrompt, PROMPT_VERSION } from "@/lib/ai-advisor/prompt";
import {
  getDegreeProgress,
  getPlanSnapshot,
  getRemainingRequirements,
  resolveCourseIdsByCodes,
  type AdvisorDegreeProgress,
  type AdvisorPlanSnapshot,
  type AdvisorRemainingRequirements,
  type AdvisorStudentProfile,
  type SupabaseTableClient,
} from "@/lib/ai-advisor/data";
import type {
  AdvisorChatHistoryItem,
  AdvisorChatResponse,
  AdvisorConfidence,
  AdvisorRecommendation,
} from "@/types/ai-advisor";

export const TOOL_NAMES = {
  getStudentProfile: "get_student_profile",
  getPlanSnapshot: "get_plan_snapshot",
  getDegreeProgress: "get_degree_progress",
  getRemainingRequirements: "get_remaining_requirements",
  checkCoursePrereqs: "check_course_prereqs",
  recommendNextSemester: "recommend_next_semester",
} as const;

export type AdvisorToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

type CheckCoursePrereqsInput = {
  courseIds?: number[];
  courseCodes?: string[];
};

type GetPlanScopedInput = {
  planId?: number | null;
};

type GetRemainingRequirementsInput = {
  planId?: number | null;
  limit?: number;
};

type RecommendNextSemesterInput = {
  targetCredits?: number;
  planId?: number | null;
};

export interface AdvisorToolDependencies {
  getStudentProfile: () => Promise<AdvisorStudentProfile>;
  getPlanSnapshot: (planId?: number | null) => Promise<AdvisorPlanSnapshot | null>;
  getDegreeProgress: (planId?: number | null) => Promise<AdvisorDegreeProgress>;
  getRemainingRequirements: (
    planId?: number | null,
    limit?: number
  ) => Promise<AdvisorRemainingRequirements>;
  resolveCourseIdsByCodes: (
    courseCodes: string[]
  ) => Promise<{ resolvedIds: number[]; unresolvedCodes: string[]; resolvedCodes: string[] }>;
  evaluatePrereqs: (courseIds: number[]) => Promise<PrereqEvaluationMap>;
}

export interface AdvisorDependencyContext {
  supabase: SupabaseTableClient;
  studentId: number;
  profile: AdvisorStudentProfile;
}

export function createAdvisorToolDependencies(
  context: AdvisorDependencyContext
): AdvisorToolDependencies {
  return {
    getStudentProfile: async () => context.profile,
    getPlanSnapshot: async (planId?: number | null) =>
      getPlanSnapshot(context.supabase, context.studentId, planId),
    getDegreeProgress: async (planId?: number | null) =>
      getDegreeProgress(context.supabase, context.studentId, planId),
    getRemainingRequirements: async (planId?: number | null, limit?: number) =>
      getRemainingRequirements(context.supabase, context.studentId, planId, limit),
    resolveCourseIdsByCodes: async (courseCodes: string[]) =>
      resolveCourseIdsByCodes(context.supabase, courseCodes),
    evaluatePrereqs: async (courseIds: number[]) =>
      evaluatePrereqsForCourses(courseIds, context.studentId, context.supabase),
  };
}

function normalizeCourseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ").replace(/-/g, " ");
}

function extractCourseCodes(message: string): string[] {
  const matches = message.matchAll(/([A-Za-z]{2,6})\s*[- ]\s*([0-9]{2,4}[A-Za-z]?)/g);
  const codes = new Set<string>();
  for (const match of matches) {
    const subject = String(match[1] ?? "").toUpperCase();
    const number = String(match[2] ?? "").toUpperCase();
    if (!subject || !number) continue;
    codes.add(`${subject} ${number}`);
  }
  return Array.from(codes);
}

function scoreRequirementPriority(blockName: string): number {
  const name = blockName.toLowerCase();
  if (name.includes("core") || name.includes("required")) return 3;
  if (name.includes("elective")) return 2;
  return 1;
}

function recommendationConfidence(unlocked: boolean, priority: number): AdvisorConfidence {
  if (!unlocked) return "low";
  if (priority >= 3) return "high";
  return "medium";
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function tryParseJson(text: string): unknown {
  const raw = text.trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    // Continue with fallback parsing.
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // Continue with fallback parsing.
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

function normalizeAdvisorResponse(payload: unknown): AdvisorChatResponse | null {
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
    ? obj.risks.map((value) => String(value)).filter(Boolean)
    : [];
  const missingData = Array.isArray(obj.missingData)
    ? obj.missingData.map((value) => String(value)).filter(Boolean)
    : [];
  const citations = Array.isArray(obj.citations)
    ? obj.citations.map((value) => String(value)).filter(Boolean)
    : [];

  return {
    answer,
    recommendations,
    risks: dedupeStrings(risks),
    missingData: dedupeStrings(missingData),
    citations: dedupeStrings(citations),
  };
}

function makeFallbackResponse(answer: string): AdvisorChatResponse {
  return {
    answer,
    recommendations: [],
    risks: [],
    missingData: [],
    citations: [],
  };
}

function classifyIntent(message: string): "next_semester" | "remaining" | "prereq" | "progress" | "unknown" {
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

type ToolExecutionResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export interface AdvisorToolset {
  get_student_profile: () => Promise<{
    studentId: number;
    name: string;
    email: string | null;
    hasCompletedOnboarding: boolean;
    expectedGraduation: string | null;
    programs: Array<{ id: number; name: string; programType: string; catalogYear: string | null }>;
  }>;
  get_plan_snapshot: (input?: GetPlanScopedInput) => Promise<AdvisorPlanSnapshot | null>;
  get_degree_progress: (input?: GetPlanScopedInput) => Promise<AdvisorDegreeProgress>;
  get_remaining_requirements: (
    input?: GetRemainingRequirementsInput
  ) => Promise<AdvisorRemainingRequirements>;
  check_course_prereqs: (input: CheckCoursePrereqsInput) => Promise<{
    results: Array<{
      courseId: number;
      courseCode: string;
      unlocked: boolean;
      summary: string[];
    }>;
    unresolvedCourseCodes: string[];
  }>;
  recommend_next_semester: (input?: RecommendNextSemesterInput) => Promise<{
    targetCredits: number;
    totalRecommendedCredits: number;
    recommendations: Array<{
      courseId: number;
      courseCode: string;
      title: string;
      credits: number;
      reason: string;
      confidence: AdvisorConfidence;
      risk: string | null;
    }>;
    risks: string[];
  }>;
}

export function createAdvisorTools(deps: AdvisorToolDependencies): AdvisorToolset {
  return {
    async get_student_profile() {
      const profile = await deps.getStudentProfile();
      return {
        studentId: profile.studentId,
        name: profile.fullName,
        email: profile.email,
        hasCompletedOnboarding: profile.hasCompletedOnboarding,
        expectedGraduation: profile.expectedGraduation,
        programs: profile.programs.map((program) => ({
          id: program.id,
          name: program.name,
          programType: program.programType,
          catalogYear: program.catalogYear,
        })),
      };
    },

    async get_plan_snapshot(input?: GetPlanScopedInput) {
      return deps.getPlanSnapshot(input?.planId ?? null);
    },

    async get_degree_progress(input?: GetPlanScopedInput) {
      return deps.getDegreeProgress(input?.planId ?? null);
    },

    async get_remaining_requirements(input?: GetRemainingRequirementsInput) {
      return deps.getRemainingRequirements(input?.planId ?? null, input?.limit ?? 25);
    },

    async check_course_prereqs(input: CheckCoursePrereqsInput) {
      const normalizedIds = Array.from(
        new Set(
          (input.courseIds ?? [])
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id))
        )
      );

      const normalizedCodes = Array.from(
        new Set((input.courseCodes ?? []).map((code) => normalizeCourseCode(code)).filter(Boolean))
      );

      const lookup = normalizedCodes.length
        ? await deps.resolveCourseIdsByCodes(normalizedCodes)
        : { resolvedIds: [], unresolvedCodes: [], resolvedCodes: [] };

      const candidateIds = Array.from(new Set([...normalizedIds, ...lookup.resolvedIds]));
      const prereqMap = await deps.evaluatePrereqs(candidateIds);

      const idToCode = new Map<number, string>();
      lookup.resolvedIds.forEach((id, idx) => {
        const code = lookup.resolvedCodes[idx];
        if (code) idToCode.set(id, code);
      });

      const results = candidateIds
        .map((courseId) => {
          const courseCode = idToCode.get(courseId);
          if (!courseCode) {
            return null; // Skip courses without resolved codes
          }
          const prereq = prereqMap.get(courseId) ?? { unlocked: true, summary: [] };
          return {
            courseId,
            courseCode,
            unlocked: prereq.unlocked,
            summary: prereq.summary,
          };
        })
        .filter((result): result is NonNullable<typeof result> => result !== null);

      return {
        results,
        unresolvedCourseCodes: lookup.unresolvedCodes,
      };
    },

    async recommend_next_semester(input?: RecommendNextSemesterInput) {
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
    },
  };
}

type ClaudeToolDefinition = Anthropic.Messages.Tool;

const CLAUDE_TOOL_DEFINITIONS: ClaudeToolDefinition[] = [
  {
    name: TOOL_NAMES.getStudentProfile,
    description: "Get the student profile context, programs, and expected graduation information.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: TOOL_NAMES.getPlanSnapshot,
    description: "Get active plan terms, planned courses, and total planned credits.",
    input_schema: {
      type: "object" as const,
      properties: { planId: { type: "integer" as const, description: "Plan ID" } },
    },
  },
  {
    name: TOOL_NAMES.getDegreeProgress,
    description: "Get degree progress by requirement block and overall completion metrics.",
    input_schema: {
      type: "object" as const,
      properties: { planId: { type: "integer" as const, description: "Plan ID" } },
    },
  },
  {
    name: TOOL_NAMES.getRemainingRequirements,
    description: "Get remaining requirement courses grouped by block.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID" },
        limit: { type: "integer" as const, description: "Max courses to return" },
      },
    },
  },
  {
    name: TOOL_NAMES.checkCoursePrereqs,
    description: "Check whether a student can take specified courses and list unmet prerequisites.",
    input_schema: {
      type: "object" as const,
      properties: {
        courseIds: { type: "array" as const, items: { type: "integer" as const }, description: "Course IDs" },
        courseCodes: { type: "array" as const, items: { type: "string" as const }, description: "Course codes" },
      },
    },
  },
  {
    name: TOOL_NAMES.recommendNextSemester,
    description: "Recommend next-semester courses using requirement priority and prerequisite status.",
    input_schema: {
      type: "object" as const,
      properties: {
        targetCredits: { type: "number" as const, description: "Target credits" },
        planId: { type: "integer" as const, description: "Plan ID" },
      },
    },
  },
];

async function runClaudeToolCalling(args: {
  message: string;
  history: AdvisorChatHistoryItem[];
  profile: AdvisorStudentProfile;
  activePlanId?: number | null;
  executeTool: (name: AdvisorToolName, toolArgs: Record<string, unknown>) => Promise<ToolExecutionResult>;
}): Promise<AdvisorChatResponse | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

  const systemPrompt = buildSystemPrompt({
    promptVersion: PROMPT_VERSION,
    studentName: args.profile.fullName,
    primaryProgram: args.profile.primaryProgram?.name ?? null,
    catalogYear: args.profile.primaryProgram?.catalogYear ?? null,
    expectedGraduation: args.profile.expectedGraduation,
    hasCompletedOnboarding: args.profile.hasCompletedOnboarding,
  });

  const messages: Anthropic.Messages.MessageParam[] = [
    ...args.history.slice(-8).map((item) => ({
      role: item.role as "user" | "assistant",
      content: item.text,
    })),
    { role: "user" as const, content: args.message },
  ];

  const maxTurns = 4;
  for (let turn = 0; turn < maxTurns; turn += 1) {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: `${systemPrompt}\n\nReturn strict JSON with keys: answer, recommendations, risks, missingData, citations.`,
      tools: CLAUDE_TOOL_DEFINITIONS,
      messages,
    });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      const textBlock = response.content.find(
        (block): block is Anthropic.Messages.TextBlock => block.type === "text"
      );
      const content = textBlock?.text ?? "";
      const parsed = normalizeAdvisorResponse(tryParseJson(content));
      if (parsed) return parsed;
      return makeFallbackResponse(
        content || "I could not safely parse a structured response. Please ask your question again."
      );
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const toolInput = (toolUse.input as Record<string, unknown>) ?? {};

      // Inject activePlanId for tools that support planId parameter
      const toolName = toolUse.name as AdvisorToolName;
      if (
        args.activePlanId !== undefined &&
        (toolName === TOOL_NAMES.getPlanSnapshot ||
          toolName === TOOL_NAMES.getDegreeProgress ||
          toolName === TOOL_NAMES.getRemainingRequirements ||
          toolName === TOOL_NAMES.recommendNextSemester) &&
        !toolInput.planId
      ) {
        toolInput.planId = args.activePlanId;
      }

      const toolResult = await args.executeTool(toolName, toolInput);
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(toolResult),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return makeFallbackResponse("I could not complete tool execution safely in time. Please try again.");
}

async function runDeterministicAdvisor(args: {
  message: string;
  activePlanId?: number | null;
  executeTool: (name: AdvisorToolName, toolArgs: Record<string, unknown>) => Promise<ToolExecutionResult>;
}): Promise<AdvisorChatResponse> {
  const intent = classifyIntent(args.message);

  if (intent === "prereq") {
    const detectedCodes = extractCourseCodes(args.message);
    if (detectedCodes.length === 0) {
      return makeFallbackResponse(
        "I can check prerequisite status, but I need a specific course code (for example, CSCI 340)."
      );
    }

    const prereqResult = await args.executeTool(TOOL_NAMES.checkCoursePrereqs, {
      courseCodes: detectedCodes,
    });
    if (!prereqResult.ok) {
      return makeFallbackResponse(
        "I could not run prerequisite checks right now. Please try again."
      );
    }

    const data = prereqResult.data as {
      results: Array<{ courseCode: string; unlocked: boolean; summary: string[] }>;
      unresolvedCourseCodes: string[];
    };

    const lines = data.results.map((row) =>
      row.unlocked
        ? `${row.courseCode}: prerequisites look satisfied.`
        : `${row.courseCode}: not unlocked (${row.summary.join("; ") || "missing prerequisite data"}).`
    );

    const unresolvedText =
      data.unresolvedCourseCodes.length > 0
        ? ` I could not match: ${data.unresolvedCourseCodes.join(", ")}.`
        : "";

    const risks = data.results
      .filter((row) => !row.unlocked)
      .map((row) => `${row.courseCode}: ${row.summary.join("; ") || "Prerequisites not met."}`);

    return {
      answer: `${lines.join(" ")}${unresolvedText}`,
      recommendations: [],
      risks,
      missingData: [],
      citations: [`tool:${TOOL_NAMES.checkCoursePrereqs}`],
    };
  }

  if (intent === "remaining") {
    const remainingResult = await args.executeTool(TOOL_NAMES.getRemainingRequirements, {
      planId: args.activePlanId ?? null,
      limit: 20,
    });
    if (!remainingResult.ok) {
      return makeFallbackResponse(
        "I could not load remaining requirements right now. Please try again."
      );
    }

    const data = remainingResult.data as AdvisorRemainingRequirements;
    const blockSummaries = data.blocks
      .slice(0, 3)
      .map(
        (block) =>
          `${block.blockName}: ${block.remainingCourses
            .slice(0, 3)
            .map((course) => course.courseCode)
            .join(", ")}`
      );

    const answer =
      blockSummaries.length > 0
        ? `You have ${data.totalRemainingCourses} remaining requirement courses. ${blockSummaries.join(" | ")}`
        : "I did not find remaining courses in your current requirement scope.";

    return {
      answer,
      recommendations: [],
      risks: [],
      missingData: [],
      citations: [`tool:${TOOL_NAMES.getRemainingRequirements}`],
    };
  }

  if (intent === "next_semester") {
    const recommendedResult = await args.executeTool(TOOL_NAMES.recommendNextSemester, {
      targetCredits: 15,
      planId: args.activePlanId ?? null,
    });
    if (!recommendedResult.ok) {
      return makeFallbackResponse(
        "I could not generate next-semester recommendations right now. Please try again."
      );
    }

    const data = recommendedResult.data as {
      targetCredits: number;
      totalRecommendedCredits: number;
      recommendations: Array<{
        courseCode: string;
        reason: string;
        confidence: AdvisorConfidence;
      }>;
      risks: string[];
    };

    const recommendations = data.recommendations.map((item) => ({
      courseCode: item.courseCode,
      reason: item.reason,
      confidence: item.confidence,
    }));

    const answer =
      recommendations.length > 0
        ? `I recommend ${recommendations.length} courses totaling ${data.totalRecommendedCredits} credits (target: ${data.targetCredits}).`
        : "I could not find confident recommendations from current data.";

    return {
      answer,
      recommendations,
      risks: data.risks,
      missingData: [],
      citations: [`tool:${TOOL_NAMES.recommendNextSemester}`],
    };
  }

  if (intent === "progress") {
    const progressResult = await args.executeTool(TOOL_NAMES.getDegreeProgress, {
      planId: args.activePlanId ?? null,
    });
    if (!progressResult.ok) {
      return makeFallbackResponse("I could not load your progress summary right now.");
    }

    const data = progressResult.data as AdvisorDegreeProgress;
    const answer = `You are ${data.overall.percentage}% complete (${data.overall.completedCredits} completed + ${data.overall.inProgressCredits} in progress out of ${data.overall.totalCreditsRequired} required credits).`;

    return {
      answer,
      recommendations: [],
      risks: [],
      missingData: [],
      citations: [`tool:${TOOL_NAMES.getDegreeProgress}`],
    };
  }

  return {
    answer:
      "I’m not certain what you want yet. I can help with next-semester planning, remaining requirements, prerequisite checks, or graduation progress. What should I check first?",
    recommendations: [],
    risks: [],
    missingData: [],
    citations: [],
  };
}

async function executeToolByName(
  toolset: AdvisorToolset,
  toolName: AdvisorToolName,
  toolArgs: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case TOOL_NAMES.getStudentProfile:
      return toolset.get_student_profile();
    case TOOL_NAMES.getPlanSnapshot:
      return toolset.get_plan_snapshot(toolArgs as GetPlanScopedInput);
    case TOOL_NAMES.getDegreeProgress:
      return toolset.get_degree_progress(toolArgs as GetPlanScopedInput);
    case TOOL_NAMES.getRemainingRequirements:
      return toolset.get_remaining_requirements(toolArgs as GetRemainingRequirementsInput);
    case TOOL_NAMES.checkCoursePrereqs:
      return toolset.check_course_prereqs(toolArgs as CheckCoursePrereqsInput);
    case TOOL_NAMES.recommendNextSemester:
      return toolset.recommend_next_semester(toolArgs as RecommendNextSemesterInput);
    default:
      throw new Error(`Unknown tool requested: ${toolName}`);
  }
}

export interface GenerateAdvisorResponseInput {
  message: string;
  history: AdvisorChatHistoryItem[];
  activePlanId?: number | null;
  profile: AdvisorStudentProfile;
  dependencies: AdvisorToolDependencies;
}

export async function generateAdvisorResponse(
  input: GenerateAdvisorResponseInput
): Promise<AdvisorChatResponse> {
  const toolset = createAdvisorTools(input.dependencies);
  const usedCitations = new Set<string>();
  const missingData = new Set<string>();

  const executeTool = async (
    toolName: AdvisorToolName,
    toolArgs: Record<string, unknown>
  ): Promise<ToolExecutionResult> => {
    try {
      const data = await executeToolByName(toolset, toolName, toolArgs);
      usedCitations.add(`tool:${toolName}`);
      return { ok: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed";
      missingData.add(`${toolName}: ${message}`);
      return { ok: false, error: message };
    }
  };

  let response: AdvisorChatResponse | null = null;
  try {
    response = await runClaudeToolCalling({
      message: input.message,
      history: input.history,
      profile: input.profile,
      activePlanId: input.activePlanId ?? null,
      executeTool,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claude API call failed";
    missingData.add(`claude: ${message}`);
  }

  if (!response) {
    response = await runDeterministicAdvisor({
      message: input.message,
      activePlanId: input.activePlanId ?? null,
      executeTool,
    });
  }

  return {
    ...response,
    risks: dedupeStrings(response.risks),
    missingData: dedupeStrings([...response.missingData, ...Array.from(missingData)]),
    citations: dedupeStrings([...response.citations, ...Array.from(usedCitations)]),
    recommendations: response.recommendations.slice(0, 8),
  };
}

export {
  CLAUDE_TOOL_DEFINITIONS,
  executeToolByName,
  normalizeAdvisorResponse,
  tryParseJson,
  makeFallbackResponse,
  TOOL_NAMES as ADVISOR_TOOL_NAMES,
};