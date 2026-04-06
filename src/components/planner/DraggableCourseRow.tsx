"use client";

import { useDraggable } from "@dnd-kit/core";
import { Box, Table, Text } from "@chakra-ui/react";
import { LuGripVertical } from "react-icons/lu";
import { getSubjectColor } from "@/lib/subject-colors";
import type { Course } from "@/types/course";

interface DraggableCourseRowProps {
  course: Course;
  termId: number;
  onCourseClick: (course: Course) => void;
}

export default function DraggableCourseRow({
  course,
  termId,
  onCourseClick,
}: DraggableCourseRowProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `course-${course.id}-term-${termId}`,
      data: { course, fromTermId: termId },
    });

  const style = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
        zIndex: 1000,
      }
    : undefined;

  const color = getSubjectColor(course.subject);

  return (
    <Table.Row
      ref={setNodeRef}
      style={style}
      opacity={isDragging ? 0.5 : 1}
      cursor="pointer"
      onClick={() => {
        if (!isDragging) onCourseClick(course);
      }}
      _hover={{ bg: "bg.subtle" }}
      transition="background 0.15s"
      css={{
        "& > td:first-of-type": {
          borderLeftWidth: "3px",
          borderLeftColor: `var(--chakra-colors-${color}-500)`,
        },
      }}
    >
      <Table.Cell px="0">
        <Box
          {...listeners}
          {...attributes}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          cursor="grab"
          color="fg.subtle"
          _hover={{ color: "fg.muted" }}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <LuGripVertical size={14} />
        </Box>
      </Table.Cell>
      <Table.Cell>
        <Text fontSize="sm" fontWeight="600">
          {course.subject} {course.number}
        </Text>
      </Table.Cell>
      <Table.Cell>
        <Text fontSize="sm" color="fg.muted" lineClamp={2}>
          {course.title}
        </Text>
      </Table.Cell>
      <Table.Cell textAlign="end">
        <Text fontSize="sm">{course.credits}</Text>
      </Table.Cell>
    </Table.Row>
  );
}
