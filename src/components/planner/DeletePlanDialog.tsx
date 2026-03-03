"use client";

import { useState } from "react";
import {
  Button,
  CloseButton,
  Dialog,
  Portal,
  Text,
} from "@chakra-ui/react";
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
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root
      lazyMount
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderRadius="xl">
            <Dialog.Header>
              <Dialog.Title
                fontFamily="var(--font-outfit), sans-serif"
                fontWeight="400"
                letterSpacing="-0.02em"
              >
                Delete Plan
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text fontSize="sm" color="fg.muted">
                Are you sure you want to delete{" "}
                <Text as="span" fontWeight="600" color="fg">
                  {plan?.name}
                </Text>
                ? This will remove all {plan?.term_count ?? 0} semesters and{" "}
                {plan?.course_count ?? 0} planned courses. This action cannot be
                undone.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline" borderRadius="lg">
                  Cancel
                </Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="red"
                borderRadius="lg"
                onClick={handleDelete}
                loading={loading}
              >
                Delete Plan
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
