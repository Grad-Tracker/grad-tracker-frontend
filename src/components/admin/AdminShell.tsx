"use client";

import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

export default function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Box minH="100vh" bg="bg" fontFamily="var(--font-dm-sans), sans-serif">
      <Flex>
        <AdminSidebar />
        <Box
          flex="1"
          ml={{ base: "0", lg: "260px" }}
          pt={{ base: "56px", lg: "0" }}
          minH="100vh"
          position="relative"
          className="mesh-gradient-subtle"
        >
          <AdminHeader />
          <Box px={{ base: "4", md: "8" }} py="6" position="relative" zIndex="1">
            {children}
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}
