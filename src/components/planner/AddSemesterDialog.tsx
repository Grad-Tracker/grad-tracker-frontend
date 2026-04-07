"use client";

import { useState } from "react";
import {
  Box,
  Button,
  HStack,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
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

  const isDuplicate = existingTerms.some(
    (t) => t.season === season && t.year === year
  );

  async function handleAdd() {
    if (isDuplicate) return;
    await onAdd(season, year);
    // Reset for next time
    setSeason("Fall");
    setYear(currentYear);
  }

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={handleAdd}
      title="Add Semester"
      confirmText={`Add ${season} ${year}`}
      confirmColor="blue"
      confirmDisabled={isDuplicate}
    >
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
                colorPalette={season === s ? "blue" : "gray"}
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
    </ConfirmationDialog>
  );
}
