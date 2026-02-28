"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  Box,
  Card,
  Heading,
  HStack,
  IconButton,
  Text,
  VStack,
  Badge,
} from "@chakra-ui/react";
import { LuTrash2, LuCalendar, LuTriangleAlert } from "react-icons/lu";
import type { Term, PlannedCourseWithDetails } from "@/types/planner";
import DraggableCourseCard from "./DraggableCourseCard";

interface SemesterColumnProps {
  term: Term;
  courses: PlannedCourseWithDetails[];
  onRemoveTerm: (termId: number) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isGraduatePlan?: boolean;
}

const SEASON_COLORS: Record<string, string> = {
  Fall: "orange",
  Spring: "green",
  Summer: "yellow",
};

function getCreditLoadInfo(
  credits: number,
  isSummer: boolean,
  isGraduate: boolean
): { color: string; label: string } | null {
  if (credits === 0) return null;

  if (isGraduate) {
    if (isSummer) {
      if (credits > 9) return { color: "red", label: "Heavy" };
      return null;
    }
    if (credits >= 15) return { color: "red", label: "Overloaded" };
    if (credits >= 12) return { color: "orange", label: "Heavy" };
    if (credits < 6) return { color: "gray", label: "Part-time" };
    return null;
  }

  if (isSummer) {
    if (credits > 12) return { color: "red", label: "Heavy" };
    return null;
  }
  if (credits >= 18) return { color: "red", label: "Overloaded" };
  if (credits >= 16) return { color: "orange", label: "Heavy" };
  if (credits < 12) return { color: "gray", label: "Part-time" };
  return null;
}

export default function SemesterColumn({
  term,
  courses,
  onRemoveTerm,
  isCollapsed = false,
  onToggleCollapse,
  isGraduatePlan = false,
}: SemesterColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `term-${term.id}`,
    data: { term },
  });

  const totalCredits = courses.reduce(
    (sum, pc) => sum + (pc.course?.credits ?? 0),
    0
  );

  const seasonColor = SEASON_COLORS[term.season] || "gray";

  // Collapsed summer view
  if (isCollapsed) {
    return (
      <Box
        cursor="pointer"
        onClick={onToggleCollapse}
        borderWidth="1px"
        borderColor="border.subtle"
        borderStyle="dashed"
        borderRadius="xl"
        px="4"
        py="2"
        bg="bg.subtle"
        _hover={{ bg: "bg.muted", borderColor: "yellow.300" }}
        transition="all 0.15s"
        minW="280px"
      >
        <HStack justify="center" gap="2">
          <Text fontSize="xs" color="fg.muted" fontWeight="500">
            ☀️ Summer {term.year}
          </Text>
          {courses.length > 0 && (
            <Badge size="sm" variant="subtle" colorPalette="yellow">
              {courses.length} courses · {totalCredits} cr
            </Badge>
          )}
          <Text fontSize="xs" color="fg.muted">
            Click to expand
          </Text>
        </HStack>
      </Box>
    );
  }

  return (
    <Card.Root
      ref={setNodeRef}
      minW="280px"
      w="280px"
      borderRadius="xl"
      borderWidth="1px"
      borderColor={isOver ? "green.400" : "border.subtle"}
      boxShadow={isOver ? "0 0 0 2px var(--chakra-colors-green-200)" : "none"}
      bg="bg"
      transition="all 0.2s"
      flexShrink={0}
      display="flex"
      flexDirection="column"
    >
      {/* Semester Header */}
      <Box
        px="4"
        py="3"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        bg={`${seasonColor}.subtle`}
        borderTopRadius="xl"
      >
        <HStack justify="space-between">
          <HStack gap="2">
            <Box color={`${seasonColor}.fg`}>
              <LuCalendar size={16} />
            </Box>
            <Heading
              size="sm"
              fontFamily="'DM Serif Display', serif"
              fontWeight="400"
              letterSpacing="-0.02em"
            >
              {term.season} {term.year}
            </Heading>
          </HStack>
          <HStack gap="1">
            <Badge
              size="sm"
              variant="subtle"
              colorPalette={seasonColor}
            >
              {totalCredits} cr
            </Badge>
            {(() => {
              const load = getCreditLoadInfo(totalCredits, term.season === "Summer", isGraduatePlan);
              if (!load) return null;
              return (
                <Badge
                  size="sm"
                  variant="subtle"
                  colorPalette={load.color}
                  gap="1"
                >
                  <LuTriangleAlert size={10} />
                  {load.label}
                </Badge>
              );
            })()}
            {term.season === "Summer" && onToggleCollapse && (
              <IconButton
                aria-label="Collapse summer"
                variant="ghost"
                size="xs"
                onClick={onToggleCollapse}
                color="fg.muted"
              >
                <Text fontSize="xs">−</Text>
              </IconButton>
            )}
            <IconButton
              aria-label="Remove semester"
              variant="ghost"
              size="xs"
              color="fg.muted"
              _hover={{ color: "red.500", bg: "red.subtle" }}
              onClick={() => onRemoveTerm(term.id)}
            >
              <LuTrash2 size={14} />
            </IconButton>
          </HStack>
        </HStack>
      </Box>

      {/* Drop Zone */}
      <VStack
        align="stretch"
        gap="1.5"
        p="3"
        flex="1"
        minH="200px"
      >
        {courses.length === 0 && (
          <Box
            py="10"
            textAlign="center"
            borderWidth="2px"
            borderStyle="dashed"
            borderColor={isOver ? "green.300" : "border.subtle"}
            borderRadius="lg"
            bg={isOver ? "green.subtle" : "transparent"}
            transition="all 0.2s"
          >
            <Text fontSize="sm" color="fg.muted">
              {isOver ? "Drop here!" : "Drag courses here"}
            </Text>
          </Box>
        )}
        {courses.map((pc) => (
          <DraggableCourseCard
            key={pc.course_id}
            course={pc.course}
            termId={term.id}
          />
        ))}
      </VStack>

      {/* Footer */}
      {courses.length > 0 && (
        <Box
          px="4"
          py="2"
          borderTopWidth="1px"
          borderColor="border.subtle"
          bg="bg.subtle"
          borderBottomRadius="xl"
        >
          <HStack justify="space-between">
            <Text fontSize="xs" color="fg.muted">
              {courses.length} {courses.length === 1 ? "course" : "courses"}
            </Text>
            <Text fontSize="xs" fontWeight="600" color={`${seasonColor}.fg`}>
              {totalCredits} credits
            </Text>
          </HStack>
        </Box>
      )}
    </Card.Root>
  );
}
