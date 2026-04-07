"use client";

import React from "react";
import { Box, Flex } from "@chakra-ui/react";

interface LayoutShellProps {
  sidebar: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
}

export default function LayoutShell({ sidebar, header, children }: LayoutShellProps) {
  return (
    <Box minH="100vh" bg="bg" fontFamily="var(--font-dm-sans), sans-serif">
      <Flex>
        {sidebar}
        <Box
          flex="1"
          ml={{ base: "0", lg: "260px" }}
          pt={{ base: "56px", lg: "0" }}
          minH="100vh"
          position="relative"
          className="mesh-gradient-subtle"
        >
          {header}
          <Box px={{ base: "4", md: "8" }} py="6" position="relative" zIndex="1">
            {children}
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}
