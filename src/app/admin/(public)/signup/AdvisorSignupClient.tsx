"use client";

import { useState } from "react";
import {
  Button,
  HStack,
  Icon,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { toaster } from "@/components/ui/toaster";
import { LuArrowRight, LuLoader, LuShieldCheck } from "react-icons/lu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeEmail } from "@/lib/email-validation";
import { DB_TABLES } from "@/lib/supabase/queries/schema";
import AuthPageLayout from "@/components/auth/AuthPageLayout";
import PasswordStrength from "@/components/auth/PasswordStrength";

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

    const normalizedEmail = normalizeEmail(email);

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
          emailRedirectTo: `${globalThis.location.origin}/auth/callback`,
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
          description:
            "An account with this email already exists. Please sign in instead.",
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
    <AuthPageLayout
      headline="Advisor"
      highlightWord="portal."
      subtitle="Manage programs, track student progress, and keep the catalog up to date."
    >
      <VStack gap="5" align="stretch">
        <HStack
          gap="2"
          px="3"
          py="1.5"
          bg="green.50"
          borderRadius="full"
          borderWidth="1px"
          borderColor="green.200"
          w="fit-content"
        >
          <Icon color="green.600" boxSize="3.5">
            <LuShieldCheck />
          </Icon>
          <Text fontSize="xs" fontWeight="600" color="green.700">
            Access code verified
          </Text>
        </HStack>

        <VStack gap="1" align="start">
          <Text
            fontWeight="700"
            fontSize={{ base: "2xl", md: "3xl" }}
            letterSpacing="-0.02em"
          >
            Create Advisor Account
          </Text>
          <Text color="fg.muted" fontSize="sm">
            Set up your advisor account for program management tools.
          </Text>
        </VStack>

        <HStack gap="3" w="full">
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
            placeholder="you@example.com"
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
          {password.length > 0 && <PasswordStrength password={password} />}
        </Field>

        <Field label="Confirm Password">
          <PasswordInput
            placeholder="Confirm your password"
            rounded="lg"
            size="lg"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {confirmPassword.length > 0 && (
            <Text
              fontSize="xs"
              color={password === confirmPassword ? "green.500" : "red.500"}
              mt="1"
            >
              {password === confirmPassword
                ? "Passwords match"
                : "Passwords don\u2019t match"}
            </Text>
          )}
        </Field>

        <Button
          w="full"
          size="lg"
          rounded="full"
          fontWeight="600"
          bg="#1E3A5F"
          color="white"
          _hover={{
            bg: "#162d4a",
            transform: "translateY(-2px)",
            boxShadow: "0 8px 24px rgba(30,58,95,0.3)",
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
              color="#3B82F6"
              cursor="pointer"
              fontWeight="600"
              _hover={{ textDecoration: "underline" }}
            >
              Sign in
            </Text>
          </Link>
        </Text>
      </VStack>
    </AuthPageLayout>
  );
}
