"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Flex,
  HStack,
  Icon,
  Text,
} from "@chakra-ui/react";
import {
  LuCalendar,
  LuBookOpen,
  LuGraduationCap,
  LuTrendingUp,
  LuChevronUp,
} from "react-icons/lu";
import {
  ProgressCircleRing,
  ProgressCircleRoot,
  ProgressCircleValueText,
} from "@/components/ui/progress-circle";
import type { PlannedCourseWithDetails, Term, RequirementBlockWithCourses } from "@/types/planner";

const GRADUATE_TOTAL_CREDITS = 30;

interface PlannerSummaryProps {
  terms: Term[];
  plannedCourses: PlannedCourseWithDetails[];
  blocks: RequirementBlockWithCourses[];
  completedCourseIds: Set<number>;
  isGraduatePlan?: boolean;
}

export default function PlannerSummary({
  terms,
  plannedCourses,
  blocks,
  completedCourseIds,
  isGraduatePlan = false,
}: PlannerSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  const totalPlannedCredits = plannedCourses.reduce(
    (sum, pc) => sum + (pc.course?.credits ?? 0),
    0
  );

  const stats = useMemo(() => {
    const summedCredits = blocks.reduce((s, b) => {
      return s + (b.credits_required ?? b.courses.reduce((cs, c) => cs + c.credits, 0));
    }, 0);
    const totalRequired = isGraduatePlan ? GRADUATE_TOTAL_CREDITS : summedCredits;

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
  }, [blocks, completedCourseIds, totalPlannedCredits, terms.length, isGraduatePlan]);

  return (
    <Flex
      position="fixed"
      bottom="4"
      left="50%"
      transform="translateX(-50%)"
      zIndex="popover"
      ml={{ base: "0", lg: "130px" }}
    >
      <Box
        bg="bg"
        borderRadius="2xl"
        borderWidth="1px"
        borderColor="border.subtle"
        boxShadow="0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)"
        backdropFilter="blur(12px)"
        cursor="pointer"
        onClick={() => setExpanded((e) => !e)}
        transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        _hover={{
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.08)",
          transform: "translateY(-2px)",
        }}
        overflow="hidden"
      >
        {/* Collapsed pill */}
        <HStack
          px="5"
          py="2.5"
          gap="4"
        >
          {/* Progress ring */}
          {stats.totalRequired > 0 && (
            <ProgressCircleRoot
              value={stats.degreePct}
              size="sm"
              colorPalette="blue"
            >
              <ProgressCircleRing
                cap="round"
                css={{ "--thickness": "3px" }}
              />
              <ProgressCircleValueText
                fontSize="2xs"
                fontWeight="700"
              />
            </ProgressCircleRoot>
          )}

          <HStack gap="4" divideX="1px" divideColor="border.subtle">
            <HStack gap="1.5">
              <Icon color="blue.fg" boxSize="3.5">
                <LuCalendar />
              </Icon>
              <Text fontSize="sm" fontWeight="600">{terms.length}</Text>
              <Text fontSize="xs" color="fg.muted">sem</Text>
            </HStack>

            <HStack gap="1.5" pl="4">
              <Icon color="purple.fg" boxSize="3.5">
                <LuBookOpen />
              </Icon>
              <Text fontSize="sm" fontWeight="600">{plannedCourses.length}</Text>
              <Text fontSize="xs" color="fg.muted">courses</Text>
            </HStack>

            <HStack gap="1.5" pl="4">
              <Icon color="blue.fg" boxSize="3.5">
                <LuGraduationCap />
              </Icon>
              <Text fontSize="sm" fontWeight="600">{totalPlannedCredits}</Text>
              {stats.totalRequired > 0 && (
                <Text fontSize="xs" color="fg.muted">/ {stats.totalRequired}</Text>
              )}
              <Text fontSize="xs" color="fg.muted">cr</Text>
            </HStack>

            {stats.semsNeeded > 0 && (
              <HStack gap="1.5" pl="4">
                <Icon color="orange.fg" boxSize="3.5">
                  <LuTrendingUp />
                </Icon>
                <Text fontSize="sm" fontWeight="600">
                  ~{stats.semsNeeded}
                </Text>
                <Text fontSize="xs" color="fg.muted">remaining</Text>
              </HStack>
            )}
          </HStack>

          <Icon
            color="fg.muted"
            boxSize="3.5"
            transition="transform 0.2s"
            transform={expanded ? "rotate(180deg)" : "rotate(0deg)"}
          >
            <LuChevronUp />
          </Icon>
        </HStack>

        {/* Expanded details */}
        <Box
          maxH={expanded ? "200px" : "0"}
          overflow="hidden"
          transition="max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        >
          <Box
            px="5"
            py="3"
            borderTopWidth="1px"
            borderColor="border.subtle"
          >
            <HStack gap="6" flexWrap="wrap">
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="0.5">Completed</Text>
                <Text fontSize="sm" fontWeight="700" color="blue.fg">
                  {stats.completedCredits} credits
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="0.5">Planned</Text>
                <Text fontSize="sm" fontWeight="700">
                  {totalPlannedCredits} credits
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="0.5">Remaining</Text>
                <Text fontSize="sm" fontWeight="700" color="orange.fg">
                  {stats.remainingCredits} credits
                </Text>
              </Box>
              {terms.length > 0 && (
                <Box>
                  <Text fontSize="xs" color="fg.muted" mb="0.5">Avg per Semester</Text>
                  <Text fontSize="sm" fontWeight="700">
                    {stats.avgCreditsPerSem} credits
                  </Text>
                </Box>
              )}
            </HStack>
          </Box>
        </Box>
      </Box>
    </Flex>
  );
}
