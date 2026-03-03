"use client";

import { useEffect, useState } from "react";
import { Avatar, Box, Circle, Flex, HStack, IconButton } from "@chakra-ui/react";
import { LuBell } from "react-icons/lu";
import { ColorModeButton } from "@/components/ui/color-mode";
import { createClient } from "@/lib/supabase/client";

export default function DashboardHeader() {
  const [userName, setUserName] = useState("");

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata) {
        const { first_name, last_name } = user.user_metadata;
        setUserName([first_name, last_name].filter(Boolean).join(" "));
      }
    }
    loadUser();
  }, []);

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
      <Flex justify="flex-end" align="center" px={{ base: "4", md: "8" }} py="3">
        <HStack gap="3">
          <IconButton aria-label="Notifications" variant="ghost" size="sm" position="relative">
            <LuBell />
            <Circle size="2" bg="red.500" position="absolute" top="1.5" right="1.5" />
          </IconButton>
          <ColorModeButton variant="ghost" size="sm" />
          <Avatar.Root size="sm">
            <Avatar.Fallback name={userName || "User"} />
          </Avatar.Root>
        </HStack>
      </Flex>
    </Box>
  );
}