"use client";

import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Icon,
  Input,
  Progress,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  LuSparkles,
  LuSend,
  LuBookOpen,
  LuCircleCheck,
  LuClock,
  LuTarget,
} from "react-icons/lu";
import type { ReactNode, ElementType } from "react";

// ─── Static data ─────────────────────────────────────────────────────────────

const promptChips = [
  "What should I take next?",
  "Am I on track to graduate?",
  "Show my remaining requirements",
  "What are my prerequisites?",
];

const creditCategories = [
  { label: "Major Core", completed: 30, required: 42, color: "blue" },
  { label: "Major Electives", completed: 12, required: 18, color: "purple" },
  { label: "General Education", completed: 28, required: 36, color: "blue" },
  { label: "Free Electives", completed: 8, required: 24, color: "orange" },
];

const semesterStats = [
  { label: "Enrolled Courses", value: "4 courses", icon: LuBookOpen, color: "blue" },
  { label: "Credits in Progress", value: "12 cr", icon: LuTarget, color: "purple" },
  { label: "Semesters Remaining", value: "3 semesters", icon: LuClock, color: "orange" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AIMessage({ children, timestamp }: { children: ReactNode; timestamp: string }) {
  return (
    <HStack align="flex-start" gap="3">
      <Box
        w="8"
        h="8"
        borderRadius="full"
        bg="purple.subtle"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
        mt="0.5"
      >
        <Icon boxSize="4" color="purple.fg">
          <LuSparkles />
        </Icon>
      </Box>
      <Box flex="1" minW="0">
        <HStack mb="1" gap="2">
          <Text fontSize="xs" fontWeight="600">
            AI Advisor
          </Text>
          <Text fontSize="2xs" color="fg.muted">
            {timestamp}
          </Text>
        </HStack>
        <Box
          bg="bg"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="xl"
          borderTopLeftRadius="sm"
          p="3.5"
        >
          {children}
        </Box>
      </Box>
    </HStack>
  );
}

function UserMessage({ children, timestamp }: { children: ReactNode; timestamp: string }) {
  return (
    <HStack align="flex-start" gap="3" justify="flex-end">
      <Box maxW="75%">
        <HStack mb="1" gap="2" justify="flex-end">
          <Text fontSize="2xs" color="fg.muted">
            {timestamp}
          </Text>
          <Text fontSize="xs" fontWeight="600">
            You
          </Text>
        </HStack>
        <Box
          bg="blue.500"
          color="white"
          borderRadius="xl"
          borderTopRightRadius="sm"
          px="4"
          py="3"
        >
          <Text fontSize="sm">{children}</Text>
        </Box>
      </Box>
      <Avatar.Root size="sm" colorPalette="blue" flexShrink={0} mt="0.5">
        <Avatar.Fallback name="Alex Johnson" />
      </Avatar.Root>
    </HStack>
  );
}

function CourseChip({
  code,
  title,
  credits,
  note,
  iconColor,
  IconComponent,
}: {
  code: string;
  title: string;
  credits: number;
  note: string;
  iconColor: string;
  IconComponent: ElementType;
}) {
  return (
    <HStack
      px="3"
      py="2"
      bg="bg.subtle"
      borderRadius="lg"
      borderWidth="1px"
      borderColor="border.subtle"
      gap="3"
    >
      <Icon color={iconColor} boxSize="4">
        <IconComponent />
      </Icon>
      <Box flex="1" minW="0">
        <HStack gap="1.5" flexWrap="wrap">
          <Text fontSize="xs" fontWeight="700">
            {code}
          </Text>
          <Text fontSize="xs" color="fg.muted">
            ·
          </Text>
          <Text fontSize="xs" color="fg.muted">
            {title}
          </Text>
        </HStack>
        <Text fontSize="2xs" color="fg.muted">
          {note}
        </Text>
      </Box>
      <Badge colorPalette="gray" variant="subtle" fontSize="2xs" flexShrink={0}>
        {credits} cr
      </Badge>
    </HStack>
  );
}

function TypingMessage() {
  return (
    <HStack align="flex-start" gap="3">
      <Box
        w="8"
        h="8"
        borderRadius="full"
        bg="purple.subtle"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
        mt="0.5"
      >
        <Icon boxSize="4" color="purple.fg">
          <LuSparkles />
        </Icon>
      </Box>
      <Box>
        <HStack mb="1" gap="2">
          <Text fontSize="xs" fontWeight="600">
            AI Advisor
          </Text>
          <Text fontSize="2xs" color="fg.muted">
            2:38 PM
          </Text>
        </HStack>
        <Box
          bg="bg"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="xl"
          borderTopLeftRadius="sm"
          px="4"
          py="3.5"
          display="inline-block"
        >
          <HStack gap="1.5" color="fg.muted">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </HStack>
        </Box>
      </Box>
    </HStack>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIAdvisorPage() {
  return (
    <Box>
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        .typing-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
          display: inline-block;
          animation: typing-bounce 1.3s infinite ease-in-out;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      {/* ── Page Header ───────────────────────────────────────────────── */}
      <HStack gap="3" mb="6" align="flex-start">
        <Box p="2.5" bg="purple.subtle" borderRadius="xl" mt="0.5" flexShrink={0}>
          <Icon color="purple.fg" boxSize="5">
            <LuSparkles />
          </Icon>
        </Box>
        <Box flex="1">
          <HStack gap="3" mb="0.5">
            <Heading size="xl" fontFamily="var(--font-outfit), sans-serif">
              AI Academic Advisor
            </Heading>
            <Badge colorPalette="purple" variant="subtle" size="sm">
              Beta
            </Badge>
          </HStack>
          <Text color="fg.muted" fontSize="sm">
            Get personalized course recommendations, check graduation progress, and plan your
            degree — powered by AI.
          </Text>
        </Box>
      </HStack>

      {/* ── Main: Chat + Context Panel ────────────────────────────────── */}
      <Flex gap="5" align="flex-start">
        {/* ── Chat Column ──────────────────────────────────────────────── */}
        <Box flex="1" minW="0">
          <Box
            bg="bg"
            borderWidth="1px"
            borderColor="border.subtle"
            borderRadius="xl"
            overflow="hidden"
            display="flex"
            flexDirection="column"
          >
            {/* Status bar */}
            <HStack
              px="5"
              py="3"
              borderBottomWidth="1px"
              borderColor="border.subtle"
              bg="bg.subtle"
              gap="2"
            >
              <Box w="2" h="2" borderRadius="full" bg="blue.500" />
              <Text fontSize="xs" fontWeight="600" color="fg.muted">
                AI Advisor is online
              </Text>
              <Text fontSize="2xs" color="fg.subtle" ms="auto">
                Design mockup — responses are not real
              </Text>
            </HStack>

            {/* Messages */}
            <Box
              flex="1"
              overflowY="auto"
              p="5"
              maxH={{ base: "440px", md: "520px" }}
            >
              <VStack align="stretch" gap="5">
                {/* ── AI: Greeting ──────────────────────────────────── */}
                <AIMessage timestamp="2:31 PM">
                  <Text fontSize="sm">
                    Hi Alex! I&apos;m your AI Academic Advisor. I can help you plan your courses,
                    understand graduation requirements, and answer questions about your degree.
                    What would you like to explore today?
                  </Text>
                </AIMessage>

                {/* ── User: Q1 ──────────────────────────────────────── */}
                <UserMessage timestamp="2:32 PM">
                  What courses should I take next semester?
                </UserMessage>

                {/* ── AI: Course recommendations ────────────────────── */}
                <AIMessage timestamp="2:32 PM">
                  <Text fontSize="sm" mb="3">
                    Based on your progress in the{" "}
                    <strong>B.S. Computer Science</strong> program, here&apos;s what I&apos;d
                    recommend for next semester:
                  </Text>

                  {/* Core recommendations */}
                  <Box mb="3">
                    <Badge colorPalette="blue" variant="subtle" fontSize="2xs" mb="2">
                      Core Requirements
                    </Badge>
                    <VStack align="stretch" gap="2">
                      <CourseChip
                        code="CSCI 340"
                        title="Data Structures & Algorithms"
                        credits={3}
                        note="Prereq: CSCI 240 ✓ — satisfies core requirement"
                        iconColor="blue.fg"
                        IconComponent={LuCircleCheck}
                      />
                      <CourseChip
                        code="CSCI 361"
                        title="Computer Organization"
                        credits={3}
                        note="Satisfies Architecture requirement"
                        iconColor="blue.fg"
                        IconComponent={LuCircleCheck}
                      />
                      <CourseChip
                        code="MATH 280"
                        title="Discrete Mathematics"
                        credits={3}
                        note="Required before CSCI 450 and 460"
                        iconColor="blue.fg"
                        IconComponent={LuCircleCheck}
                      />
                    </VStack>
                  </Box>

                  {/* Elective recommendations */}
                  <Box mb="3">
                    <Badge colorPalette="purple" variant="subtle" fontSize="2xs" mb="2">
                      Elective — Choose 1
                    </Badge>
                    <VStack align="stretch" gap="2">
                      <CourseChip
                        code="CSCI 450"
                        title="Software Engineering"
                        credits={3}
                        note="Highly recommended for industry prep"
                        iconColor="purple.fg"
                        IconComponent={LuBookOpen}
                      />
                      <CourseChip
                        code="CSCI 410"
                        title="Database Systems"
                        credits={3}
                        note="Opens pathways to data & backend roles"
                        iconColor="purple.fg"
                        IconComponent={LuBookOpen}
                      />
                    </VStack>
                  </Box>

                  <Box px="3" py="2.5" bg="blue.subtle" borderRadius="lg">
                    <Text fontSize="xs" color="blue.fg" fontWeight="600">
                      ✓ This schedule (15 credits) keeps you on track to graduate May 2026
                    </Text>
                  </Box>
                </AIMessage>

                {/* ── User: Q2 ──────────────────────────────────────── */}
                <UserMessage timestamp="2:35 PM">
                  Can I take CSCI 340 without the prerequisite?
                </UserMessage>

                {/* ── AI: Prereq explanation ────────────────────────── */}
                <AIMessage timestamp="2:35 PM">
                  <Text fontSize="sm" mb="3">
                    CSCI 340 requires{" "}
                    <strong>CSCI 240 (Object-Oriented Programming)</strong> as a prerequisite —
                    and your transcript shows CSCI 240 isn&apos;t completed yet.
                  </Text>

                  <Box
                    px="3"
                    py="2.5"
                    bg="orange.subtle"
                    borderRadius="lg"
                    borderLeftWidth="3px"
                    borderLeftColor="orange.400"
                    mb="3"
                  >
                    <Text fontSize="xs" color="orange.fg" fontWeight="600">
                      Most departments enforce this — enrollment without the prereq will
                      likely be blocked at registration.
                    </Text>
                  </Box>

                  <Text fontSize="sm" fontWeight="600" mb="2">
                    Here&apos;s what I&apos;d suggest instead:
                  </Text>

                  <VStack align="stretch" gap="2" mb="3">
                    <HStack
                      px="3"
                      py="2"
                      bg="bg.subtle"
                      borderRadius="lg"
                      borderWidth="1px"
                      borderColor="border.subtle"
                      gap="3"
                    >
                      <Icon color="blue.fg" boxSize="4">
                        <LuClock />
                      </Icon>
                      <Text fontSize="xs">
                        <strong>This semester:</strong> Take CSCI 240 — offered both fall &
                        spring
                      </Text>
                    </HStack>
                    <HStack
                      px="3"
                      py="2"
                      bg="bg.subtle"
                      borderRadius="lg"
                      borderWidth="1px"
                      borderColor="border.subtle"
                      gap="3"
                    >
                      <Icon color="blue.fg" boxSize="4">
                        <LuCircleCheck />
                      </Icon>
                      <Text fontSize="xs">
                        <strong>Next semester:</strong> Take CSCI 340 once CSCI 240 is complete
                      </Text>
                    </HStack>
                  </VStack>

                  <Text fontSize="xs" color="fg.muted">
                    Alternatively, swap CSCI 340 for{" "}
                    <strong>CSCI 301</strong> (Intro to Computer Theory) — no additional prereqs
                    beyond CSCI 150.
                  </Text>
                </AIMessage>

                {/* ── User: Q3 ──────────────────────────────────────── */}
                <UserMessage timestamp="2:38 PM">
                  How many more credits do I need to graduate?
                </UserMessage>

                {/* ── AI: Typing indicator ──────────────────────────── */}
                <TypingMessage />
              </VStack>
            </Box>

            {/* Input area */}
            <Box px="4" py="3.5" borderTopWidth="1px" borderColor="border.subtle">
              {/* Prompt chips */}
              <Flex gap="2" wrap="wrap" mb="3">
                {promptChips.map((chip) => (
                  <Button
                    key={chip}
                    size="xs"
                    variant="outline"
                    borderRadius="full"
                    fontSize="xs"
                    color="fg.muted"
                    _hover={{ bg: "purple.subtle", color: "purple.fg", borderColor: "purple.200" }}
                    transition="all 0.15s"
                  >
                    {chip}
                  </Button>
                ))}
              </Flex>

              {/* Input row */}
              <HStack gap="2">
                <Input
                  placeholder="Ask about courses, requirements, or your degree plan..."
                  size="md"
                  borderRadius="xl"
                  flex="1"
                  fontSize="sm"
                  _placeholder={{ color: "fg.subtle" }}
                  _focus={{
                    borderColor: "purple.500",
                    boxShadow: "0 0 0 1px var(--chakra-colors-purple-500)",
                  }}
                />
                <Button
                  colorPalette="purple"
                  size="md"
                  borderRadius="xl"
                  px="4"
                  flexShrink={0}
                >
                  <Icon boxSize="4">
                    <LuSend />
                  </Icon>
                </Button>
              </HStack>
            </Box>
          </Box>
        </Box>

        {/* ── Context Sidebar ───────────────────────────────────────────── */}
        <VStack
          align="stretch"
          gap="4"
          w="280px"
          flexShrink={0}
          display={{ base: "none", xl: "flex" }}
        >
          {/* Student Info */}
          <Box
            bg="bg"
            borderWidth="1px"
            borderColor="border.subtle"
            borderRadius="xl"
            p="4"
          >
            <HStack gap="3" mb="4">
              <Avatar.Root size="md" colorPalette="purple">
                <Avatar.Fallback name="Alex Johnson" />
              </Avatar.Root>
              <Box>
                <Text fontWeight="700" fontSize="sm">
                  Alex Johnson
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  Student ID: 20231045
                </Text>
              </Box>
            </HStack>

            <Separator mb="4" />

            <VStack align="stretch" gap="2.5">
              {[
                { label: "Program", value: "B.S. Computer Science" },
                { label: "Catalog Year", value: "2022–2023" },
              ].map((row) => (
                <HStack key={row.label} justify="space-between" gap="3">
                  <Text fontSize="xs" color="fg.muted" flexShrink={0}>
                    {row.label}
                  </Text>
                  <Text fontSize="xs" fontWeight="600" textAlign="right">
                    {row.value}
                  </Text>
                </HStack>
              ))}
              <HStack justify="space-between">
                <Text fontSize="xs" color="fg.muted">
                  Expected Grad
                </Text>
                <Badge colorPalette="blue" variant="subtle" fontSize="2xs">
                  May 2026
                </Badge>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="xs" color="fg.muted">
                  GPA
                </Text>
                <Text fontSize="xs" fontWeight="600">
                  3.42
                </Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="xs" color="fg.muted">
                  Standing
                </Text>
                <Badge colorPalette="blue" variant="subtle" fontSize="2xs">
                  Good Standing
                </Badge>
              </HStack>
            </VStack>
          </Box>

          {/* Credits Progress */}
          <Box
            bg="bg"
            borderWidth="1px"
            borderColor="border.subtle"
            borderRadius="xl"
            p="4"
          >
            <HStack mb="1" justify="space-between">
              <Heading size="sm">Credit Progress</Heading>
              <Badge colorPalette="purple" variant="subtle" fontSize="xs">
                78 / 120
              </Badge>
            </HStack>
            <Text fontSize="2xs" color="fg.muted" mb="3">
              65% complete toward degree
            </Text>

            <Progress.Root value={65} colorPalette="blue" mb="5" size="sm">
              <Progress.Track borderRadius="full"><Progress.Range /></Progress.Track>
            </Progress.Root>

            <VStack align="stretch" gap="3">
              {creditCategories.map((cat) => (
                <Box key={cat.label}>
                  <HStack justify="space-between" mb="1.5">
                    <Text fontSize="2xs" color="fg.muted">
                      {cat.label}
                    </Text>
                    <Text fontSize="2xs" color="fg.muted">
                      {cat.completed}/{cat.required} cr
                    </Text>
                  </HStack>
                  <Progress.Root
                    value={Math.round((cat.completed / cat.required) * 100)}
                    colorPalette={cat.color}
                    size="sm"
                  >
                    <Progress.Track borderRadius="full"><Progress.Range /></Progress.Track>
                  </Progress.Root>
                </Box>
              ))}
            </VStack>
          </Box>

          {/* This Semester */}
          <Box
            bg="bg"
            borderWidth="1px"
            borderColor="border.subtle"
            borderRadius="xl"
            p="4"
          >
            <Heading size="sm" mb="3">
              This Semester
            </Heading>
            <VStack align="stretch" gap="2">
              {semesterStats.map((stat) => (
                <HStack
                  key={stat.label}
                  px="3"
                  py="2.5"
                  bg="bg.subtle"
                  borderRadius="lg"
                  gap="2.5"
                >
                  <Box
                    w="7"
                    h="7"
                    borderRadius="md"
                    bg={`${stat.color}.subtle`}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    <Icon boxSize="3.5" color={`${stat.color}.fg`}>
                      <stat.icon />
                    </Icon>
                  </Box>
                  <Box>
                    <Text fontSize="xs" fontWeight="600">
                      {stat.value}
                    </Text>
                    <Text fontSize="2xs" color="fg.muted">
                      {stat.label}
                    </Text>
                  </Box>
                </HStack>
              ))}
            </VStack>
          </Box>
        </VStack>
      </Flex>
    </Box>
  );
}
