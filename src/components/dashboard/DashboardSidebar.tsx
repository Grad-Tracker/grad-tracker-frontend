"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, Box, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { toaster } from "@/components/ui/toaster";
import { DB_TABLES, STUDENT_COLUMNS } from "@/lib/supabase/queries/schema";
import {
  MenuContent,
  MenuItem,
  MenuItemText,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  LuLayoutDashboard,
  LuBookOpen,
  LuTarget,
  LuCalendar,
  LuGraduationCap,
  LuSettings,
  LuLogOut,
} from "react-icons/lu";

const PROFILE_IMAGE_BUCKET = "profile-images";
const STAFF_TABLE = "staff";

const navItems = [
  { icon: LuLayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: LuBookOpen, label: "Courses", href: "/dashboard/courses" },
  { icon: LuTarget, label: "Requirements", href: "/dashboard/requirements" },
  { icon: LuCalendar, label: "Planner", href: "/dashboard/planner" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

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
            const { data, error } = await supabase.storage
              .from(PROFILE_IMAGE_BUCKET)
              .createSignedUrl(student.avatar_path, 60 * 60);
            if (!error) setAvatarUrl(data.signedUrl);
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
            const { data, error } = await supabase.storage
              .from(PROFILE_IMAGE_BUCKET)
              .createSignedUrl(staff.avatar_path, 60 * 60);
            if (!error) setAvatarUrl(data.signedUrl);
          } catch {
            setAvatarUrl("");
          }
        }
      }
    }

    loadUser();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toaster.create({
      title: "Signed out",
      description: "You've been signed out successfully.",
      type: "success",
    });
    router.push("/signin");
  }

  const accountMenu = (
    <MenuRoot positioning={{ placement: "top-start" }}>
      <MenuTrigger asChild>
        <HStack
          gap="3"
          px="4"
          py="2.5"
          borderRadius="lg"
          cursor="pointer"
          color="fg.muted"
          _hover={{ bg: "bg.subtle", color: "fg" }}
          transition="all 0.15s"
        >
          <Avatar.Root size="xs">
            <Avatar.Fallback name={userName || "User"} />
            {avatarUrl ? <Avatar.Image src={avatarUrl} alt={userName || "User"} /> : null}
          </Avatar.Root>
          <Text fontSize="sm" fontWeight="500" truncate>
            {userName || "Account"}
          </Text>
        </HStack>
      </MenuTrigger>
      <MenuContent
        minW="200px"
        borderRadius="xl"
        p="1"
        bg="bg"
        borderWidth="1px"
        borderColor="border.subtle"
        boxShadow="lg"
      >
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
  );

  return (
    <>
      {/* ── Mobile top nav (hidden on lg+) ───────────────────────────── */}
      <Box
        as="nav"
        display={{ base: "flex", lg: "none" }}
        position="fixed"
        top="0"
        left="0"
        right="0"
        zIndex="sticky"
        bg="bg"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        h="56px"
        px="3"
        alignItems="center"
        gap="1"
        overflowX="auto"
        css={{ "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}
      >
        {/* Logo icon */}
        <Box p="1.5" bg="blue.solid" borderRadius="md" flexShrink={0} mr="1">
          <Icon color="white" boxSize="4">
            <LuGraduationCap />
          </Icon>
        </Box>

        {/* Nav items */}
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.label} href={item.href} style={{ textDecoration: "none", flexShrink: 0 }}>
              <VStack
                gap="0.5"
                px="2.5"
                py="1"
                borderRadius="md"
                bg={active ? "blue.subtle" : "transparent"}
                color={active ? "blue.fg" : "fg.muted"}
                align="center"
                transition="all 0.15s"
                _hover={{ bg: active ? "blue.subtle" : "bg.subtle", color: active ? "blue.fg" : "fg" }}
              >
                <Icon boxSize="4">
                  <item.icon />
                </Icon>
                <Text fontSize="2xs" fontWeight={active ? "600" : "500"} whiteSpace="nowrap">
                  {item.label}
                </Text>
              </VStack>
            </Link>
          );
        })}

        <Box flex="1" flexShrink={0} minW="2" />

        {/* Mobile account avatar */}
        <MenuRoot positioning={{ placement: "bottom-end" }}>
          <MenuTrigger asChild>
            <Box cursor="pointer" borderRadius="full" flexShrink={0}>
              <Avatar.Root size="xs">
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
          >
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

      {/* ── Desktop sidebar (hidden below lg) ────────────────────────── */}
      <Box
        as="aside"
        w="260px"
        minH="100vh"
        bg="bg"
        borderRightWidth="1px"
        borderColor="border.subtle"
        position="fixed"
        left="0"
        top="0"
        display={{ base: "none", lg: "flex" }}
        flexDirection="column"
      >
        {/* Logo */}
        <HStack gap="3" px="6" py="5" borderBottomWidth="1px" borderColor="border.subtle">
          <Box p="2" bg="blue.solid" borderRadius="lg">
            <Icon color="white" boxSize="5">
              <LuGraduationCap />
            </Icon>
          </Box>
          <Text fontWeight="700" fontSize="lg" fontFamily="var(--font-dm-sans), sans-serif">
            GradTracker
          </Text>
        </HStack>

        {/* Navigation */}
        <VStack align="stretch" flex="1" py="4" px="3" gap="1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.label} href={item.href} style={{ textDecoration: "none" }}>
                <HStack
                  px="4"
                  py="2.5"
                  borderRadius="lg"
                  cursor="pointer"
                  bg={active ? "blue.subtle" : "transparent"}
                  color={active ? "blue.fg" : "fg.muted"}
                  fontWeight={active ? "600" : "500"}
                  _hover={{
                    bg: active ? "blue.subtle" : "bg.subtle",
                    color: active ? "blue.fg" : "fg",
                  }}
                  transition="all 0.15s"
                >
                  <Icon boxSize="5">
                    <item.icon />
                  </Icon>
                  <Text fontSize="sm">{item.label}</Text>
                </HStack>
              </Link>
            );
          })}
        </VStack>

        {/* Account */}
        <Box p="3" borderTopWidth="1px" borderColor="border.subtle">
          {accountMenu}
        </Box>
      </Box>
    </>
  );
}
