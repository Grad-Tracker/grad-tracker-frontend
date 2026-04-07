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
import { PasswordInput } from "@/components/ui/password-input";
import { toaster } from "@/components/ui/toaster";
import { LuGraduationCap, LuArrowRight, LuLoader } from "react-icons/lu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DB_TABLES } from "@/lib/supabase/queries/schema";

export default function AdvisorSignupClient() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!firstName || !lastName || !email || !password) {
      toaster.create({
        title: "Missing fields",
        description: "Please fill in all fields.",
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

    const normalizedEmail = email.trim().toLowerCase();

    const hasValidAdvisorDomain =
      normalizedEmail.endsWith("@uwp.edu") &&
      !normalizedEmail.endsWith("@rangers.uwp.edu");

    if (!hasValidAdvisorDomain) {
      toaster.create({
        title: "Invalid email domain",
        description: "Advisor sign up requires a @uwp.edu email address.",
        type: "error",
      });
      return;
    }

    setLoading(true);

    const supabase = createClient();

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            role: "advisor",
            first_name: firstName,
            last_name: lastName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toaster.create({
          title: "Sign up failed",
          description: error.message,
          type: "error",
        });
        return;
      }

      if (!data.user) {
        toaster.create({
          title: "Sign up failed",
          description: "Unable to create account. Please try again.",
          type: "error",
        });
        return;
      }

      if (data.user.identities?.length === 0) {
        await supabase.auth.signOut();
        toaster.create({
          title: "Account already exists",
          description: "An account with this email already exists. Please sign in instead.",
          type: "error",
        });
        return;
      }

      const { error: insertErr } = await supabase
        .from(DB_TABLES.staff)
        .insert({
          auth_user_id: data.user.id,
          email: normalizedEmail,
          first_name: firstName,
          last_name: lastName,
          role: "advisor",
          is_admin: false,
        });

      if (insertErr) {
        await supabase.auth.signOut();
        toaster.create({
          title: "Advisor record failed",
          description: insertErr.message,
          type: "error",
        });
        return;
      }

      try {
        await fetch("/api/advisor/consume-signup-gate", { method: "POST" });
      } catch (consumeError) {
        console.warn("Failed to consume advisor signup gate", consumeError);
      }

      toaster.create({
        title: "Account created!",
        description: "Welcome to GradTracker, Advisor.",
        type: "success",
      });

      router.push("/admin");
    } catch (e: any) {
      toaster.create({
        title: "Sign up failed",
        description: e?.message ?? "Unexpected error",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      minH="100vh"
      fontFamily="var(--font-plus-jakarta), sans-serif"
      position="relative"
    >
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
                  fontFamily="var(--font-outfit), sans-serif"
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

      <Box
        className="mesh-gradient noise-overlay"
        py={{ base: "16", md: "24" }}
        minH="calc(100vh - 73px)"
        display="flex"
        alignItems="center"
        position="relative"
        overflow="hidden"
      >
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
                      fontFamily="var(--font-outfit), sans-serif"
                      letterSpacing="-0.02em"
                    >
                      Create Advisor Account
                    </Text>
                    <Text color="fg.muted" fontSize="sm">
                      Create an advisor account for advisor tools access.
                    </Text>
                  </VStack>

                  <VStack gap="5">
                    <HStack gap="4" w="full">
                      <Field label="First Name">
                        <Input
                          placeholder="First name"
                          rounded="lg"
                          size="lg"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                        />
                      </Field>
                      <Field label="Last Name">
                        <Input
                          placeholder="Last name"
                          rounded="lg"
                          size="lg"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                        />
                      </Field>
                    </HStack>

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

                    <Field label="Password">
                      <PasswordInput
                        placeholder="Create a password"
                        rounded="lg"
                        size="lg"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </Field>

                    <Field label="Confirm Password">
                      <PasswordInput
                        placeholder="Confirm your password"
                        rounded="lg"
                        size="lg"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </Field>
                  </VStack>

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
                    onClick={handleSignup}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Icon className="animate-spin" mr="2">
                          <LuLoader />
                        </Icon>
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Create Advisor Account
                        <Icon ml="2">
                          <LuArrowRight />
                        </Icon>
                      </>
                    )}
                  </Button>

                  <Text fontSize="sm" color="fg.muted" textAlign="center">
                    Already have an account?{" "}
                    <Link href="/signin">
                      <Text
                        as="span"
                        color="blue.solid"
                        cursor="pointer"
                        fontWeight="600"
                        _hover={{ textDecoration: "underline" }}
                      >
                        Sign in
                      </Text>
                    </Link>
                  </Text>
                </VStack>
              </Card.Body>
            </Card.Root>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
