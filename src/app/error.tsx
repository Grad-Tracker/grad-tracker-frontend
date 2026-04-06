"use client";

import {
  Box,
  Button,
  Container,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuTriangleAlert, LuRefreshCw, LuHouse } from "react-icons/lu";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Box
      minH="100vh"
      fontFamily="var(--font-plus-jakarta), sans-serif"
      display="flex"
      alignItems="center"
      justifyContent="center"
      position="relative"
      overflow="hidden"
    >
      {/* Decorative blur */}
      <Box
        position="absolute"
        top="-20%"
        right="-10%"
        w="500px"
        h="500px"
        bg="red.subtle"
        opacity="0.05"
        borderRadius="full"
        filter="blur(100px)"
      />

      <Container maxW="md">
        <VStack gap="6" textAlign="center">
          <Box
            p="4"
            bg="red.subtle"
            borderRadius="full"
          >
            <Icon boxSize="10" color="red.solid">
              <LuTriangleAlert />
            </Icon>
          </Box>

          <VStack gap="2">
            <Text
              fontWeight="700"
              fontSize="2xl"
              fontFamily="var(--font-outfit), sans-serif"
              letterSpacing="-0.02em"
            >
              Something went wrong
            </Text>
            <Text color="fg.muted" fontSize="sm" maxW="sm">
              An unexpected error occurred. You can try again, or head back to
              the home page.
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
            <Link href="/" style={{ width: "100%" }}>
              <Button
                w="full"
                variant="outline"
                size="lg"
                rounded="lg"
                fontWeight="600"
              >
                <Icon mr="2">
                  <LuHouse />
                </Icon>
                Back to Home
              </Button>
            </Link>
          </VStack>
        </VStack>
      </Container>
    </Box>
  );
}