"use client";

import {
  Box,
  Badge,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuPackage, LuCheck, LuChevronRight } from "react-icons/lu";
import type { BreadthPackage } from "@/types/planner";
import { BREADTH_PACKAGES, getPackageCourseKeys, courseKey } from "@/types/planner";
import type { Course } from "@/types/course";

interface BreadthPackageSelectorProps {
  selectedPackageId: string | null;
  onSelect: (packageId: string) => void;
  completedCourseIds: Set<number>;
  plannedCourseIds: Set<number>;
  allBreadthCourses: Course[];
}

function matchCount(
  pkg: BreadthPackage,
  courseIds: Set<number>,
  allCourses: Course[]
): number {
  const keys = getPackageCourseKeys(pkg);
  return allCourses.filter(
    (c) => courseIds.has(c.id) && keys.has(courseKey(c))
  ).length;
}

export default function BreadthPackageSelector({
  selectedPackageId,
  onSelect,
  completedCourseIds,
  plannedCourseIds,
  allBreadthCourses,
}: BreadthPackageSelectorProps) {
  const combined = new Set([...completedCourseIds, ...plannedCourseIds]);

  return (
    <Box>
      {!selectedPackageId && (
        <Box px="3" pt="2" pb="1">
          <HStack gap="1.5" mb="1">
            <Icon boxSize="3.5" color="orange.fg">
              <LuPackage />
            </Icon>
            <Text fontSize="xs" fontWeight="600" color="orange.fg">
              Choose a breadth package
            </Text>
          </HStack>
          <Text fontSize="2xs" color="fg.muted" lineHeight="short">
            You must complete one pre-approved package of 9+ credits.
          </Text>
        </Box>
      )}

      <VStack align="stretch" gap="1" px="2" py="2">
        {BREADTH_PACKAGES.map((pkg) => {
          const isSelected = pkg.id === selectedPackageId;
          const completed = matchCount(pkg, completedCourseIds, allBreadthCourses);
          const planned = matchCount(pkg, combined, allBreadthCourses);
          const totalCourses = pkg.groups.reduce((s, g) => s + g.nRequired, 0);
          const hasProgress = planned > 0;

          return (
            <Box
              key={pkg.id}
              as="button"
              w="full"
              textAlign="left"
              px="3"
              py="2"
              borderRadius="lg"
              borderWidth="1px"
              borderColor={isSelected ? "green.500" : hasProgress ? "orange.300" : "border.subtle"}
              bg={isSelected ? "green.subtle" : "bg"}
              _hover={{
                bg: isSelected ? "green.subtle" : "bg.subtle",
                borderColor: isSelected ? "green.500" : "border",
              }}
              transition="all 0.15s"
              cursor="pointer"
              onClick={() => onSelect(pkg.id)}
            >
              <HStack justify="space-between" gap="2">
                <HStack gap="2" flex="1" minW="0">
                  {isSelected && (
                    <Icon boxSize="3.5" color="green.fg" flexShrink={0}>
                      <LuCheck />
                    </Icon>
                  )}
                  <Box minW="0" flex="1">
                    <Text
                      fontSize="xs"
                      fontWeight={isSelected ? "700" : "600"}
                      color={isSelected ? "green.fg" : "fg"}
                      truncate
                    >
                      {pkg.name}
                    </Text>
                    <Text fontSize="2xs" color="fg.muted" truncate>
                      {pkg.description}
                    </Text>
                  </Box>
                </HStack>

                <HStack gap="1.5" flexShrink={0}>
                  {completed > 0 && (
                    <Badge size="sm" variant="subtle" colorPalette="green">
                      {completed} done
                    </Badge>
                  )}
                  {planned > completed && (
                    <Badge size="sm" variant="subtle" colorPalette="blue">
                      {planned - completed} planned
                    </Badge>
                  )}
                  <Text fontSize="2xs" color="fg.subtle">
                    {totalCourses} courses
                  </Text>
                  {!isSelected && (
                    <Icon boxSize="3" color="fg.subtle">
                      <LuChevronRight />
                    </Icon>
                  )}
                </HStack>
              </HStack>
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}
