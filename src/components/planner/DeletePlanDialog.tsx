"use client";

import { Text } from "@chakra-ui/react";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import type { PlanWithMeta } from "@/types/planner";

interface DeletePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  plan: PlanWithMeta | null;
}

export default function DeletePlanDialog({
  open,
  onOpenChange,
  onConfirm,
  plan,
}: DeletePlanDialogProps) {
  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title="Delete Plan"
      confirmText="Delete Plan"
      confirmColor="red"
    >
      <Text fontSize="sm" color="fg.muted">
        Are you sure you want to delete{" "}
        <Text as="span" fontWeight="600" color="fg">
          {plan?.name}
        </Text>
        ? This will remove all {plan?.term_count ?? 0} semesters and{" "}
        {plan?.course_count ?? 0} planned courses. This action cannot be
        undone.
      </Text>
    </ConfirmationDialog>
  );
}
