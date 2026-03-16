"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { LuBookMarked, LuBlocks, LuLayoutDashboard, LuShield } from "react-icons/lu";

const navItems = [
  { icon: LuLayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: LuBookMarked, label: "Programs", href: "/admin/programs" },
  { icon: LuBlocks, label: "Gen-Ed", href: "/admin/gen-ed" },
];

export default function AdminSidebar() {
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
      <HStack gap="3" px="6" py="5" borderBottomWidth="1px" borderColor="border.subtle">
        <Box p="2" bg="green.solid" borderRadius="lg">
          <Icon color="white" boxSize="5">
            <LuShield />
          </Icon>
        </Box>
        <Box>
          <Text fontWeight="700" fontSize="lg" fontFamily="var(--font-outfit), sans-serif">
            GradTracker
          </Text>
          <Text fontSize="xs" color="fg.muted">
            Advisor Console
          </Text>
        </Box>
      </HStack>

      <VStack align="stretch" flex="1" py="4" px="3" gap="1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
    </Box>
  );
}
