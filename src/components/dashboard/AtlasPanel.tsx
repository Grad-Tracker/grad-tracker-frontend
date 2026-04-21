"use client";

import { Badge, Box, CloseButton, Drawer, HStack, Icon, Portal, Text } from "@chakra-ui/react";
import { LuSparkles } from "react-icons/lu";
import { useAtlasPanel } from "@/contexts/AtlasPanelContext";
import { ChatInterface } from "@/components/dashboard/ai-advisor/ChatInterface";

export default function AtlasPanel() {
  const { isOpen, close } = useAtlasPanel();

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) close();
      }}
      placement="end"
      size="md"
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
            <Drawer.Header bg="bg" borderBottomWidth="1px" borderColor="border.subtle">
              <HStack gap="3" flex="1">
                <Box p="1.5" bg="blue.solid" borderRadius="md">
                  <Icon color="white" boxSize="4">
                    <LuSparkles />
                  </Icon>
                </Box>
                <Text fontWeight="700" fontSize="md">
                  Atlas
                </Text>
                <Badge colorPalette="blue" variant="subtle" size="sm">
                  Beta
                </Badge>
              </HStack>
              <Drawer.CloseTrigger asChild pos="initial">
                <CloseButton size="sm" />
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body p="0" display="flex" flexDirection="column" bg="bg">
              <ChatInterface />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
