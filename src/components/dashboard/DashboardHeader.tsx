"use client";

import { Avatar, Box, Icon, Text } from "@chakra-ui/react";
import { LuLogOut, LuSettings } from "react-icons/lu";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAtlasPanel } from "@/contexts/AtlasPanelContext";
import { signOutAndRedirect } from "@/lib/auth-helpers";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import {
  MenuContent,
  MenuItem,
  MenuItemText,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

export default function DashboardHeader() {
  const router = useRouter();
  const { isOpen: atlasPanelOpen } = useAtlasPanel();
  const { userName, avatarUrl } = useUserProfile({ includeAvatar: true });
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
