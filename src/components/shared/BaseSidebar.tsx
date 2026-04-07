"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, HStack, Icon, Text, VStack } from "@chakra-ui/react";

export interface NavItem {
  icon: React.ComponentType;
  label: string;
  href: string;
}

export interface BaseSidebarProps {
  navItems: NavItem[];
  logoIcon: React.ComponentType;
  logoText: string;
  logoSubtext?: string;
  logoColor?: string;
  desktopBottom?: React.ReactNode;
  mobileTrailing?: React.ReactNode;
  isActive?: (href: string, pathname: string) => boolean;
}

function defaultIsActive(href: string, pathname: string): boolean {
  return pathname === href;
}

export default function BaseSidebar({
  navItems,
  logoIcon: LogoIcon,
  logoText,
  logoSubtext,
  logoColor = "blue.solid",
  desktopBottom,
  mobileTrailing,
  isActive: isActiveProp,
}: BaseSidebarProps) {
  const pathname = usePathname();
  const isActive = isActiveProp ?? defaultIsActive;

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
        {/* Logo icon */}
        <Box p="1.5" bg={logoColor} borderRadius="md" flexShrink={0} mr="1">
          <Icon color="white" boxSize="4"><LogoIcon /></Icon>
        </Box>

        {/* Nav items */}
        {navItems.map((item) => {
          const active = isActive(item.href, pathname);
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
                <Icon boxSize="4"><item.icon /></Icon>
                <Text fontSize="2xs" fontWeight={active ? "600" : "500"} whiteSpace="nowrap">
                  {item.label}
                </Text>
              </VStack>
            </Link>
          );
        })}

        <Box flex="1" flexShrink={0} minW="2" />

        {/* Mobile trailing content (e.g. sign-out button, avatar menu) */}
        {mobileTrailing}
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
        {/* Logo header */}
        <HStack gap="3" px="6" py="5" borderBottomWidth="1px" borderColor="border.subtle">
          <Box p="2" bg={logoColor} borderRadius="lg">
            <Icon color="white" boxSize="5"><LogoIcon /></Icon>
          </Box>
          <Box>
            <Text fontWeight="700" fontSize="lg" fontFamily="var(--font-dm-sans), sans-serif">
              {logoText}
            </Text>
            {logoSubtext && (
              <Text fontSize="xs" color="fg.muted">
                {logoSubtext}
              </Text>
            )}
          </Box>
        </HStack>

        {/* Navigation */}
        <VStack align="stretch" flex="1" py="4" px="3" gap="1">
          {navItems.map((item) => {
            const active = isActive(item.href, pathname);
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
                  <Icon boxSize="5"><item.icon /></Icon>
                  <Text fontSize="sm">{item.label}</Text>
                </HStack>
              </Link>
            );
          })}
        </VStack>

        {/* Desktop bottom section */}
        {desktopBottom}
      </Box>
    </>
  );
}
