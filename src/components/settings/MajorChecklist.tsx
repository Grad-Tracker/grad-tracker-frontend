"use client";

import { Badge, Card, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { Checkbox } from "@/components/ui/checkbox";
import type { MajorWithRequirements } from "@/lib/supabase/queries/classHistory";

interface MajorChecklistProps {
  major: MajorWithRequirements;
  completedCourseIds: Set<number>;
  onToggle: (courseId: number, checked: boolean) => void;
}

export function MajorChecklist({ major, completedCourseIds, onToggle }: Readonly<MajorChecklistProps>) {
  const allCourses = major.blocks.flatMap((b) => b.courses);
  const completedCount = allCourses.filter((c) => completedCourseIds.has(c.id)).length;

  return (
    <Stack gap="4">
      <HStack justify="space-between">
        <Heading size="md" fontWeight="600">
          {major.majorName}
        </Heading>
        <Badge colorPalette="blue" variant="subtle">
          {completedCount}/{allCourses.length} courses
        </Badge>
      </HStack>

      {major.blocks.map((block) => {
        const blockCompleted = block.courses.filter((c) => completedCourseIds.has(c.id)).length;
        return (
          <Card.Root
            key={block.id}
            bg="bg"
            borderRadius="xl"
            borderWidth="1px"
            borderColor="border.subtle"
          >
            <Card.Header p="5" pb="3">
              <HStack justify="space-between">
                <Heading size="sm" fontWeight="600">
                  {block.name}
                </Heading>
                <Badge colorPalette="blue" variant="outline">
                  {blockCompleted}/{block.courses.length}
                </Badge>
              </HStack>
            </Card.Header>
            <Card.Body p="5" pt="0">
              <Stack gap="2">
                {block.courses.map((course) => (
                  <Checkbox
                    key={course.id}
                    colorPalette="blue"
                    checked={completedCourseIds.has(course.id)}
                    onCheckedChange={(e) => onToggle(course.id, !!e.checked)}
                  >
                    <Text fontSize="sm">
                      {course.subject} {course.number} — {course.title}
                    </Text>
                  </Checkbox>
                ))}
              </Stack>
            </Card.Body>
          </Card.Root>
        );
      })}
    </Stack>
  );
}
