"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  Input,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ColorModeButton } from "@/components/ui/color-mode";
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import {
  ProgressBar,
  ProgressLabel,
  ProgressRoot,
  ProgressValueText,
} from "@/components/ui/progress";
import {
  ProgressCircleRing,
  ProgressCircleRoot,
  ProgressCircleValueText,
} from "@/components/ui/progress-circle";
import { StatLabel, StatRoot, StatValueText } from "@/components/ui/stat";
import {
  TimelineConnector,
  TimelineContent,
  TimelineItem,
  TimelineRoot,
  TimelineTitle,
} from "@/components/ui/timeline";
import {
  LuChartBar,
  LuBell,
  LuCalendar,
  LuCheck,
  LuSquareCheck,
  LuGraduationCap,
  LuChartPie,
  LuUsers,
  LuArrowRight,
  LuSparkles,
  LuShield,
  LuZap,
  LuLoader,
} from "react-icons/lu";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toaster } from "@/components/ui/toaster";

const features = [
  {
    icon: LuChartBar,
    title: "Credit Tracking",
    description:
      "Track your completed, in-progress, and remaining credits toward your Parkside degree requirements.",
    color: "green",
  },
  {
    icon: LuSquareCheck,
    title: "Parkside Requirements",
    description:
      "Maps directly to UW-Parkside degree programs, general education, and major-specific requirements.",
    color: "teal",
  },
  {
    icon: LuChartPie,
    title: "Progress Visualization",
    description:
      "See your progress toward your Parkside degree at a glance with clear visual indicators.",
    color: "blue",
  },
  {
    icon: LuUsers,
    title: "Advisor Ready",
    description:
      "Generate progress reports to share with your Parkside academic advisor during meetings.",
    color: "purple",
  },
  {
    icon: LuCalendar,
    title: "Semester Planning",
    description:
      "Plan your remaining semesters at Parkside to stay on track for graduation.",
    color: "orange",
  },
  {
    icon: LuBell,
    title: "Requirement Alerts",
    description:
      "Know when you're missing prerequisites or need specific courses before they fill up.",
    color: "pink",
  },
];

const steps = [
  {
    title: "Sign In with Your Parkside Account",
    description:
      "Use your UW-Parkside credentials to securely access your academic information.",
  },
  {
    title: "Select Your Degree Program",
    description:
      "Choose your major from Parkside's catalog and we'll load your specific requirements.",
  },
  {
    title: "Add Your Completed Courses",
    description:
      "Enter the courses you've taken at Parkside or transferred from other institutions.",
  },
  {
    title: "Track and Plan Your Graduation",
    description:
      "See your progress toward your Parkside degree and plan your remaining semesters.",
  },
];

