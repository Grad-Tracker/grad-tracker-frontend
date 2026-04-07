"use client";

import { type ReactNode } from "react";
import { Box, Card, HStack, Stack } from "@chakra-ui/react";
import { Skeleton } from "@/components/ui/skeleton";

/* ------------------------------------------------------------------ */
/*  SkeletonCard – Card.Root with standard skeleton styling           */
/* ------------------------------------------------------------------ */

interface SkeletonCardProps {
  children: ReactNode;
  /** Optional header padding override (default: p="5" pb="0") */
  headerPadding?: Record<string, string>;
}

export function SkeletonCard({ children }: SkeletonCardProps) {
  return (
    <Card.Root
      bg="bg"
      borderRadius="xl"
      borderWidth="1px"
      borderColor="border.subtle"
    >
      {children}
    </Card.Root>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonRow – icon placeholder + text lines                       */
/* ------------------------------------------------------------------ */

interface SkeletonRowProps {
  /** Icon/avatar size (default: "8") */
  iconSize?: string;
  /** Icon border radius (default: "lg") */
  iconRadius?: string;
  /** Width of primary text line (default: "80px") */
  primaryWidth?: string;
  /** Width of secondary text line (default: "140px") */
  secondaryWidth?: string;
}

export function SkeletonRow({
  iconSize = "8",
  iconRadius = "lg",
  primaryWidth = "80px",
  secondaryWidth = "140px",
}: SkeletonRowProps) {
  return (
    <HStack gap="3">
      <Skeleton height={iconSize} width={iconSize} borderRadius={iconRadius} />
      <Box flex="1">
        <Skeleton height="4" width={primaryWidth} mb="1" />
        <Skeleton height="3" width={secondaryWidth} />
      </Box>
    </HStack>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonProgressBar – label + value line with bar underneath      */
/* ------------------------------------------------------------------ */

interface SkeletonProgressBarProps {
  /** Width of the label skeleton (default: "140px") */
  labelWidth?: string;
  /** Width of the value skeleton (default: "90px") */
  valueWidth?: string;
}

export function SkeletonProgressBar({
  labelWidth = "140px",
  valueWidth = "90px",
}: SkeletonProgressBarProps) {
  return (
    <Box>
      <HStack justify="space-between" mb="2">
        <Skeleton height="4" width={labelWidth} />
        <Skeleton height="4" width={valueWidth} />
      </HStack>
      <Skeleton height="2" width="full" borderRadius="full" />
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonList – repeats SkeletonRow N times                        */
/* ------------------------------------------------------------------ */

interface SkeletonListProps {
  /** Number of rows to render (default: 3) */
  count?: number;
  /** Props forwarded to each SkeletonRow */
  iconSize?: string;
  iconRadius?: string;
  primaryWidth?: string;
  secondaryWidth?: string;
  /** Gap between rows (default: "3") */
  gap?: string;
}

export function SkeletonList({
  count = 3,
  gap = "3",
  ...rowProps
}: SkeletonListProps) {
  return (
    <Stack gap={gap}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} {...rowProps} />
      ))}
    </Stack>
  );
}
