import {
  Box,
  Button,
  Container,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuSearchX, LuHouse, LuArrowLeft } from "react-icons/lu";
import Link from "next/link";

export default function NotFound() {
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
        bottom="-30%"
        left="-10%"
        w="400px"
        h="400px"
        bg="green.500"
        opacity="0.05"
        borderRadius="full"
        filter="blur(80px)"
      />

      <Container maxW="md">
        <VStack gap="6" textAlign="center">
          <Box p="4" bg="bg.subtle" borderRadius="full">
            <Icon boxSize="10" color="fg.muted">
              <LuSearchX />
            </Icon>
          </Box>

          <VStack gap="2">
            <Text
              fontWeight="800"
              fontSize="6xl"
              fontFamily="var(--font-outfit), sans-serif"
              letterSpacing="-0.04em"
              color="fg.subtle"
              lineHeight="1"
            >
              404
            </Text>
            <Text
              fontWeight="700"
              fontSize="2xl"
              fontFamily="var(--font-outfit), sans-serif"
              letterSpacing="-0.02em"
            >
              Page not found
            </Text>
            <Text color="fg.muted" fontSize="sm" maxW="sm">
              The page you&apos;re looking for doesn&apos;t exist or has been
              moved.
            </Text>
          </VStack>

          <VStack gap="3" w="full" maxW="xs">
            <Link href="/" style={{ width: "100%" }}>
              <Button
                w="full"
                colorPalette="green"
                size="lg"
                rounded="lg"
                fontWeight="600"
                _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
                transition="all 0.2s"
              >
                <Icon mr="2">
                  <LuHouse />
                </Icon>
                Back to Home
              </Button>
            </Link>
            <Link href="/dashboard" style={{ width: "100%" }}>
              <Button
                w="full"
                variant="outline"
                size="lg"
                rounded="lg"
                fontWeight="600"
              >
                <Icon mr="2">
                  <LuArrowLeft />
                </Icon>
                Go to Dashboard
              </Button>
            </Link>
          </VStack>
        </VStack>
      </Container>
    </Box>
  );
}
