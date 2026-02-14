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
  Text,
  VStack,
} from "@chakra-ui/react";
import { ColorModeButton } from "@/components/ui/color-mode";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { toaster } from "@/components/ui/toaster";
import { LuGraduationCap, LuLoader, LuCheck } from "react-icons/lu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpdatePassword() {
    if (!password || !confirmPassword) {
      toaster.create({
        title: "Missing fields",
        description: "Please fill in both password fields.",
        type: "error",
      });
      return;
    }

    if (password !== confirmPassword) {
      toaster.create({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        type: "error",
      });
      return;
    }

    if (password.length < 6) {
      toaster.create({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        type: "error",
      });
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      toaster.create({
        title: "Update failed",
        description: error.message,
        type: "error",
      });
      return;
    }

    toaster.create({
      title: "Password updated!",
      description: "Redirecting to your dashboard...",
      type: "success",
    });

    router.push("/dashboard");
  }

  return (
    <Box
      minH="100vh"
      fontFamily="'Plus Jakarta Sans', sans-serif"
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
                  bg="green.solid"
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
                  fontFamily="'DM Serif Display', serif"
                  letterSpacing="-0.02em"
                >
                  GradTracker
                </Text>
                <Badge
                  colorPalette="green"
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

      {/* Reset Password Section */}
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
          bg="green.500"
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
              bg="green.500"
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
                gradientVia="green.500"
                gradientTo="transparent"
              />

              <Card.Body p="0">
                <VStack gap="6" align="stretch">
                  <VStack gap="2" textAlign="center">
                    <Text
                      fontWeight="700"
                      fontSize="2xl"
                      fontFamily="'DM Serif Display', serif"
                      letterSpacing="-0.02em"
                    >
                      Set New Password
                    </Text>
                    <Text color="fg.muted" fontSize="sm">
                      Choose a strong password for your account
                    </Text>
                  </VStack>

                  <VStack gap="5">
                    <Field label="New Password">
                      <PasswordInput
                        placeholder="Enter new password"
                        rounded="lg"
                        size="lg"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </Field>

                    <Field label="Confirm New Password">
                      <PasswordInput
                        placeholder="Confirm new password"
                        rounded="lg"
                        size="lg"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </Field>
                  </VStack>

                  <Button
                    w="full"
                    colorPalette="green"
                    size="lg"
                    rounded="lg"
                    fontWeight="600"
                    _hover={{
                      transform: "translateY(-2px)",
                      boxShadow: "lg",
                    }}
                    transition="all 0.2s"
                    onClick={handleUpdatePassword}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Icon className="animate-spin" mr="2">
                          <LuLoader />
                        </Icon>
                        Updating...
                      </>
                    ) : (
                      <>
                        <Icon mr="2">
                          <LuCheck />
                        </Icon>
                        Update Password
                      </>
                    )}
                  </Button>
                </VStack>
              </Card.Body>
            </Card.Root>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
