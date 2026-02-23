"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import {
  LuLayoutDashboard,
  LuBookOpen,
  LuTarget,
  LuCalendar,
  LuFileText,
  LuGraduationCap,
  LuSettings,
  LuLogOut,
} from "react-icons/lu";

const navItems = [
  { icon: LuLayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: LuBookOpen, label: "Courses", href: "/dashboard/courses" },
  { icon: LuTarget, label: "Requirements", href: "/dashboard/requirements" },
  { icon: LuCalendar, label: "Planner", href: "/dashboard/planner" },
  { icon: LuFileText, label: "Reports", href: "/dashboard/reports" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
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
        <Box p="2" bg="green.solid" borderRadius="lg">
          <Icon color="white" boxSize="5">
            <LuGraduationCap />
          </Icon>
        </Box>
        <Text fontWeight="700" fontSize="lg" fontFamily="'DM Serif Display', serif">
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
                bg={active ? "green.subtle" : "transparent"}
                color={active ? "green.fg" : "fg.muted"}
                fontWeight={active ? "600" : "500"}
                _hover={{
                  bg: active ? "green.subtle" : "bg.subtle",
                  color: active ? "green.fg" : "fg",
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
          px="4"
          py="2.5"
          borderRadius="lg"
          cursor="pointer"
          color="fg.muted"
          fontWeight="500"
          _hover={{ bg: "red.subtle", color: "red.fg" }}
          transition="all 0.15s"
        >
          <Icon boxSize="5">
            <LuLogOut />
          </Icon>
          <Text fontSize="sm">Sign Out</Text>
        </HStack>
      </VStack>
    </Box>
  );
}