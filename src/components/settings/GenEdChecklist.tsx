"use client";

import { Badge, Stack } from "@chakra-ui/react";
import { RequirementCard } from "@/components/shared/RequirementCard";
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
          <RequirementCard
            key={bucket.id}
            title={bucket.name}
            badge={
              <Badge colorPalette="blue" variant="subtle">
                {completedCredits}/{bucket.credits_required} credits
              </Badge>
            }
            items={bucket.courses}
            completedIds={completedCourseIds}
            onToggleItem={onToggle}
          />
        );
      })}
    </Stack>
  );
}
