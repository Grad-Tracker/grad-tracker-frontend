"use client";

import {
  Box,
  Flex,
  HStack,
  Icon,
  Text,
  Container,
} from "@chakra-ui/react";
import Link from "next/link";
import { LuArrowLeft, LuGraduationCap } from "react-icons/lu";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

export default function WizardPage() {
  return (
    <Box
      minH="100vh"
      bg="bg"
      fontFamily="'Plus Jakarta Sans', sans-serif"
      className="mesh-gradient-subtle"
    >
      {/* Header */}
      <Box
        as="header"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        className="glass-card"
        position="sticky"
        top="0"
        zIndex="10"
      >
        <Container maxW="4xl" mx="auto" px={{ base: "4", md: "8" }}>
          <Flex justify="space-between" align="center" py="4">
            <Link href="/dashboard/onboarding">
              <HStack
                gap="2"
                color="fg.muted"
                _hover={{ color: "fg" }}
                transition="color 0.15s"
              >
                <Icon boxSize="5">
                  <LuArrowLeft />
                </Icon>
                <Text fontSize="sm" fontWeight="500">
                  Back
                </Text>
              </HStack>
            </Link>
            <HStack gap="3">
              <Box p="2" bg="green.solid" borderRadius="lg">
                <Icon color="white" boxSize="5">
                  <LuGraduationCap />
                </Icon>
              </Box>
              <Text
                fontWeight="700"
                fontSize="lg"
                fontFamily="'DM Serif Display', serif"
                letterSpacing="-0.02em"
              >
                GradTracker
              </Text>
            </HStack>
          </Flex>
        </Container>
      </Box>

      {/* Wizard Content */}
      <OnboardingWizard />
    </Box>
  );
}
