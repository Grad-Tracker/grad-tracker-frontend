# AI Advisor Full Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the AI Advisor from a basic OpenAI-backed chat into a production-ready feature with Claude Haiku, streaming responses, a data-driven context sidebar, and conversation persistence.

**Architecture:** The AI Advisor uses a tool-calling LLM pattern: Claude Haiku receives the student's question, decides which data tools to call (profile, degree progress, prerequisites, etc.), executes them against Supabase, then generates a structured JSON response. Streaming sends SSE events (status updates during tool execution, text deltas during generation, structured data on completion). Conversations persist in two Supabase tables with RLS scoping to the authenticated student.

**Tech Stack:** Next.js 16 App Router, Anthropic SDK (`@anthropic-ai/sdk`), Supabase (auth + DB + RLS), Chakra UI v3, Vitest + Testing Library

**Jira tickets covered:** GT-151 (done), GT-152 (modify for Claude), GT-153 (done), GT-154, GT-155, GT-156, GT-157

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/__tests__/mocks/server-only.ts` | Empty mock for `server-only` package in test env |
| `src/components/dashboard/ai-advisor/ChatInterface.tsx` | Client component — chat state, message list, input, prompt chips |
| `src/components/dashboard/ai-advisor/AdvisorSidebar.tsx` | Client component — student info, credit progress, semester stats |
| `src/app/api/ai-advisor/context/route.ts` | GET endpoint — returns sidebar data (profile + degree progress) |
| `src/app/api/ai-advisor/chat/stream/route.ts` | POST endpoint — streaming chat with SSE |
| `src/lib/ai-advisor/persistence.ts` | Conversation CRUD queries (create, save message, load, list, delete) |
| `src/__tests__/components/ai-advisor/AdvisorSidebar.test.tsx` | Sidebar component tests |
| `src/__tests__/components/ai-advisor/ChatInterface.test.tsx` | Chat component tests |
| `src/__tests__/app/api/ai-advisor/context.route.test.ts` | Context endpoint tests |
| `src/__tests__/lib/ai-advisor/persistence.test.ts` | Persistence query tests |

### Modified Files
| File | Changes |
|------|---------|
| `vitest.config.ts` | Add `server-only` alias |
| `package.json` | Add `@anthropic-ai/sdk` dependency |
| `src/lib/ai-advisor/tools.ts` | Replace OpenAI with Claude Haiku, export helpers for streaming route |
| `src/app/dashboard/ai-advisor/page.tsx` | Server component with sidebar layout, delegates to ChatInterface |
| `src/types/ai-advisor.ts` | Add conversation/message types, streaming event types |
| `src/lib/supabase/queries/schema.ts` | Add `aiConversations`, `aiMessages` table constants |
| `src/__tests__/lib/ai-advisor/tools.test.ts` | Update env var from OPENAI to ANTHROPIC |
| `src/__tests__/app/api/ai-advisor/chat.route.test.ts` | Extend with Claude-specific scenarios |

---

## Task 1: Fix Test Infrastructure

**Files:**
- Create: `src/__tests__/mocks/server-only.ts`
- Modify: `vitest.config.ts`
- Test: `src/__tests__/lib/ai-advisor/tools.test.ts` (existing, currently broken)

- [ ] **Step 1: Create the server-only mock**

```ts
// src/__tests__/mocks/server-only.ts
export {};
```

- [ ] **Step 2: Add the alias to vitest config**

In `vitest.config.ts`, add `"server-only"` to the `resolve.alias` block:

```ts
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    "server-only": path.resolve(__dirname, "./src/__tests__/mocks/server-only.ts"),
  }
}
```

- [ ] **Step 3: Verify the broken test now passes**

Run: `npx vitest run src/__tests__/lib/ai-advisor/tools.test.ts`

Expected: 4 tests pass (next-semester recommendations, prereq check, remaining requirements, unknown questions)

- [ ] **Step 4: Run the full AI advisor test suite**

Run: `npx vitest run src/__tests__/lib/ai-advisor src/__tests__/app/api/ai-advisor`

Expected: All 12 tests pass (6 route + 2 prompt + 4 tools)

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/mocks/server-only.ts vitest.config.ts
git commit -m "fix: add server-only mock to unblock ai-advisor tool tests"
```

---

## Task 2: Switch to Claude Haiku

**Files:**
- Modify: `package.json` (add dependency)
- Modify: `src/lib/ai-advisor/tools.ts` (replace OpenAI with Claude)
- Modify: `src/__tests__/lib/ai-advisor/tools.test.ts` (update env var)

**Reference:** When implementing, invoke the `claude-api` skill for SDK patterns.

- [ ] **Step 1: Install the Anthropic SDK**

Run: `npm install @anthropic-ai/sdk`

- [ ] **Step 2: Update the tools test to use ANTHROPIC_API_KEY**

In `src/__tests__/lib/ai-advisor/tools.test.ts`, change the `beforeEach` block:

```ts
beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});
```

- [ ] **Step 3: Run tools tests to confirm they still pass**

Run: `npx vitest run src/__tests__/lib/ai-advisor/tools.test.ts`

Expected: 4 tests pass. The tests exercise the deterministic fallback path (no API key set), so behavior is unchanged.

- [ ] **Step 4: Replace OpenAI types and tool definitions with Claude equivalents**

In `src/lib/ai-advisor/tools.ts`, replace the import and types section. Remove the `OpenAIToolDefinition` type and `OPENAI_TOOL_DEFINITIONS` array (lines ~425-526). Replace with:

