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
  isGraduatePlan?: boolean;
}

const BLOCK_COLORS = ["blue", "purple", "orange", "teal", "cyan", "pink", "yellow", "emerald"];
const GRADUATE_TOTAL_CREDITS = 30;

function graduateBlockColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("core")) return "blue";
  if (n === "electives") return "orange";
  return "purple";
}

interface BlockStat {
  id: number | string;
  name: string;
  completedCredits: number;
  plannedCredits: number;
  totalRequired: number;
  percentage: number;
  color: string;
}

export default function RequirementProgress({
  blocks,
  plannedCourses,
  completedCourseIds,
  hasBreadthPackageSelected = true,
  isGraduatePlan = false,
}: RequirementProgressProps) {
  const plannedCourseIdSet = useMemo(
    () => new Set(plannedCourses.map((pc) => pc.course_id)),
    [plannedCourses]
  );

  const blockStats = useMemo(() => {
    const stats: BlockStat[] = blocks.map((block, index) => {
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
      const displayName = breadthNoSelection ? "Breadth (select package)" : block.name;
      const color = isGraduatePlan
        ? graduateBlockColor(displayName)
        : BLOCK_COLORS[index % BLOCK_COLORS.length];

      return {
        id: block.id,
        name: displayName,
        completedCredits: Math.min(completedCredits, totalRequired),
        plannedCredits: Math.min(plannedCredits, Math.max(0, totalRequired - completedCredits)),
        totalRequired,
        percentage,
        color,
      };
    });

    return stats;
  }, [blocks, completedCourseIds, plannedCourseIdSet, hasBreadthPackageSelected, isGraduatePlan]);

  if (blocks.length === 0) return null;

  const totalCompleted = blockStats.reduce((s, b) => s + b.completedCredits, 0);
  const totalPlanned = blockStats.reduce((s, b) => s + b.plannedCredits, 0);
  const totalRequired = isGraduatePlan
    ? GRADUATE_TOTAL_CREDITS
    : blockStats.reduce((s, b) => s + b.totalRequired, 0);
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
        <Icon boxSize="4" color="blue.fg">
          <LuTarget />
        </Icon>
        <Text fontSize="xs" fontWeight="600">
          Degree Progress
        </Text>
        <Badge size="sm" variant="subtle" colorPalette="blue">
          {totalCompleted + totalPlanned}/{totalRequired} cr
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
                {stat.completedCredits + stat.plannedCredits}/{stat.totalRequired} cr
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
