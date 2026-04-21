"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Input,
  List,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuSend, LuSquare } from "react-icons/lu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  AdvisorChatHistoryItem,
  AdvisorPersistedMessage,
  AdvisorRecommendation,
  AdvisorSideEffect,
  AdvisorStreamEvent,
} from "@/types/ai-advisor";

type ChatRole = "assistant" | "user";

interface AdvisorMessage {
  id: string;
  role: ChatRole;
  text: string;
  recommendations?: AdvisorRecommendation[];
  risks?: string[];
  missingData?: string[];
  citations?: string[];
}

export interface ChatInterfaceProps {
  conversationId: number | null;
  onConversationCreated: (id: number) => void;
  activePlanId: number | null;
  onSideEffect?: (effect: AdvisorSideEffect) => void;
}

const WELCOME_MESSAGE =
  "I'm **Atlas**, your AI Academic Advisor.\n\nI can help you with:\n- **Next-semester planning** — what to take and when\n- **Prerequisite checks** — whether you're eligible for a course\n- **Degree progress** — how close you are to graduating\n- **Plan building** — create and fill out your graduation plan\n\nWhat would you like to work on?";

const promptChips = [
  "What should I take next semester?",
  "Am I on track to graduate?",
  "Show my remaining requirements",
  "Create a graduation plan",
];

