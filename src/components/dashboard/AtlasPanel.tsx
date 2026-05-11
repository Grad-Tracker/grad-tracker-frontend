"use client";

import { useCallback, useRef, useState } from "react";
import {
  Badge,
  Box,
  CloseButton,
  Drawer,
  Flex,
  HStack,
  Icon,
  IconButton,
  Portal,
  Text,
} from "@chakra-ui/react";
import { LuHistory, LuPanelLeft, LuSparkles } from "react-icons/lu";
import { useAtlasPanel } from "@/contexts/AtlasPanelContext";
import { ChatInterface } from "@/components/dashboard/ai-advisor/ChatInterface";
import { AdvisorSidebar } from "@/components/dashboard/ai-advisor/AdvisorSidebar";
import { ConversationList } from "@/components/dashboard/ai-advisor/ConversationList";
import { PlanSwitcher } from "@/components/dashboard/ai-advisor/PlanSwitcher";
import type { AdvisorSideEffect } from "@/types/ai-advisor";

export default function AtlasPanel() {
  const { isOpen, close } = useAtlasPanel();

  // Conversation state — lifted here so history panel and chat stay in sync.
  const [conversationId, setConversationId] = useState<number | null>(null);

  // Plan state — drives the active plan context and plan switcher.
  const [activePlanId, setActivePlanId] = useState<number | null>(null);

  // History panel open/close.
  const [historyOpen, setHistoryOpen] = useState(false);

  // Context sidebar (AdvisorSidebar) visibility.
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Trigger to re-fetch plan list after Atlas creates a plan.
  const [planRefreshTrigger, setPlanRefreshTrigger] = useState(0);

  // Ref to allow ChatInterface to reset to a new chat from outside.
  const chatResetKeyRef = useRef(0);
  const [chatKey, setChatKey] = useState(0);

  const handleNewConversation = useCallback(() => {
    setConversationId(null);
    setHistoryOpen(false);
    chatResetKeyRef.current += 1;
    setChatKey(chatResetKeyRef.current);
  }, []);

  const handleConversationSelect = useCallback((id: number) => {
    setConversationId(id);
    setHistoryOpen(false);
  }, []);

  const handleConversationCreated = useCallback((id: number) => {
    setConversationId(id);
  }, []);

  const handleSideEffect = useCallback((effect: AdvisorSideEffect) => {
    if (effect.type === "plan_created") {
      // Auto-select the new plan and trigger a refresh of the plan switcher list.
      setActivePlanId(effect.planId);
      setPlanRefreshTrigger((prev) => prev + 1);
    }
  }, []);

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) close();
      }}
      placement="end"
      size="xl"
      modal={false}
      closeOnInteractOutside={false}
      lazyMount
      unmountOnExit={false}
    >
      <Portal>
        <Drawer.Positioner pointerEvents="none">
          <Drawer.Content
            pointerEvents="auto"
            bg="bg"
            borderLeftWidth="1px"
            borderColor="border.subtle"
            boxShadow="lg"
          >
            {/* ── Header ─────────────────────────────────────────── */}
            <Drawer.Header bg="bg" borderBottomWidth="1px" borderColor="border.subtle">
              <HStack gap="3" flex="1" minW={0}>
                <Box p="1.5" bg="blue.solid" borderRadius="md" flexShrink={0}>
                  <Icon color="white" boxSize="4">
                    <LuSparkles />
                  </Icon>
                </Box>
                <Text fontWeight="700" fontSize="md" flexShrink={0}>
                  Atlas
                </Text>
                <Badge colorPalette="blue" variant="subtle" size="sm" flexShrink={0}>
                  Beta
                </Badge>

                {/* Plan switcher — takes remaining space */}
                <Box flex="1" minW={0}>
                  <PlanSwitcher
                    activePlanId={activePlanId}
                    onPlanChange={setActivePlanId}
                    refreshTrigger={planRefreshTrigger}
                  />
                </Box>
              </HStack>

              <HStack gap="1" flexShrink={0}>
                {/* Toggle conversation history */}
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label={historyOpen ? "Close history" : "Open history"}
                  aria-pressed={historyOpen}
                  onClick={() => setHistoryOpen((prev) => !prev)}
                  color={historyOpen ? "blue.fg" : "fg.muted"}
                >
                  <LuHistory />
                </IconButton>

                {/* Toggle context sidebar */}
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label={sidebarOpen ? "Hide context panel" : "Show context panel"}
                  aria-pressed={sidebarOpen}
                  onClick={() => setSidebarOpen((prev) => !prev)}
                  color={sidebarOpen ? "blue.fg" : "fg.muted"}
                  display={{ base: "none", lg: "flex" }}
                >
                  <LuPanelLeft />
                </IconButton>

                <Drawer.CloseTrigger asChild pos="initial">
                  <CloseButton size="sm" />
                </Drawer.CloseTrigger>
              </HStack>
            </Drawer.Header>

            {/* ── Body ───────────────────────────────────────────── */}
            <Drawer.Body p="0" overflow="hidden">
              <Flex h="100%" overflow="hidden" position="relative">

                {/* History slide-in panel */}
                <Box
                  position="absolute"
                  top={0}
                  left={0}
                  bottom={0}
                  zIndex={10}
                  w="260px"
                  bg="bg"
                  borderRightWidth="1px"
                  borderColor="border.subtle"
                  boxShadow="md"
                  transform={historyOpen ? "translateX(0)" : "translateX(-100%)"}
                  transition="transform 0.2s ease"
                  aria-hidden={!historyOpen}
                  pointerEvents={historyOpen ? "auto" : "none"}
                >
                  <ConversationList
                    activeConversationId={conversationId}
                    onSelect={handleConversationSelect}
                    onNewConversation={handleNewConversation}
                  />
                </Box>

                {/* Backdrop for history panel on click-away */}
                {historyOpen && (
                  <Box
                    position="absolute"
                    inset={0}
                    zIndex={9}
                    onClick={() => setHistoryOpen(false)}
                    aria-hidden="true"
                  />
                )}

                {/* Main chat area */}
                <Box flex="1" minW={0} overflow="hidden">
                  <ChatInterface
                    key={chatKey}
                    conversationId={conversationId}
                    onConversationCreated={handleConversationCreated}
                    activePlanId={activePlanId}
                    onSideEffect={handleSideEffect}
                  />
                </Box>

                {/* Context sidebar (collapsible, desktop only) */}
                <Box
                  w={sidebarOpen ? "280px" : "0"}
                  flexShrink={0}
                  overflow="hidden"
                  transition="width 0.2s ease"
                  borderLeftWidth={sidebarOpen ? "1px" : "0"}
                  borderColor="border.subtle"
                  display={{ base: "none", lg: "block" }}
                >
                  <Box w="280px" h="100%" overflowY="auto" p="3">
                    <AdvisorSidebar />
                  </Box>
                </Box>

              </Flex>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
