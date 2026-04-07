"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, Box, Icon, Text } from "@chakra-ui/react";
import { signOutAndRedirect } from "@/lib/auth-helpers";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import BaseSidebar from "@/components/shared/BaseSidebar";
import type { NavItem } from "@/components/shared/BaseSidebar";
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
import { HStack } from "@chakra-ui/react";

const navItems: NavItem[] = [
  { icon: LuLayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: LuBookOpen, label: "Courses", href: "/dashboard/courses" },
  { icon: LuTarget, label: "Requirements", href: "/dashboard/requirements" },
  { icon: LuCalendar, label: "Planner", href: "/dashboard/planner" },
];

export default function DashboardSidebar() {
  const router = useRouter();
  const { userName, avatarUrl } = useUserProfile({ includeAvatar: true });
  const handleSignOut = () => signOutAndRedirect(router.push);

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

  const mobileTrailing = (
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
  );

  const desktopBottom = (
    <Box p="3" borderTopWidth="1px" borderColor="border.subtle">
      {accountMenu}
    </Box>
  );

  return (
    <BaseSidebar
      navItems={navItems}
      logoIcon={LuGraduationCap}
      logoText="GradTracker"
      desktopBottom={desktopBottom}
      mobileTrailing={mobileTrailing}
    />
  );
}
