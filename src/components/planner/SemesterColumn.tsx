"use client";

import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  Box,
  HStack,
  IconButton,
  Text,
  Badge,
  Table,
} from "@chakra-ui/react";
import { LuTrash2, LuCalendar, LuTriangleAlert } from "react-icons/lu";
import type { Term, PlannedCourseWithDetails } from "@/types/planner";
import type { Course } from "@/types/course";
import DraggableCourseRow from "./DraggableCourseRow";
import { SEASON_COLORS } from "@/constants/planner";

interface SemesterColumnProps {
  term: Term;
  courses: PlannedCourseWithDetails[];
  onRemoveTerm: (termId: number) => void;
  onCourseClick: (course: Course, termId: number) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isGraduatePlan?: boolean;
  canEdit?: boolean;
}

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

function SemesterColumn({
  term,
  courses,
  onRemoveTerm,
  onCourseClick,
  isCollapsed = false,
  onToggleCollapse,
  isGraduatePlan = false,
  canEdit = true,
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
        w="full"
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

  const load = getCreditLoadInfo(totalCredits, term.season === "Summer", isGraduatePlan);

  return (
    <Box
      ref={setNodeRef}
      w="full"
      overflow="hidden"
      borderWidth="1px"
      borderColor={isOver ? "blue.400" : "border.subtle"}
      boxShadow={isOver ? "0 0 0 2px var(--chakra-colors-blue-200)" : "none"}
      bg="bg"
      transition="all 0.2s"
    >
      <Table.Root size="sm" variant="line" interactive css={{ tableLayout: "fixed", width: "100%" }}>
        <Table.ColumnGroup>
          <Table.Column htmlWidth="20px" />
          <Table.Column htmlWidth="30%" />
          <Table.Column />
          <Table.Column htmlWidth="32px" />
        </Table.ColumnGroup>
        <Table.Header>
          {/* Semester info row */}
          <Table.Row bg={`${seasonColor}.subtle`}>
            <Table.ColumnHeader colSpan={4} py="2.5">
              <HStack justify="space-between" w="full">
                <HStack gap="2">
                  <Box color={`${seasonColor}.fg`}>
                    <LuCalendar size={16} />
                  </Box>
                  <Text
                    fontSize="sm"
                    fontWeight="500"
                    fontFamily="var(--font-dm-sans), sans-serif"
                    letterSpacing="-0.02em"
                  >
                    {term.season} {term.year}
                  </Text>
                  <Badge size="sm" variant="subtle" colorPalette={seasonColor}>
                    {totalCredits} cr
                  </Badge>
                  {load && (
                    <Badge
                      size="sm"
                      variant="subtle"
                      colorPalette={load.color}
                      gap="1"
                    >
                      <LuTriangleAlert size={10} />
                      {load.label}
                    </Badge>
                  )}
                </HStack>
                <HStack gap="1">
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
                  {canEdit && (
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
                  )}
                </HStack>
              </HStack>
            </Table.ColumnHeader>
          </Table.Row>

          {/* Column headers */}
          <Table.Row>
            <Table.ColumnHeader px="0" />
            <Table.ColumnHeader>Course</Table.ColumnHeader>
            <Table.ColumnHeader>Title</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Cr</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {courses.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={4} py="4" textAlign="center">
                <Box
                  mx="2"
                  py="3"
                  borderWidth="2px"
                  borderStyle="dashed"
                  borderColor={isOver ? "blue.300" : "border.subtle"}
                  borderRadius="lg"
                  bg={isOver ? "blue.subtle" : "transparent"}
                  transition="all 0.2s"
                >
                  <Text fontSize="sm" color="fg.muted">
                    {isOver ? "Drop here!" : "Drag courses here"}
                  </Text>
                </Box>
              </Table.Cell>
            </Table.Row>
          ) : (
            courses.map((pc) => (
              <DraggableCourseRow
                key={pc.course_id}
                course={pc.course}
                termId={term.id}
                onCourseClick={onCourseClick}
                canEdit={canEdit}
              />
            ))
          )}
        </Table.Body>

        {courses.length > 0 && (
          <Table.Footer>
            <Table.Row>
              <Table.Cell colSpan={4} py="2">
                <HStack justify="space-between">
                  <Text fontSize="xs" color="fg.muted">
                    {courses.length}{" "}
                    {courses.length === 1 ? "course" : "courses"}
                  </Text>
                  <Text
                    fontSize="xs"
                    fontWeight="600"
                    color={`${seasonColor}.fg`}
                  >
                    {totalCredits} credits
                  </Text>
                </HStack>
              </Table.Cell>
            </Table.Row>
          </Table.Footer>
        )}
      </Table.Root>
    </Box>
  );
}

export default memo(SemesterColumn);
