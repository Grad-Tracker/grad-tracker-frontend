"use client";

import {
  Box,
  Button,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuTriangleAlert, LuRefreshCw, LuLayoutDashboard } from "react-icons/lu";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Box
      flex="1"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p="8"
    >
      <VStack gap="6" textAlign="center" maxW="md">
        <Box p="4" bg="red.subtle" borderRadius="full">
          <Icon boxSize="8" color="red.solid">
            <LuTriangleAlert />
          </Icon>
        </Box>

        <VStack gap="2">
          <Text
            fontWeight="700"
            fontSize="xl"
            fontFamily="var(--font-outfit), sans-serif"
            letterSpacing="-0.02em"
          >
            Something went wrong
          </Text>
          <Text color="fg.muted" fontSize="sm" maxW="sm">
            There was a problem loading this page. Try again, or head back to
            the dashboard overview.
          </Text>
          {error.digest && (
            <Text color="fg.subtle" fontSize="xs" fontFamily="mono">
              Error ID: {error.digest}
            </Text>
          )}
        </VStack>

        <VStack gap="3" w="full" maxW="xs">
          <Button
            w="full"
            colorPalette="green"
            size="lg"
            rounded="lg"
            fontWeight="600"
            onClick={reset}
            _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
            transition="all 0.2s"
          >
            <Icon mr="2">
              <LuRefreshCw />
            </Icon>
            Try Again
          </Button>
          <Link href="/dashboard" style={{ width: "100%" }}>
            <Button
              w="full"
              variant="outline"
              size="lg"
              rounded="lg"
              fontWeight="600"
            >
              <Icon mr="2">
                <LuLayoutDashboard />
              </Icon>
              Dashboard Overview
            </Button>
          </Link>
        </VStack>
      </VStack>
    </Box>
  );
}
