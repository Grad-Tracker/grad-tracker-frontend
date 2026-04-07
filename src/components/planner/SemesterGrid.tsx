"use client";

import { useMemo, useState } from "react";
import { Box, Flex, HStack, Text, VStack } from "@chakra-ui/react";
import type { Term, PlannedCourseWithDetails } from "@/types/planner";
import type { Course } from "@/types/course";
import { compareTerms } from "@/types/planner";
import SemesterColumn from "./SemesterColumn";
import CourseDetailDrawer from "./CourseDetailDrawer";

interface SemesterGridProps {
  terms: Term[];
  plannedCourses: PlannedCourseWithDetails[];
  onRemoveTerm: (termId: number) => void;
  onRemoveCourse?: (course: Course, termId: number) => void | Promise<void>;
  isRemovingCourse?: boolean;
  isGraduatePlan?: boolean;
}

function getAcademicYear(term: Term): string {
  if (term.season === "Fall") {
    return `${term.year}–${term.year + 1}`;
  }
  return `${term.year - 1}–${term.year}`;
}

function getAcademicYearLabel(term: Term): { start: number; end: number } {
  if (term.season === "Fall") {
    return { start: term.year, end: term.year + 1 };
  }
  return { start: term.year - 1, end: term.year };
}

export default function SemesterGrid({
  terms,
  plannedCourses,
  onRemoveTerm,
  onRemoveCourse,
  isRemovingCourse = false,
  isGraduatePlan = false,
}: SemesterGridProps) {
  const [collapsedSummers, setCollapsedSummers] = useState<Set<number>>(
    () => new Set(terms.filter((t) => t.season === "Summer").map((t) => t.id))
  );

  const [selectedCourse, setSelectedCourse] = useState<{
    course: Course;
    termId: number;
  } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleCourseClick(course: Course, termId: number) {
    setSelectedCourse({ course, termId });
    setDrawerOpen(true);
  }

  const sortedTerms = [...terms].sort(compareTerms);

  const yearGroups = useMemo(() => {
    const groups: {
      year: string;
      label: { start: number; end: number };
      fall: Term | null;
      spring: Term | null;
      summer: Term | null;
    }[] = [];
    let currentYear = "";

    for (const term of sortedTerms) {
      const ay = getAcademicYear(term);
      if (ay !== currentYear) {
        currentYear = ay;
        groups.push({
          year: ay,
          label: getAcademicYearLabel(term),
          fall: term.season === "Fall" ? term : null,
          spring: term.season === "Spring" ? term : null,
          summer: term.season === "Summer" ? term : null,
        });
      } else {
        const group = groups.at(-1)!;
        if (term.season === "Fall") group.fall = term;
        else if (term.season === "Spring") group.spring = term;
        else if (term.season === "Summer") group.summer = term;
      }
    }

    return groups;
  }, [sortedTerms]);

  function toggleSummerCollapse(termId: number) {
    setCollapsedSummers((prev) => {
      const next = new Set(prev);
      if (next.has(termId)) next.delete(termId);
      else next.add(termId);
      return next;
    });
  }

  function getCoursesForTerm(termId: number): PlannedCourseWithDetails[] {
    return plannedCourses.filter((pc) => pc.term_id === termId);
  }

  return (
    <Box flex="1" overflowY="auto" px="4" py="4">
      <VStack gap="0" align="stretch">
        {yearGroups.map((group, groupIdx) => (
          <Flex key={group.year} gap="0" align="stretch">
            {/* Timeline */}
            <VStack
              gap="0"
              align="center"
              minW="80px"
              w="80px"
              flexShrink={0}
              position="relative"
            >
              {/* Connector line above */}
              {groupIdx > 0 && (
                <Box w="2px" h="4" bg="border.subtle" />
              )}

              {/* Year badge */}
              <Box
                px="3"
                py="1.5"
                bg="bg.subtle"
                borderRadius="lg"
                borderWidth="1px"
                borderColor="border.subtle"
                textAlign="center"
                zIndex="1"
              >
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  color="fg.muted"
                  lineHeight="1.2"
                >
                  {group.label.start}
                </Text>
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  color="fg.muted"
                  lineHeight="1.2"
                >
                  {group.label.end}
                </Text>
              </Box>

              {/* Connector line below */}
              <Box w="2px" flex="1" bg="border.subtle" />
            </VStack>

            {/* Semesters for this year */}
            <VStack gap="3" align="stretch" flex="1" pb="6" pl="2">
              {/* Fall + Spring side by side */}
              <HStack gap="4" align="start" flexWrap="wrap">
                {group.fall && (
                  <Box flex="1" minW="0">
                    <SemesterColumn
                      term={group.fall}
                      courses={getCoursesForTerm(group.fall.id)}
                      onRemoveTerm={onRemoveTerm}
                      onCourseClick={handleCourseClick}
                      isGraduatePlan={isGraduatePlan}
                    />
                  </Box>
                )}
                {group.spring && (
                  <Box flex="1" minW="0">
                    <SemesterColumn
                      term={group.spring}
                      courses={getCoursesForTerm(group.spring.id)}
                      onRemoveTerm={onRemoveTerm}
                      onCourseClick={handleCourseClick}
                      isGraduatePlan={isGraduatePlan}
                    />
                  </Box>
                )}
                {/* If only one semester exists, show it full width */}
                {!group.fall && !group.spring && group.summer && (
                  <Box flex="1" minW="0">
                    <SemesterColumn
                      term={group.summer}
                      courses={getCoursesForTerm(group.summer.id)}
                      onRemoveTerm={onRemoveTerm}
                      onCourseClick={handleCourseClick}
                      isCollapsed={collapsedSummers.has(group.summer.id)}
                      onToggleCollapse={() =>
                        toggleSummerCollapse(group.summer!.id)
                      }
                      isGraduatePlan={isGraduatePlan}
                    />
                  </Box>
                )}
              </HStack>

              {/* Summer below (if fall or spring also exist) */}
              {group.summer && (group.fall || group.spring) && (
                <Box maxW="50%">
                  <SemesterColumn
                    term={group.summer}
                    courses={getCoursesForTerm(group.summer.id)}
                    onRemoveTerm={onRemoveTerm}
                    onCourseClick={handleCourseClick}
                    isCollapsed={collapsedSummers.has(group.summer.id)}
                    onToggleCollapse={() =>
                      toggleSummerCollapse(group.summer!.id)
                    }
                    isGraduatePlan={isGraduatePlan}
                  />
                </Box>
              )}
            </VStack>
          </Flex>
        ))}
      </VStack>
      <CourseDetailDrawer
        course={selectedCourse?.course ?? null}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onRemoveCourse={
          selectedCourse && onRemoveCourse
            ? async () => {
                await onRemoveCourse(selectedCourse.course, selectedCourse.termId);
                setDrawerOpen(false);
                setSelectedCourse(null);
              }
            : undefined
        }
        isRemovingCourse={isRemovingCourse}
      />
    </Box>
  );
}
