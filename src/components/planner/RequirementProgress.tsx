"use client";

import { useMemo } from "react";
import {
  Box,
  Badge,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuTarget } from "react-icons/lu";
import {
  ProgressBar,
  ProgressRoot,
} from "@/components/ui/progress";
import type { RequirementBlockWithCourses, PlannedCourseWithDetails } from "@/types/planner";
import { isBreadthBlock } from "@/types/planner";

interface RequirementProgressProps {
  blocks: RequirementBlockWithCourses[];
  plannedCourses: PlannedCourseWithDetails[];
  completedCourseIds: Set<number>;
  hasBreadthPackageSelected?: boolean;
}

const BLOCK_COLORS = ["green", "blue", "purple", "orange", "teal", "cyan", "pink", "yellow"];

export default function RequirementProgress({
  blocks,
  plannedCourses,
  completedCourseIds,
  hasBreadthPackageSelected = true,
}: RequirementProgressProps) {
  const plannedCourseIdSet = useMemo(
    () => new Set(plannedCourses.map((pc) => pc.course_id)),
    [plannedCourses]
  );

  const blockStats = useMemo(() => {
    return blocks.map((block, index) => {
      const breadthNoSelection = isBreadthBlock(block) && !hasBreadthPackageSelected;
      let completedCredits = 0;
      let plannedCredits = 0;

      if (!breadthNoSelection) {
        for (const course of block.courses) {
          if (completedCourseIds.has(course.id)) {
            completedCredits += course.credits;
          } else if (plannedCourseIdSet.has(course.id)) {
            plannedCredits += course.credits;
          }
        }
      }

      const totalRequired = breadthNoSelection
        ? 9
        : (block.credits_required ?? block.courses.reduce((s, c) => s + c.credits, 0));
      const filledCredits = completedCredits + plannedCredits;
      const percentage = totalRequired > 0 ? Math.min(100, Math.round((filledCredits / totalRequired) * 100)) : 0;
      const color = BLOCK_COLORS[index % BLOCK_COLORS.length];

      return {
        id: block.id,
        name: breadthNoSelection ? "Breadth (select package)" : block.name,
        completedCredits,
        plannedCredits,
        totalRequired,
        percentage,
        color,
      };
    });
  }, [blocks, completedCourseIds, plannedCourseIdSet, hasBreadthPackageSelected]);

  if (blocks.length === 0) return null;

  const totalCompleted = blockStats.reduce((s, b) => s + b.completedCredits, 0);
  const totalPlanned = blockStats.reduce((s, b) => s + b.plannedCredits, 0);
  const totalRequired = blockStats.reduce((s, b) => s + b.totalRequired, 0);
  const overallPct = totalRequired > 0
    ? Math.min(100, Math.round(((totalCompleted + totalPlanned) / totalRequired) * 100))
    : 0;

  return (
    <Box
      px="4"
      py="4"
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      <HStack mb="3" gap="2">
        <Icon boxSize="4" color="green.fg">
          <LuTarget />
        </Icon>
        <Text fontSize="xs" fontWeight="600">
          Degree Progress
        </Text>
        <Badge size="sm" variant="subtle" colorPalette="green">
          {overallPct}%
        </Badge>
      </HStack>

      <VStack align="stretch" gap="3">
        {blockStats.map((stat) => (
          <Box key={stat.id}>
            <HStack justify="space-between" mb="1">
              <Text fontSize="xs" fontWeight="500" truncate flex="1" minW="0">
                {stat.name}
              </Text>
              <Text fontSize="xs" color="fg.muted" flexShrink={0}>
                {stat.completedCredits + stat.plannedCredits}/{stat.totalRequired}
              </Text>
            </HStack>
            <ProgressRoot
              value={stat.percentage}
              colorPalette={stat.color}
              size="xs"
            >
              <ProgressBar borderRadius="full" />
            </ProgressRoot>
            <HStack gap="3" mt="1">
              <HStack gap="1">
                <Box w="1.5" h="1.5" borderRadius="full" bg={`${stat.color}.solid`} />
                <Text fontSize="2xs" color="fg.muted">
                  {stat.completedCredits} done
                </Text>
              </HStack>
              {stat.plannedCredits > 0 && (
                <HStack gap="1">
                  <Box w="1.5" h="1.5" borderRadius="full" bg={`${stat.color}.300`} opacity={0.6} />
                  <Text fontSize="2xs" color="fg.muted">
                    {stat.plannedCredits} planned
                  </Text>
                </HStack>
              )}
            </HStack>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}
