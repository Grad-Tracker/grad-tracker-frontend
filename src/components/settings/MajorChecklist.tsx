"use client";

import { Badge, Heading, HStack, Stack } from "@chakra-ui/react";
import { RequirementCard } from "@/components/shared/RequirementCard";
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
          <RequirementCard
            key={block.id}
            title={block.name}
            badge={
              <Badge colorPalette="blue" variant="outline">
                {blockCompleted}/{block.courses.length}
              </Badge>
            }
            items={block.courses}
            completedIds={completedCourseIds}
            onToggleItem={onToggle}
          />
        );
      })}
    </Stack>
  );
}
