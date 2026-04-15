"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LinkButton } from "@/components/ui/link-button";
import {
  LuArrowRight,
  LuBookOpen,
  LuCalendarRange,

  LuGraduationCap,
  LuLayoutGrid,
  LuMousePointerClick,
  LuSparkles,
  LuTrendingUp,
  LuUserPlus,
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
      <Box
        as="header"
        position="absolute"
        top="0"
        left="0"
        right="0"
        zIndex="10"
      >
        <Flex
          justify="space-between"
          align="center"
          px={{ base: "6", md: "12" }}
          py="5"
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
      </Box>

      <Box>
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

          {/* Hero content */}
          <VStack gap="7" position="relative" zIndex="2" maxW="700px">
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
              onClick={() =>
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })
              }
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
        <Box position="relative" zIndex="3">
        <FadeIn>
        <Box
          px={{ base: "4", md: "12" }}
          mt={{ base: "-8", md: "-12" }}
          textAlign="center"
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
            {/* Browser chrome */}
            <Flex
              align="center"
              px="4"
              py="3"
              bg="bg.subtle"
              borderBottomWidth="1px"
              borderColor="border.subtle"
              gap="2"
            >
              <HStack gap="1.5">
                <Box w="3" h="3" borderRadius="full" bg="red.400" />
                <Box w="3" h="3" borderRadius="full" bg="yellow.400" />
                <Box w="3" h="3" borderRadius="full" bg="green.400" />
              </HStack>
              <Box
                flex="1"
                maxW="360px"
                mx="auto"
                bg="bg"
                borderRadius="md"
                px="3"
                py="1"
                borderWidth="1px"
                borderColor="border.subtle"
              >
                <Text fontSize="2xs" color="fg.muted" textAlign="center" fontFamily="monospace">
                  gradtracker.app/dashboard
                </Text>
              </Box>
            </Flex>
            <Image
              src="/landing/Dashboard_page.png"
              alt="GradTracker Dashboard"
              width={1920}
              height={1080}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </Box>
        </Box>
        </FadeIn>
        </Box>

        {/* ===== HOW IT WORKS ===== */}
        <Box id="how-it-works" py={{ base: "16", md: "24" }} scrollMarginTop="4">
        <Container maxW="960px" mx="auto" px={{ base: "4", md: "6" }}>
          <FadeIn>
          <VStack gap="3" textAlign="center" mb={{ base: "12", md: "16" }}>
            <Text
              fontSize="xs"
              fontWeight="700"
              letterSpacing="1.5px"
              textTransform="uppercase"
              color="blue.fg"
            >
              How it works
            </Text>
            <Heading
              fontFamily="var(--font-dm-sans), sans-serif"
              fontSize={{ base: "3xl", md: "4xl" }}
              fontWeight="400"
              letterSpacing="-0.02em"
            >
              Three steps to graduation clarity
            </Heading>
          </VStack>
          </FadeIn>

          <Grid
            templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }}
            gap={{ base: "8", md: "6" }}
            position="relative"
          >
            {/* Connecting line (desktop only) */}
            <Box
              display={{ base: "none", md: "block" }}
              position="absolute"
              top="36px"
              left="calc(16.67% + 20px)"
              right="calc(16.67% + 20px)"
              h="2px"
              style={{
                background: "linear-gradient(90deg, #3B82F6, #8B5CF6)",
                opacity: 0.2,
              }}
            />

            {[
              {
                icon: LuUserPlus,
                step: "01",
                title: "Create your account",
                desc: "Sign up free with your Parkside email. Takes less than a minute.",
                color: "#3B82F6",
              },
              {
                icon: LuMousePointerClick,
                step: "02",
                title: "Select your program",
                desc: "Choose your major, minor, or certificates from 40+ Parkside programs.",
                color: "#6366F1",
              },
              {
                icon: LuTrendingUp,
                step: "03",
                title: "Track your progress",
                desc: "See exactly where you stand and what you need to graduate on time.",
                color: "#8B5CF6",
              },
            ].map((item, i) => (
              <FadeIn key={item.step} delay={i * 0.12}>
              <VStack gap="4" textAlign="center" position="relative">
                <Flex
                  w="14"
                  h="14"
                  borderRadius="2xl"
                  align="center"
                  justify="center"
                  bg="bg"
                  border="1px solid"
                  borderColor="border.subtle"
                  boxShadow="0 2px 8px rgba(0,0,0,0.04)"
                  position="relative"
                  zIndex="1"
                >
                  <Icon boxSize="6" color={item.color}>
                    <item.icon />
                  </Icon>
                </Flex>
                <Text
                  fontSize="2xs"
                  fontWeight="700"
                  letterSpacing="1px"
                  color="fg.subtle"
                >
                  STEP {item.step}
                </Text>
                <Heading
                  fontSize="md"
                  fontWeight="600"
                  fontFamily="var(--font-dm-sans), sans-serif"
                >
                  {item.title}
                </Heading>
                <Text fontSize="sm" color="fg.muted" lineHeight="1.6" maxW="280px">
                  {item.desc}
                </Text>
              </VStack>
              </FadeIn>
            ))}
          </Grid>
        </Container>
        </Box>

        {/* ===== FEATURES — Bento Grid ===== */}
        <Box py={{ base: "10", md: "20" }} borderTopWidth="1px" borderColor="border.subtle">
        <Container maxW="960px" mx="auto" px={{ base: "4", md: "6" }}>
          <FadeIn>
          <VStack gap="3" textAlign="center" mb={{ base: "10", md: "14" }}>
            <Text
              fontSize="xs"
              fontWeight="700"
              letterSpacing="1.5px"
              textTransform="uppercase"
              color="blue.fg"
            >
              Features
            </Text>
            <Heading
              fontFamily="var(--font-dm-sans), sans-serif"
              fontSize={{ base: "3xl", md: "4xl" }}
              fontWeight="400"
              letterSpacing="-0.02em"
            >
              Everything you need to graduate on time
            </Heading>
            <Text fontSize="md" color="fg.muted" maxW="480px" lineHeight="1.6">
              Plan, track, and get guidance — everything working together from
              enrollment to commencement.
            </Text>
          </VStack>
          </FadeIn>

          <FadeIn delay={0.1}>
          <Grid
            templateColumns={{ base: "1fr", md: "1fr 1fr" }}
            gap="4"
          >
            {/* 1. Semester Planner — wide */}
            <BentoCard
              icon={LuCalendarRange}
              iconColor="#3B82F6"
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
              icon={LuBookOpen}
              iconColor="#6366F1"
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
              icon={LuLayoutGrid}
              iconColor="#8B5CF6"
              title="Requirement Breakdown"
              description="Every gen-ed bucket and major block mapped to your program — 106+ programs tracked."
            >
              <ScreenshotVisual
                src="/landing/Programs_Page.png"
                alt="Programs and Requirements"
              />
            </BentoCard>

            {/* 4. AI Advisor — wide */}
            <BentoCard
              icon={LuSparkles}
              iconColor="#EC4899"
              title="AI Academic Advisor"
              description="Get instant, personalized guidance. Knows your progress, your requirements, and your program."
              wide
            >
              <Box
                px={{ base: "4", md: "6" }}
                py="5"
                bg="bg.subtle"
                borderTop="1px solid"
                borderColor="border.subtle"
                position="relative"
                overflow="hidden"
              >
                {/* Subtle gradient accent */}
                <Box
                  position="absolute"
                  top="0"
                  left="0"
                  right="0"
                  h="1px"
                  style={{
                    background: "linear-gradient(90deg, transparent, #EC4899, #8B5CF6, transparent)",
                    opacity: 0.4,
                  }}
                />
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
                        JM
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
                  {/* AI reply */}
                  <HStack gap="2.5" align="flex-start">
                    <Flex
                      w="7"
                      h="7"
                      borderRadius="full"
                      style={{
                        background: "linear-gradient(135deg, #EC4899, #8B5CF6)",
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

          </Grid>
          </FadeIn>
        </Container>
        </Box>

        {/* ===== CTA ===== */}
        <Box
          position="relative"
          overflow="hidden"
          style={{
            background: "linear-gradient(to bottom, #0F172A 0%, #0B1120 100%)",
          }}
        >
          {/* Background glow */}
          <Box
            position="absolute"
            top="-200px"
            left="50%"
            transform="translateX(-50%)"
            w="800px"
            h="600px"
            borderRadius="full"
            style={{
              background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)",
            }}
            pointerEvents="none"
          />
          {/* Grid pattern overlay */}
          <Box
            position="absolute"
            inset="0"
            opacity="0.03"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
            pointerEvents="none"
          />

          <Box
            py={{ base: "20", md: "28" }}
            textAlign="center"
            position="relative"
          >
            <FadeIn>
            <Container maxW="lg" mx="auto">
              <VStack gap="6">
                <Heading
                  fontFamily="var(--font-dm-sans), sans-serif"
                  fontSize={{ base: "3xl", md: "5xl" }}
                  fontWeight="400"
                  letterSpacing="-0.03em"
                  lineHeight="1.1"
                  color="white"
                >
                  Your graduation roadmap
                  <br />
                  <Text
                    as="span"
                    style={{
                      background: "linear-gradient(135deg, #93C5FD, #C4B5FD)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    starts here
                  </Text>
                </Heading>
                <Text
                  fontSize="md"
                  color="whiteAlpha.600"
                  lineHeight="1.6"
                  maxW="420px"
                >
                  Free for all UW-Parkside students. Set up in under 2 minutes.
                  No credit card required.
                </Text>
                <Link href="/signup">
                  <Button
                    size="lg"
                    bg="white"
                    color="#0F172A"
                    rounded="full"
                    px="10"
                    fontWeight="600"
                    fontSize="md"
                    _hover={{
                      bg: "whiteAlpha.900",
                      transform: "translateY(-2px)",
                      boxShadow: "0 8px 30px rgba(255,255,255,0.15)",
                    }}
                    transition="all 0.2s"
                  >
                    Get Started Free
                    <Icon ml="2">
                      <LuArrowRight />
                    </Icon>
                  </Button>
                </Link>
              </VStack>
            </Container>
            </FadeIn>
          </Box>
        </Box>
      </Box>

      {/* ===== FOOTER ===== */}
      <Box
        position="relative"
        overflow="hidden"
        style={{
          background: "linear-gradient(to bottom, #0F172A 0%, #0B1120 100%)",
        }}
      >
        {/* Background glow */}
        <Box
          position="absolute"
          top="-200px"
          left="50%"
          transform="translateX(-50%)"
          w="800px"
          h="600px"
          borderRadius="full"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)",
          }}
          pointerEvents="none"
        />
        {/* Grid pattern overlay */}
        <Box
          position="absolute"
          inset="0"
          opacity="0.03"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
          pointerEvents="none"
        />

        {/* Footer */}
        <Box
          as="footer"
          py="10"
          position="relative"
          color="whiteAlpha.700"
        >
          <Container maxW="960px" mx="auto" px={{ base: "4", md: "6" }}>
            <Box
              mb="8"
              h="1px"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
              }}
            />
            <Flex
              direction={{ base: "column", md: "row" }}
              justify="space-between"
              align={{ base: "start", md: "center" }}
              gap="6"
            >
              <HStack gap="3">
                <Flex
                  align="center"
                  justify="center"
                  w="6"
                  h="6"
                  bg="whiteAlpha.100"
                  borderRadius="md"
                >
                  <Icon color="white" boxSize="3.5">
                    <LuGraduationCap />
                  </Icon>
                </Flex>
                <Text fontWeight="700" fontSize="sm" color="white">
                  GradTracker{" "}
                  <Text as="span" color="whiteAlpha.400" fontWeight="500" fontSize="xs">
                    Parkside
                  </Text>
                </Text>
              </HStack>

              <HStack gap="6" flexWrap="wrap">
                {["Progress Tracking", "Semester Planner", "AI Advisor", "Course Catalog"].map((link) => (
                  <Text
                    key={link}
                    fontSize="sm"
                  >
                    {link}
                  </Text>
                ))}
              </HStack>
            </Flex>
            <Box mt="8" pt="6">
              <Text fontSize="xs" color="whiteAlpha.400">
                &copy; {new Date().getFullYear()} GradTracker. A project for UW-Parkside.
              </Text>
            </Box>
          </Container>
        </Box>
      </Box>
    </Box>
  );
}

