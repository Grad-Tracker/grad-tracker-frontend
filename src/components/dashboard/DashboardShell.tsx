"use client";

import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { AtlasPanelProvider } from "@/contexts/AtlasPanelContext";
import AtlasPanel from "@/components/dashboard/AtlasPanel";
import AtlasFAB from "@/components/dashboard/AtlasFAB";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AtlasPanelProvider>
      <Box minH="100vh" bg="bg" fontFamily="var(--font-dm-sans), sans-serif">
        <Flex>
          <DashboardSidebar />

          <Box
            flex="1"
            ml={{ base: "0", lg: "260px" }}
            pt={{ base: "56px", lg: "0" }}
            minH="100vh"
            position="relative"
            className="mesh-gradient-subtle"
          >
            <Box px={{ base: "4", md: "8" }} py="6" position="relative" zIndex="1">
              {children}
            </Box>
          </Box>
        </Flex>
      </Box>

      <AtlasPanel />
      <AtlasFAB />
    </AtlasPanelProvider>
  );
}
