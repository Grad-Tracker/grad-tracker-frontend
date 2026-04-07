"use client";

import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  HStack,
  Icon,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ColorModeButton } from "@/components/ui/color-mode";
import { Field } from "@/components/ui/field";
import { toaster } from "@/components/ui/toaster";
import { LuGraduationCap, LuArrowLeft, LuLoader, LuMail } from "react-icons/lu";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email) {
      toaster.create({
        title: "Missing email",
        description: "Please enter your email address.",
        type: "error",
      });
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);

    if (error) {
      toaster.create({
        title: "Something went wrong",
        description: error.message,
        type: "error",
      });
      return;
    }

    setSent(true);
    toaster.create({
      title: "Check your email",
      description: "We sent you a password reset link.",
      type: "success",
    });
  }

  return (
    <Box
      minH="100vh"
      fontFamily="var(--font-dm-sans), sans-serif"
      position="relative"
    >
      {/* Navigation Header */}
      <Box
        as="header"
        position="sticky"
        top="0"
        zIndex="sticky"
        className="glass-card"
        borderBottomWidth="1px"
        borderColor="border.subtle"
      >
        <Container maxW="7xl" mx="auto" px={{ base: "4", md: "6", lg: "8" }}>
          <HStack justify="space-between" py="4">
            <Link href="/">
              <HStack gap="3" cursor="pointer">
                <Box
                  p="2"
                  bg="blue.solid"
                  borderRadius="lg"
                  className="animate-pulse-glow"
                >
                  <Icon color="white" boxSize="5">
                    <LuGraduationCap />
                  </Icon>
                </Box>
                <Text
                  fontWeight="700"
                  fontSize="xl"
                  fontFamily="var(--font-dm-sans), sans-serif"
                  letterSpacing="-0.02em"
                >
                  GradTracker
                </Text>
                <Badge
                  colorPalette="blue"
                  variant="surface"
                  size="sm"
                  fontWeight="500"
                >
                  Parkside
                </Badge>
              </HStack>
            </Link>
            <HStack gap="3">
              <ColorModeButton variant="ghost" size="sm" />
            </HStack>
          </HStack>
        </Container>
      </Box>

      {/* Forgot Password Section */}
      <Box
        className="mesh-gradient noise-overlay"
        py={{ base: "16", md: "24" }}
        minH="calc(100vh - 73px)"
        display="flex"
        alignItems="center"
        position="relative"
        overflow="hidden"
      >
        {/* Decorative elements */}
        <Box
          position="absolute"
          top="-20%"
          right="-10%"
          w="500px"
          h="500px"
          bg="blue.500"
          opacity="0.05"
          borderRadius="full"
          filter="blur(100px)"
        />
        <Box
          position="absolute"
          bottom="-30%"
          left="-10%"
          w="400px"
          h="400px"
          bg="teal.500"
          opacity="0.05"
          borderRadius="full"
          filter="blur(80px)"
        />

        <Container maxW="md" position="relative" zIndex="2">
          <Box position="relative">
            {/* Glow effect */}
            <Box
              position="absolute"
              inset="-4"
              bg="blue.500"
              opacity="0.15"
              borderRadius="3xl"
              filter="blur(40px)"
            />

            <Card.Root
              bg="bg"
              p={{ base: "6", md: "10" }}
              borderRadius="3xl"
              boxShadow="2xl"
              borderWidth="1px"
              borderColor="border.subtle"
              position="relative"
              overflow="hidden"
            >
              {/* Subtle gradient overlay */}
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                h="1px"
                bgGradient="to-r"
                gradientFrom="transparent"
                gradientVia="blue.500"
                gradientTo="transparent"
              />

              <Card.Body p="0">
                <VStack gap="6" align="stretch">
                  <VStack gap="2" textAlign="center">
                    <Text
                      fontWeight="700"
                      fontSize="2xl"
                      fontFamily="var(--font-dm-sans), sans-serif"
                      letterSpacing="-0.02em"
                    >
                      Reset Your Password
                    </Text>
                    <Text color="fg.muted" fontSize="sm">
                      {sent
                        ? "Check your inbox for a reset link. You can close this page."
                        : "Enter your email and we'll send you a link to reset your password."}
                    </Text>
                  </VStack>

                  {sent ? (
                    <VStack gap="4" py="4">
                      <Box
                        p="4"
                        bg="blue.500"
                        opacity="0.9"
                        borderRadius="full"
                      >
                        <Icon color="white" boxSize="8">
                          <LuMail />
                        </Icon>
                      </Box>
                      <Text fontSize="sm" color="fg.muted" textAlign="center">
                        Didn&apos;t get the email? Check your spam folder or try again.
                      </Text>
                      <Button
                        variant="outline"
                        colorPalette="blue"
                        size="sm"
                        onClick={() => setSent(false)}
                      >
                        Try again
                      </Button>
                    </VStack>
                  ) : (
                    <>
                      <Field label="Email">
                        <Input
                          placeholder="your.name@uwp.edu"
                          type="email"
                          rounded="lg"
                          size="lg"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </Field>

                      <Button
                        w="full"
                        colorPalette="blue"
                        size="lg"
                        rounded="lg"
                        fontWeight="600"
                        _hover={{
                          transform: "translateY(-2px)",
                          boxShadow: "lg",
                        }}
                        transition="all 0.2s"
                        onClick={handleReset}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Icon className="animate-spin" mr="2">
                              <LuLoader />
                            </Icon>
                            Sending...
                          </>
                        ) : (
                          "Send Reset Link"
                        )}
                      </Button>
                    </>
                  )}

                  <Link href="/signin">
                    <HStack
                      gap="1"
                      justify="center"
                      color="blue.solid"
                      fontWeight="600"
                      fontSize="sm"
                      cursor="pointer"
                      _hover={{ textDecoration: "underline" }}
                    >
                      <Icon>
                        <LuArrowLeft />
                      </Icon>
                      <Text>Back to sign in</Text>
                    </HStack>
                  </Link>
                </VStack>
              </Card.Body>
            </Card.Root>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}