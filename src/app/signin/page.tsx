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

export default function SigninPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignin() {
    if (!email || !password) {
      toaster.create({
        title: "Missing fields",
        description: "Please enter your email and password.",
        type: "error",
      });
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
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

    toaster.create({
      title: "Welcome back!",
      description: "Redirecting...",
      type: "success",
    });

    setLoading(false);
    router.push(user?.user_metadata?.role === "advisor" ? "/admin" : "/dashboard");
  }

  return (
    <Box
      minH="100vh"
      fontFamily="var(--font-plus-jakarta), sans-serif"
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

      {/* Signin Section */}
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
                      Welcome Back, Ranger
                    </Text>
                    <Text color="fg.muted" fontSize="sm">
                      Sign in to continue tracking your path to graduation
                    </Text>
                  </VStack>

                  <VStack gap="5">
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
                        placeholder="Enter your password"
                        rounded="lg"
                        size="lg"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </Field>

                    <Link href="/forgot-password">
                      <Text
                        fontSize="sm"
                        color="green.solid"
                        cursor="pointer"
                        fontWeight="600"
                        alignSelf="flex-end"
                        _hover={{ textDecoration: "underline" }}
                      >
                        Forgot password?
                      </Text>
                    </Link>
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

                  <Text fontSize="sm" color="fg.muted" textAlign="center">
                    Don&apos;t have an account?{" "}
                    <Link href="/signup">
                      <Text
                        as="span"
                        color="green.solid"
                        cursor="pointer"
                        fontWeight="600"
                        _hover={{ textDecoration: "underline" }}
                      >
                        Create one
                      </Text>
                    </Link>
                  </Text>

                  <Text fontSize="sm" color="fg.muted" textAlign="center">
                    Are you an advisor?{" "}
                    <Link href="/admin/signup">
                      <Text
                        as="span"
                        color="green.solid"
                        cursor="pointer"
                        fontWeight="600"
                        _hover={{ textDecoration: "underline" }}
                      >
                        Sign up here
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