export default function Home() {
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

    setLoading(false);

    if (error) {
      toaster.create({
        title: "Sign in failed",
        description: error.message,
        type: "error",
      });
      return;
    }

    toaster.create({
      title: "Welcome back!",
      description: "Redirecting to your dashboard...",
      type: "success",
    });

    router.push("/dashboard");
  }

  return (
    <Box
      minH="100vh"
      fontFamily="'Plus Jakarta Sans', sans-serif"
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
            <HStack gap="3">
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
                fontFamily="'DM Serif Display', serif"
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
            <HStack gap="3">
              <ColorModeButton variant="ghost" size="sm" />
              <DialogRoot>
                <DialogTrigger asChild>
                  <Button
                    variant="solid"
                    colorPalette="green"
                    size="sm"
                    rounded="full"
                    px="5"
                    fontWeight="600"
                  >
                    Sign In
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-card">
                  <DialogHeader>
                    <DialogTitle fontFamily="'DM Serif Display', serif">
                      Welcome Back, Ranger
                    </DialogTitle>
                  </DialogHeader>
                  <DialogCloseTrigger />
                  <DialogBody pb="6">
                    <VStack gap="5">
                      <Field label="Email">
                        <Input
                          placeholder="your.name@uwp.edu"
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
                      <Button
                        w="full"
                        colorPalette="green"
                        size="lg"
                        rounded="lg"
                        fontWeight="600"
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
                          "Sign In"
                        )}
                      </Button>
                      <Text fontSize="sm" color="fg.muted">
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
                    </VStack>
                  </DialogBody>
                </DialogContent>
              </DialogRoot>
            </HStack>
          </HStack>
        </Container>
      </Box>

      {/* Hero Section */}
      <Box
        className="mesh-gradient noise-overlay"
        py={{ base: "16", md: "24", lg: "32" }}
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

        <Container
          maxW="7xl"
          mx="auto"
          px={{ base: "4", md: "6", lg: "8" }}
          position="relative"
          zIndex="2"
        >
          <Grid
            templateColumns={{ base: "1fr", lg: "1.2fr 1fr" }}
            gap={{ base: "12", lg: "16" }}
            alignItems="center"
          >
            <VStack
              align={{ base: "center", lg: "start" }}
              gap="8"
              textAlign={{ base: "center", lg: "left" }}
            >
              <HStack className="animate-fade-up">
                <Badge
                  colorPalette="green"
                  variant="surface"
                  size="lg"
                  px="4"
                  py="2"
                  rounded="full"
                  fontWeight="600"
                >
                  <Icon boxSize="4" mr="2">
                    <LuSparkles />
                  </Icon>
                  Built for UW-Parkside Students
                </Badge>
              </HStack>

              <Heading
                className="animate-fade-up-delay-1"
                fontFamily="'DM Serif Display', serif"
                size={{ base: "4xl", md: "5xl", lg: "6xl" }}
                lineHeight="1.1"
                letterSpacing="-0.03em"
                fontWeight="400"
              >
                Your Path to{" "}
                <Text as="span" className="gradient-text">
                  Graduation
                </Text>
                , Visualized
              </Heading>

              <Text
                className="animate-fade-up-delay-2"
                fontSize={{ base: "lg", md: "xl" }}
                color="fg.muted"
                maxW="xl"
                lineHeight="1.7"
              >
                Track your completed courses, monitor degree requirements, and
                plan your remaining semesters—all in one place designed
                specifically for Rangers.
              </Text>

              <HStack
                gap="4"
                pt="4"
                className="animate-fade-up-delay-3"
                flexWrap="wrap"
                justify={{ base: "center", lg: "start" }}
              >
                <Link href="/signup">
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
                    Get Started Free
                    <Icon ml="2">
                      <LuArrowRight />
                    </Icon>
                  </Button>
                </Link>

                <Button
                  size="lg"
                  variant="outline"
                  rounded="full"
                  px="8"
                  fontWeight="600"
                  borderWidth="2px"
                  _hover={{
                    bg: "bg.subtle",
                    transform: "translateY(-2px)",
                  }}
                  transition="all 0.2s"
                >
                  See How It Works
                </Button>
              </HStack>

              <HStack
                gap="8"
                pt="6"
                className="animate-fade-up-delay-4"
                color="fg.muted"
                fontSize="sm"
                flexWrap="wrap"
                justify={{ base: "center", lg: "start" }}
              >
                <HStack gap="2">
                  <Icon color="green.solid">
                    <LuShield />
                  </Icon>
                  <Text>Secure & Private</Text>
                </HStack>
                <HStack gap="2">
                  <Icon color="green.solid">
                    <LuZap />
                  </Icon>
                  <Text>Always Free</Text>
                </HStack>
              </HStack>
            </VStack>

            <Center className="animate-scale-in">
              <Box position="relative" className="animate-float">
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
                  minW={{ base: "280px", md: "340px" }}
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
                    <VStack gap="6">
                      <Box position="relative">
                        <ProgressCircleRoot
                          value={72}
                          size="xl"
                          colorPalette="green"
                        >
                          <ProgressCircleRing
                            cap="round"
                            css={{ "--thickness": "8px" }}
                          />
                          <ProgressCircleValueText
                            fontSize="4xl"
                            fontWeight="700"
                            fontFamily="'DM Serif Display', serif"
                          />
                        </ProgressCircleRoot>
                      </Box>
                      <VStack gap="2">
                        <Text
                          fontWeight="700"
                          fontSize="xl"
                          fontFamily="'DM Serif Display', serif"
                        >
                          Graduation Progress
                        </Text>
                        <Text color="fg.muted" fontSize="sm">
                          86 of 120 credits completed
                        </Text>
                      </VStack>
                      <HStack gap="4" w="full" justify="center">
                        <VStack gap="0">
                          <Text fontWeight="700" fontSize="lg" color="green.fg">
                            34
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            Remaining
                          </Text>
                        </VStack>
                        <Box w="1px" h="8" bg="border.muted" />
                        <VStack gap="0">
                          <Text fontWeight="700" fontSize="lg" color="blue.fg">
                            12
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            In Progress
                          </Text>
                        </VStack>
                        <Box w="1px" h="8" bg="border.muted" />
                        <VStack gap="0">
                          <Text
                            fontWeight="700"
                            fontSize="lg"
                            color="teal.solid"
                          >
                            3
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            Semesters
                          </Text>
                        </VStack>
                      </HStack>
                    </VStack>
                  </Card.Body>
                </Card.Root>
              </Box>
            </Center>
          </Grid>
        </Container>
      </Box>

      {/* Stats Section */}
      <Box py="16" borderBottomWidth="1px" borderColor="border.subtle">
        <Container maxW="7xl" mx="auto" px={{ base: "4", md: "6", lg: "8" }}>
          <SimpleGrid columns={{ base: 2, md: 4 }} gap={{ base: "6", md: "8" }}>
            {[
              { value: "40+", label: "Degree Programs" },
              { value: "120", label: "Credits to Graduate" },
              { value: "4", label: "Year Programs" },
              { value: "1", label: "Tool to Track It All" },
            ].map((stat, i) => (
              <StatRoot key={stat.label} textAlign="center">
                <StatValueText
                  fontSize={{ base: "3xl", md: "5xl" }}
                  fontWeight="400"
                  fontFamily="'DM Serif Display', serif"
                  className="gradient-text"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {stat.value}
                </StatValueText>
                <StatLabel color="fg.muted" fontSize="sm" fontWeight="500">
                  {stat.label}
                </StatLabel>
              </StatRoot>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box py={{ base: "16", md: "24" }} className="mesh-gradient">
        <Container maxW="7xl" mx="auto" px={{ base: "4", md: "6", lg: "8" }}>
          <VStack gap="16" align="center">
            <VStack gap="5" textAlign="center" maxW="2xl" mx="auto">
              <Badge
                colorPalette="green"
                variant="surface"
                size="lg"
                px="4"
                py="2"
                rounded="full"
              >
                Features
              </Badge>
              <Heading
                fontFamily="'DM Serif Display', serif"
                size={{ base: "3xl", md: "4xl" }}
                letterSpacing="-0.02em"
                fontWeight="400"
              >
                Built for Parkside Rangers
              </Heading>
              <Text fontSize="lg" color="fg.muted" lineHeight="1.7">
                Designed specifically for UW-Parkside degree requirements,
                course catalogs, and graduation pathways.
              </Text>
            </VStack>

            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="6" w="full">
              {features.map((feature, index) => (
                <Card.Root
                  key={feature.title}
                  bg="bg"
                  p="0"
                  borderRadius="2xl"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  overflow="hidden"
                  _hover={{
                    borderColor: `${feature.color}.solid`,
                    transform: "translateY(-4px)",
                    boxShadow: "xl",
                  }}
                  transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <Card.Body p="6">
                    <VStack align="start" gap="4">
                      <Flex
                        align="center"
                        justify="center"
                        w="12"
                        h="12"
                        bg={`${feature.color}.subtle`}
                        borderRadius="xl"
                        color={`${feature.color}.fg`}
                      >
                        <Icon boxSize="6">
                          <feature.icon />
                        </Icon>
                      </Flex>
                      <VStack align="start" gap="2">
                        <Heading
                          size="md"
                          fontWeight="600"
                          letterSpacing="-0.01em"
                        >
                          {feature.title}
                        </Heading>
                        <Text color="fg.muted" lineHeight="1.6" fontSize="sm">
                          {feature.description}
                        </Text>
                      </VStack>
                    </VStack>
                  </Card.Body>
                </Card.Root>
              ))}
            </SimpleGrid>
          </VStack>
        </Container>
      </Box>

      {/* How It Works Section */}
      <Box bg="bg.subtle" py={{ base: "16", md: "24" }}>
        <Container maxW="5xl" mx="auto" px={{ base: "4", md: "6", lg: "8" }}>
          <Grid
            templateColumns={{ base: "1fr", lg: "1fr 1.2fr" }}
            gap={{ base: "12", lg: "16" }}
            alignItems="center"
          >
            <VStack align={{ base: "center", lg: "start" }} gap="6">
              <Badge
                colorPalette="teal"
                variant="surface"
                size="lg"
                px="4"
                py="2"
                rounded="full"
              >
                How It Works
              </Badge>
              <Heading
                fontFamily="'DM Serif Display', serif"
                size={{ base: "3xl", md: "4xl" }}
                letterSpacing="-0.02em"
                fontWeight="400"
                textAlign={{ base: "center", lg: "left" }}
              >
                Get started in minutes
              </Heading>
              <Text
                fontSize="lg"
                color="fg.muted"
                lineHeight="1.7"
                textAlign={{ base: "center", lg: "left" }}
              >
                Simple setup, powerful insights. Your graduation roadmap awaits.
              </Text>
            </VStack>

            <TimelineRoot size="lg">
              {steps.map((step, index) => (
                <TimelineItem key={index}>
                  <TimelineConnector>
                    <Center
                      w="10"
                      h="10"
                      bg={index === 0 ? "green.solid" : "bg"}
                      borderWidth="2px"
                      borderColor={index === 0 ? "green.solid" : "green.muted"}
                      borderRadius="full"
                      color={index === 0 ? "white" : "green.fg"}
                      fontWeight="700"
                      fontSize="sm"
                    >
                      {index + 1}
                    </Center>
                  </TimelineConnector>
                  <TimelineContent pb="8">
                    <TimelineTitle fontWeight="600" fontSize="md" mb="1">
                      {step.title}
                    </TimelineTitle>
                    <Text color="fg.muted" fontSize="sm" lineHeight="1.6">
                      {step.description}
                    </Text>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </TimelineRoot>
          </Grid>
        </Container>
      </Box>

      {/* Progress Demo Section */}
      <Box py={{ base: "16", md: "24" }}>
        <Container maxW="7xl" mx="auto" px={{ base: "4", md: "6", lg: "8" }}>
          <Grid
            templateColumns={{ base: "1fr", lg: "1fr 1fr" }}
            gap={{ base: "12", lg: "16" }}
            alignItems="center"
          >
            <Card.Root
              bg="bg"
              p={{ base: "6", md: "8" }}
              borderRadius="2xl"
              borderWidth="1px"
              borderColor="border.subtle"
              boxShadow="lg"
            >
              <Card.Body p="0">
                <VStack align="stretch" gap="6">
                  <HStack justify="space-between" align="center">
                    <Heading
                      size="lg"
                      fontFamily="'DM Serif Display', serif"
                      fontWeight="400"
                    >
                      Your Dashboard
                    </Heading>
                    <Badge colorPalette="green" variant="surface" size="sm">
                      Demo
                    </Badge>
                  </HStack>

                  <Stack gap="5">
                    <ProgressRoot value={72} colorPalette="green" size="sm">
                      <HStack justify="space-between" mb="2">
                        <ProgressLabel fontWeight="500" fontSize="sm">
                          Overall Completion
                        </ProgressLabel>
                        <ProgressValueText fontWeight="600" fontSize="sm" />
                      </HStack>
                      <ProgressBar rounded="full" />
                    </ProgressRoot>

                    <ProgressRoot value={100} colorPalette="teal" size="sm">
                      <HStack justify="space-between" mb="2">
                        <ProgressLabel fontWeight="500" fontSize="sm">
                          General Education
                        </ProgressLabel>
                        <ProgressValueText fontWeight="600" fontSize="sm" />
                      </HStack>
                      <ProgressBar rounded="full" />
                    </ProgressRoot>

                    <ProgressRoot value={85} colorPalette="blue" size="sm">
                      <HStack justify="space-between" mb="2">
                        <ProgressLabel fontWeight="500" fontSize="sm">
                          Major Requirements
                        </ProgressLabel>
                        <ProgressValueText fontWeight="600" fontSize="sm" />
                      </HStack>
                      <ProgressBar rounded="full" />
                    </ProgressRoot>

                    <ProgressRoot value={40} colorPalette="orange" size="sm">
                      <HStack justify="space-between" mb="2">
                        <ProgressLabel fontWeight="500" fontSize="sm">
                          Electives
                        </ProgressLabel>
                        <ProgressValueText fontWeight="600" fontSize="sm" />
                      </HStack>
                      <ProgressBar rounded="full" />
                    </ProgressRoot>
                  </Stack>
                </VStack>
              </Card.Body>
            </Card.Root>

            <VStack
              align={{ base: "center", lg: "start" }}
              gap="6"
              textAlign={{ base: "center", lg: "left" }}
            >
              <Badge
                colorPalette="blue"
                variant="surface"
                size="lg"
                px="4"
                py="2"
                rounded="full"
              >
                Progress Tracking
              </Badge>
              <Heading
                fontFamily="'DM Serif Display', serif"
                size={{ base: "2xl", md: "3xl" }}
                letterSpacing="-0.02em"
                fontWeight="400"
              >
                See Your Progress at a Glance
              </Heading>
              <Text fontSize="lg" color="fg.muted" lineHeight="1.7">
                Your personalized dashboard breaks down progress by category so
                you always know exactly what you have left to complete.
              </Text>
              <VStack
                align={{ base: "center", lg: "start" }}
                gap="3"
                pt="2"
                w="full"
              >
                {[
                  "Track multiple requirement categories",
                  "Real-time progress updates",
                  "Color-coded completion status",
                  "Export reports for advisors",
                ].map((item) => (
                  <HStack key={item} gap="3">
                    <Flex
                      align="center"
                      justify="center"
                      w="6"
                      h="6"
                      bg="green.subtle"
                      borderRadius="full"
                    >
                      <Icon color="green.fg" boxSize="3.5">
                        <LuCheck />
                      </Icon>
                    </Flex>
                    <Text fontSize="sm" fontWeight="500">
                      {item}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </VStack>
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        position="relative"
        overflow="hidden"
        py={{ base: "16", md: "24" }}
        bg="green.950"
        _light={{ bg: "green.600" }}
      >
        {/* Decorative elements */}
        <Box
          position="absolute"
          top="-50%"
          right="-20%"
          w="600px"
          h="600px"
          bg="green.500"
          opacity="0.15"
          borderRadius="full"
          filter="blur(100px)"
        />
        <Box
          position="absolute"
          bottom="-50%"
          left="-20%"
          w="500px"
          h="500px"
          bg="teal.500"
          opacity="0.1"
          borderRadius="full"
          filter="blur(80px)"
        />

        <Container
          maxW="4xl"
          mx="auto"
          px={{ base: "4", md: "6", lg: "8" }}
          position="relative"
          zIndex="2"
        >
          <VStack gap="8" textAlign="center">
            <Heading
              fontFamily="'DM Serif Display', serif"
              size={{ base: "3xl", md: "4xl", lg: "5xl" }}
              color="white"
              letterSpacing="-0.02em"
              fontWeight="400"
              lineHeight="1.2"
            >
              Ready to Graduate
              <br />
              on Time, Ranger?
            </Heading>
            <Text
              fontSize={{ base: "lg", md: "xl" }}
              color="whiteAlpha.800"
              maxW="2xl"
              lineHeight="1.7"
            >
              Take control of your Parkside academic journey. Start tracking
              your progress toward your degree today — it&apos;s free for all
              UW-Parkside students.
            </Text>
            <HStack gap="4" pt="4" flexWrap="wrap" justify="center">
              <Button
                size="lg"
                bg="white"
                color="green.700"
                rounded="full"
                px="8"
                fontWeight="600"
                _hover={{
                  bg: "whiteAlpha.900",
                  transform: "translateY(-2px)",
                  boxShadow: "xl",
                }}
                transition="all 0.2s"
              >
                Get Started Free
                <Icon ml="2">
                  <LuArrowRight />
                </Icon>
              </Button>
              <Button
                size="lg"
                variant="outline"
                color="white"
                borderColor="whiteAlpha.400"
                borderWidth="2px"
                rounded="full"
                px="8"
                fontWeight="600"
                _hover={{
                  bg: "whiteAlpha.100",
                  borderColor: "whiteAlpha.600",
                }}
              >
                Learn More
              </Button>
            </HStack>
          </VStack>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        as="footer"
        bg="bg"
        py="12"
        borderTopWidth="1px"
        borderColor="border.subtle"
      >
        <Container maxW="7xl" mx="auto" px={{ base: "4", md: "6", lg: "8" }}>
          <SimpleGrid columns={{ base: 1, md: 4 }} gap="8">
            <VStack align="start" gap="4">
              <HStack gap="3">
                <Box p="2" bg="green.solid" borderRadius="lg">
                  <Icon color="white" boxSize="4">
                    <LuGraduationCap />
                  </Icon>
                </Box>
                <Text
                  fontWeight="700"
                  fontSize="lg"
                  fontFamily="'DM Serif Display', serif"
                >
                  GradTracker
                </Text>
              </HStack>
              <Text color="fg.muted" fontSize="sm" lineHeight="1.6">
                A graduation tracking tool built specifically for UW-Parkside
                students.
              </Text>
            </VStack>

            {[
              {
                title: "Resources",
                links: [
                  "Degree Programs",
                  "Course Catalog",
                  "Academic Calendar",
                ],
              },
              {
                title: "Support",
                links: ["Help Center", "Contact Advising", "FAQ"],
              },
              {
                title: "UW-Parkside",
                links: ["University Website", "SOLAR", "Rangers Athletics"],
              },
            ].map((section) => (
              <VStack align="start" gap="4" key={section.title}>
                <Text fontWeight="600" fontSize="sm" letterSpacing="0.02em">
                  {section.title}
                </Text>
                <VStack align="start" gap="2">
                  {section.links.map((link) => (
                    <Text
                      key={link}
                      color="fg.muted"
                      fontSize="sm"
                      cursor="pointer"
                      _hover={{ color: "green.fg" }}
                      transition="color 0.2s"
                    >
                      {link}
                    </Text>
                  ))}
                </VStack>
              </VStack>
            ))}
          </SimpleGrid>

          <Box
            pt="8"
            mt="8"
            borderTopWidth="1px"
            borderColor="border.subtle"
            textAlign="center"
          >
            <Text color="fg.muted" fontSize="sm">
              © {new Date().getFullYear()} Parkside GradTracker. Built with care
              for UW-Parkside students.
            </Text>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
