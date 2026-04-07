"use client";

import { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Box, Badge, HStack, Text, VStack } from "@chakra-ui/react";
import { LuGripVertical, LuCircleCheck } from "react-icons/lu";
import { Tooltip } from "@/components/ui/tooltip";
import { getSubjectColor } from "@/lib/subject-colors";
import type { Course } from "@/types/course";

interface DraggableCourseCardProps {
  course: Course;
  termId?: number;
  isCompleted?: boolean;
  isPlanned?: boolean;
  dragContextId?: string | number;
}

function CourseTooltipContent({ course }: { course: Course }) {
  const hasDetails = course.description || course.prereq_text;
  if (!hasDetails) {
    return (
      <Box>
        <Text fontWeight="600" fontSize="xs">
          {course.subject} {course.number} — {course.title}
        </Text>
        <Text fontSize="xs" color="fg.muted" mt="0.5">
          {course.credits} credits
        </Text>
      </Box>
    );
  }
  return (
    <VStack align="start" gap="1.5" maxW="280px">
      <Box>
        <Text fontWeight="600" fontSize="xs">
          {course.subject} {course.number} — {course.title}
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {course.credits} credits
        </Text>
      </Box>
      {course.description && (
        <Text fontSize="xs" lineHeight="short">
          {course.description}
        </Text>
      )}
      {course.prereq_text && (
        <Box>
          <Text fontSize="xs" fontWeight="600">
            Prerequisites
          </Text>
          <Text fontSize="xs" color="fg.muted">
            {course.prereq_text}
          </Text>
        </Box>
      )}
    </VStack>
  );
}

function DraggableCourseCard({
  course,
  termId,
  isCompleted = false,
  isPlanned = false,
  dragContextId,
}: DraggableCourseCardProps) {
  const poolScope = dragContextId != null ? `panel-${dragContextId}` : "panel";
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `course-${course.id}-term-${termId ?? poolScope}`,
      data: { course, fromTermId: termId },
      disabled: isCompleted,
    });

  const style = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
        zIndex: 1000,
      }
    : undefined;

  const color = getSubjectColor(course.subject);

  const card = (
    <Box
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      bg="bg"
      borderWidth="1px"
      borderColor={isDragging ? "blue.500" : "border.subtle"}
      borderLeftWidth="3px"
      borderLeftColor={isCompleted ? "fg.subtle" : `${color}.500`}
      borderRadius="lg"
      px="3"
      py="2"
      cursor={isCompleted ? "not-allowed" : "grab"}
      opacity={isCompleted ? 0.5 : isDragging ? 0.01 : 1}
      _hover={
        isCompleted
          ? {}
          : {
              borderColor: `${color}.300`,
              boxShadow: "sm",
            }
      }
      transition={isDragging ? "none" : "all 0.15s"}
      position={isDragging ? "relative" : "static"}
    >
      <HStack justify="space-between" gap="2">
        <HStack gap="2" flex="1" minW="0">
          {!isCompleted && (
            <Box color="fg.subtle" flexShrink={0}>
              <LuGripVertical size={14} />
            </Box>
          )}
          {isCompleted && (
            <Box color="blue.500" flexShrink={0}>
              <LuCircleCheck size={14} />
            </Box>
          )}
          <Box minW="0" flex="1">
            <Text
              fontSize="xs"
              fontWeight="600"
              truncate
              textDecoration={isCompleted ? "line-through" : "none"}
            >
              {course.subject} {course.number}
            </Text>
            <Text
              fontSize="xs"
              color="fg.muted"
              truncate
              textDecoration={isCompleted ? "line-through" : "none"}
            >
              {course.title}
            </Text>
          </Box>
        </HStack>
        <Badge
          size="sm"
          variant="subtle"
          colorPalette={isCompleted ? "gray" : color}
          flexShrink={0}
        >
          {course.credits} cr
        </Badge>
      </HStack>
      {isPlanned && !isCompleted && !termId && (
        <Badge size="sm" variant="outline" colorPalette="blue" mt="1">
          Planned
        </Badge>
      )}
    </Box>
  );

  if (isDragging) return card;

  return (
    <Tooltip
      content={<CourseTooltipContent course={course} />}
      showArrow
      openDelay={500}
      closeDelay={0}
      positioning={{ placement: "right" }}
    >
      {card}
    </Tooltip>
  );
}

export default memo(DraggableCourseCard);
