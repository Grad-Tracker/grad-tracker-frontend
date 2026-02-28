"use client";

import {
  Box,
  Badge,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuCheck, LuChevronRight, LuRoute } from "react-icons/lu";
import type { GraduateTrack } from "@/types/planner";

interface GraduateTrackSelectorProps {
  tracks: GraduateTrack[];
  selectedTrackId: number | null;
  onSelect: (trackId: number) => void;
}

export default function GraduateTrackSelector({
  tracks,
  selectedTrackId,
  onSelect,
}: GraduateTrackSelectorProps) {
  if (tracks.length === 0) return null;

  return (
    <Box px="4" py="3" borderBottomWidth="1px" borderColor="border.subtle">
      <HStack gap="1.5" mb="2">
        <Icon boxSize="3.5" color="purple.fg">
          <LuRoute />
        </Icon>
        <Text fontSize="xs" fontWeight="600" color="purple.fg">
          {selectedTrackId ? "Concentration" : "Choose a concentration"}
        </Text>
      </HStack>
      {!selectedTrackId && (
        <Text fontSize="2xs" color="fg.muted" mb="2" lineHeight="short">
          Select your specialization track to see the relevant courses.
        </Text>
      )}

      <VStack align="stretch" gap="1.5">
        {tracks.map((track) => {
          const isSelected = track.blockId === selectedTrackId;

          return (
            <Box
              key={track.blockId}
              as="button"
              w="full"
              textAlign="left"
              px="3"
              py="2"
              borderRadius="lg"
              borderWidth="1px"
              borderColor={isSelected ? "purple.500" : "border.subtle"}
              bg={isSelected ? "purple.subtle" : "bg"}
              _hover={{
                bg: isSelected ? "purple.subtle" : "bg.subtle",
                borderColor: isSelected ? "purple.500" : "border",
              }}
              transition="all 0.15s"
              cursor="pointer"
              onClick={() => onSelect(track.blockId)}
            >
              <HStack justify="space-between" gap="2">
                <HStack gap="2" flex="1" minW="0">
                  {isSelected && (
                    <Icon boxSize="3.5" color="purple.fg" flexShrink={0}>
                      <LuCheck />
                    </Icon>
                  )}
                  <Text
                    fontSize="xs"
                    fontWeight={isSelected ? "700" : "600"}
                    color={isSelected ? "purple.fg" : "fg"}
                    truncate
                  >
                    {track.name}
                  </Text>
                </HStack>

                <HStack gap="1.5" flexShrink={0}>
                  <Badge
                    size="sm"
                    variant="subtle"
                    colorPalette={isSelected ? "purple" : "gray"}
                  >
                    {track.courseCount} courses
                  </Badge>
                  {!isSelected && (
                    <Icon boxSize="3" color="fg.subtle">
                      <LuChevronRight />
                    </Icon>
                  )}
                </HStack>
              </HStack>
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}