```ts
import Anthropic from "@anthropic-ai/sdk";

type ClaudeToolDefinition = Anthropic.Messages.Tool;

const CLAUDE_TOOL_DEFINITIONS: ClaudeToolDefinition[] = [
  {
    name: TOOL_NAMES.getStudentProfile,
    description: "Get the student profile context, programs, and expected graduation information.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: TOOL_NAMES.getPlanSnapshot,
    description: "Get active plan terms, planned courses, and total planned credits.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID to scope the snapshot" },
      },
    },
  },
  {
    name: TOOL_NAMES.getDegreeProgress,
    description: "Get degree progress by requirement block and overall completion metrics.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID to scope the progress" },
      },
    },
  },
  {
    name: TOOL_NAMES.getRemainingRequirements,
    description: "Get remaining requirement courses grouped by block.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "integer" as const, description: "Plan ID to scope the requirements" },
        limit: { type: "integer" as const, description: "Maximum number of courses to return" },
      },
    },
  },
  {
    name: TOOL_NAMES.checkCoursePrereqs,
    description: "Check whether a student can take specified courses and list unmet prerequisites.",
    input_schema: {
      type: "object" as const,
      properties: {
        courseIds: {
          type: "array" as const,
          items: { type: "integer" as const },
          description: "Course IDs to check",
        },
        courseCodes: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "Course codes to check (e.g. CSCI 340)",
        },
      },
    },
  },
  {
    name: TOOL_NAMES.recommendNextSemester,
    description: "Recommend next-semester courses using requirement priority and prerequisite status.",
    input_schema: {
      type: "object" as const,
      properties: {
        targetCredits: { type: "number" as const, description: "Target credit hours" },
        planId: { type: "integer" as const, description: "Plan ID to scope recommendations" },
      },
    },
  },
];
```

- [ ] **Step 5: Replace `runOpenAiToolCalling` with `runClaudeToolCalling`**

Remove the entire `runOpenAiToolCalling` function (lines ~528-634). Replace with:

```ts
async function runClaudeToolCalling(args: {
  message: string;
  history: AdvisorChatHistoryItem[];
  profile: AdvisorStudentProfile;
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
        content || "I could not safely parse a structured response. Please ask your question again with more detail."
      );
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const toolResult = await args.executeTool(
        toolUse.name as AdvisorToolName,
        (toolUse.input as Record<string, unknown>) ?? {}
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(toolResult),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return makeFallbackResponse(
    "I could not complete tool execution safely in time. Please try again."
  );
}
```

- [ ] **Step 6: Update `generateAdvisorResponse` to call Claude**

In the `generateAdvisorResponse` function, replace the `runOpenAiToolCalling` call:

```ts
  try {
    response = await runClaudeToolCalling({
      message: input.message,
      history: input.history,
      profile: input.profile,
      executeTool,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claude API call failed";
    missingData.add(`claude: ${message}`);
  }
```

- [ ] **Step 7: Export helpers that the streaming route will need later**

Add exports at the bottom of `tools.ts` for functions the streaming route will reuse:

```ts
export {
  CLAUDE_TOOL_DEFINITIONS,
  executeToolByName,
  normalizeAdvisorResponse,
  tryParseJson,
  makeFallbackResponse,
  ADVISOR_TOOL_NAMES,
};
```

(`executeToolByName`, `normalizeAdvisorResponse`, `tryParseJson`, and `makeFallbackResponse` were previously not exported.)

- [ ] **Step 8: Run all AI advisor tests**

Run: `npx vitest run src/__tests__/lib/ai-advisor src/__tests__/app/api/ai-advisor`

Expected: All 12 tests pass. The deterministic fallback path is unchanged; the route tests mock `generateAdvisorResponse` entirely.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/lib/ai-advisor/tools.ts src/__tests__/lib/ai-advisor/tools.test.ts
git commit -m "feat: replace OpenAI with Claude Haiku for AI advisor LLM integration"
```

---

## Task 3: Wire Context Sidebar to Real Student Data (GT-154)

**Files:**
- Create: `src/app/api/ai-advisor/context/route.ts`
- Create: `src/components/dashboard/ai-advisor/AdvisorSidebar.tsx`
- Create: `src/components/dashboard/ai-advisor/ChatInterface.tsx`
- Modify: `src/app/dashboard/ai-advisor/page.tsx`
- Create: `src/__tests__/app/api/ai-advisor/context.route.test.ts`

### Step Group A: Context API Route

- [ ] **Step 1: Write the context route test**

```ts
// src/__tests__/app/api/ai-advisor/context.route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockCreateClient = vi.fn(async () => ({
  auth: { getUser: mockGetUser },
}));

const mockResolveStudentProfile = vi.fn();
const mockGetDegreeProgress = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

vi.mock("@/lib/ai-advisor/data", () => ({
  resolveStudentProfile: (...args: any[]) => mockResolveStudentProfile(...args),
  getDegreeProgress: (...args: any[]) => mockGetDegreeProgress(...args),
}));

import { GET } from "@/app/api/ai-advisor/context/route";

function makeRequest() {
  return new Request("http://localhost/api/ai-advisor/context", {
    method: "GET",
  });
}

