"use client";

import { Text } from "@chakra-ui/react";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import type { Term } from "@/types/planner";

interface RemoveSemesterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  term: Term | null;
  courseCount: number;
}

export default function RemoveSemesterDialog({
  open,
  onOpenChange,
  onConfirm,
  term,
  courseCount,
}: RemoveSemesterDialogProps) {
  if (!term) return null;

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={`Remove ${term.season} ${term.year}?`}
      confirmText="Remove Semester"
      confirmColor="red"
    >
      <Text fontSize="sm" color="fg.muted">
        This semester has{" "}
        <Text as="span" fontWeight="600" color="fg">
          {courseCount} {courseCount === 1 ? "course" : "courses"}
        </Text>{" "}
        planned. Removing it will unplan all courses and return them to
        the course pool.
      </Text>
    </ConfirmationDialog>
  );
}
