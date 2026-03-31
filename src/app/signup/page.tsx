"use client";

import { Suspense, useEffect, useState } from "react";
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
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { toaster } from "@/components/ui/toaster";
import { LuGraduationCap, LuArrowRight, LuLoader } from "react-icons/lu";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function AdvisorAccessQuerySync({ onOpen }: { onOpen: () => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("advisor") === "1") {
      onOpen();
    }
  }, [onOpen, searchParams]);

  return null;
}

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [advisorAccessCode, setAdvisorAccessCode] = useState("");
  const [advisorDialogOpen, setAdvisorDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdvisorAccessContinue() {
    try {
      const response = await fetch("/api/advisor/verify-signup-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: advisorAccessCode }),
      });

      let payload: { ok?: boolean; message?: string } | null = null;

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (payload?.ok) {
        setAdvisorDialogOpen(false);
        setAdvisorAccessCode("");
        router.push("/admin/signup");
        return;
      }

      if (response.status >= 500) {
        throw new Error("verification failed");
      }

      if (payload?.message) {
        toaster.create({
          title: payload.message,
          type: "error",
        });
        return;
      }

      toaster.create({
        title: "Invalid access code",
        type: "error",
      });
      return;
    } catch {
      // Fall through to generic verification failure handling below.
    }

    toaster.create({
      title: "Verification failed",
      type: "error",
    });
  }

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

    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    setLoading(false);

    if (error) {
      toaster.create({
        title: "Sign up failed",
        description: error.message,
        type: "error",
      });
      return;
    }

    // Supabase returns a user with empty identities when the email is already
    // taken (instead of an error, to prevent email enumeration attacks).
    // Detect this and show a friendly message without granting access.
    if (data.user?.identities?.length === 0) {
      // Sign out immediately so no session lingers
      await supabase.auth.signOut();
      toaster.create({
        title: "Account already exists",
        description: "An account with this email already exists. Please sign in instead.",
        type: "error",
      });
      return;
    }

    toaster.create({
      title: "Account created!",
      description: "Welcome to GradTracker, Ranger.",
      type: "success",
    });

    router.push("/dashboard");
  }

  return (
    <Box
      minH="100vh"
      fontFamily="var(--font-plus-jakarta), sans-serif"
      position="relative"
    >
      <Suspense fallback={null}>
        <AdvisorAccessQuerySync onOpen={() => setAdvisorDialogOpen(true)} />
      </Suspense>

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
                  fontFamily="var(--font-outfit), sans-serif"
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

      {/* Signup Section */}
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
                      fontFamily="var(--font-outfit), sans-serif"
                      letterSpacing="-0.02em"
                    >
                      Create Student Account
                    </Text>
                    <Text color="fg.muted" fontSize="sm">
                      Join fellow Rangers and start tracking your path to
                      graduation with your student tools.
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
                        placeholder="your.name@rangers.uwp.edu"
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
                    colorPalette="green"
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
                        Create Account
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
                        color="green.solid"
                        cursor="pointer"
                        fontWeight="600"
                        _hover={{ textDecoration: "underline" }}
                      >
                        Sign in
                      </Text>
                    </Link>
                  </Text>

                  <Text fontSize="sm" color="fg.muted" textAlign="center">
                    Are you an advisor?{" "}
                    <Button
                      type="button"
                      variant="plain"
                      size="sm"
                      minH="unset"
                      h="auto"
                      px="0"
                      py="0"
                      verticalAlign="baseline"
                      color="green.solid"
                      cursor="pointer"
                      fontWeight="600"
                      _hover={{ textDecoration: "underline" }}
                      onClick={() => setAdvisorDialogOpen(true)}
                    >
                      Access code required &rarr;
                    </Button>
                  </Text>
                </VStack>
              </Card.Body>
            </Card.Root>
          </Box>
        </Container>
      </Box>

      <DialogRoot
        open={advisorDialogOpen}
        onOpenChange={(event) => {
          setAdvisorDialogOpen(event.open);
          if (!event.open) {
            setAdvisorAccessCode("");
          }
        }}
      >
        <DialogContent maxW="sm">
          <DialogHeader>
            <DialogTitle>Advisor Access</DialogTitle>
          </DialogHeader>
          <DialogBody pb="6">
            <VStack gap="4" align="stretch">
              <Text fontSize="sm" color="fg.muted">
                Enter the access code provided by the department.
              </Text>
              <Field label="Advisor Access Code">
                <Input
                  type="password"
                  placeholder="Advisor Access Code"
                  rounded="lg"
                  value={advisorAccessCode}
                  onChange={(e) => setAdvisorAccessCode(e.target.value)}
                />
              </Field>
            </VStack>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setAdvisorDialogOpen(false);
                setAdvisorAccessCode("");
              }}
            >
              Cancel
            </Button>
            <Button colorPalette="green" onClick={handleAdvisorAccessContinue}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </Box>
  );
}
