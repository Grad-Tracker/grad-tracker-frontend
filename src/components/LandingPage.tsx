"use client";

import {
  Box,
  Button,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LinkButton } from "@/components/ui/link-button";
import {
  LuArrowRight,
  LuCheck,
  LuGraduationCap,
} from "react-icons/lu";
import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  return (
    <Box
      minH="100vh"
      fontFamily="var(--font-dm-sans), sans-serif"
      position="relative"
    >
      {/* ===== HERO — Campus photo background ===== */}
      <Box
        position="relative"
        minH={{ base: "600px", md: "700px", lg: "90vh" }}
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        textAlign="center"
        px={{ base: "6", md: "12" }}
        py={{ base: "20", md: "24" }}
        overflow="hidden"
      >
        {/* Campus background image */}
        <Image
          src="/landing/Parkside_Hero.jpg"
          alt="UW-Parkside Campus aerial view"
          fill
          style={{ objectFit: "cover", objectPosition: "center" }}
          priority

        />

        {/* Dark overlay */}
        <Box
          position="absolute"
          inset="0"
          zIndex="1"
          style={{
            background: "linear-gradient(to bottom, rgba(15,23,42,0.5) 0%, rgba(15,23,42,0.6) 40%, rgba(15,23,42,0.8) 100%)",
          }}
        />

        {/* Floating top bar: logo + sign in */}
        <Flex
          position="absolute"
          top="0"
          left="0"
          right="0"
          justify="space-between"
          align="center"
          px={{ base: "6", md: "12" }}
          py="5"
          zIndex="10"
        >
          <HStack gap="3">
            <Flex
              align="center"
              justify="center"
              w="8"
              h="8"
              bg="rgba(255,255,255,0.15)"
              css={{ backdropFilter: "blur(8px)" }}
              border="1px solid rgba(255,255,255,0.2)"
              borderRadius="lg"
            >
              <Icon color="white" boxSize="4">
                <LuGraduationCap />
              </Icon>
            </Flex>
            <Text fontWeight="700" fontSize="md" color="white">
              GradTracker{" "}
              <Text as="span" color="whiteAlpha.600" fontWeight="500" fontSize="sm">
                Parkside
              </Text>
            </Text>
          </HStack>
          <LinkButton
            href="/signin"
            variant="plain"
            color="whiteAlpha.700"
            fontWeight="500"
            fontSize="sm"
            _hover={{ color: "white" }}
          >
            Sign In
          </LinkButton>
        </Flex>

        {/* Hero content */}
        <VStack gap="7" position="relative" zIndex="2" maxW="700px">
          {/* Badge */}
          <Box
            display="inline-flex"
            alignItems="center"
            gap="2"
            px="4"
            py="1.5"
            borderRadius="full"
            fontSize="xs"
            fontWeight="600"
            color="white"
            bg="rgba(255,255,255,0.12)"
            border="1px solid rgba(255,255,255,0.2)"
            backdropFilter="blur(8px)"
          >
            <Box w="1.5" h="1.5" borderRadius="full" bg="blue.400" />
            Built for Parkside Rangers
          </Box>

          {/* Headline */}
          <Heading
            fontFamily="var(--font-dm-sans), sans-serif"
            fontSize={{ base: "4xl", md: "5xl", lg: "6xl" }}
            fontWeight="400"
            lineHeight="1.08"
            letterSpacing="-0.035em"
            color="white"
          >
            Your degree.
            <br />
            Your plan.
            <br />
            <Text
              as="span"
              style={{
                background: "linear-gradient(135deg, #93C5FD, #C4B5FD)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Your future.
            </Text>
          </Heading>

          {/* Subtitle */}
          <Text
            fontSize={{ base: "md", md: "lg" }}
            color="whiteAlpha.700"
            lineHeight="1.6"
            maxW="520px"
          >
            Track every requirement, plan every semester, and get AI-powered
            guidance — built specifically for UW-Parkside students.
          </Text>

          {/* CTA buttons */}
          <HStack gap="3" flexWrap="wrap" justify="center">
            <Link href="/signup">
              <Button
                size="lg"
                bg="white"
                color="#1E3A5F"
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
                Start Tracking
                <Icon ml="2">
                  <LuArrowRight />
                </Icon>
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              color="white"
              borderColor="rgba(255,255,255,0.3)"
              borderWidth="1.5px"
              rounded="full"
              px="8"
              fontWeight="600"
              _hover={{
                bg: "rgba(255,255,255,0.08)",
                borderColor: "rgba(255,255,255,0.5)",
              }}
              transition="all 0.2s"
            >
              See How It Works
            </Button>
          </HStack>

          {/* Inline stats */}
          <HStack
            gap={{ base: "4", md: "8" }}
            flexWrap="wrap"
            justify="center"
          >
            {[
              { num: "40+", label: "Programs" },
              { num: "2,200+", label: "Courses" },
              { num: "135", label: "Catalogs" },
              { num: "Free", label: "For Students" },
            ].map((stat, i) => (
              <HStack key={stat.label} gap="1.5" align="baseline">
                {i > 0 && (
                  <Box
                    w="1px"
                    h="4"
                    bg="rgba(255,255,255,0.15)"
                    mr="3"
                    display={{ base: "none", md: "block" }}
                  />
                )}
                <Text fontWeight="700" fontSize="sm" color="white">
                  {stat.num}
                </Text>
                <Text fontSize="xs" color="whiteAlpha.500" fontWeight="500">
                  {stat.label}
                </Text>
              </HStack>
            ))}
          </HStack>
        </VStack>

        {/* Campus credit */}
        <Text
          position="absolute"
          bottom="3"
          right="4"
          zIndex="5"
          fontSize="2xs"
          color="whiteAlpha.300"
          fontWeight="500"
        >
          UW-Parkside Campus
        </Text>
      </Box>

      {/* ===== PRODUCT SCREENSHOT — overlaps hero ===== */}
      <Box
        px={{ base: "4", md: "12" }}
        mt={{ base: "-8", md: "-12" }}
        position="relative"
        zIndex="3"
        textAlign="center"
      >
        <Box
          position="relative"
          maxW="960px"
          mx="auto"
        >
          <Box
            borderRadius="xl"
            borderWidth="1px"
            borderColor="border"
            boxShadow="0 4px 6px rgba(0,0,0,0.04), 0 20px 40px rgba(0,0,0,0.08), 0 40px 80px rgba(0,0,0,0.06)"
            overflow="hidden"
            bg="bg"
          >
            <Image
              src="/landing/Dashboard_page.png"
              alt="GradTracker Dashboard"
              width={1920}
              height={1080}
              style={{ width: "100%", height: "auto", display: "block" }}
    
            />
          </Box>
          {/* Bottom fade */}
          <Box
            position="absolute"
            bottom="0"
            left="0"
            right="0"
            h="180px"
            style={{
              background: "linear-gradient(to top, var(--chakra-colors-bg) 0%, transparent 100%)",
            }}
            pointerEvents="none"
            zIndex="2"
          />
        </Box>
      </Box>

      {/* ===== FEATURES — Bento Grid ===== */}
      <Box py={{ base: "10", md: "20" }}>
        <Container maxW="960px" mx="auto" px={{ base: "4", md: "6" }}>
          {/* Section header */}
          <VStack gap="3" textAlign="center" mb={{ base: "10", md: "14" }}>
            <Heading
              fontFamily="var(--font-dm-sans), sans-serif"
              fontSize={{ base: "3xl", md: "4xl" }}
              fontWeight="400"
              letterSpacing="-0.02em"
            >
              Everything you need to graduate on time
            </Heading>
            <Text fontSize="md" color="fg.muted" maxW="480px" lineHeight="1.6">
              Six tools working together to keep you on track from enrollment to
              commencement.
            </Text>
          </VStack>

          {/* Bento grid */}
          <Grid
            templateColumns={{ base: "1fr", md: "1fr 1fr" }}
            gap="4"
          >
            {/* 1. Semester Planner — wide */}
            <BentoCard
              title="Semester Planner"
              description="Build your path to graduation semester by semester. Drag courses, track credits, and see your degree progress update in real time."
              wide
            >
              <ScreenshotVisual
                src="/landing/Planner_Page.png"
                alt="Semester Planner"
              />
            </BentoCard>

            {/* 2. Course Catalog */}
            <BentoCard
              title="Course Catalog"
              description="Browse 2,200+ courses with credits, prerequisites, and requirement mapping."
            >
              <ScreenshotVisual
                src="/landing/Courses_Page.png"
                alt="Course Catalog"
              />
            </BentoCard>

            {/* 3. Requirement Breakdown */}
            <BentoCard
              title="Requirement Breakdown"
              description="Every gen-ed bucket and major block mapped to your program — 106+ programs tracked."
            >
              <ScreenshotVisual
                src="/landing/Programs_Page.png"
                alt="Programs and Requirements"
              />
            </BentoCard>

            {/* 4. AI Advisor — Atlas — wide */}
            <BentoCard
              title="AI Academic Advisor — Atlas"
              description="Get instant, personalized guidance. Atlas knows your progress, your requirements, and your program."
              wide
            >
              <Box
                px={{ base: "4", md: "6" }}
                py="5"
                bg="bg.subtle"
                borderTop="1px solid"
                borderColor="border.subtle"
              >
                <VStack
                  gap="3"
                  maxW="600px"
                  mx="auto"
                  align="stretch"
                >
                  {/* User message */}
                  <Flex justify="flex-end">
                    <HStack gap="2.5" flexDirection="row-reverse" align="flex-start">
                      <Flex
                        w="7"
                        h="7"
                        borderRadius="full"
                        bg="#1E3A5F"
                        color="white"
                        fontWeight="600"
                        fontSize="2xs"
                        align="center"
                        justify="center"
                        flexShrink={0}
                      >
                        LM
                      </Flex>
                      <Box
                        bg="#1E3A5F"
                        color="white"
                        px="3.5"
                        py="2.5"
                        borderRadius="xl"
                        borderBottomRightRadius="sm"
                        fontSize="sm"
                        lineHeight="1.5"
                        maxW="75%"
                      >
                        What should I take next semester to stay on track?
                      </Box>
                    </HStack>
                  </Flex>
                  {/* Atlas reply */}
                  <HStack gap="2.5" align="flex-start">
                    <Flex
                      w="7"
                      h="7"
                      borderRadius="full"
                      style={{
                        background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
                      }}
                      color="white"
                      fontSize="sm"
                      align="center"
                      justify="center"
                      flexShrink={0}
                    >
                      ✦
                    </Flex>
                    <Box
                      bg="bg"
                      border="1px solid"
                      borderColor="border.subtle"
                      px="3.5"
                      py="2.5"
                      borderRadius="xl"
                      borderBottomLeftRadius="sm"
                      fontSize="sm"
                      lineHeight="1.5"
                      maxW="75%"
                    >
                      Based on your progress, I&apos;d recommend{" "}
                      <Text as="strong">CSCI 340</Text> and{" "}
                      <Text as="strong">MATH 221</Text> — both are
                      prerequisites for your senior-year courses. You also need
                      one more Humanities gen-ed.
                      <br />
                      <br />
                      Would you like me to add these to your semester plan?
                    </Box>
                  </HStack>
                </VStack>
              </Box>
            </BentoCard>

            {/* 5. Degree Progress */}
            <BentoCard
              title="Degree Progress"
              description="See your overall completion, credits earned, and what's left at a glance."
            >
              <ScreenshotVisual
                src="/landing/Dashboard_page.png"
                alt="Degree Progress"
                maxH="220px"
              />
            </BentoCard>

            {/* 6. Easy Onboarding */}
            <BentoCard
              title="Set Up in Minutes"
              description="Pick your major, add your courses, and start tracking immediately."
            >
              <Box px="6" py="5" bg="bg.subtle" borderTop="1px solid" borderColor="border.subtle">
                <VStack align="stretch" gap="0">
                  {[
                    { num: 1, title: "Choose your program", desc: "Select from 40+ Parkside degrees", done: true },
                    { num: 2, title: "Add completed courses", desc: "Enter courses or transfer credits", current: true },
                    { num: 3, title: "Start tracking", desc: "See your progress instantly" },
                  ].map((step, i) => (
                    <Flex key={i} gap="3.5" align="flex-start" position="relative" pb={i < 2 ? "5" : "0"}>
                      {/* Connecting line */}
                      {i < 2 && (
                        <Box
                          position="absolute"
                          left="13px"
                          top="28px"
                          bottom="0"
                          w="2px"
                          bg="border"
                        />
                      )}
                      {/* Number circle */}
                      <Flex
                        w="7"
                        h="7"
                        borderRadius="full"
                        align="center"
                        justify="center"
                        fontSize="xs"
                        fontWeight="700"
                        flexShrink={0}
                        position="relative"
                        zIndex="1"
                        {...(step.done
                          ? { bg: "blue.solid", color: "white" }
                          : step.current
                          ? { bg: "bg", border: "2px solid", borderColor: "blue.solid", color: "blue.fg" }
                          : { bg: "bg", border: "2px solid", borderColor: "border", color: "fg.muted" })}
                      >
                        {step.done ? <LuCheck size={12} /> : step.num}
                      </Flex>
                      <Box>
                        <Text fontSize="sm" fontWeight="600">
                          {step.title}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" lineHeight="1.4">
                          {step.desc}
                        </Text>
                      </Box>
                    </Flex>
                  ))}
                </VStack>
              </Box>
            </BentoCard>
          </Grid>
        </Container>
      </Box>

      {/* ===== CTA ===== */}
      <Box
        py={{ base: "16", md: "20" }}
        textAlign="center"
        position="relative"
        overflow="hidden"
        borderTopWidth="1px"
        borderColor="border.subtle"
      >
        {/* Subtle glow */}
        <Box
          position="absolute"
          top="-100px"
          left="50%"
          transform="translateX(-50%)"
          w="700px"
          h="400px"
          bg="blue.500"
          opacity="0.04"
          borderRadius="full"
          filter="blur(100px)"
          pointerEvents="none"
        />

        <Container maxW="lg" mx="auto" position="relative">
          <Heading
            fontFamily="var(--font-dm-sans), sans-serif"
            fontSize={{ base: "3xl", md: "4xl" }}
            fontWeight="400"
            letterSpacing="-0.02em"
            mb="4"
          >
            Ready to graduate on time?
          </Heading>
          <Text fontSize="md" color="fg.muted" mb="8" lineHeight="1.6">
            Free for all UW-Parkside students. Set up in under 5 minutes.
          </Text>
          <Link href="/signup">
            <Button
              size="lg"
              colorPalette="blue"
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
        </Container>
      </Box>

      {/* ===== FOOTER ===== */}
      <Box
        as="footer"
        py="12"
        borderTopWidth="1px"
        borderColor="border.subtle"
      >
        <Container maxW="7xl" mx="auto" px={{ base: "4", md: "6", lg: "8" }}>
          <SimpleGrid columns={{ base: 1, md: 4 }} gap="8">
            <VStack align="start" gap="4">
              <HStack gap="3">
                <Flex
                  align="center"
                  justify="center"
                  w="6"
                  h="6"
                  bg="#1E3A5F"
                  borderRadius="md"
                >
                  <Icon color="white" boxSize="3.5">
                    <LuGraduationCap />
                  </Icon>
                </Flex>
                <Text fontWeight="700" fontSize="sm">
                  GradTracker{" "}
                  <Text as="span" color="fg.muted" fontWeight="500" fontSize="xs">
                    Parkside
                  </Text>
                </Text>
              </HStack>
              <Text color="fg.muted" fontSize="xs" lineHeight="1.5" maxW="200px">
                Built for UW-Parkside students.
              </Text>
            </VStack>

            {[
              {
                title: "Product",
                links: [
                  "Progress Tracking",
                  "Semester Planner",
                  "AI Advisor",
                  "Course Catalog",
                ],
              },
              {
                title: "Resources",
                links: ["UW-Parkside", "Academic Calendar", "SOLAR"],
              },
              {
                title: "Support",
                links: ["Help Center", "Contact Advising", "FAQ"],
              },
            ].map((section) => (
              <VStack align="start" gap="3" key={section.title}>
                <Text
                  fontWeight="600"
                  fontSize="xs"
                  letterSpacing="0.5px"
                  textTransform="uppercase"
                >
                  {section.title}
                </Text>
                <VStack align="start" gap="1.5">
                  {section.links.map((link) => (
                    <Text
                      key={link}
                      color="fg.muted"
                      fontSize="sm"
                      cursor="pointer"
                      _hover={{ color: "blue.fg" }}
                      transition="color 0.2s"
                      lineHeight="2"
                    >
                      {link}
                    </Text>
                  ))}
                </VStack>
              </VStack>
            ))}
          </SimpleGrid>
        </Container>
      </Box>
    </Box>
  );
}

/* ===== Sub-components ===== */

function BentoCard({
  title,
  description,
  wide,
  children,
}: {
  title: string;
  description: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box
      bg="bg"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="2xl"
      overflow="hidden"
      gridColumn={wide ? { base: "span 1", md: "span 2" } : undefined}
      transition="all 0.3s"
      _hover={{
        transform: "translateY(-4px)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.06)",
      }}
    >
      <Box px={{ base: "5", md: "6" }} pt={{ base: "5", md: "6" }}>
        <Heading
          fontSize="lg"
          fontWeight="600"
          fontFamily="var(--font-dm-sans), sans-serif"
          mb="1.5"
        >
          {title}
        </Heading>
        <Text fontSize="sm" color="fg.muted" lineHeight="1.5">
          {description}
        </Text>
      </Box>
      {children}
    </Box>
  );
}

function ScreenshotVisual({
  src,
  alt,
  maxH,
}: {
  src: string;
  alt: string;
  maxH?: string;
}) {
  return (
    <Box
      mt="4"
      position="relative"
      overflow="hidden"
      borderTop="1px solid"
      borderColor="border.subtle"
      maxH={maxH}
    >
      <Image
        src={src}
        alt={alt}
        width={1920}
        height={1080}
        style={{ width: "100%", height: "auto", display: "block" }}
      />
      {/* Bottom fade */}
      <Box
        position="absolute"
        bottom="0"
        left="0"
        right="0"
        h="60px"
        style={{
          background: "linear-gradient(to top, var(--chakra-colors-bg) 0%, transparent 100%)",
        }}
        pointerEvents="none"
      />
    </Box>
  );
}
