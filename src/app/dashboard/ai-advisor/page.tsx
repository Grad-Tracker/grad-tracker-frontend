"use client";

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
              Sage
            </Heading>
            <Badge colorPalette="purple" variant="subtle" size="sm">
              Beta
            </Badge>
          </HStack>
          <Text color="fg.muted" fontSize="sm">
            AI Academic Advisor — read-only, tool-grounded support for planning and graduation questions.
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
