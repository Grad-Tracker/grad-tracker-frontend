"use client";

import { Avatar, Badge, Box, Flex, HStack, Text } from "@chakra-ui/react";
import { LuShield } from "react-icons/lu";
import { ColorModeButton } from "@/components/ui/color-mode";
import { useUserProfile } from "@/lib/hooks/useUserProfile";

export default function AdminHeader() {
  const { userName: advisorName } = useUserProfile();

  return (
    <Box
      as="header"
      position="sticky"
      top={{ base: "56px", lg: "0" }}
      bg="bg"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      zIndex="sticky"
      className="glass-card"
    >
      <Flex
        justify="space-between"
        align="center"
        px={{ base: "4", md: "8" }}
        py="3"
        gap="4"
      >
        <HStack gap="3">
          <Box
            display={{ base: "grid", lg: "none" }}
            placeItems="center"
            w="10"
            h="10"
            borderRadius="xl"
            bg="blue.subtle"
            color="blue.fg"
          >
            <LuShield />
          </Box>
          <Box>
            <Text fontWeight="700" fontSize={{ base: "lg", md: "xl" }}>
              Advisor Tools
            </Text>
            <Text fontSize="sm" color="fg.muted">
              Manage programs and Gen-Ed requirements
            </Text>
          </Box>
        </HStack>

        <HStack gap="3">
          {advisorName && (
            <HStack gap="2" display={{ base: "none", md: "flex" }}>
              <Avatar.Root size="sm">
                <Avatar.Fallback name={advisorName} />
              </Avatar.Root>
              <Box>
                <Text fontSize="sm" fontWeight="600" lineHeight="1.2">
                  {advisorName}
                </Text>
                <Badge colorPalette="blue" variant="surface" size="xs">
                  Advisor
                </Badge>
              </Box>
            </HStack>
          )}
          <ColorModeButton variant="ghost" size="sm" />
        </HStack>
      </Flex>
    </Box>
  );
}
