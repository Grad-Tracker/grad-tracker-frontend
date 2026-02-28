"use client";

import { useState } from "react";
import {
  Button,
  CloseButton,
  Dialog,
  Portal,
  Text,
} from "@chakra-ui/react";
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
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  if (!term) return null;

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
                fontFamily="'DM Serif Display', serif"
                fontWeight="400"
                letterSpacing="-0.02em"
              >
                Remove {term.season} {term.year}?
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text fontSize="sm" color="fg.muted">
                This semester has{" "}
                <Text as="span" fontWeight="600" color="fg">
                  {courseCount} {courseCount === 1 ? "course" : "courses"}
                </Text>{" "}
                planned. Removing it will unplan all courses and return them to
                the course pool.
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
                onClick={handleConfirm}
                loading={loading}
              >
                Remove Semester
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
