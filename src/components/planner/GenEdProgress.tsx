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
import { LuGraduationCap } from "react-icons/lu";
import {
  ProgressBar,
  ProgressRoot,
} from "@/components/ui/progress";
import type { GenEdBucketWithCourses } from "@/types/auto-generate";
import type { PlannedCourseWithDetails } from "@/types/planner";

interface GenEdProgressProps {
  buckets: GenEdBucketWithCourses[];
  plannedCourses: PlannedCourseWithDetails[];
  completedCourseIds: Set<number>;
}

const BUCKET_COLORS = ["teal", "cyan", "blue", "purple", "pink", "orange", "yellow", "emerald"];

interface BucketStat {
  id: number;
  name: string;
  code: string;
  completedCredits: number;
  plannedCredits: number;
  totalRequired: number;
  percentage: number;
  color: string;
}

export default function GenEdProgress({
  buckets,
  plannedCourses,
  completedCourseIds,
}: Readonly<GenEdProgressProps>) {
  const plannedCourseIdSet = useMemo(
    () => new Set(plannedCourses.map((pc) => pc.course_id)),
    [plannedCourses]
  );

  const bucketStats = useMemo(() => {
    return buckets.map((bucket, index): BucketStat => {
      let completedCredits = 0;
      let plannedCredits = 0;

      for (const course of bucket.courses) {
        if (completedCourseIds.has(course.id)) {
          completedCredits += course.credits;
        } else if (plannedCourseIdSet.has(course.id)) {
          plannedCredits += course.credits;
        }
      }

      const totalRequired = bucket.credits_required;
      const filledCredits = completedCredits + plannedCredits;
      const percentage = totalRequired > 0
        ? Math.min(100, Math.round((filledCredits / totalRequired) * 100))
        : 0;

      return {
        id: bucket.id,
        name: bucket.name,
        code: bucket.code,
        completedCredits: Math.min(completedCredits, totalRequired),
        plannedCredits: Math.min(plannedCredits, Math.max(0, totalRequired - completedCredits)),
        totalRequired,
        percentage,
        color: BUCKET_COLORS[index % BUCKET_COLORS.length],
      };
    });
  }, [buckets, completedCourseIds, plannedCourseIdSet]);

  if (buckets.length === 0) return null;

  const totalCompleted = bucketStats.reduce((s, b) => s + b.completedCredits, 0);
  const totalPlanned = bucketStats.reduce((s, b) => s + b.plannedCredits, 0);
  const totalRequired = bucketStats.reduce((s, b) => s + b.totalRequired, 0);
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
        <Icon boxSize="4" color="teal.fg">
          <LuGraduationCap />
        </Icon>
        <Text fontSize="xs" fontWeight="600">
          Gen Ed Progress
        </Text>
        <Badge size="sm" variant="subtle" colorPalette="teal">
          {totalCompleted + totalPlanned}/{totalRequired} cr · {overallPct}%
        </Badge>
      </HStack>

      <VStack align="stretch" gap="3">
        {bucketStats.map((stat) => (
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