/* ===== Sub-components ===== */

function FadeIn({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={ref}
      opacity={isVisible ? 1 : 0}
      transform={isVisible ? "translateY(0)" : "translateY(24px)"}
      transition={`opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`}
    >
      {children}
    </Box>
  );
}

function BentoCard({
  icon: IconComponent,
  iconColor,
  title,
  description,
  wide,
  children,
}: {
  icon: React.ComponentType;
  iconColor: string;
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
      css={{
        "& img": {
          transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1)",
        },
        "&:hover img": {
          transform: "scale(1.03)",
        },
      }}
    >
      <Box px={{ base: "5", md: "6" }} pt={{ base: "5", md: "6" }}>
        <Flex
          w="9"
          h="9"
          borderRadius="xl"
          align="center"
          justify="center"
          mb="4"
          style={{ backgroundColor: `${iconColor}12` }}
        >
          <Icon boxSize="4.5" color={iconColor}>
            <IconComponent />
          </Icon>
        </Flex>
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
}: {
  src: string;
  alt: string;
}) {
  return (
    <Box
      mt="4"
      overflow="hidden"
      borderTop="1px solid"
      borderColor="border.subtle"
    >
      <Image
        src={src}
        alt={alt}
        width={1920}
        height={1080}
        style={{ width: "100%", height: "auto", display: "block" }}
      />
    </Box>
  );
}
