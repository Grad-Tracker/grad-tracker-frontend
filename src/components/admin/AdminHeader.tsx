"use client";

import { Box, Button, Flex, HStack, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { LuLogOut, LuShield } from "react-icons/lu";
import { toaster } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";

export default function AdminHeader() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toaster.create({
      title: "Signed out",
      description: "You have been signed out successfully.",
      type: "success",
    });
    router.push("/signin");
  }

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
            bg="green.subtle"
            color="green.fg"
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

        <Button variant="outline" borderRadius="lg" onClick={handleSignOut}>
          <LuLogOut />
          Sign Out
        </Button>
      </Flex>
    </Box>
  );
}
