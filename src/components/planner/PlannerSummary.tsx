"use client";

import { useMemo } from "react";
import {
  Box,
  Card,
  HStack,
  Icon,
  Text,
  Flex,
} from "@chakra-ui/react";
import {
  LuCalendar,
  LuBookOpen,
  LuGraduationCap,
  LuTrendingUp,
} from "react-icons/lu";
import {
  ProgressCircleRing,
  ProgressCircleRoot,
} from "@/components/ui/progress-circle";
import type { PlannedCourseWithDetails, Term, RequirementBlockWithCourses } from "@/types/planner";

interface PlannerSummaryProps {
  terms: Term[];
  plannedCourses: PlannedCourseWithDetails[];
  blocks: RequirementBlockWithCourses[];
  completedCourseIds: Set<number>;
}

export default function PlannerSummary({
  terms,
  plannedCourses,
  blocks,
  completedCourseIds,
}: PlannerSummaryProps) {
  const totalPlannedCredits = plannedCourses.reduce(
    (sum, pc) => sum + (pc.course?.credits ?? 0),
    0
  );

  const stats = useMemo(() => {
    const totalRequired = blocks.reduce((s, b) => {
      return s + (b.credits_required ?? b.courses.reduce((cs, c) => cs + c.credits, 0));
    }, 0);

    let completedCredits = 0;
    for (const block of blocks) {
      for (const course of block.courses) {
        if (completedCourseIds.has(course.id)) {
          completedCredits += course.credits;
        }
      }
    }

    const coveredCredits = completedCredits + totalPlannedCredits;
    const degreePct = totalRequired > 0
      ? Math.min(100, Math.round((coveredCredits / totalRequired) * 100))
      : 0;

    const remainingCredits = Math.max(0, totalRequired - coveredCredits);
    const avgCreditsPerSem = terms.length > 0 ? Math.round(totalPlannedCredits / terms.length) : 0;
    const semsNeeded = avgCreditsPerSem > 0 ? Math.ceil(remainingCredits / avgCreditsPerSem) : 0;

    return { totalRequired, completedCredits, degreePct, remainingCredits, avgCreditsPerSem, semsNeeded };
  }, [blocks, completedCourseIds, totalPlannedCredits, terms.length]);

  return (
    <Box
      px={{ base: "4", md: "6" }}
      py="3"
      borderTopWidth="1px"
      borderColor="border.subtle"
      bg="bg"
    >
      <HStack justify="center" gap="4" flexWrap="wrap">
        <Card.Root
          bg="bg.subtle"
          borderRadius="lg"
          borderWidth="0"
          shadow="none"
          size="sm"
        >
          <Card.Body px="4" py="2.5">
            <HStack gap="3">
              <Flex
                align="center"
                justify="center"
                w="8"
                h="8"
                bg="blue.subtle"
                borderRadius="md"
              >
                <Icon color="blue.fg" boxSize="4">
                  <LuCalendar />
                </Icon>
              </Flex>
              <Box>
                <Text fontSize="xs" color="fg.muted" lineHeight="1">Semesters</Text>
                <Text fontSize="md" fontWeight="700">{terms.length}</Text>
              </Box>
            </HStack>
          </Card.Body>
        </Card.Root>

        <Card.Root
          bg="bg.subtle"
          borderRadius="lg"
          borderWidth="0"
          shadow="none"
          size="sm"
        >
          <Card.Body px="4" py="2.5">
            <HStack gap="3">
              <Flex
                align="center"
                justify="center"
                w="8"
                h="8"
                bg="purple.subtle"
                borderRadius="md"
              >
                <Icon color="purple.fg" boxSize="4">
                  <LuBookOpen />
                </Icon>
              </Flex>
              <Box>
                <Text fontSize="xs" color="fg.muted" lineHeight="1">Planned Courses</Text>
                <Text fontSize="md" fontWeight="700">{plannedCourses.length}</Text>
              </Box>
            </HStack>
          </Card.Body>
        </Card.Root>

        <Card.Root
          bg="bg.subtle"
          borderRadius="lg"
          borderWidth="0"
          shadow="none"
          size="sm"
        >
          <Card.Body px="4" py="2.5">
            <HStack gap="3">
              <Flex
                align="center"
                justify="center"
                w="8"
                h="8"
                bg="green.subtle"
                borderRadius="md"
              >
                <Icon color="green.fg" boxSize="4">
                  <LuGraduationCap />
                </Icon>
              </Flex>
              <Box>
                <Text fontSize="xs" color="fg.muted" lineHeight="1">Total Credits</Text>
                <HStack gap="1" align="baseline">
                  <Text fontSize="md" fontWeight="700">{totalPlannedCredits}</Text>
                  {stats.totalRequired > 0 && (
                    <Text fontSize="xs" color="fg.muted">/ {stats.totalRequired}</Text>
                  )}
                </HStack>
              </Box>
            </HStack>
          </Card.Body>
        </Card.Root>

        {stats.totalRequired > 0 && (
          <Card.Root
            bg="bg.subtle"
            borderRadius="lg"
            borderWidth="0"
            shadow="none"
            size="sm"
          >
            <Card.Body px="4" py="2.5">
              <HStack gap="3">
                <ProgressCircleRoot
                  value={stats.degreePct}
                  size="sm"
                  colorPalette="green"
                >
                  <ProgressCircleRing
                    cap="round"
                    css={{ "--thickness": "3px" }}
                  />
                </ProgressCircleRoot>
                <Box>
                  <Text fontSize="xs" color="fg.muted" lineHeight="1">Degree Planned</Text>
                  <Text fontSize="md" fontWeight="700">{stats.degreePct}%</Text>
                </Box>
              </HStack>
            </Card.Body>
          </Card.Root>
        )}

        {stats.semsNeeded > 0 && (
          <Card.Root
            bg="bg.subtle"
            borderRadius="lg"
            borderWidth="0"
            shadow="none"
            size="sm"
          >
            <Card.Body px="4" py="2.5">
              <HStack gap="3">
                <Flex
                  align="center"
                  justify="center"
                  w="8"
                  h="8"
                  bg="orange.subtle"
                  borderRadius="md"
                >
                  <Icon color="orange.fg" boxSize="4">
                    <LuTrendingUp />
                  </Icon>
                </Flex>
                <Box>
                  <Text fontSize="xs" color="fg.muted" lineHeight="1">Est. Remaining</Text>
                  <Text fontSize="md" fontWeight="700">
                    {stats.semsNeeded} sem{stats.semsNeeded !== 1 ? "s" : ""}
                  </Text>
                </Box>
              </HStack>
            </Card.Body>
          </Card.Root>
        )}
      </HStack>
    </Box>
  );
}
