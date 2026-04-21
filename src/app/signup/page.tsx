"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import {
  Box,
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
import { LuArrowRight, LuLoader } from "react-icons/lu";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isStudentEmail, normalizeEmail } from "@/lib/email-validation";
import AuthPageLayout from "@/components/auth/AuthPageLayout";
import PasswordStrength from "@/components/auth/PasswordStrength";

function AdvisorAccessQuerySync({
  onOpen,
  onConsumeAdvisorParam,
}: {
  onOpen: () => void;
  onConsumeAdvisorParam: () => void;
}) {
  const searchParams = useSearchParams();
  const openedRef = useRef(false);

  useEffect(() => {
    if (searchParams.get("advisor") === "1" && !openedRef.current) {
      openedRef.current = true;
      onOpen();
      onConsumeAdvisorParam();
    }
  }, [onConsumeAdvisorParam, onOpen, searchParams]);

  return null;
}

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [advisorAccessCode, setAdvisorAccessCode] = useState("");
  const [advisorPanelOpen, setAdvisorPanelOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdvisorAccessContinue() {
    try {
      const response = await fetch("/api/advisor/verify-signup-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: advisorAccessCode }),
      });

      let payload: { ok?: boolean; message?: string } | null = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (payload?.ok) {
        setAdvisorPanelOpen(false);
        setAdvisorAccessCode("");
        router.push("/admin/signup");
        return;
      }

      if (response.status >= 500) {
        throw new Error("verification failed");
      }

      if (payload?.message) {
        toaster.create({ title: payload.message, type: "error" });
        return;
      }

      toaster.create({ title: "Invalid access code", type: "error" });
      return;
    } catch {
      // Fall through to generic failure below
    }

    toaster.create({ title: "Verification failed", type: "error" });
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

    const normalized = normalizeEmail(email);

    if (!isStudentEmail(normalized)) {
      toaster.create({
        title: "Invalid email domain",
        description: "Student sign up requires a @rangers.uwp.edu email address.",
        type: "error",
      });
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: normalized,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
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

    if (data.user?.identities?.length === 0) {
      await supabase.auth.signOut();
      toaster.create({
        title: "Account already exists",
        description:
          "An account with this email already exists. Please sign in instead.",
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
    <AuthPageLayout
      headline="Start your"
      highlightWord="journey."
      subtitle="Create your free account and start tracking your path to graduation today."
      maxFormW="480px"
    >
      <Suspense fallback={null}>
        <AdvisorAccessQuerySync
          onOpen={() => setAdvisorPanelOpen(true)}
          onConsumeAdvisorParam={() => router.replace("/signup")}
        />
      </Suspense>

      <VStack gap="5" align="stretch">
        <VStack gap="1" align="start">
          <Text
            fontWeight="700"
            fontSize={{ base: "2xl", md: "3xl" }}
            letterSpacing="-0.02em"
          >
            Create Account
          </Text>
          <Text color="fg.muted" fontSize="sm">
            Join fellow Rangers and start tracking your path to graduation.
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
              color={password === confirmPassword ? "green.600" : "red.600"}
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
          bg="blue.800"
          color="white"
          _hover={{
            bg: "blue.900",
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
              color="blue.500"
              cursor="pointer"
              fontWeight="600"
              _hover={{ textDecoration: "underline" }}
            >
              Sign in
            </Text>
          </Link>
        </Text>

        {!advisorPanelOpen ? (
          <VStack gap="1">
            <Text fontSize="sm" color="fg.muted" textAlign="center">
              Are you an advisor?
            </Text>
            <Button
              variant="ghost"
              size="sm"
              color="blue.500"
              fontWeight="600"
              onClick={() => setAdvisorPanelOpen(true)}
            >
              Enter access code →
            </Button>
          </VStack>
        ) : (
          <Box
            p="4"
            bg="bg.subtle"
            borderRadius="xl"
            borderWidth="1px"
            borderColor="border.subtle"
            css={{
              animation: "fadeIn 0.25s ease both",
              "@keyframes fadeIn": {
                from: { opacity: 0, transform: "translateY(8px)" },
                to: { opacity: 1, transform: "translateY(0)" },
              },
            }}
          >
            <VStack gap="3" align="stretch">
              <HStack justify="space-between" align="center">
                <Text fontSize="sm" fontWeight="600">
                  Advisor Access
                </Text>
                <Button
                  variant="ghost"
                  size="xs"
                  color="fg.muted"
                  onClick={() => {
                    setAdvisorPanelOpen(false);
                    setAdvisorAccessCode("");
                  }}
                >
                  Cancel
                </Button>
              </HStack>
              <Text fontSize="xs" color="fg.muted">
                Enter the access code provided by the department.
              </Text>
              <Input
                type="password"
                placeholder="Access code"
                rounded="lg"
                size="sm"
                value={advisorAccessCode}
                onChange={(e) => setAdvisorAccessCode(e.target.value)}
              />
              <Button
                size="sm"
                bg="blue.800"
                color="white"
                rounded="lg"
                fontWeight="600"
                _hover={{ bg: "blue.900" }}
                onClick={handleAdvisorAccessContinue}
              >
                Continue
                <Icon ml="1.5" boxSize="3.5">
                  <LuArrowRight />
                </Icon>
              </Button>
            </VStack>
          </Box>
        )}
      </VStack>
    </AuthPageLayout>
  );
}