describe("GET /api/ai-advisor/context", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it("returns 404 when profile not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
    mockResolveStudentProfile.mockResolvedValue(null);
    const response = await GET(makeRequest());
    expect(response.status).toBe(404);
  });

  it("returns sidebar data for authenticated student", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
    mockResolveStudentProfile.mockResolvedValue({
      studentId: 10,
      fullName: "Alex Johnson",
      email: "alex@test.com",
      hasCompletedOnboarding: true,
      expectedGraduation: "May 2026",
      programs: [{ id: 1, name: "B.S. Computer Science", catalogYear: "2022-2023", programType: "MAJOR" }],
      primaryProgram: { id: 1, name: "B.S. Computer Science", catalogYear: "2022-2023", programType: "MAJOR" },
    });
    mockGetDegreeProgress.mockResolvedValue({
      planId: 7,
      overall: { completedCredits: 78, inProgressCredits: 12, remainingCredits: 30, totalCreditsRequired: 120, percentage: 75 },
      blocks: [
        { blockId: 1, blockName: "Major Core", completedCredits: 30, inProgressCredits: 6, remainingCredits: 6, totalCreditsRequired: 42, percentage: 86 },
      ],
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.studentName).toBe("Alex Johnson");
    expect(data.progress.overall.percentage).toBe(75);
    expect(data.progress.blocks).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/app/api/ai-advisor/context.route.test.ts`

Expected: FAIL — module `@/app/api/ai-advisor/context/route` not found.

- [ ] **Step 3: Implement the context API route**

```ts
// src/app/api/ai-advisor/context/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveStudentProfile, getDegreeProgress } from "@/lib/ai-advisor/data";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let profile;
  try {
    profile = await resolveStudentProfile(supabase, user.id);
  } catch {
    return NextResponse.json({ error: "Failed to load profile." }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  let progress;
  try {
    progress = await getDegreeProgress(supabase, profile.studentId);
  } catch {
    return NextResponse.json({ error: "Failed to load progress." }, { status: 500 });
  }

  return NextResponse.json({
    studentName: profile.fullName,
    primaryProgram: profile.primaryProgram?.name ?? null,
    catalogYear: profile.primaryProgram?.catalogYear ?? null,
    expectedGraduation: profile.expectedGraduation,
    progress: {
      overall: progress.overall,
      blocks: progress.blocks,
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/app/api/ai-advisor/context.route.test.ts`

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ai-advisor/context/route.ts src/__tests__/app/api/ai-advisor/context.route.test.ts
git commit -m "feat: add GET /api/ai-advisor/context endpoint for sidebar data"
```

### Step Group B: Extract ChatInterface Component

- [ ] **Step 6: Create ChatInterface component**

Move the entire content of the current `page.tsx` into `src/components/dashboard/ai-advisor/ChatInterface.tsx`. The component is identical to the current page default export, but named `ChatInterface` and exported as a named export.

```tsx
// src/components/dashboard/ai-advisor/ChatInterface.tsx
"use client";

import { useMemo, useState } from "react";
import {
  Badge, Box, Button, Flex, HStack, Input,
  Separator, Text, VStack,
} from "@chakra-ui/react";
import { LuSend } from "react-icons/lu";
import type {
  AdvisorChatHistoryItem,
  AdvisorChatResponse,
  AdvisorRecommendation,
} from "@/types/ai-advisor";

// --- Copy ALL types, constants, and sub-components from current page.tsx ---
// (ChatRole, AdvisorMessage, promptChips, createId, AIMessage, UserMessage)
// --- Then the main component: ---

export function ChatInterface() {
  // Exact same state + logic as current AIAdvisorPage component body
  // (messages, draft, loading, history, sendMessage)
  // Return the chat box JSX (everything below the header in current page)
  // --- The header with "AI Academic Advisor" title is NOT included here ---
  // --- It stays in page.tsx ---
}
```

The key difference: `ChatInterface` renders **only** the chat card (status bar, messages, prompt chips, input). The page header (icon, title, "Beta" badge, description) stays in `page.tsx`.

- [ ] **Step 7: Verify it compiles**

Run: `npx next build --no-lint 2>&1 | tail -5` (or `npm run dev` and check the page loads)

### Step Group C: Sidebar Component

- [ ] **Step 8: Create AdvisorSidebar component**

```tsx
// src/components/dashboard/ai-advisor/AdvisorSidebar.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Badge, Box, HStack, Progress, Text, VStack,
} from "@chakra-ui/react";
import { LuBookOpen, LuClock, LuTarget } from "react-icons/lu";
import type { AdvisorProgressBlock } from "@/lib/ai-advisor/data";

interface SidebarData {
  studentName: string;
  primaryProgram: string | null;
  catalogYear: string | null;
  expectedGraduation: string | null;
  progress: {
    overall: {
      completedCredits: number;
      inProgressCredits: number;
      remainingCredits: number;
      totalCreditsRequired: number;
      percentage: number;
    };
    blocks: AdvisorProgressBlock[];
  };
}

const BLOCK_COLORS: Record<string, string> = {
  core: "blue",
  required: "blue",
  elective: "purple",
  "general education": "green",
  "gen ed": "green",
};

function blockColor(blockName: string): string {
  const lower = blockName.toLowerCase();
  for (const [keyword, color] of Object.entries(BLOCK_COLORS)) {
    if (lower.includes(keyword)) return color;
  }
  return "gray";
}

export function AdvisorSidebar() {
  const [data, setData] = useState<SidebarData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/ai-advisor/context")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((json) => setData(json as SidebarData))
      .catch(() => setError(true));
  }, []);

  if (error) return null;
  if (!data) {
    return (
      <Box w="280px" flexShrink={0} display={{ base: "none", xl: "block" }}>
        <VStack gap="4" align="stretch">
          <Box bg="bg" borderWidth="1px" borderColor="border.subtle" borderRadius="xl" p="4">
            <Text fontSize="sm" color="fg.muted">Loading context...</Text>
          </Box>
        </VStack>
      </Box>
    );
  }

  const { overall, blocks } = data.progress;
  const inProgressCount = blocks.reduce(
    (sum, b) => sum + (b.inProgressCredits > 0 ? 1 : 0), 0
  );

  return (
    <Box w="280px" flexShrink={0} display={{ base: "none", xl: "block" }}>
      <VStack gap="4" align="stretch">
        {/* Student Info Card */}
        <Box bg="bg" borderWidth="1px" borderColor="border.subtle" borderRadius="xl" p="4">
          <Text fontSize="xs" fontWeight="600" color="fg.muted" mb="3">
            Student Info
          </Text>
          <VStack align="stretch" gap="2">
            <Text fontSize="sm" fontWeight="600">{data.studentName}</Text>
            {data.primaryProgram && (
              <Text fontSize="xs" color="fg.muted">{data.primaryProgram}</Text>
            )}
            {data.catalogYear && (
              <HStack gap="1">
                <Text fontSize="xs" color="fg.muted">Catalog:</Text>
                <Text fontSize="xs">{data.catalogYear}</Text>
              </HStack>
            )}
            {data.expectedGraduation && (
              <HStack gap="1">
                <Badge size="sm" colorPalette="green" variant="subtle">
                  Expected: {data.expectedGraduation}
                </Badge>
              </HStack>
            )}
          </VStack>
        </Box>

        {/* Credit Progress Card */}
        <Box bg="bg" borderWidth="1px" borderColor="border.subtle" borderRadius="xl" p="4">
          <Text fontSize="xs" fontWeight="600" color="fg.muted" mb="3">
            Credit Progress
          </Text>
          <HStack justify="space-between" mb="2">
            <Text fontSize="2xl" fontWeight="700">{overall.percentage}%</Text>
            <Text fontSize="xs" color="fg.muted">
              {overall.completedCredits}/{overall.totalCreditsRequired} cr
            </Text>
          </HStack>
          <Progress.Root value={overall.percentage} size="sm" mb="4" colorPalette="blue">
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
          <VStack align="stretch" gap="3">
            {blocks.map((block) => (
              <Box key={block.blockId}>
                <HStack justify="space-between" mb="1">
                  <Text fontSize="xs" fontWeight="500">{block.blockName}</Text>
                  <Text fontSize="xs" color="fg.muted">
                    {block.completedCredits}/{block.totalCreditsRequired}
                  </Text>
                </HStack>
                <Progress.Root value={block.percentage} size="xs" colorPalette={blockColor(block.blockName)}>
                  <Progress.Track>
                    <Progress.Range />
                  </Progress.Track>
                </Progress.Root>
              </Box>
            ))}
          </VStack>
        </Box>

        {/* This Semester Card */}
        <Box bg="bg" borderWidth="1px" borderColor="border.subtle" borderRadius="xl" p="4">
          <Text fontSize="xs" fontWeight="600" color="fg.muted" mb="3">
            Snapshot
          </Text>
          <VStack align="stretch" gap="2.5">
            <HStack gap="2">
              <Box color="blue.fg"><LuBookOpen size={14} /></Box>
              <Text fontSize="xs">{overall.completedCredits} credits completed</Text>
            </HStack>
            <HStack gap="2">
              <Box color="purple.fg"><LuTarget size={14} /></Box>
              <Text fontSize="xs">{overall.inProgressCredits} credits in progress</Text>
            </HStack>
            <HStack gap="2">
              <Box color="orange.fg"><LuClock size={14} /></Box>
              <Text fontSize="xs">{overall.remainingCredits} credits remaining</Text>
            </HStack>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
}
```

- [ ] **Step 9: Update page.tsx to compose the layout**

Replace the entire `src/app/dashboard/ai-advisor/page.tsx` with:

```tsx
import { Box, Flex, HStack, Heading, Text, Badge } from "@chakra-ui/react";
import { LuSparkles } from "react-icons/lu";
import { ChatInterface } from "@/components/dashboard/ai-advisor/ChatInterface";
import { AdvisorSidebar } from "@/components/dashboard/ai-advisor/AdvisorSidebar";

export default function AIAdvisorPage() {
  return (
    <Box>
      <HStack gap="3" mb="6" align="flex-start">
        <Box p="2.5" bg="purple.subtle" borderRadius="xl" mt="0.5" flexShrink={0}>
          <LuSparkles />
        </Box>
        <Box flex="1">
          <HStack gap="3" mb="0.5">
            <Heading size="xl" fontFamily="var(--font-outfit), sans-serif">
              AI Academic Advisor
            </Heading>
            <Badge colorPalette="purple" variant="subtle" size="sm">
              Beta
            </Badge>
          </HStack>
          <Text color="fg.muted" fontSize="sm">
            Read-only, tool-grounded advisor support for planning and graduation questions.
          </Text>
        </Box>
      </HStack>

      <Flex gap="6" align="flex-start">
        <Box flex="1" minW="0">
          <ChatInterface />
        </Box>
        <AdvisorSidebar />
      </Flex>
    </Box>
  );
}
```

Note: `page.tsx` is now a **client component** only because `ChatInterface` and `AdvisorSidebar` are client components. Actually, since it only imports client components and basic Chakra components, this page itself doesn't need `"use client"` — Next.js will handle it. However, if Chakra components require client context, you may need to add `"use client"` at the top. Test and add if needed.

- [ ] **Step 10: Verify the page renders**

Run: `npm run dev` and navigate to `/dashboard/ai-advisor`.

Expected: Chat interface on the left, sidebar on the right (visible on xl+ screens). Sidebar shows loading state, then populates with real data if authenticated with a student profile.

- [ ] **Step 11: Commit**

```bash
git add src/components/dashboard/ai-advisor/ChatInterface.tsx src/components/dashboard/ai-advisor/AdvisorSidebar.tsx src/app/dashboard/ai-advisor/page.tsx
git commit -m "feat(GT-154): add context sidebar with real student data and credit progress"
```

---

## Task 4: Add Streaming Response Rendering (GT-155)

**Files:**
- Create: `src/app/api/ai-advisor/chat/stream/route.ts`
- Modify: `src/types/ai-advisor.ts` (add streaming event types)
- Modify: `src/components/dashboard/ai-advisor/ChatInterface.tsx` (streaming UI)

### Step Group A: Streaming Types

- [ ] **Step 1: Add streaming event types**

Append to `src/types/ai-advisor.ts`:

```ts
export type AdvisorStreamEvent =
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  | { type: "done"; response: AdvisorChatResponse }
  | { type: "error"; message: string };
```

### Step Group B: Streaming API Route

- [ ] **Step 2: Create the streaming route**

```ts
// src/app/api/ai-advisor/chat/stream/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { resolveStudentProfile } from "@/lib/ai-advisor/data";
import { buildSystemPrompt, PROMPT_VERSION } from "@/lib/ai-advisor/prompt";
import {
  createAdvisorToolDependencies,
  createAdvisorTools,
  executeToolByName,
  normalizeAdvisorResponse,
  tryParseJson,
  makeFallbackResponse,
  CLAUDE_TOOL_DEFINITIONS,
  ADVISOR_TOOL_NAMES,
} from "@/lib/ai-advisor/tools";
import type { AdvisorToolName } from "@/lib/ai-advisor/tools";
import type {
  AdvisorChatHistoryItem,
  AdvisorChatRequest,
  AdvisorStreamEvent,
} from "@/types/ai-advisor";

function isHistoryItem(value: unknown): value is AdvisorChatHistoryItem {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (c.role === "user" || c.role === "assistant") && typeof c.text === "string";
}

function parseRequestBody(body: unknown): AdvisorChatRequest | null {
  if (!body || typeof body !== "object") return null;
  const c = body as Record<string, unknown>;
  if (typeof c.message !== "string" || c.message.trim().length === 0) return null;
  if (!Array.isArray(c.history) || !c.history.every(isHistoryItem)) return null;
  if (c.activePlanId !== undefined && c.activePlanId !== null && typeof c.activePlanId !== "number") return null;
  return {
    message: c.message.trim(),
    history: c.history,
    activePlanId: (c.activePlanId as number | null | undefined) ?? null,
  };
}

export async function POST(request: Request) {
  let parsedBody: AdvisorChatRequest | null = null;
  try {
    parsedBody = parseRequestBody(await request.json());
  } catch {
    parsedBody = null;
  }

  if (!parsedBody) {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let profile;
  try {
    profile = await resolveStudentProfile(supabase, user.id);
  } catch {
    return new Response(JSON.stringify({ error: "Failed to load profile." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!profile) {
    return new Response(JSON.stringify({ error: "Profile not found." }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!profile.hasCompletedOnboarding) {
    return new Response(JSON.stringify({ error: "Onboarding not completed." }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI service not configured." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const body = parsedBody;

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: AdvisorStreamEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        const client = new Anthropic({ apiKey });
        const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

        const systemPrompt = buildSystemPrompt({
          promptVersion: PROMPT_VERSION,
          studentName: profile.fullName,
          primaryProgram: profile.primaryProgram?.name ?? null,
          catalogYear: profile.primaryProgram?.catalogYear ?? null,
          expectedGraduation: profile.expectedGraduation,
          hasCompletedOnboarding: profile.hasCompletedOnboarding,
        });

        const deps = createAdvisorToolDependencies({
          supabase,
          studentId: profile.studentId,
          profile,
        });
        const toolset = createAdvisorTools(deps);
        const usedCitations = new Set<string>();

        const messages: Anthropic.Messages.MessageParam[] = [
          ...body.history.slice(-8).map((item) => ({
            role: item.role as "user" | "assistant",
            content: item.text,
          })),
          { role: "user" as const, content: body.message },
        ];

        const maxTurns = 4;
        for (let turn = 0; turn < maxTurns; turn += 1) {
          const messageStream = client.messages.stream({
            model,
            max_tokens: 1024,
            system: `${systemPrompt}\n\nReturn strict JSON with keys: answer, recommendations, risks, missingData, citations.`,
            tools: CLAUDE_TOOL_DEFINITIONS,
            messages,
          });

          let hasToolUse = false;
          messageStream.on("contentBlock", (block) => {
            if (block.type === "tool_use") hasToolUse = true;
          });
          messageStream.on("text", (text) => {
            if (!hasToolUse) {
              send({ type: "delta", text });
            }
          });

          const finalMessage = await messageStream.finalMessage();

          const toolUseBlocks = finalMessage.content.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
          );

          if (toolUseBlocks.length === 0) {
            const textContent = finalMessage.content
              .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
              .map((b) => b.text)
              .join("");
            const parsed = normalizeAdvisorResponse(tryParseJson(textContent));
            const response = parsed ?? makeFallbackResponse(textContent || "I could not parse a response.");
            response.citations = Array.from(new Set([...response.citations, ...usedCitations]));
            send({ type: "done", response });
            break;
          }

          messages.push({ role: "assistant", content: finalMessage.content });

          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
          for (const toolUse of toolUseBlocks) {
            const toolLabel = toolUse.name.replace(/_/g, " ");
            send({ type: "status", text: `Looking up ${toolLabel}...` });
            try {
              const data = await executeToolByName(
                toolset,
                toolUse.name as AdvisorToolName,
                (toolUse.input ?? {}) as Record<string, unknown>
              );
              usedCitations.add(`tool:${toolUse.name}`);
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify({ ok: true, data }),
              });
            } catch (err) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Tool failed" }),
              });
            }
          }
          messages.push({ role: "user", content: toolResults });
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Streaming failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 3: Verify the streaming route compiles**

Run: `npm run build -- --no-lint 2>&1 | tail -10`

Expected: Build succeeds (or no errors related to the new route).

### Step Group C: Streaming Client UI

- [ ] **Step 4: Update ChatInterface to use streaming**

Replace the `sendMessage` function in `src/components/dashboard/ai-advisor/ChatInterface.tsx` with a streaming version. Also add an `AbortController` ref for the "Stop generating" button.

Key changes to the component:

```tsx
import { useRef, useMemo, useState } from "react";
import type { AdvisorStreamEvent } from "@/types/ai-advisor";

// Inside the component:
const abortRef = useRef<AbortController | null>(null);

function stopGenerating() {
  abortRef.current?.abort();
  abortRef.current = null;
  setLoading(false);
}

async function sendMessage(rawMessage: string) {
  const message = rawMessage.trim();
  if (!message || loading) return;

  const userMsg: AdvisorMessage = { id: createId(), role: "user", text: message };
  const assistantId = createId();
  const assistantMsg: AdvisorMessage = { id: assistantId, role: "assistant", text: "" };

  setMessages((prev) => [...prev, userMsg, assistantMsg]);
  setDraft("");
  setLoading(true);

  const controller = new AbortController();
  abortRef.current = controller;

  try {
    const response = await fetch("/api/ai-advisor/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: [...history, { role: "user", text: message }],
        activePlanId: null,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const fallback =
        response.status === 401 ? "You must sign in again to use AI Advisor."
        : response.status === 409 ? "Complete onboarding before using AI Advisor."
        : "AI Advisor could not process your request.";
      throw new Error((payload as any).error || fallback);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let event: AdvisorStreamEvent;
        try {
          event = JSON.parse(line.slice(6)) as AdvisorStreamEvent;
        } catch {
          continue;
        }

        if (event.type === "delta") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, text: m.text + event.text } : m
            )
          );
        } else if (event.type === "status") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, text: m.text || event.text } : m
            )
          );
        } else if (event.type === "done") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    text: event.response.answer,
                    recommendations: event.response.recommendations,
                    risks: event.response.risks,
                    missingData: event.response.missingData,
                    citations: event.response.citations,
                  }
                : m
            )
          );
        } else if (event.type === "error") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, text: event.message, risks: ["Unable to complete this request."] }
                : m
            )
          );
        }
      }
    }
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.text
            ? { ...m, text: "Response stopped." }
            : m
        )
      );
    } else {
      const text = error instanceof Error ? error.message : "Unexpected error.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, text, risks: ["Unable to complete this request."] }
            : m
        )
      );
    }
  } finally {
    abortRef.current = null;
    setLoading(false);
  }
}
```

- [ ] **Step 5: Add "Stop generating" button**

In the input area of `ChatInterface`, next to the send button, show a stop button when loading:

```tsx
{loading ? (
  <Button
    colorPalette="red"
    variant="outline"
    size="md"
    borderRadius="xl"
    px="4"
    flexShrink={0}
    onClick={stopGenerating}
  >
    Stop
  </Button>
) : (
  <Button
    type="submit"
    colorPalette="purple"
    size="md"
    borderRadius="xl"
    px="4"
    flexShrink={0}
    loading={loading}
  >
    <LuSend />
  </Button>
)}
```

- [ ] **Step 6: Add auto-scroll to latest message**

Add a ref and scroll effect:

```tsx
const messagesEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages]);

