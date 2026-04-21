"use client";

import { useMemo } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuSearch, LuCheck } from "react-icons/lu";
import { TYPE_ORDER as DEFAULT_TYPE_ORDER, TYPE_META } from "@/lib/program-constants";
import type { Program } from "@/types/onboarding";

interface ProgramSelectorProps {
  programs: Program[];
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  /** Override the default type ordering / which types to show */
  typeOrder?: Program["program_type"][];
  /** Max height of the scrollable program list */
  maxH?: string;
  /** Whether programs are still loading */
  loading?: boolean;
}

export default function ProgramSelector({
  programs,
  selectedIds,
  onToggle,
  searchQuery,
  onSearchChange,
  typeOrder = DEFAULT_TYPE_ORDER,
  maxH = "280px",
  loading = false,
}: Readonly<ProgramSelectorProps>) {
  const filteredByType = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? programs.filter((p) => p.name.toLowerCase().includes(q))
      : programs;

    const grouped: Record<string, Program[]> = {};
    for (const type of typeOrder) {
      grouped[type] = [];
    }
    for (const p of filtered) {
      if (grouped[p.program_type]) grouped[p.program_type].push(p);
    }
    return grouped;
  }, [programs, searchQuery, typeOrder]);

  return (
    <>
      {/* Search */}
      <Box position="relative" mb="3">
        <Box
          position="absolute"
          left="3"
          top="50%"
          transform="translateY(-50%)"
          color="fg.muted"
          zIndex="1"
        >
          <LuSearch size={14} />
        </Box>
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search programs..."
          size="sm"
          borderRadius="lg"
          pl="9"
        />
      </Box>

      {loading ? (
        <Text fontSize="sm" color="fg.muted" py="4" textAlign="center">
          Loading programs...
        </Text>
      ) : (
        <VStack
          align="stretch"
          gap="4"
          maxH={maxH}
          overflowY="auto"
          pr="1"
        >
          {typeOrder.map((type) => {
            const grouped = filteredByType[type];
            if (!grouped || grouped.length === 0) return null;
            const meta = TYPE_META[type];

            return (
              <Box key={type}>
                <HStack gap="2" mb="2">
                  <Icon boxSize="3.5" color={`${meta.color}.fg`}>
                    <meta.icon />
                  </Icon>
                  <Text
                    fontSize="xs"
                    fontWeight="600"
                    color="fg.muted"
                    textTransform="uppercase"
                    letterSpacing="0.05em"
                  >
                    {meta.label}
                  </Text>
                  <Badge
                    size="sm"
                    variant="subtle"
                    colorPalette={meta.color}
                  >
                    {grouped.length}
                  </Badge>
                </HStack>

                <Flex gap="2" flexWrap="wrap">
                  {grouped.map((program) => {
                    const isSelected = selectedIds.has(program.id);
                    return (
                      <Button
                        key={program.id}
                        size="xs"
                        variant={isSelected ? "solid" : "outline"}
                        colorPalette={isSelected ? meta.color : "gray"}
                        borderRadius="full"
                        onClick={() => onToggle(program.id)}
                        fontWeight={isSelected ? "600" : "400"}
                      >
                        {isSelected && <LuCheck size={12} />}
                        {program.name}
                      </Button>
                    );
                  })}
                </Flex>
              </Box>
            );
          })}
        </VStack>
      )}
    </>
  );
}
