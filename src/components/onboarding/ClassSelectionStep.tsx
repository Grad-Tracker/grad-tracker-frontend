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
import { mockCourses } from "@/data/mock/courses";

interface ClassSelectionStepProps {
  selectedClasses: string[];
  onClassesChange: (classIds: string[]) => void;
}

export default function ClassSelectionStep({
  selectedClasses,
  onClassesChange,
}: ClassSelectionStepProps) {
  const totalCredits = selectedClasses.reduce((sum, classId) => {
    const course = mockCourses.find((c) => c.id === classId);
    return sum + (course?.credits || 0);
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
            fontFamily="'DM Serif Display', serif"
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
          bg="green.subtle"
          borderRadius="lg"
          px="4"
          py="3"
          borderWidth="1px"
          borderColor="green.muted"
        >
          <Text fontSize="sm" fontWeight="600" color="green.fg">
            {selectedClasses.length} course{selectedClasses.length !== 1 ? "s" : ""}{" "}
            selected ({totalCredits} credits)
          </Text>
        </Box>
      )}

      {/* Course Selection */}
      <CheckboxGroup
        value={selectedClasses}
        onValueChange={(values) => onClassesChange(values)}
      >
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="3">
          {mockCourses.map((course) => (
            <CheckboxCard
              key={course.id}
              value={course.id}
              label={course.code}
              description={
                <Box>
                  <Text fontSize="sm" color="fg.muted" lineClamp={1}>
                    {course.name}
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
              colorPalette="green"
              borderRadius="xl"
            />
          ))}
        </SimpleGrid>
      </CheckboxGroup>
    </VStack>
  );
}
