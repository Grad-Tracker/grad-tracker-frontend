"use client";

import { useEffect, useState } from "react";
import { Avatar, Box, Icon, Text } from "@chakra-ui/react";
import { LuLogOut, LuSettings } from "react-icons/lu";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAtlasPanel } from "@/contexts/AtlasPanelContext";
import { createClient } from "@/lib/supabase/client";
import { signOutAndRedirect } from "@/lib/auth-helpers";
import { DB_TABLES, STUDENT_COLUMNS } from "@/lib/supabase/queries/schema";
import {
  MenuContent,
  MenuItem,
  MenuItemText,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

const PROFILE_IMAGE_BUCKET = "profile-images";
const STAFF_TABLE = "staff";

export default function DashboardHeader() {
  const router = useRouter();
  const { isOpen: atlasPanelOpen } = useAtlasPanel();
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

  const handleSignOut = () => signOutAndRedirect(router.push);

  return (
    <Box
      position="fixed"
      top={{ base: "68px", lg: "16px" }}
      right={{ base: "16px", lg: "24px" }}
      zIndex="popover"
      display={atlasPanelOpen ? "none" : "block"}
    >
      <MenuRoot positioning={{ placement: "bottom-end" }}>
        <MenuTrigger asChild>
          <Box cursor="pointer" borderRadius="full" transition="all 0.15s" _hover={{ opacity: 0.8 }}>
            <Avatar.Root size="sm">
              <Avatar.Fallback name={userName || "User"} />
              {avatarUrl ? <Avatar.Image src={avatarUrl} alt={userName || "User"} /> : null}
            </Avatar.Root>
          </Box>
        </MenuTrigger>
        <MenuContent
          minW="200px"
          borderRadius="xl"
          p="1"
          bg="bg"
          borderWidth="1px"
          borderColor="border.subtle"
          boxShadow="lg"
          zIndex="popover"
        >
          {userName && (
            <>
              <Box px="3" py="2">
                <Text fontSize="sm" fontWeight="600" color="fg">
                  {userName}
                </Text>
              </Box>
              <MenuSeparator />
            </>
          )}
          <MenuItem value="settings" asChild borderRadius="lg" px="3" py="2" color="fg" _hover={{ bg: "bg.subtle" }}>
            <Link href="/dashboard/settings" style={{ textDecoration: "none" }}>
              <Icon boxSize="4" mr="2" color="fg.muted">
                <LuSettings />
              </Icon>
              <MenuItemText>Settings</MenuItemText>
            </Link>
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            value="sign-out"
            borderRadius="lg"
            px="3"
            py="2"
            color="red.fg"
            _hover={{ bg: "red.subtle" }}
            onClick={handleSignOut}
          >
            <Icon boxSize="4" mr="2">
              <LuLogOut />
            </Icon>
            <MenuItemText>Sign Out</MenuItemText>
          </MenuItem>
        </MenuContent>
      </MenuRoot>
    </Box>
  );
}
