"use client";

import * as React from "react";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuGraduationCap } from "react-icons/lu";

import { createClient } from "@/lib/supabase/client";
import { toaster } from "@/components/ui/toaster";
import { DB_TABLES } from "@/lib/supabase/queries/schema";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Keep the same password rule you use in /signup if you already have one.
// If your student signup uses a different rule, copy that exact logic here.
function isStrongPassword(pw: string) {
  return pw.length >= 8;
}

export default function AdminSignupPage() {
  const router = useRouter();

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [loading, setLoading] = React.useState(false);

  const validate = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword) {
      return "All fields are required.";
    }
    if (!isValidEmail(email)) {
      return "Please enter a valid email address.";
    }
    if (!isStrongPassword(password)) {
      return "Password must be at least 8 characters.";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }
    return null;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const err = validate();
    if (err) {
      toaster.create({ title: "Fix the form", description: err, type: "error" });
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      // 1) Create auth user with role in metadata
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            role: "advisor",
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          },
          // Make sure you have this in env: NEXT_PUBLIC_SITE_URL or similar.
          // If your student signup does not use email confirmations, this still works.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toaster.create({ title: "Signup failed", description: error.message, type: "error" });
        setLoading(false);
        return;
      }

      // If email confirmation is ON, user may be null until they confirm.
      // So we try to insert advisors row only if user exists now.
      const user = data.user;

      if (user) {
        // 2) Create advisors table row
        const { error: insertErr } = await supabase
          .from(DB_TABLES.advisors)
          .insert({
            auth_user_id: user.id,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
          });

        if (insertErr) {
          toaster.create({
            title: "Advisor record failed",
            description: insertErr.message,
            type: "error",
          });
          setLoading(false);
          return;
        }

        // 3) Go to admin dashboard
        router.push("/admin");
      } else {
        // Email confirmation flow case
        toaster.create({
          title: "Check your email",
          description: "Please confirm your email to finish creating your advisor account.",
          type: "info",
        });
        router.push("/signin");
      }
    } catch (e: any) {
      toaster.create({
        title: "Signup failed",
        description: e?.message ?? "Unexpected error",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minH="100vh" bg="bg" className="mesh-gradient-subtle">
      <Flex align="center" justify="center" px="4" py="10">
        <Card.Root w="full" maxW="lg" borderRadius="2xl" borderWidth="1px" borderColor="border.subtle">
          <Card.Body p={{ base: "6", md: "8" }}>
            <VStack align="stretch" gap="6">
              <HStack gap="3">
                <Box p="2" bg="green.solid" borderRadius="lg">
                  <Icon color="white" boxSize="5">
                    <LuGraduationCap />
                  </Icon>
                </Box>
                <Box>
                  <Heading size="lg" fontFamily="'DM Serif Display', serif" fontWeight="400">
                    Advisor Sign Up
                  </Heading>
                  <Text color="fg.muted" fontSize="sm">
                    Create an advisor account to access the admin dashboard.
                  </Text>
                </Box>
              </HStack>

              <Box as="form" onSubmit={handleSignup}>
                <Stack gap="4">
                  <Stack direction={{ base: "column", md: "row" }} gap="4">
                    <Box flex="1">
                      <Text fontSize="sm" fontWeight="600" mb="1">
                        First Name
                      </Text>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                    </Box>
                    <Box flex="1">
                      <Text fontSize="sm" fontWeight="600" mb="1">
                        Last Name
                      </Text>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                    </Box>
                  </Stack>

                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb="1">
                      Email
                    </Text>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.edu" />
                  </Box>

                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb="1">
                      Password
                    </Text>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
                  </Box>

                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb="1">
                      Confirm Password
                    </Text>
                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
                  </Box>

                  <Button type="submit" colorPalette="green" size="lg" loading={loading}>
                    Create Advisor Account
                  </Button>

                  <Text fontSize="sm" color="fg.muted" textAlign="center">
                    Already have an account?{" "}
                    <Link href="/signin" style={{ textDecoration: "underline" }}>
                      Sign in
                    </Link>
                  </Text>
                </Stack>
              </Box>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Flex>
    </Box>
  );
}