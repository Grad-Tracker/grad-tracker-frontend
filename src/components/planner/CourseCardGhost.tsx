"use client";

import { Box, Badge, HStack, Text } from "@chakra-ui/react";
import { LuGripVertical } from "react-icons/lu";
import { getSubjectColor } from "@/lib/subject-colors";
import type { Course } from "@/types/course";

/**
 * Lightweight static card rendered inside DragOverlay.
 * No dnd hooks — avoids subscribing to the drag context and re-rendering
 * on every pointer event during a drag.
 */
export default function CourseCardGhost({ course }: { course: Course }) {
  const color = getSubjectColor(course.subject);

  return (
    <Box
      bg="bg"
      borderWidth="1px"
      borderColor="blue.500"
      borderLeftWidth="3px"
      borderLeftColor={`${color}.500`}
      borderRadius="lg"
      px="3"
      py="2"
      boxShadow="lg"
      opacity="0.95"
      cursor="grabbing"
      pointerEvents="none"
    >
      <HStack justify="space-between" gap="2">
        <HStack gap="2" flex="1" minW="0">
          <Box color="fg.subtle" flexShrink={0}>
            <LuGripVertical size={14} />
          </Box>
          <Box minW="0" flex="1">
            <Text fontSize="xs" fontWeight="600" truncate>
              {course.subject} {course.number}
            </Text>
            <Text fontSize="xs" color="fg.muted" truncate>
              {course.title}
            </Text>
          </Box>
        </HStack>
        <Badge size="sm" variant="subtle" colorPalette={color} flexShrink={0}>
          {course.credits} cr
        </Badge>
      </HStack>
    </Box>
  );
}
