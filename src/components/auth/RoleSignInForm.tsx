"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuArrowRight, LuLoader } from "react-icons/lu";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { toaster } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";
import { normalizeEmail } from "@/lib/email-validation";
import AuthPageLayout from "./AuthPageLayout";

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
    title: "Sign In",
    helper: "View your dashboard, requirements, and planner.",
    emailPlaceholder: "you@example.com",
    emailHelper: "",
    postSignInHint: "You'll be taken to your student dashboard.",
    signupHref: "/signup",
    signupLabel: "Create student account",
  },
  advisor: {
    title: "Sign In",
    helper: "Manage programs, Gen-Ed buckets, and course catalog.",
    emailPlaceholder: "you@example.com",
    emailHelper: "",
    postSignInHint: "You'll be taken to the advisor console.",
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

    const normalized = normalizeEmail(email);

    setLoading(true);

    const supabase = createClient();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalized,
        password,
      });

      if (error) {
        toaster.create({
          title: "Sign in failed",
          description: error.message,
          type: "error",
        });
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toaster.create({
          title: "Sign in failed",
          description: "Unable to retrieve user session. Please try again.",
          type: "error",
        });
        await supabase.auth.signOut();
        return;
      }

      const actualRole = user.user_metadata?.role ?? "student";

      if (selectedRole === "student" && actualRole === "advisor") {
        toaster.create({
          title: "Wrong sign in type",
          description: "This is an advisor account. Use Advisor sign in.",
          type: "error",
        });
        await supabase.auth.signOut();
        return;
      }

      if (selectedRole === "advisor" && actualRole !== "advisor") {
        toaster.create({
          title: "Wrong sign in type",
          description: "This is a student account. Use Student sign in.",
          type: "error",
        });
        await supabase.auth.signOut();
        return;
      }

      toaster.create({
        title: "Welcome back!",
        description: "Redirecting...",
        type: "success",
      });

      router.push(actualRole === "advisor" ? "/admin" : "/dashboard");
    } catch (error: any) {
      toaster.create({
        title: "Sign in failed",
        description: error?.message ?? "Unexpected error",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageLayout
      headline="Welcome back,"
      highlightWord="Ranger."
      subtitle="Track your requirements, plan your semesters, and stay on course to graduation."
      maxFormW="400px"
    >
      <VStack gap="6" align="stretch">
        <VStack gap="1" align="start">
          <Text
            fontWeight="700"
            fontSize={{ base: "2xl", md: "3xl" }}
            letterSpacing="-0.02em"
          >
            {currentRole.title}
          </Text>
          <Text color="fg.muted" fontSize="sm">
            {currentRole.helper}
          </Text>
        </VStack>

        {!hideRoleSelector && (
          <HStack
            position="relative"
            gap="1"
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
              borderRadius="lg"
              bg="blue.800"
              boxShadow="0 2px 8px rgba(30,58,95,0.3)"
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
                  h="10"
                  rounded="lg"
                  position="relative"
                  zIndex="1"
                  variant="ghost"
                  fontSize="sm"
                  fontWeight="600"
                  color={active ? "white" : "fg.muted"}
                  px="4"
                  onClick={() => setSelectedRole(role)}
                  aria-pressed={active}
                  aria-label={role === "student" ? "Student" : "Advisor"}
                  transition="all 0.18s ease"
                  bg="transparent"
                  _hover={{
                    color: active ? "white" : "fg",
                    bg: active ? "transparent" : "bg.emphasized",
                  }}
                  _active={{ transform: "scale(0.98)" }}
                >
                  {role === "student" ? "Student" : "Advisor"}
                </Button>
              );
            })}
          </HStack>
        )}

        <VStack gap="4">
          <Field label="Email">
            <Input
              placeholder={currentRole.emailPlaceholder}
              type="email"
              rounded="lg"
              size="lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {currentRole.emailHelper && (
              <Text fontSize="xs" color="fg.muted" mt="1">
                {currentRole.emailHelper}
              </Text>
            )}
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

          <Flex justify="flex-end">
            <Link href="/forgot-password">
              <Text
                fontSize="sm"
                color="blue.500"
                cursor="pointer"
                fontWeight="600"
                _hover={{ textDecoration: "underline" }}
              >
                Forgot password?
              </Text>
            </Link>
          </Flex>
        </VStack>

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

        <Text key={selectedRole} fontSize="xs" color="fg.subtle" textAlign="center">
          {currentRole.postSignInHint}
        </Text>

        <Text fontSize="sm" color="fg.muted" textAlign="center">
          Don&apos;t have an account?{" "}
          <Link href={currentRole.signupHref}>
            <Text
              as="span"
              color="blue.500"
              cursor="pointer"
              fontWeight="600"
              _hover={{ textDecoration: "underline" }}
            >
              {currentRole.signupLabel}
            </Text>
          </Link>
        </Text>
      </VStack>
    </AuthPageLayout>
  );
}
