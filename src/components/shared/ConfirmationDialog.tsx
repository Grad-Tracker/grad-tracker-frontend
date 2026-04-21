"use client";

import { type ReactNode, useState } from "react";
import {
  Button,
  CloseButton,
  Dialog,
  Portal,
} from "@chakra-ui/react";

export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  title: string;
  children: ReactNode;
  confirmText?: string;
  confirmColor?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  children,
  confirmText = "Confirm",
  confirmColor = "red",
  cancelText = "Cancel",
  confirmDisabled = false,
}: ConfirmationDialogProps) {
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
                fontFamily="var(--font-dm-sans), sans-serif"
                fontWeight="400"
                letterSpacing="-0.02em"
              >
                {title}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>{children}</Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline" borderRadius="lg">
                  {cancelText}
                </Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette={confirmColor}
                borderRadius="lg"
                onClick={handleConfirm}
                loading={loading}
                disabled={confirmDisabled}
              >
                {confirmText}
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
