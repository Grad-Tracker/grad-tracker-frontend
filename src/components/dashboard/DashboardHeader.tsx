"use client";

import { Avatar, Box, Circle, Flex, Heading, HStack, IconButton, Text } from "@chakra-ui/react";
import { LuBell } from "react-icons/lu";
import { ColorModeButton } from "@/components/ui/color-mode";

export default function DashboardHeader() {
  return (
    <Box
      as="header"
      position="sticky"
      top="0"
      bg="bg"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      zIndex="sticky"
      className="glass-card"
    >
      <Flex justify="space-between" align="center" px={{ base: "4", md: "8" }} py="4">
        <Box>
          <Text fontSize="sm" color="fg.muted" fontWeight="500">
            Dashboard
          </Text>
          <Heading size="lg" fontFamily="'DM Serif Display', serif" fontWeight="400">
            Grad Tracker
          </Heading>
        </Box>

        <HStack gap="3">
          <IconButton aria-label="Notifications" variant="ghost" size="sm" position="relative">
            <LuBell />
            <Circle size="2" bg="red.500" position="absolute" top="1.5" right="1.5" />
          </IconButton>
          <ColorModeButton variant="ghost" size="sm" />
          <Avatar.Root size="sm">
            <Avatar.Fallback name="Alex Johnson" />
          </Avatar.Root>
        </HStack>
      </Flex>
    </Box>
  );
}