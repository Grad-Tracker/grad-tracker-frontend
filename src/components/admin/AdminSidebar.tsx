"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Box, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { createClient } from "@/lib/supabase/client";
import { toaster } from "@/components/ui/toaster";
import {
  LuBookMarked,
  LuBlocks,
  LuBookOpen,
  LuLayoutDashboard,
  LuLogOut,
  LuShield,
} from "react-icons/lu";

const navItems = [
  { icon: LuLayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: LuBookOpen,        label: "Courses",   href: "/admin/courses" },
  { icon: LuBookMarked,      label: "Programs",  href: "/admin/programs" },
  { icon: LuBlocks,          label: "Gen-Ed",    href: "/admin/gen-ed" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toaster.create({
      title: "Signed out",
      description: "You have been signed out successfully.",
      type: "success",
    });
    router.push("/signin");
  }

  return (
    <>
      {/* Mobile top nav */}
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
        <Box p="1.5" bg="green.solid" borderRadius="md" flexShrink={0} mr="1">
          <Icon color="white" boxSize="4"><LuShield /></Icon>
        </Box>

        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.label} href={item.href} style={{ textDecoration: "none", flexShrink: 0 }}>
              <VStack
                gap="0.5"
                px="2.5"
                py="1"
                borderRadius="md"
                bg={active ? "green.subtle" : "transparent"}
                color={active ? "green.fg" : "fg.muted"}
                align="center"
                transition="all 0.15s"
                _hover={{ bg: active ? "green.subtle" : "bg.subtle", color: active ? "green.fg" : "fg" }}
              >
                <Icon boxSize="4"><item.icon /></Icon>
                <Text fontSize="2xs" fontWeight={active ? "600" : "500"} whiteSpace="nowrap">
                  {item.label}
                </Text>
              </VStack>
            </Link>
          );
        })}

        <Box flex="1" />

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
      </Box>

      {/* Desktop sidebar */}
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
            <Icon color="white" boxSize="5"><LuShield /></Icon>
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
            const active = isActive(item.href);
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
                  <Icon boxSize="5"><item.icon /></Icon>
                  <Text fontSize="sm">{item.label}</Text>
                </HStack>
              </Link>
            );
          })}
        </VStack>

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
      </Box>
    </>
  );
}
