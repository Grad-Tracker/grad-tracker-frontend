"use client";

import { useMemo } from "react";
import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { useState } from "react";
import type { Term, PlannedCourseWithDetails } from "@/types/planner";
import { compareTerms } from "@/types/planner";
import SemesterColumn from "./SemesterColumn";

interface SemesterGridProps {
  terms: Term[];
  plannedCourses: PlannedCourseWithDetails[];
  onRemoveTerm: (termId: number) => void;
  isGraduatePlan?: boolean;
}

function getAcademicYear(term: Term): string {
  if (term.season === "Fall") {
    return `${term.year}–${term.year + 1}`;
  }
  return `${term.year - 1}–${term.year}`;
}

export default function SemesterGrid({
  terms,
  plannedCourses,
  onRemoveTerm,
  isGraduatePlan = false,
}: SemesterGridProps) {
  const [collapsedSummers, setCollapsedSummers] = useState<Set<number>>(
    () => new Set(terms.filter((t) => t.season === "Summer").map((t) => t.id))
  );

  const sortedTerms = [...terms].sort(compareTerms);

  const yearGroups = useMemo(() => {
    const groups: { year: string; terms: Term[] }[] = [];
    let currentYear = "";

    for (const term of sortedTerms) {
      const ay = getAcademicYear(term);
      if (ay !== currentYear) {
        currentYear = ay;
        groups.push({ year: ay, terms: [term] });
      } else {
        groups[groups.length - 1].terms.push(term);
      }
    }

    return groups;
  }, [sortedTerms]);

  function toggleSummerCollapse(termId: number) {
    setCollapsedSummers((prev) => {
      const next = new Set(prev);
      if (next.has(termId)) {
        next.delete(termId);
      } else {
        next.add(termId);
      }
      return next;
    });
  }

  function getCoursesForTerm(termId: number): PlannedCourseWithDetails[] {
    return plannedCourses.filter((pc) => pc.term_id === termId);
  }

  const showYearLabels = yearGroups.length > 1 || (yearGroups.length === 1 && yearGroups[0].terms.length > 1);

  return (
    <Box overflowX="auto" flex="1" px="4" py="4">
      <HStack gap="4" align="stretch" minH="400px">
        {yearGroups.map((group) => (
          <HStack key={group.year} gap="4" align="stretch">
            {showYearLabels && (
              <VStack gap="0" justify="start" pt="0" minW="0" mr="-2">
                <Box
                  px="2"
                  py="1"
                  bg="bg.subtle"
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  whiteSpace="nowrap"
                >
                  <Text fontSize="2xs" fontWeight="600" color="fg.muted" letterSpacing="0.05em">
                    {group.year}
                  </Text>
                </Box>
                <Box w="1px" flex="1" bg="border.subtle" />
              </VStack>
            )}
            {group.terms.map((term) => (
              <SemesterColumn
                key={term.id}
                term={term}
                courses={getCoursesForTerm(term.id)}
                onRemoveTerm={onRemoveTerm}
                isCollapsed={
                  term.season === "Summer" && collapsedSummers.has(term.id)
                }
                onToggleCollapse={
                  term.season === "Summer"
                    ? () => toggleSummerCollapse(term.id)
                    : undefined
                }
                isGraduatePlan={isGraduatePlan}
              />
            ))}
          </HStack>
        ))}
      </HStack>
    </Box>
  );
}