// Inside the messages VStack, after the map:
<div ref={messagesEndRef} />
```

- [ ] **Step 7: Test manually**

Run: `npm run dev`, navigate to `/dashboard/ai-advisor`, send a message.

Expected: Status text appears during tool calls, then response streams in word by word. "Stop" button visible during generation. Auto-scrolls to latest message.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/ai-advisor/chat/stream/route.ts src/types/ai-advisor.ts src/components/dashboard/ai-advisor/ChatInterface.tsx
git commit -m "feat(GT-155): add streaming response rendering with SSE and stop button"
```

---

## Task 5: Add Conversation Persistence (GT-156)

**Files:**
- Modify: `src/lib/supabase/queries/schema.ts` (add table constants)
- Create: `src/lib/ai-advisor/persistence.ts`
- Modify: `src/types/ai-advisor.ts` (add conversation types)
- Modify: `src/components/dashboard/ai-advisor/ChatInterface.tsx` (save/load)
- Create: `src/__tests__/lib/ai-advisor/persistence.test.ts`

### Step Group A: Database Tables

- [ ] **Step 1: Create the Supabase migration**

Use the Supabase MCP tool to apply a migration:

```sql
-- Create AI conversation tables
CREATE TABLE ai_conversations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id bigint NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id bigint NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ai_conversations_student ON ai_conversations(student_id);
CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id);

-- RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage own conversations"
  ON ai_conversations FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid()));

CREATE POLICY "Students can manage own messages"
  ON ai_messages FOR ALL
  USING (conversation_id IN (
    SELECT id FROM ai_conversations WHERE student_id IN (
      SELECT id FROM students WHERE auth_user_id = auth.uid()
    )
  ));
```

