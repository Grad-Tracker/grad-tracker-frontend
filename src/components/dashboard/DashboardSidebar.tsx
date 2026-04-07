"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Box, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { toaster } from "@/components/ui/toaster";
import {
  LuLayoutDashboard,
  LuBookOpen,
  LuTarget,
  LuCalendar,
  LuGraduationCap,
  LuSettings,
  LuLogOut,
} from "react-icons/lu";

const navItems = [
  { icon: LuLayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: LuBookOpen, label: "Courses", href: "/dashboard/courses" },
  { icon: LuTarget, label: "Requirements", href: "/dashboard/requirements" },
  { icon: LuCalendar, label: "Planner", href: "/dashboard/planner" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
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

        {/* Settings */}
        <Link href="/dashboard/settings" aria-label="Open settings" style={{ textDecoration: "none", flexShrink: 0 }}>
          <Box
            px="2.5"
            py="1.5"
            borderRadius="md"
            color="fg.muted"
            _hover={{ bg: "bg.subtle", color: "fg" }}
            transition="all 0.15s"
          >
            <Icon boxSize="4.5">
              <LuSettings />
            </Icon>
          </Box>
        </Link>

        {/* Sign Out */}
        <Box
          as="button"
          aria-label="Sign out"
          px="2.5"
          py="1.5"
          borderRadius="md"
          color="fg.muted"
          cursor="pointer"
          flexShrink={0}
          _hover={{ bg: "red.subtle", color: "red.fg" }}
          transition="all 0.15s"
          onClick={handleSignOut}
        >
          <Icon boxSize="4.5">
            <LuLogOut />
          </Icon>
        </Box>
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

      {/* Bottom section */}
      <VStack align="stretch" p="4" gap="2" borderTopWidth="1px" borderColor="border.subtle">
        <Link href="/dashboard/settings" style={{ textDecoration: "none" }}>
          <HStack
            px="4"
            py="2.5"
            borderRadius="lg"
            cursor="pointer"
            color="fg.muted"
            fontWeight="500"
            _hover={{ bg: "bg.subtle", color: "fg" }}
            transition="all 0.15s"
          >
            <Icon boxSize="5">
              <LuSettings />
            </Icon>
            <Text fontSize="sm">Settings</Text>
          </HStack>
        </Link>

        <HStack
          as="button"
          aria-label="Sign out"
          px="4"
          py="2.5"
          borderRadius="lg"
          cursor="pointer"
          color="fg.muted"
          fontWeight="500"
          _hover={{ bg: "red.subtle", color: "red.fg" }}
          transition="all 0.15s"
          onClick={handleSignOut}
        >
          <Icon boxSize="5">
            <LuLogOut />
          </Icon>
          <Text fontSize="sm">Sign Out</Text>
        </HStack>
      </VStack>
    </Box>
    </>
  );
}