function createId() {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

function makeWelcomeMessage(): AdvisorMessage {
  return { id: createId(), role: "assistant", text: WELCOME_MESSAGE };
}

function MarkdownContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <Text fontSize="sm" mb="1" _last={{ mb: 0 }}>
            {children}
          </Text>
        ),
        strong: ({ children }) => (
          <Text as="strong" fontWeight="700">
            {children}
          </Text>
        ),
        em: ({ children }) => (
          <Text as="em" fontStyle="italic">
            {children}
          </Text>
        ),
        code: ({ children }) => (
          <Code fontSize="xs" px="1" borderRadius="sm">
            {children}
          </Code>
        ),
        ul: ({ children }) => (
          <List.Root ps="4" mb="1" gap="0.5">
            {children}
          </List.Root>
        ),
        ol: ({ children }) => (
          <List.Root as="ol" ps="4" mb="1" gap="0.5">
            {children}
          </List.Root>
        ),
        li: ({ children }) => (
          <List.Item fontSize="sm">{children}</List.Item>
        ),
        h1: ({ children }) => (
          <Text fontSize="sm" fontWeight="700" mb="1" mt="2">
            {children}
          </Text>
        ),
        h2: ({ children }) => (
          <Text fontSize="sm" fontWeight="700" mb="1" mt="2">
            {children}
          </Text>
        ),
        h3: ({ children }) => (
          <Text fontSize="sm" fontWeight="600" mb="0.5" mt="1.5" color="fg.muted">
            {children}
          </Text>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function AIMessage({ message }: { message: AdvisorMessage }) {
  return (
    <VStack align="stretch" gap="2">
      <HStack gap="2">
        <Badge colorPalette="blue" variant="subtle">
          Atlas
        </Badge>
      </HStack>
      <Box
        bg="bg"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="xl"
        p="4"
      >
        <MarkdownContent text={message.text} />

        {message.recommendations && message.recommendations.length > 0 && (
          <Box mt="3">
            <Text fontSize="xs" color="fg.muted" mb="2" fontWeight="600">
              Recommendations
            </Text>
            <VStack align="stretch" gap="2">
              {message.recommendations.map((item) => (
                <Box
                  key={`${message.id}-${item.courseCode}`}
                  p="2.5"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  borderRadius="lg"
                  bg="bg.subtle"
                >
                  <HStack justify="space-between" mb="1">
                    <Text fontSize="xs" fontWeight="700">
                      {item.courseCode}
                    </Text>
                    <Badge size="sm" variant="subtle" colorPalette="green">
                      {item.confidence}
                    </Badge>
                  </HStack>
                  <Text fontSize="xs" color="fg.muted">
                    {item.reason}
                  </Text>
                </Box>
              ))}
            </VStack>
          </Box>
        )}

        {message.risks && message.risks.length > 0 && (
          <Box mt="3">
            <Text fontSize="xs" color="fg.muted" mb="1.5" fontWeight="600">
              Risks
            </Text>
            <VStack align="stretch" gap="1.5">
              {message.risks.map((risk) => (
                <Text key={`${message.id}-${risk}`} fontSize="xs" color="orange.fg">
                  — {risk}
                </Text>
              ))}
            </VStack>
          </Box>
        )}

        {message.missingData && message.missingData.length > 0 && (
          <Box mt="3">
            <Text fontSize="xs" color="fg.muted" mb="1.5" fontWeight="600">
              Missing Data
            </Text>
            <VStack align="stretch" gap="1.5">
              {message.missingData.map((item) => (
                <Text key={`${message.id}-${item}`} fontSize="xs" color="red.fg">
                  — {item}
                </Text>
              ))}
            </VStack>
          </Box>
        )}

        {message.citations && message.citations.length > 0 && (
          <HStack mt="3" gap="2" wrap="wrap">
            {message.citations.map((citation) => (
              <Badge key={`${message.id}-${citation}`} size="sm" variant="outline" colorPalette="gray">
                {citation}
              </Badge>
            ))}
          </HStack>
        )}
      </Box>
    </VStack>
  );
}

function UserMessage({ message }: Readonly<{ message: AdvisorMessage }>) {
  return (
    <VStack align="end" gap="1">
      <Badge colorPalette="blue" variant="subtle">
        You
      </Badge>
      <Box
        maxW="80%"
        bg="blue.500"
        color="white"
        borderRadius="xl"
        borderTopRightRadius="sm"
        px="4"
        py="3"
      >
        <Text fontSize="sm">{message.text}</Text>
      </Box>
    </VStack>
  );
}

/** Map a persisted message (from the DB) back to a UI AdvisorMessage. */
function hydratePersistedMessage(msg: AdvisorPersistedMessage): AdvisorMessage {
  const meta = msg.metadata ?? {};
  return {
    id: createId(),
    role: msg.role,
    text: msg.content,
    recommendations: Array.isArray(meta.recommendations)
      ? (meta.recommendations as AdvisorRecommendation[])
      : undefined,
    risks: Array.isArray(meta.risks) ? (meta.risks as string[]) : undefined,
    missingData: Array.isArray(meta.missingData) ? (meta.missingData as string[]) : undefined,
    citations: Array.isArray(meta.citations) ? (meta.citations as string[]) : undefined,
  };
}

export function ChatInterface({
  conversationId,
  onConversationCreated,
  activePlanId,
  onSideEffect,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<AdvisorMessage[]>([makeWelcomeMessage()]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const abortRef = useRef<{ controller: AbortController; owner: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationCreatePromiseRef = useRef<Promise<number> | null>(null);
  // Tracks the conversation ID created locally so subsequent messages in the
  // same chat session reuse it even before the parent prop updates.
  const localConversationIdRef = useRef<number | null>(null);

  // Scroll to bottom when messages change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Abort in-flight request on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.controller.abort();
    };
  }, []);

  // Keep the local conversation ID ref in sync with the prop so that when the
  // parent resets it (new chat) or provides an existing ID (history load) the
  // ref is always accurate.
  useEffect(() => {
    localConversationIdRef.current = conversationId;
  }, [conversationId]);

  // Load a past conversation when conversationId changes and is non-null.
  useEffect(() => {
    if (conversationId === null) return;

    let cancelled = false;
    setLoadingHistory(true);

    fetch(`/api/ai-advisor/conversations/${conversationId}/messages`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ messages: AdvisorPersistedMessage[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        const hydrated = data.messages.map(hydratePersistedMessage);
        setMessages(hydrated.length > 0 ? hydrated : [makeWelcomeMessage()]);
        setLoadingHistory(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const history = useMemo<AdvisorChatHistoryItem[]>(
    () =>
      messages
        .filter((m) => m.role === "assistant" || m.role === "user")
        .map((m) => ({ role: m.role, text: m.text })),
    [messages]
  );

  function stopGenerating() {
    abortRef.current?.controller.abort();
    abortRef.current = null;
    setLoading(false);
    setStatusText(null);
  }

  const persistMessages = useCallback(
    async (
      userText: string,
      assistantText: string,
      metadata: Record<string, unknown>,
      resolvedConversationId: number | null
    ) => {
      try {
        let convId = resolvedConversationId;

        if (!convId) {
          if (conversationCreatePromiseRef.current) {
            convId = await conversationCreatePromiseRef.current;
          } else {
            const createPromise = (async () => {
              const res = await fetch("/api/ai-advisor/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: userText.slice(0, 100) }),
              });
              if (!res.ok) throw new Error("Failed to create conversation");
              const data = await res.json();
              return data.id as number;
            })();

            conversationCreatePromiseRef.current = createPromise;
            try {
              convId = await createPromise;
              localConversationIdRef.current = convId;
              onConversationCreated(convId);
            } finally {
              conversationCreatePromiseRef.current = null;
            }
          }
        }

        const userRes = await fetch("/api/ai-advisor/conversations/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: convId, role: "user", content: userText }),
        });
        if (!userRes.ok) throw new Error(`Failed to save user message (${userRes.status})`);

        const assistantRes = await fetch("/api/ai-advisor/conversations/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: convId,
            role: "assistant",
            content: assistantText,
            metadata,
          }),
        });
        if (!assistantRes.ok) throw new Error(`Failed to save assistant message (${assistantRes.status})`);
      } catch (error) {
        console.error("Failed to persist messages:", error);
      }
    },
    [onConversationCreated]
  );

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim();
    if (!message || loading || loadingHistory) return;

    const userMessage: AdvisorMessage = { id: createId(), role: "user", text: message };
    const assistantId = createId();
    const assistantPlaceholder: AdvisorMessage = { id: assistantId, role: "assistant", text: "" };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setDraft("");
    setLoading(true);
    setStatusText("Atlas is thinking...");

    if (abortRef.current?.controller) {
      abortRef.current.controller.abort();
    }
    const controller = new AbortController();
    const owner = createId();
    abortRef.current = { controller, owner };

    // Capture conversation ID at request time. Fall back to the locally-created
    // ID so that successive messages in the same session reuse it even when the
    // parent prop hasn't updated yet.
    const requestConversationId = conversationId ?? localConversationIdRef.current;

    try {
      const response = await fetch("/api/ai-advisor/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, activePlanId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        let fallbackError = "Atlas could not process your request.";
        if (response.status === 401) fallbackError = "You must sign in again to use Atlas.";
        else if (response.status === 409) fallbackError = "Complete onboarding before using Atlas.";
        throw new Error(payload.error || fallbackError);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream available.");

      const decoder = new TextDecoder();
      let buffer = "";
      let finalAssistantText = "";
      let finalMetadata: Record<string, unknown> = {};

      const processLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) return;
        const jsonStr = trimmed.slice(6);
        let event: AdvisorStreamEvent;
        try {
          event = JSON.parse(jsonStr) as AdvisorStreamEvent;
        } catch {
          return;
        }
        if (event.type === "status") {
          setStatusText(event.text);
        } else if (event.type === "delta") {
          // Deltas contain raw JSON fragments — suppress and rely on the "done" event.
        } else if (event.type === "done") {
          const { response: resp } = event;
          finalAssistantText = resp.answer;
          finalMetadata = {
            recommendations: resp.recommendations,
            risks: resp.risks,
            missingData: resp.missingData,
            citations: resp.citations,
          };

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    text: resp.answer,
                    recommendations: resp.recommendations,
                    risks: resp.risks,
                    missingData: resp.missingData,
                    citations: resp.citations,
                  }
                : m
            )
          );

          if (resp.sideEffects) {
            for (const effect of resp.sideEffects) {
              onSideEffect?.(effect);
            }
          }

          void persistMessages(message, finalAssistantText, finalMetadata, requestConversationId);
        } else if (event.type === "error") {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: (event as { type: "error"; message: string }).message } : m))
          );
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Flush any remaining buffered content after stream ends
          if (buffer.trim()) {
            processLine(buffer);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          processLine(line);
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.text ? { ...m, text: "Response stopped." } : m
          )
        );
      } else {
        const messageText =
          error instanceof Error ? error.message : "Unexpected Atlas error.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  text: messageText,
                  risks: ["Unable to complete this request with current data."],
                }
              : m
          )
        );
      }
    } finally {
      if (abortRef.current?.owner === owner) {
        abortRef.current = null;
        setLoading(false);
        setStatusText(null);
      }
    }
  }

  function resetToNewChat() {
    stopGenerating();
    localConversationIdRef.current = null;
    setMessages([makeWelcomeMessage()]);
    setLoadingHistory(false);
  }

  return (
    <Flex direction="column" h="100%" overflow="hidden">
      {/* Status bar */}
      <HStack
        px="4"
        py="2"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        bg="bg.subtle"
        gap="2"
        flexShrink={0}
      >
        <Box
          w="2"
          h="2"
          borderRadius="full"
          bg={loadingHistory ? "blue.500" : loading ? "orange.500" : "green.500"}
          flexShrink={0}
        />
        <Text fontSize="xs" fontWeight="600" color="fg.muted" flex="1" lineClamp={1}>
          {loadingHistory
            ? "Loading conversation..."
            : statusText && loading
              ? statusText
              : loading
                ? "Atlas is thinking..."
                : "Atlas is online"}
        </Text>
        <Button
          size="xs"
          variant="ghost"
          ms="auto"
          flexShrink={0}
          onClick={resetToNewChat}
          disabled={loadingHistory}
        >
          New Chat
        </Button>
      </HStack>

      {/* Messages */}
      <VStack align="stretch" gap="4" p="4" flex="1" overflowY="auto">
        {loadingHistory ? (
          <Box py="8" textAlign="center">
            <Text fontSize="xs" color="fg.subtle">Loading messages...</Text>
          </Box>
        ) : (
          messages.map((message) =>
            message.role === "assistant" ? (
              <AIMessage key={message.id} message={message} />
            ) : (
              <UserMessage key={message.id} message={message} />
            )
          )
        )}
        <div ref={messagesEndRef} />
      </VStack>

      {/* Input area */}
      <Box px="4" py="3" borderTopWidth="1px" borderColor="border.subtle" flexShrink={0}>
        <Flex gap="2" wrap="wrap" mb="3">
          {promptChips.map((chip) => (
            <Button
              key={chip}
              size="xs"
              variant="outline"
              borderRadius="full"
              fontSize="xs"
              onClick={() => sendMessage(chip)}
              disabled={loading || loadingHistory}
            >
              {chip}
            </Button>
          ))}
        </Flex>

        <HStack
          as="form"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(draft);
          }}
          gap="2"
        >
          <Input
            placeholder="Ask about courses, requirements, plans, or graduation..."
            size="md"
            borderRadius="xl"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={loading || loadingHistory}
            aria-label="Message input"
          />
          {loading ? (
            <Button
              type="button"
              colorPalette="red"
              variant="outline"
              size="md"
              borderRadius="xl"
              px="4"
              flexShrink={0}
              onClick={stopGenerating}
              aria-label="Stop generating"
            >
              <LuSquare />
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              colorPalette="blue"
              size="md"
              borderRadius="xl"
              px="4"
              flexShrink={0}
              aria-label="Send message"
              disabled={!draft.trim() || loadingHistory}
            >
              <LuSend />
            </Button>
          )}
        </HStack>
      </Box>
    </Flex>
  );
}
