"use client";

import { Card, Heading, HStack, Stack, Text, Badge } from "@chakra-ui/react";
import { Checkbox } from "@/components/ui/checkbox";
import type { GenEdBucketWithCourses } from "@/types/auto-generate";

interface GenEdChecklistProps {
  buckets: GenEdBucketWithCourses[];
  completedCourseIds: Set<number>;
  onToggle: (courseId: number, checked: boolean) => void;
}

export function GenEdChecklist({ buckets, completedCourseIds, onToggle }: GenEdChecklistProps) {
  return (
    <Stack gap="4">
      {buckets.map((bucket) => {
        const completedCredits = bucket.courses
          .filter((c) => completedCourseIds.has(c.id))
          .reduce((sum, c) => sum + c.credits, 0);

        return (
          <Card.Root
            key={bucket.id}
            bg="bg"
            borderRadius="xl"
            borderWidth="1px"
            borderColor="border.subtle"
          >
            <Card.Header p="5" pb="3">
              <HStack justify="space-between">
                <Heading size="sm" fontWeight="600">
                  {bucket.name}
                </Heading>
                <Badge colorPalette="blue" variant="subtle">
                  {completedCredits}/{bucket.credits_required} credits
                </Badge>
              </HStack>
            </Card.Header>
            <Card.Body p="5" pt="0">
              <Stack gap="2">
                {bucket.courses.map((course) => (
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
