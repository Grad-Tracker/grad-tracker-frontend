"use client";

import { useEffect, useState } from "react";
import { Avatar, Box, Circle, Flex, HStack, IconButton } from "@chakra-ui/react";
import { LuBell } from "react-icons/lu";
import { ColorModeButton } from "@/components/ui/color-mode";
import { createClient } from "@/lib/supabase/client";
import { DB_TABLES, STUDENT_COLUMNS } from "@/lib/supabase/queries/schema";

const PROFILE_IMAGE_BUCKET = "profile-images";
const STAFF_TABLE = "staff";

export default function DashboardHeader() {
  const [userName, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    const loadAvatarSignedUrl = async (path: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(PROFILE_IMAGE_BUCKET)
        .createSignedUrl(path, 60 * 60);

      if (error) throw error;
      return data.signedUrl;
    };

    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { first_name, last_name } = user.user_metadata ?? {};
      const fallbackName = [first_name, last_name].filter(Boolean).join(" ").trim();
      setUserName(fallbackName);

      const { data: student } = await supabase
        .from(DB_TABLES.students)
        .select("first_name, last_name, avatar_path")
        .eq(STUDENT_COLUMNS.authUserId, user.id)
        .maybeSingle();

      if (student) {
        const studentName = [student.first_name, student.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();

        setUserName(studentName || fallbackName);

        if (student.avatar_path) {
          try {
            setAvatarUrl(await loadAvatarSignedUrl(student.avatar_path));
          } catch {
            setAvatarUrl("");
          }
        }

        return;
      }

      const { data: staff } = await supabase
        .from(STAFF_TABLE)
        .select("first_name, last_name, avatar_path")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (staff) {
        const staffName = [staff.first_name, staff.last_name].filter(Boolean).join(" ").trim();
        setUserName(staffName || fallbackName);

        if (staff.avatar_path) {
          try {
            setAvatarUrl(await loadAvatarSignedUrl(staff.avatar_path));
          } catch {
            setAvatarUrl("");
          }
        }
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
            {avatarUrl ? <Avatar.Image src={avatarUrl} alt={userName || "User"} /> : null}
          </Avatar.Root>
        </HStack>
      </Flex>
    </Box>
  );
}
