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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuArrowRight, LuGraduationCap, LuLoader } from "react-icons/lu";
import { ColorModeButton } from "@/components/ui/color-mode";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { toaster } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";

type Role = "student" | "advisor";

type RoleSignInFormProps = {
  defaultRole: Role;
  hideRoleSelector?: boolean;
};

const roleContent: Record<
  Role,
  {
    title: string;
    helper: string;
    emailPlaceholder: string;
    emailHelper: string;
    postSignInHint: string;
    signupHref: string;
    signupLabel: string;
  }
> = {
  student: {
    title: "Student Sign In",
    helper: "View your dashboard, requirements, and planner.",
    emailPlaceholder: "your.name@rangers.uwp.edu",
    emailHelper: "Use your Parkside student email ending in @rangers.uwp.edu.",
    postSignInHint: "You’ll be taken to your student dashboard.",
    signupHref: "/signup",
    signupLabel: "Create student account",
  },
  advisor: {
    title: "Advisor Sign In",
    helper: "Manage programs, Gen-Ed buckets, and course catalog.",
    emailPlaceholder: "your.name@uwp.edu",
    emailHelper: "Use your advisor email ending in @uwp.edu.",
    postSignInHint: "You’ll be taken to the advisor console.",
    signupHref: "/admin/signup",
    signupLabel: "Create advisor account",
  },
};

