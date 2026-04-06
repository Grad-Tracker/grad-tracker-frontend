"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuSend, LuSquare } from "react-icons/lu";
import type {
  AdvisorChatHistoryItem,
  AdvisorRecommendation,
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

const promptChips = [
  "What should I take next semester?",
  "Am I on track to graduate?",
  "Show my remaining requirements",
  "Can I take CSCI 340?",
];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
        <Text fontSize="sm">{message.text}</Text>

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
                    <Badge size="sm" variant="subtle" colorPalette="emerald">
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
                  - {risk}
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
                  - {item}
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

function UserMessage({ message }: { message: AdvisorMessage }) {
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

export function ChatInterface() {
  const [messages, setMessages] = useState<AdvisorMessage[]>([
    {
      id: createId(),
      role: "assistant",
      text: "I'm Atlas, your AI Academic Advisor. Ask about next-semester planning, prerequisites, remaining requirements, or graduation progress.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const abortRef = useRef<{ controller: AbortController; owner: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationCreatePromiseRef = useRef<Promise<number> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      // Cleanup: abort any in-flight requests when component unmounts
      if (abortRef.current) {
        abortRef.current.controller.abort();
      }
    };
  }, []);

  const history = useMemo<AdvisorChatHistoryItem[]>(
    () =>
      messages
        .filter((m) => m.role === "assistant" || m.role === "user")
        .map((m) => ({
          role: m.role,
          text: m.text,
        })),
    [messages]
  );

  function stopGenerating() {
    if (abortRef.current) {
      abortRef.current.controller.abort();
      abortRef.current = null;
    }
    setLoading(false);
  }

  async function persistMessages(
    userText: string,
    assistantText: string,
    metadata: Record<string, unknown>
  ) {
    try {
      let convId = conversationId;

      // Check if conversation already exists
      if (!convId) {
        // Check if there's an in-flight conversation creation
        if (conversationCreatePromiseRef.current) {
          convId = await conversationCreatePromiseRef.current;
        } else {
          // Create new conversation
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
            setConversationId(convId);
          } finally {
            conversationCreatePromiseRef.current = null;
          }
        }
      }

      await fetch("/api/ai-advisor/conversations/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, role: "user", content: userText }),
      });
      await fetch("/api/ai-advisor/conversations/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, role: "assistant", content: assistantText, metadata }),
      });
    } catch (error) {
      // Silent fail — persistence is best-effort
      console.error("Failed to persist messages:", error);
    }
  }

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim();
    if (!message || loading) return;

    const userMessage: AdvisorMessage = {
      id: createId(),
      role: "user",
      text: message,
    };

    const assistantId = createId();
    const assistantPlaceholder: AdvisorMessage = {
      id: assistantId,
      role: "assistant",
      text: "",
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setDraft("");
    setLoading(true);

    const controller = new AbortController();
    const owner = createId();
    abortRef.current = { controller, owner };

    try {
      const response = await fetch("/api/ai-advisor/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history,
          activePlanId: null,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        const fallbackError =
          response.status === 401
            ? "You must sign in again to use Atlas."
            : response.status === 409
              ? "Complete onboarding before using Atlas."
              : "Atlas could not process your request.";
        throw new Error(payload.error || fallbackError);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream available.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6);

          let event: AdvisorStreamEvent;
          try {
            event = JSON.parse(jsonStr) as AdvisorStreamEvent;
          } catch {
            continue;
          }

          if (event.type === "delta") {
            // Deltas contain raw JSON — suppress and show typing indicator instead.
            // The final parsed answer arrives via the "done" event.
          } else if (event.type === "status") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId && !m.text
                  ? { ...m, text: event.text }
                  : m
              )
            );
          } else if (event.type === "done") {
            const { response: resp } = event;
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
            void persistMessages(message, resp.answer, {
              recommendations: resp.recommendations,
              risks: resp.risks,
              missingData: resp.missingData,
              citations: resp.citations,
            });
          } else if (event.type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, text: event.message }
                  : m
              )
            );
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.text
              ? { ...m, text: "Response stopped." }
              : m
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
      // Only clear if this request still owns the abort ref
      if (abortRef.current?.owner === owner) {
        abortRef.current = null;
        setLoading(false);
      }
    }
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
        <Box w="2" h="2" borderRadius="full" bg={loading ? "orange.500" : "green.500"} />
        <Text fontSize="xs" fontWeight="600" color="fg.muted">
          {loading ? "Atlas is thinking..." : "Atlas is online"}
        </Text>
        <Button
          size="xs"
          variant="ghost"
          ms="auto"
          onClick={() => {
            setMessages([{
              id: createId(),
              role: "assistant",
              text: "I'm Atlas, your AI Academic Advisor. Ask about next-semester planning, prerequisites, remaining requirements, or graduation progress.",
            }]);
            setConversationId(null);
          }}
        >
          New Chat
        </Button>
      </HStack>

      {/* Messages */}
      <VStack align="stretch" gap="4" p="4" flex="1" overflowY="auto">
        {messages.map((message) =>
          message.role === "assistant" ? (
            <AIMessage key={message.id} message={message} />
          ) : (
            <UserMessage key={message.id} message={message} />
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
              disabled={loading}
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
            placeholder="Ask about courses, requirements, or graduation..."
            size="md"
            borderRadius="xl"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={loading}
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
            >
              <LuSend />
            </Button>
          )}
        </HStack>
      </Box>
    </Flex>
  );
}