"use client";

import { useState } from "react";
import { Button, Card, Heading, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import { CourseSearchDialog } from "./CourseSearchDialog";
import type { CourseRow } from "@/types/onboarding";

interface AdditionalCoursesProps {
  courses: CourseRow[];
  onDelete: (courseId: number) => void;
  onCourseSelected: (course: CourseRow) => void;
}

export function AdditionalCourses({ courses, onDelete, onCourseSelected }: AdditionalCoursesProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Stack gap="4">
      <HStack justify="space-between">
        <Heading size="md" fontWeight="600">
          Additional Courses
        </Heading>
        <Button
          colorPalette="green"
          size="sm"
          borderRadius="lg"
          onClick={() => setDialogOpen(true)}
        >
          <Icon>
            <LuPlus />
          </Icon>
          Add Course
        </Button>
      </HStack>

      {courses.length === 0 ? (
        <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
          <Card.Body p="5">
            <Text fontSize="sm" color="fg.muted">
              No additional courses added yet.
            </Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
          <Card.Body p="5">
            <Stack gap="2">
              {courses.map((course) => (
                <HStack key={course.id} justify="space-between">
                  <Text fontSize="sm">
                    {course.subject} {course.number} — {course.title} ({course.credits} cr)
                  </Text>
                  <Button
                    variant="ghost"
                    size="xs"
                    colorPalette="red"
                    onClick={() => onDelete(course.id)}
                  >
                    <Icon>
                      <LuTrash2 />
                    </Icon>
                  </Button>
                </HStack>
              ))}
            </Stack>
          </Card.Body>
        </Card.Root>
      )}

      <CourseSearchDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCourseSelected={onCourseSelected}
      />
    </Stack>
  );
}