export default function RoleSignInForm({
  defaultRole,
  hideRoleSelector = false,
}: RoleSignInFormProps) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>(defaultRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const currentRole = roleContent[selectedRole];

  async function handleSignin() {
    if (!email || !password) {
      toaster.create({
        title: "Missing fields",
        description: "Please enter your email and password.",
        type: "error",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const hasValidDomain =
      selectedRole === "student"
        ? normalizedEmail.endsWith("@rangers.uwp.edu")
        : normalizedEmail.endsWith("@uwp.edu") &&
          !normalizedEmail.endsWith("@rangers.uwp.edu");

    if (!hasValidDomain) {
      toaster.create({
        title: "Invalid email domain",
        description:
          selectedRole === "student"
            ? "Student sign in requires a @rangers.uwp.edu email address."
            : "Advisor sign in requires a @uwp.edu email address.",
        type: "error",
      });
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setLoading(false);
      toaster.create({
        title: "Sign in failed",
        description: error.message,
        type: "error",
      });
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const actualRole = user?.user_metadata?.role ?? "student";

    if (selectedRole === "student" && actualRole === "advisor") {
      toaster.create({
        title: "Wrong sign in type",
        description: "This is an advisor account. Use Advisor sign in.",
        type: "error",
      });
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (selectedRole === "advisor" && actualRole !== "advisor") {
      toaster.create({
        title: "Wrong sign in type",
        description: "This is a student account. Use Student sign in.",
        type: "error",
      });
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    toaster.create({
      title: "Welcome back!",
      description: "Redirecting...",
      type: "success",
    });

    setLoading(false);
    router.push(actualRole === "advisor" ? "/admin" : "/dashboard");
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
          bg="green.500"
          opacity="0.02"
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
          opacity="0.02"
          borderRadius="full"
          filter="blur(80px)"
        />
        <Box
          position="absolute"
          inset="0"
          bg="blackAlpha.600"
          opacity="0.28"
        />
        <Box
          position="absolute"
          inset="0"
          bgGradient="radial(circle at center, transparent 35%, rgba(0, 0, 0, 0.5) 100%)"
          opacity="0.75"
        />

        <Container maxW="md" position="relative" zIndex="2">
          <Box position="relative">
            <Box
              position="absolute"
              inset="-4"
              bg="green.500"
              opacity="0.1"
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
              transition="all 0.2s ease"
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "0 24px 60px rgba(0, 0, 0, 0.22)",
              }}
              _focusWithin={{
                borderColor: "green.400",
                boxShadow: "0 0 0 1px rgba(34, 197, 94, 0.4), 0 16px 40px rgba(34, 197, 94, 0.12)",
              }}
            >
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
                <VStack gap="4" align="stretch">
                  {!hideRoleSelector && (
                    <HStack
                      position="relative"
                      gap="2"
                      p="1"
                      bg="bg.subtle"
                      borderRadius="xl"
                      borderWidth="1px"
                      borderColor="border.subtle"
                      overflow="hidden"
                    >
                      <Box
                        position="absolute"
                        top="1"
                        bottom="1"
                        left="1"
                        width="calc(50% - 0.25rem)"
                        borderRadius="xl"
                        bg="green.subtle"
                        boxShadow="0 0 0 1px rgba(34, 197, 94, 0.18), 0 8px 18px rgba(34, 197, 94, 0.16)"
                        transform={
                          selectedRole === "student"
                            ? "translateX(0%)"
                            : "translateX(calc(100% + 0.5rem))"
                        }
                        transition="transform 0.22s ease"
                      />
                      {(["student", "advisor"] as const).map((role) => {
                        const active = role === selectedRole;
                        return (
                          <Button
                            key={role}
                            flex="1"
                            h="12"
                            rounded="xl"
                            position="relative"
                            zIndex="1"
                            variant="ghost"
                            colorPalette={active ? "green" : undefined}
                            px="4"
                            onClick={() => setSelectedRole(role)}
                            aria-pressed={active}
                            aria-label={role === "student" ? "Student" : "Advisor"}
                            transition="all 0.18s ease"
                            borderWidth="1px"
                            borderColor={active ? "transparent" : "transparent"}
                            bg={active ? "transparent" : "transparent"}
                            boxShadow={
                              active
                                ? "0 0 0 1px rgba(34, 197, 94, 0.14), 0 6px 16px rgba(34, 197, 94, 0.14)"
                                : "none"
                            }
                            _hover={{
                              transform: "translateY(-1px)",
                              borderColor: active ? "transparent" : "green.200",
                              bg: active ? "green.subtle" : "whiteAlpha.100",
                            }}
                            _active={{
                              transform: "scale(0.99)",
                            }}
                          >
                            {role === "student" ? "Student" : "Advisor"}
                          </Button>
                        );
                      })}
                    </HStack>
                  )}

                  <VStack gap="2" textAlign="center">
                    <Text
                      fontWeight="700"
                      fontSize={{ base: "xl", md: "2xl" }}
                      fontFamily="var(--font-outfit), sans-serif"
                      letterSpacing="-0.02em"
                    >
                      {currentRole.title}
                    </Text>
                    <Text color="fg.muted" fontSize="sm">
                      {currentRole.helper}
                    </Text>
                  </VStack>

                  <VStack gap="6">
                    <Field label="Email">
                      <VStack gap="2" align="stretch">
                        <Input
                          placeholder={currentRole.emailPlaceholder}
                          type="email"
                          rounded="lg"
                          size="lg"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                        <Text fontSize="sm" color="fg.muted">
                          {currentRole.emailHelper}
                        </Text>
                      </VStack>
                    </Field>

                    <Field label="Password">
                      <PasswordInput
                        placeholder="Enter your password"
                        rounded="lg"
                        size="lg"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </Field>

                    <HStack justify="flex-end" align="center" wrap="wrap" gap="3">
                      <Link href="/forgot-password">
                        <Text
                          fontSize="sm"
                          color="green.solid"
                          cursor="pointer"
                          fontWeight="600"
                          _hover={{ textDecoration: "underline" }}
                        >
                          Forgot password?
                        </Text>
                      </Link>
                    </HStack>
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
                    onClick={handleSignin}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Icon className="animate-spin" mr="2">
                          <LuLoader />
                        </Icon>
                        Signing In...
                      </>
                    ) : (
                      <>
                        Sign In
                        <Icon ml="2">
                          <LuArrowRight />
                        </Icon>
                      </>
                    )}
                  </Button>

                  <Text
                    key={selectedRole}
                    fontSize="sm"
                    color="fg.muted"
                    textAlign="center"
                    mt="-2"
                  >
                    {currentRole.postSignInHint}
                  </Text>

                  <Text fontSize="sm" color="fg.muted" textAlign="center">
                    Don&apos;t have an account?{" "}
                    <Link href={currentRole.signupHref}>
                      <Text
                        as="span"
                        color="green.solid"
                        cursor="pointer"
                        fontWeight="600"
                        _hover={{ textDecoration: "underline" }}
                      >
                        {currentRole.signupLabel}
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