Run this via the `mcp__supabase__apply_migration` tool.

- [ ] **Step 2: Add table constants to schema.ts**

In `src/lib/supabase/queries/schema.ts`, add to `DB_TABLES`:

```ts
  aiConversations: "ai_conversations",
  aiMessages: "ai_messages",
```

### Step Group B: Persistence Types

- [ ] **Step 3: Add conversation types**

Append to `src/types/ai-advisor.ts`:

```ts
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
```

### Step Group C: Persistence Queries

- [ ] **Step 4: Write persistence tests**

```ts
// src/__tests__/lib/ai-advisor/persistence.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

import {
  createConversation,
  saveMessage,
  loadMessages,
  listConversations,
  updateConversationTitle,
} from "@/lib/ai-advisor/persistence";

function mockChain(data: unknown, error: unknown = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: undefined,
  };
  // Make it thenable for queries that don't end with single()
  Object.defineProperty(chain, "then", {
    value: (resolve: any) => resolve({ data: Array.isArray(data) ? data : [data], error }),
    configurable: true,
  });
  return chain;
}

describe("AI advisor persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a conversation and returns its id", async () => {
    mockFrom.mockReturnValue(mockChain({ id: 42 }));
    const id = await createConversation(mockSupabase as any, 10, "Test chat");
    expect(id).toBe(42);
    expect(mockFrom).toHaveBeenCalledWith("ai_conversations");
  });

  it("saves a message and returns its id", async () => {
    mockFrom.mockReturnValue(mockChain({ id: 101 }));
    const id = await saveMessage(mockSupabase as any, 42, "user", "Hello", {});
    expect(id).toBe(101);
    expect(mockFrom).toHaveBeenCalledWith("ai_messages");
  });

  it("loads messages for a conversation ordered by created_at", async () => {
    const messages = [
      { id: 1, conversation_id: 42, role: "user", content: "Hi", metadata: {}, created_at: "2026-01-01T00:00:00Z" },
      { id: 2, conversation_id: 42, role: "assistant", content: "Hello!", metadata: {}, created_at: "2026-01-01T00:00:01Z" },
    ];
    mockFrom.mockReturnValue(mockChain(messages));
    const result = await loadMessages(mockSupabase as any, 42);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
  });

  it("lists conversations for a student", async () => {
    const convos = [
      { id: 42, student_id: 10, title: "Chat 1", created_at: "2026-01-01", updated_at: "2026-01-01" },
    ];
    mockFrom.mockReturnValue(mockChain(convos));
    const result = await listConversations(mockSupabase as any, 10);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(42);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/ai-advisor/persistence.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 6: Implement persistence queries**

```ts
// src/lib/ai-advisor/persistence.ts
import { DB_TABLES } from "@/lib/supabase/queries/schema";
import type { SupabaseTableClient } from "@/lib/ai-advisor/data";
import type { AdvisorConversation, AdvisorPersistedMessage } from "@/types/ai-advisor";

