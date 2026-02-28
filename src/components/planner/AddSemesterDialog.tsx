"use client";

import { useState } from "react";
import {
  Box,
  Button,
  CloseButton,
  Dialog,
  HStack,
  Input,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { Season, Term } from "@/types/planner";

interface AddSemesterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (season: Season, year: number) => Promise<void>;
  existingTerms: Term[];
}

const SEASONS: Season[] = ["Fall", "Spring", "Summer"];
const SEASON_ICONS: Record<Season, string> = {
  Fall: "\u{1F342}",
  Spring: "\u{1F331}",
  Summer: "\u{2600}\u{FE0F}",
};

export default function AddSemesterDialog({
  open,
  onOpenChange,
  onAdd,
  existingTerms,
}: AddSemesterDialogProps) {
  const currentYear = new Date().getFullYear();
  const [season, setSeason] = useState<Season>("Fall");
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);

  const isDuplicate = existingTerms.some(
    (t) => t.season === season && t.year === year
  );

  async function handleAdd() {
    if (isDuplicate) return;
    setLoading(true);
    try {
      await onAdd(season, year);
      onOpenChange(false);
      // Reset for next time
      setSeason("Fall");
      setYear(currentYear);
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
                fontFamily="'DM Serif Display', serif"
                fontWeight="400"
                letterSpacing="-0.02em"
              >
                Add Semester
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap="4" align="stretch">
                <Box>
                  <Text fontSize="sm" fontWeight="500" mb="2">
                    Season
                  </Text>
                  <HStack gap="2">
                    {SEASONS.map((s) => (
                      <Button
                        key={s}
                        flex="1"
                        variant={season === s ? "solid" : "outline"}
                        colorPalette={season === s ? "green" : "gray"}
                        size="sm"
                        borderRadius="lg"
                        onClick={() => setSeason(s)}
                      >
                        {SEASON_ICONS[s]} {s}
                      </Button>
                    ))}
                  </HStack>
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="500" mb="2">
                    Year
                  </Text>
                  <Input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    min={2020}
                    max={2040}
                    size="sm"
                    borderRadius="lg"
                  />
                </Box>
                {isDuplicate && (
                  <Text fontSize="sm" color="red.500">
                    {season} {year} already exists in your plan.
                  </Text>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline" borderRadius="lg">
                  Cancel
                </Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="green"
                borderRadius="lg"
                onClick={handleAdd}
                disabled={isDuplicate}
                loading={loading}
              >
                Add {season} {year}
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
