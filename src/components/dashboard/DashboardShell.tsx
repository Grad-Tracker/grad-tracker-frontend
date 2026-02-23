"use client";

import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <Box minH="100vh" bg="bg" fontFamily="'Plus Jakarta Sans', sans-serif">
      <Flex>
        <DashboardSidebar />

        <Box
          flex="1"
          ml={{ base: "0", lg: "260px" }}
          minH="100vh"
          className="mesh-gradient-subtle"
        >
          <DashboardHeader />
          <Box px={{ base: "4", md: "8" }} py="6">
            {children}
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}