"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  HStack,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuPlus } from "react-icons/lu";
import type { AdvisorConversation } from "@/types/ai-advisor";

interface ConversationListProps {
  activeConversationId: number | null;
  onSelect: (conversationId: number) => void;
  onNewConversation: () => void;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ConversationSkeleton() {
  return (
    <VStack align="stretch" gap="2" px="3">
      {[1, 2, 3, 4].map((i) => (
        <Box
          key={i}
          h="52px"
          borderRadius="lg"
          bg="bg.subtle"
          borderWidth="1px"
          borderColor="border.subtle"
          opacity={1 - i * 0.15}
        />
      ))}
    </VStack>
  );
}

export function ConversationList({
  activeConversationId,
  onSelect,
  onNewConversation,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<AdvisorConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/ai-advisor/conversations")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ conversations: AdvisorConversation[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          setConversations(data.conversations);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load conversations.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <VStack align="stretch" gap="0" h="100%" overflow="hidden">
      {/* Header */}
      <HStack px="3" py="3" borderBottomWidth="1px" borderColor="border.subtle" flexShrink={0}>
        <Text fontSize="xs" fontWeight="700" color="fg.muted" textTransform="uppercase" letterSpacing="wide" flex="1">
          History
        </Text>
        <Button
          size="xs"
          variant="ghost"
          onClick={onNewConversation}
          aria-label="New conversation"
        >
          <LuPlus />
          New
        </Button>
      </HStack>

      {/* List */}
      <VStack align="stretch" gap="1" p="2" flex="1" overflowY="auto">
        {loading ? (
          <ConversationSkeleton />
        ) : error ? (
          <Box px="3" py="4" textAlign="center">
            <Text fontSize="xs" color="fg.subtle">
              Could not load history.
            </Text>
            <Button
              size="xs"
              variant="ghost"
              mt="2"
              onClick={() => {
                setLoading(true);
                setError(null);
                fetch("/api/ai-advisor/conversations")
                  .then((r) => r.json() as Promise<{ conversations: AdvisorConversation[] }>)
                  .then((d) => { setConversations(d.conversations); setLoading(false); })
                  .catch(() => { setError("Failed to load."); setLoading(false); });
              }}
            >
              Retry
            </Button>
          </Box>
        ) : conversations.length === 0 ? (
          <Box px="3" py="6" textAlign="center">
            <Text fontSize="xs" color="fg.subtle">No past conversations yet.</Text>
            <Text fontSize="xs" color="fg.subtle" mt="1">Start a chat to see it here.</Text>
          </Box>
        ) : (
          conversations.map((convo) => {
            const isActive = convo.id === activeConversationId;
            return (
              <Box
                key={convo.id}
                as="button"
                w="100%"
                textAlign="left"
                px="3"
                py="2.5"
                borderRadius="lg"
                borderWidth="1px"
                borderColor={isActive ? "blue.200" : "transparent"}
                bg={isActive ? "blue.50" : "transparent"}
                _hover={{ bg: isActive ? "blue.50" : "bg.subtle", borderColor: isActive ? "blue.200" : "border.subtle" }}
                _dark={{
                  bg: isActive ? "blue.900/30" : "transparent",
                  borderColor: isActive ? "blue.700" : "transparent",
                  _hover: { bg: isActive ? "blue.900/30" : "bg.subtle" },
                }}
                transition="all 0.15s"
                onClick={() => onSelect(convo.id)}
                aria-current={isActive ? "true" : undefined}
              >
                <Text
                  fontSize="sm"
                  fontWeight={isActive ? "600" : "400"}
                  color={isActive ? "blue.fg" : "fg"}
                  lineClamp={1}
                  mb="0.5"
                >
                  {convo.title ?? "New conversation"}
                </Text>
                <Text fontSize="xs" color="fg.subtle">
                  {formatRelativeTime(convo.updatedAt)}
                </Text>
              </Box>
            );
          })
        )}
      </VStack>
    </VStack>
  );
}
