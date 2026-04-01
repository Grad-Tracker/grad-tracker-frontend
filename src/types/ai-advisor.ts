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

export interface AdvisorChatResponse {
  answer: string;
  recommendations: AdvisorRecommendation[];
  risks: string[];
  missingData: string[];
  citations: string[];
}

export interface AdvisorPromptContext {
  promptVersion: string;
  studentName: string | null;
  primaryProgram: string | null;
  catalogYear: string | null;
  expectedGraduation: string | null;
  hasCompletedOnboarding: boolean;
}

export type AdvisorStreamEvent =
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  | { type: "done"; response: AdvisorChatResponse }
  | { type: "error"; message: string };
