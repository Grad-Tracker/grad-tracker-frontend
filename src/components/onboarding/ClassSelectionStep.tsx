"use client";

import {
  Box,
  Heading,
  Text,
  VStack,
  SimpleGrid,
  CheckboxGroup,
  Badge,
  Icon,
  Alert,
} from "@chakra-ui/react";
import { LuInfo, LuBookMarked } from "react-icons/lu";
import { CheckboxCard } from "@/components/ui/checkbox-card";
import type { RequirementBlock } from "@/types/onboarding";

interface ClassSelectionStepProps {
  requirementBlocks: RequirementBlock[];
  selectedClasses: number[];
  onClassesChange: (classIds: number[]) => void;
}

function ruleLabel(block: RequirementBlock): string {
  switch (block.rule) {
    case "ALL_OF":
      return "Complete all";
    case "ANY_OF":
      return "Complete any";
    case "N_OF":
      return block.n_required ? `Choose ${block.n_required}` : "Choose from";
    case "CREDITS_OF":
      return block.credits_required
        ? `${block.credits_required} credits required`
        : "Credits required";
    default:
      return "";
  }
}

export default function ClassSelectionStep({
  requirementBlocks,
  selectedClasses,
  onClassesChange,
}: ClassSelectionStepProps) {
  // Compute total credits from all selected courses across all blocks
  const allCourses = requirementBlocks.flatMap((b) => b.courses);
  const totalCredits = selectedClasses.reduce((sum, courseId) => {
    const course = allCourses.find((c) => c.id === courseId);
    return sum + (course?.credits ?? 0);
  }, 0);

  return (
    <VStack gap="6" align="stretch">
      {/* Header */}
      <Box>
        <VStack gap="2" align="start" mb="4">
          <Badge colorPalette="purple" variant="surface" rounded="full" px="3" py="1">
            <Icon mr="1.5" boxSize="3.5">
              <LuBookMarked />
            </Icon>
            Current Courses
          </Badge>
          <Heading
            fontFamily="var(--font-dm-sans), sans-serif"
            size="xl"
            fontWeight="400"
            letterSpacing="-0.01em"
          >
            Select Your Classes
          </Heading>
          <Text color="fg.muted" fontSize="sm">
            Choose the courses you are currently enrolled in or have completed.
          </Text>
        </VStack>
      </Box>

      {/* Disclaimer Alert */}
      <Alert.Root
        status="info"
        variant="subtle"
        borderRadius="xl"
        borderWidth="1px"
        borderColor="blue.muted"
      >
        <Alert.Indicator>
          <LuInfo />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title fontWeight="600">Grade Assumption</Alert.Title>
          <Alert.Description color="fg.muted">
            When you select a course, we assume you passed with a grade of C or
            better. You can adjust individual grades later in your dashboard.
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>

      {/* Selected Count */}
      {selectedClasses.length > 0 && (
        <Box
          bg="blue.subtle"
          borderRadius="lg"
          px="4"
          py="3"
          borderWidth="1px"
          borderColor="blue.muted"
        >
          <Text fontSize="sm" fontWeight="600" color="blue.fg">
            {selectedClasses.length} course{selectedClasses.length !== 1 ? "s" : ""}{" "}
            selected ({totalCredits} credits)
          </Text>
        </Box>
      )}

      {/* Course Selection — Grouped by Requirement Block */}
      <CheckboxGroup
        value={selectedClasses.map(String)}
        onValueChange={(values) => onClassesChange(values.map(Number))}
      >
        <VStack gap="8" align="stretch">
          {requirementBlocks.map((block) => {
            if (block.courses.length === 0) return null;

            return (
              <Box key={block.id}>
                <VStack gap="1" align="start" mb="3">
                  <Heading size="md" fontWeight="600">
                    {block.name}
                  </Heading>
                  <Badge colorPalette="gray" variant="subtle" size="sm">
                    {ruleLabel(block)}
                  </Badge>
                </VStack>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="3">
                  {block.courses.map((course) => (
                    <CheckboxCard
                      key={course.id}
                      value={course.id.toString()}
                      label={`${course.subject} ${course.number}`}
                      description={
                        <Box>
                          <Text fontSize="sm" color="fg.muted" lineClamp={1}>
                            {course.title}
                          </Text>
                          <Badge
                            mt="1.5"
                            colorPalette="gray"
                            variant="subtle"
                            size="sm"
                          >
                            {course.credits} credits
                          </Badge>
                        </Box>
                      }
                      colorPalette="blue"
                      borderRadius="xl"
                    />
                  ))}
                </SimpleGrid>
              </Box>
            );
          })}
        </VStack>
      </CheckboxGroup>
    </VStack>
  );
}