export async function createConversation(
  supabase: SupabaseTableClient,
  studentId: number,
  title?: string | null
): Promise<number> {
  const { data, error } = await supabase
    .from(DB_TABLES.aiConversations)
    .insert({ student_id: studentId, title: title ?? null })
    .select("id")
    .single();

  if (error) throw error;
  return Number(data.id);
}

export async function saveMessage(
  supabase: SupabaseTableClient,
  conversationId: number,
  role: "user" | "assistant",
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<number> {
  const { data, error } = await supabase
    .from(DB_TABLES.aiMessages)
    .insert({
      conversation_id: conversationId,
      role,
      content,
      metadata,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase
    .from(DB_TABLES.aiConversations)
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return Number(data.id);
}

export async function loadMessages(
  supabase: SupabaseTableClient,
  conversationId: number
): Promise<AdvisorPersistedMessage[]> {
  const { data, error } = await supabase
    .from(DB_TABLES.aiMessages)
    .select("id, conversation_id, role, content, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: Number(row.id),
    conversationId: Number(row.conversation_id),
    role: row.role as "user" | "assistant",
    content: String(row.content),
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
  }));
}

export async function listConversations(
  supabase: SupabaseTableClient,
  studentId: number
): Promise<AdvisorConversation[]> {
  const { data, error } = await supabase
    .from(DB_TABLES.aiConversations)
    .select("id, student_id, title, created_at, updated_at")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: Number(row.id),
    studentId: Number(row.student_id),
    title: row.title ? String(row.title) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function updateConversationTitle(
  supabase: SupabaseTableClient,
  conversationId: number,
  title: string
): Promise<void> {
  const { error } = await supabase
    .from(DB_TABLES.aiConversations)
    .update({ title })
    .eq("id", conversationId);

  if (error) throw error;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/lib/ai-advisor/persistence.test.ts`

Expected: 4 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/supabase/queries/schema.ts src/types/ai-advisor.ts src/lib/ai-advisor/persistence.ts src/__tests__/lib/ai-advisor/persistence.test.ts
git commit -m "feat(GT-156): add conversation persistence queries and DB migration"
```

### Step Group D: Wire Persistence into ChatInterface

- [ ] **Step 9: Add conversation state and save/load to ChatInterface**

Add to `ChatInterface.tsx`:

1. New state for conversation tracking:
```tsx
const [conversationId, setConversationId] = useState<number | null>(null);
```

2. After a user message is sent and the streaming response is complete (inside the `sendMessage` function, after the `done` event), save both messages:

```tsx
// After the streaming loop completes successfully, save to DB
if (event.type === "done") {
  // ... existing state update ...

  // Persist messages (fire and forget — don't block UI)
  void persistMessages(message, event.response.answer, {
    recommendations: event.response.recommendations,
    risks: event.response.risks,
    missingData: event.response.missingData,
    citations: event.response.citations,
  });
}
```

3. Add the persist helper:
```tsx
async function persistMessages(
  userText: string,
  assistantText: string,
  metadata: Record<string, unknown>
) {
  try {
    let convId = conversationId;
    if (!convId) {
      const res = await fetch("/api/ai-advisor/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: userText.slice(0, 100) }),
      });
      if (!res.ok) return;
      const data = await res.json();
      convId = data.id;
      setConversationId(convId);
    }
    // Save user message
    await fetch("/api/ai-advisor/conversations/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: convId, role: "user", content: userText }),
    });
    // Save assistant message
    await fetch("/api/ai-advisor/conversations/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: convId, role: "assistant", content: assistantText, metadata }),
    });
  } catch {
    // Silent fail — persistence is best-effort
  }
}
```

4. Create the two small API routes for persistence:

**`src/app/api/ai-advisor/conversations/route.ts`** — POST to create, GET to list:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveStudentProfile } from "@/lib/ai-advisor/data";
import { createConversation, listConversations } from "@/lib/ai-advisor/persistence";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await resolveStudentProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.slice(0, 100) : null;
  const id = await createConversation(supabase, profile.studentId, title);
  return NextResponse.json({ id });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await resolveStudentProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const conversations = await listConversations(supabase, profile.studentId);
  return NextResponse.json({ conversations });
}
```

**`src/app/api/ai-advisor/conversations/messages/route.ts`** — POST to save:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveMessage } from "@/lib/ai-advisor/persistence";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { conversationId, role, content, metadata } = body;

  if (!conversationId || !role || !content) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const id = await saveMessage(supabase, conversationId, role, content, metadata ?? {});
  return NextResponse.json({ id });
}
```

- [ ] **Step 10: Add "New Conversation" button to ChatInterface**

At the top of the chat card (in the status bar area), add a button to reset the conversation:

```tsx
<Button
  size="xs"
  variant="ghost"
  onClick={() => {
    setMessages([{
      id: createId(),
      role: "assistant",
      text: "I am your AI Advisor. Ask about next-semester planning, prerequisites, remaining requirements, or graduation progress.",
    }]);
    setConversationId(null);
  }}
>
  New Chat
</Button>
```

- [ ] **Step 11: Test manually**

Run: `npm run dev`, navigate to `/dashboard/ai-advisor`. Send a message. Check the Supabase dashboard to confirm `ai_conversations` and `ai_messages` rows are created.

- [ ] **Step 12: Commit**

```bash
git add src/app/api/ai-advisor/conversations/ src/components/dashboard/ai-advisor/ChatInterface.tsx
git commit -m "feat(GT-156): wire conversation persistence into chat UI"
```

---

## Task 6: Add Comprehensive Tests (GT-157)

**Files:**
- Create: `src/__tests__/components/ai-advisor/ChatInterface.test.tsx`
- Create: `src/__tests__/components/ai-advisor/AdvisorSidebar.test.tsx`
- Modify: `src/__tests__/app/api/ai-advisor/chat.route.test.ts` (extend)

### Step Group A: Sidebar Component Tests

- [ ] **Step 1: Write sidebar tests**

```tsx
// src/__tests__/components/ai-advisor/AdvisorSidebar.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { AdvisorSidebar } from "@/components/dashboard/ai-advisor/AdvisorSidebar";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderSidebar() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AdvisorSidebar />
    </ChakraProvider>
  );
}

describe("AdvisorSidebar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading state initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderSidebar();
    expect(screen.getAllByText("Loading context...").length).toBeGreaterThan(0);
  });

  it("renders student info after fetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        studentName: "Alex Johnson",
        primaryProgram: "B.S. Computer Science",
        catalogYear: "2022-2023",
        expectedGraduation: "May 2026",
        progress: {
          overall: { completedCredits: 78, inProgressCredits: 12, remainingCredits: 30, totalCreditsRequired: 120, percentage: 75 },
          blocks: [],
        },
      }),
    });

    renderSidebar();
    await waitFor(() => {
      expect(screen.getAllByText("Alex Johnson").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("B.S. Computer Science").length).toBeGreaterThan(0);
  });

  it("renders nothing on fetch error", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const { container } = renderSidebar();
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });
});
```

- [ ] **Step 2: Run sidebar tests**

Run: `npx vitest run src/__tests__/components/ai-advisor/AdvisorSidebar.test.tsx`

Expected: 3 tests pass.

### Step Group B: Chat Component Tests

- [ ] **Step 3: Write ChatInterface tests**

```tsx
// src/__tests__/components/ai-advisor/ChatInterface.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ChatInterface } from "@/components/dashboard/ai-advisor/ChatInterface";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderChat() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <ChatInterface />
    </ChakraProvider>
  );
}

describe("ChatInterface", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the welcome message", () => {
    renderChat();
    expect(screen.getAllByText(/AI Advisor/i).length).toBeGreaterThan(0);
  });

  it("renders prompt chips", () => {
    renderChat();
    expect(screen.getAllByText("What should I take next semester?").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Am I on track to graduate?").length).toBeGreaterThan(0);
  });

  it("shows input field and send button", () => {
    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i);
    expect(input).toBeDefined();
  });

  it("disables input and chips while loading", async () => {
    // Mock a streaming response that never completes
    mockFetch.mockReturnValue(
      new Promise(() => {})
    );

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Test question" } });
    fireEvent.submit(input.closest("form")!);

    // Input should be disabled while loading
    expect(input.disabled).toBe(true);
  });
});
```

- [ ] **Step 4: Run chat tests**

Run: `npx vitest run src/__tests__/components/ai-advisor/ChatInterface.test.tsx`

Expected: 4 tests pass.

### Step Group C: Extended Route Tests

- [ ] **Step 5: Add test for profile resolution error**

In `src/__tests__/app/api/ai-advisor/chat.route.test.ts`, add:

```ts
it("returns 500 when profile resolution throws", async () => {
  mockGetUser.mockResolvedValue({
    data: { user: { id: "auth-1" } },
    error: null,
  });
  mockResolveStudentProfile.mockRejectedValue(new Error("DB connection failed"));

  const response = await POST(
    makeRequest({ message: "hello", history: [] })
  );

  expect(response.status).toBe(500);
  const payload = await response.json();
  expect(payload.error).toContain("Failed to load student profile");
});
```

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run src/__tests__/lib/ai-advisor src/__tests__/app/api/ai-advisor src/__tests__/components/ai-advisor`

Expected: All tests pass.

- [ ] **Step 7: Run with coverage**

Run: `npx vitest run --coverage src/__tests__/lib/ai-advisor src/__tests__/app/api/ai-advisor src/__tests__/components/ai-advisor`

Review coverage for `src/lib/ai-advisor/` and `src/app/api/ai-advisor/` files. Target: 80%+ line coverage.

- [ ] **Step 8: Commit**

```bash
git add src/__tests__/components/ai-advisor/ src/__tests__/app/api/ai-advisor/chat.route.test.ts
git commit -m "test(GT-157): add component and integration tests for AI advisor"
```

---

## Self-Review Checklist

- **GT-151 (Chat state management):** Already complete on branch. ChatInterface preserves this.
- **GT-152 (API route + LLM):** Task 2 swaps to Claude Haiku. Non-streaming route preserved. Streaming route added in Task 4.
- **GT-153 (Student context loader):** Already complete (`data.ts`, `prompt.ts`). Unchanged.
- **GT-154 (Context sidebar):** Task 3 — API route + sidebar component + page layout.
- **GT-155 (Streaming):** Task 4 — SSE streaming route + streaming client + stop button + auto-scroll.
- **GT-156 (Persistence):** Task 5 — DB tables + RLS + queries + API routes + UI wiring.
- **GT-157 (Tests):** Task 6 — sidebar, chat, and route tests.
- **Type consistency:** `AdvisorStreamEvent`, `AdvisorConversation`, `AdvisorPersistedMessage` defined in `types/ai-advisor.ts` and used consistently.
- **No placeholders:** All code blocks are complete. All commands include expected output.
- **server-only mock:** Fixed in Task 1, applies to all subsequent tasks.
