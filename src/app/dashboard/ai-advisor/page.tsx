"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuSend, LuSparkles } from "react-icons/lu";
import type {
  AdvisorChatHistoryItem,
  AdvisorChatResponse,
  AdvisorRecommendation,
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
        <Badge colorPalette="purple" variant="subtle">
          AI Advisor
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
      <Badge colorPalette="green" variant="subtle">
        You
      </Badge>
      <Box
        maxW="80%"
        bg="green.500"
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

export default function AIAdvisorPage() {
  const [messages, setMessages] = useState<AdvisorMessage[]>([
    {
      id: createId(),
      role: "assistant",
      text:
        "I am your AI Advisor. Ask about next-semester planning, prerequisites, remaining requirements, or graduation progress.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);

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

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim();
    if (!message || loading) return;

    const userMessage: AdvisorMessage = {
      id: createId(),
      role: "user",
      text: message,
    };

    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai-advisor/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          history: [...history, { role: "user", text: message }],
          activePlanId: null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        const fallbackError =
          response.status === 401
            ? "You must sign in again to use AI Advisor."
            : response.status === 409
              ? "Complete onboarding before using AI Advisor."
              : "AI Advisor could not process your request.";
        throw new Error(payload.error || fallbackError);
      }

      const advisor = (await response.json()) as AdvisorChatResponse;
      const assistantMessage: AdvisorMessage = {
        id: createId(),
        role: "assistant",
        text: advisor.answer,
        recommendations: advisor.recommendations,
        risks: advisor.risks,
        missingData: advisor.missingData,
        citations: advisor.citations,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const messageText =
        error instanceof Error
          ? error.message
          : "Unexpected AI Advisor error.";

      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          text: messageText,
          risks: ["Unable to complete this request with current data."],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

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

      <Box
        bg="bg"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="xl"
        overflow="hidden"
      >
        <HStack
          px="5"
          py="3"
          borderBottomWidth="1px"
          borderColor="border.subtle"
          bg="bg.subtle"
          gap="2"
        >
          <Box w="2" h="2" borderRadius="full" bg={loading ? "orange.500" : "green.500"} />
          <Text fontSize="xs" fontWeight="600" color="fg.muted">
            {loading ? "AI Advisor is thinking..." : "AI Advisor is online"}
          </Text>
          <Text fontSize="2xs" color="fg.subtle" ms="auto">
            Read-only mode
          </Text>
        </HStack>

        <VStack align="stretch" gap="4" p="5" maxH="520px" overflowY="auto">
          {messages.map((message) =>
            message.role === "assistant" ? (
              <AIMessage key={message.id} message={message} />
            ) : (
              <UserMessage key={message.id} message={message} />
            )
          )}
        </VStack>

        <Separator />

        <Box px="4" py="3.5">
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
              placeholder="Ask about courses, requirements, or graduation progress..."
              size="md"
              borderRadius="xl"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={loading}
            />
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
          </HStack>
        </Box>
      </Box>
    </Box>
  );
}
