"use client";

import { useRouter } from "next/navigation";
import { Box, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { signOutAndRedirect } from "@/lib/auth-helpers";
import BaseSidebar from "@/components/shared/BaseSidebar";
import type { NavItem } from "@/components/shared/BaseSidebar";
import {
  LuBookMarked,
  LuBlocks,
  LuBookOpen,
  LuLayoutDashboard,
  LuLogOut,
  LuShield,
  LuUsers,
} from "react-icons/lu";

const navItems: NavItem[] = [
  { icon: LuLayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: LuBookOpen,        label: "Courses",   href: "/admin/courses" },
  { icon: LuBookMarked,      label: "Programs",  href: "/admin/programs" },
  { icon: LuUsers,           label: "Students",  href: "/admin/students" },
  { icon: LuBlocks,          label: "Gen-Ed",    href: "/admin/gen-ed" },
];

function adminIsActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export default function AdminSidebar() {
  const router = useRouter();
  const handleSignOut = () => signOutAndRedirect(router.push);

  const mobileTrailing = (
    <Box
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
      <Icon boxSize="4.5"><LuLogOut /></Icon>
    </Box>
  );

  const desktopBottom = (
    <VStack align="stretch" p="4" gap="2" borderTopWidth="1px" borderColor="border.subtle">
      <HStack
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
        <Icon boxSize="5"><LuLogOut /></Icon>
        <Text fontSize="sm">Sign Out</Text>
      </HStack>
    </VStack>
  );

  return (
    <BaseSidebar
      navItems={navItems}
      logoIcon={LuShield}
      logoText="GradTracker"
      logoSubtext="Advisor Console"
      desktopBottom={desktopBottom}
      mobileTrailing={mobileTrailing}
      isActive={adminIsActive}
    />
  );
}
