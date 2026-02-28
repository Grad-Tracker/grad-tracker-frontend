"use client";

import { useEffect, useState } from "react";
import { Avatar, Box, Circle, Flex, Heading, HStack, IconButton, Text } from "@chakra-ui/react";
import { LuBell } from "react-icons/lu";
import { ColorModeButton } from "@/components/ui/color-mode";
import { createClient } from "@/lib/supabase/client";
import { DB_TABLES, STUDENT_COLUMNS } from "@/lib/supabase/queries/schema";

export default function DashboardHeader() {
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    async function loadName() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: student } = await supabase
        .from(DB_TABLES.students)
        .select("first_name, last_name")
        .eq(STUDENT_COLUMNS.authUserId, user.id)
        .maybeSingle();

      if (student) {
        const name = [student.first_name, student.last_name].filter(Boolean).join(" ").trim();
        if (name) setFullName(name);
      }
    }
    loadName();
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
            <Avatar.Fallback name={fullName || "?"} />
          </Avatar.Root>
        </HStack>
      </Flex>
    </Box>
  );
}