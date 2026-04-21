export type AdvisorChatRole = "user" | "assistant";

export interface AdvisorChatHistoryItem {
  role: AdvisorChatRole;
  text: string;
}

export interface AdvisorChatRequest {
  message: string;
  history: AdvisorChatHistoryItem[];
  activePlanId?: number | null;
}

export type AdvisorConfidence = "high" | "medium" | "low";

export interface AdvisorRecommendation {
  courseCode: string;
  reason: string;
  confidence: AdvisorConfidence;
}

export interface AdvisorSideEffect {
  type: "plan_created";
  planId: number;
  planName: string;
}

export interface AdvisorChatResponse {
  answer: string;
  recommendations: AdvisorRecommendation[];
  risks: string[];
  missingData: string[];
  citations: string[];
  sideEffects?: AdvisorSideEffect[];
}

export interface AdvisorPromptContext {
  promptVersion: string;
  studentName: string | null;
  primaryProgram: string | null;
  catalogYear: string | null;
  expectedGraduation: string | null;
  hasCompletedOnboarding: boolean;
  activePlanName?: string | null;
}

export type AdvisorStreamEvent =
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  | { type: "done"; response: AdvisorChatResponse }
  | { type: "error"; message: string };

export interface AdvisorConversation {
  id: number;
  studentId: number;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdvisorPersistedMessage {
  id: number;
  conversationId: number;
  role: AdvisorChatRole;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdvisorPlanSummary {
  id: number;
  name: string;
  updatedAt: string;
}
