"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Flex,
  Heading,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import {
  LuGraduationCap,
  LuArrowLeft,
  LuBookOpen,
  LuTarget,
  LuSparkles,
  LuArrowRight,
} from "react-icons/lu";

const steps = [
  {
    number: 1,
    title: "Select Your Degree",
    description: "Choose your major and expected graduation date",
    icon: LuTarget,
    color: "green",
  },
  {
    number: 2,
    title: "Add Your Courses",
    description: "Enter courses you've completed or are currently taking",
    icon: LuBookOpen,
    color: "blue",
  },
  {
    number: 3,
    title: "Get Your Roadmap",
    description: "See your personalized path to graduation",
    icon: LuSparkles,
    color: "purple",
  },
];

export default function OnboardingPage() {
  return (
    <Box
      minH="100vh"
      bg="bg"
      fontFamily="var(--font-plus-jakarta), sans-serif"
      className="mesh-gradient-subtle"
    >
      {/* Header */}
      <Box
        as="header"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        className="glass-card"
      >
        <Container maxW="4xl" mx="auto" px={{ base: "4", md: "8" }}>
          <Flex justify="space-between" align="center" py="4">
            <Link href="/dashboard">
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
                  Back to Dashboard
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
                fontFamily="var(--font-outfit), sans-serif"
                letterSpacing="-0.02em"
              >
                GradTracker
              </Text>
            </HStack>
          </Flex>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="4xl" mx="auto" px={{ base: "4", md: "8" }} py="12">
        <VStack gap="10" align="center">
          {/* Hero Section */}
          <VStack gap="4" textAlign="center" maxW="xl" className="animate-fade-up">
            <Badge
              colorPalette="green"
              variant="surface"
              size="lg"
              px="4"
              py="2"
              rounded="full"
            >
              <Icon mr="2">
                <LuSparkles />
              </Icon>
              Setup Wizard
            </Badge>
            <Heading
              fontFamily="var(--font-outfit), sans-serif"
              size={{ base: "3xl", md: "4xl" }}
              letterSpacing="-0.02em"
              fontWeight="400"
            >
              Let&apos;s Set Up Your
              <br />
              <Text as="span" className="gradient-text">
                Graduation Tracker
              </Text>
            </Heading>
            <Text fontSize="lg" color="fg.muted" lineHeight="1.7">
              We&apos;ll guide you through a quick setup to personalize your
              experience and help you track your path to graduation.
            </Text>
          </VStack>

          {/* Steps Preview */}
          <Card.Root
            w="full"
            maxW="2xl"
            bg="bg"
            borderRadius="2xl"
            borderWidth="1px"
            borderColor="border.subtle"
            className="animate-fade-up-delay-1"
          >
            <Card.Body p={{ base: "6", md: "8" }}>
              <VStack gap="6" align="stretch">
                {steps.map((step, index) => (
                  <Flex
                    key={step.number}
                    gap="4"
                    align="start"
                    p="4"
                    bg="bg.subtle"
                    borderRadius="xl"
                    opacity={index === 0 ? 1 : 0.6}
                  >
                    <Flex
                      align="center"
                      justify="center"
                      w="12"
                      h="12"
                      bg={`${step.color}.subtle`}
                      borderRadius="xl"
                      flexShrink={0}
                    >
                      <Icon color={`${step.color}.fg`} boxSize="6">
                        <step.icon />
                      </Icon>
                    </Flex>
                    <Box flex="1">
                      <HStack gap="2" mb="1">
                        <Badge
                          colorPalette={step.color}
                          variant="surface"
                          size="sm"
                        >
                          Step {step.number}
                        </Badge>
                      </HStack>
                      <Text fontWeight="600" fontSize="md" mb="1">
                        {step.title}
                      </Text>
                      <Text color="fg.muted" fontSize="sm">
                        {step.description}
                      </Text>
                    </Box>
                  </Flex>
                ))}
              </VStack>
            </Card.Body>
          </Card.Root>

          {/* CTA */}
          <VStack gap="4" className="animate-fade-up-delay-2">
            <Link href="/dashboard/onboarding/wizard">
              <Button
                size="lg"
                colorPalette="green"
                rounded="full"
                px="8"
                fontWeight="600"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "lg",
                }}
                transition="all 0.2s"
              >
                Begin Setup
                <Icon ml="2">
                  <LuArrowRight />
                </Icon>
              </Button>
            </Link>
            <Text fontSize="sm" color="fg.muted">
              Takes about 5 minutes to complete
            </Text>
          </VStack>
        </VStack>
      </Container>
    </Box>
  );
}
