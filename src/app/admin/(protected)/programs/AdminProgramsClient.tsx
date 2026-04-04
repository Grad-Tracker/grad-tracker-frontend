"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Card,
  Grid,
  Heading,
  HStack,
  Icon,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import { LuBookOpen, LuGraduationCap, LuScrollText, LuSearch, LuTarget } from "react-icons/lu";

import { NativeSelectField, NativeSelectRoot } from "@/components/ui/native-select";
import type { AdminProgramSummary } from "./server-helpers";

const PROGRAM_GROUPS = [
  { type: "MAJOR", label: "Majors", icon: LuTarget, color: "blue" },
  { type: "MINOR", label: "Minors", icon: LuBookOpen, color: "purple" },
  { type: "CERTIFICATE", label: "Certificates", icon: LuScrollText, color: "orange" },
  { type: "GRADUATE", label: "Graduate Programs", icon: LuGraduationCap, color: "green" },
] as const;

type ProgramSortOption =
  | "name-asc"
  | "name-desc"
  | "catalog-newest"
  | "catalog-oldest"
  | "blocks-most"
  | "blocks-least"
  | "courses-most"
  | "courses-least";

function ProgramCard({ program }: { program: AdminProgramSummary }) {
  return (
    <Link href={`/admin/programs/${program.id}`} style={{ display: "block" }}>
      <Card.Root
        data-testid={`program-card-${program.id}`}
        bg="bg"
        borderRadius="xl"
        borderWidth="1px"
        borderColor="border.subtle"
        _hover={{ borderColor: "green.muted", transform: "translateY(-2px)", boxShadow: "lg" }}
        transition="all 0.2s"
      >
        <Card.Body p="5">
          <VStack align="stretch" gap="4">
            <HStack justify="space-between" align="start">
              <Badge colorPalette="green" variant="surface">
                {program.program_type}
              </Badge>
              <Text fontSize="sm" color="fg.muted">
                {program.catalog_year ?? "No catalog year"}
              </Text>
            </HStack>
            <Heading size="md">{program.name}</Heading>
            <HStack gap="4" color="fg.muted" fontSize="sm" wrap="wrap">
              <Text>{program.blockCount} requirement blocks</Text>
              <Text>{program.courseCount} courses</Text>
            </HStack>
          </VStack>
        </Card.Body>
      </Card.Root>
    </Link>
  );
}

function comparePrograms(a: AdminProgramSummary, b: AdminProgramSummary, sort: ProgramSortOption) {
  const nameA = a.name ?? "";
  const nameB = b.name ?? "";
  const yearA = Number(a.catalog_year ?? 0);
  const yearB = Number(b.catalog_year ?? 0);
  const blockA = Number(a.blockCount ?? 0);
  const blockB = Number(b.blockCount ?? 0);
  const courseA = Number(a.courseCount ?? 0);
  const courseB = Number(b.courseCount ?? 0);

  switch (sort) {
    case "name-desc":
      return nameB.localeCompare(nameA);
    case "catalog-newest":
      return yearB - yearA || nameA.localeCompare(nameB);
    case "catalog-oldest":
      return yearA - yearB || nameA.localeCompare(nameB);
    case "blocks-most":
      return blockB - blockA || nameA.localeCompare(nameB);
    case "blocks-least":
      return blockA - blockB || nameA.localeCompare(nameB);
    case "courses-most":
      return courseB - courseA || nameA.localeCompare(nameB);
    case "courses-least":
      return courseA - courseB || nameA.localeCompare(nameB);
    case "name-asc":
    default:
      return nameA.localeCompare(nameB);
  }
}

export default function AdminProgramsClient({ programs }: { programs: AdminProgramSummary[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ProgramSortOption>("name-asc");

  const normalizedQuery = query.trim().toLowerCase();

  const groupedPrograms = useMemo(() => {
    const filtered = programs.filter((program) => {
      if (!normalizedQuery) return true;
      return (program.name ?? "").toLowerCase().includes(normalizedQuery);
    });

    return PROGRAM_GROUPS.map((group) => ({
      ...group,
      items: filtered
        .filter((program) => program.program_type === group.type)
        .sort((a, b) => comparePrograms(a, b, sort)),
    })).filter((group) => group.items.length > 0);
  }, [normalizedQuery, programs, sort]);

  const visibleCount = groupedPrograms.reduce((total, group) => total + group.items.length, 0);

  if (programs.length === 0) {
    return (
      <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
        <Card.Body p="8">
          <Text color="fg.muted" textAlign="center">
            No programs are currently assigned to your advisor account.
          </Text>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <VStack align="stretch" gap="6">
      <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
        <Card.Body p={{ base: "4", md: "5" }}>
          <VStack align="stretch" gap="3">
            <HStack
              gap="3"
              align={{ base: "stretch", md: "center" }}
              flexDir={{ base: "column", md: "row" }}
            >
              <Box flex="1" position="relative">
                <Box
                  position="absolute"
                  left="3"
                  top="50%"
                  transform="translateY(-50%)"
                  color="fg.muted"
                  zIndex="1"
                >
                  <LuSearch />
                </Box>
                <Input
                  aria-label="Search programs"
                  placeholder="Search programs"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  pl="10"
                  rounded="lg"
                  bg="bg"
                  borderColor="border.subtle"
                />
              </Box>

              <NativeSelectRoot width={{ base: "full", md: "280px" }}>
                <NativeSelectField
                  aria-label="Sort programs"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as ProgramSortOption)}
                >
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="catalog-newest">Catalog year (newest)</option>
                  <option value="catalog-oldest">Catalog year (oldest)</option>
                  <option value="blocks-most">Requirement blocks (most)</option>
                  <option value="blocks-least">Requirement blocks (least)</option>
                  <option value="courses-most">Courses (most)</option>
                  <option value="courses-least">Courses (least)</option>
                </NativeSelectField>
              </NativeSelectRoot>
            </HStack>

            <Text color="fg.muted" fontSize="sm">
              Showing {visibleCount} of {programs.length} assigned program{programs.length === 1 ? "" : "s"}
            </Text>
          </VStack>
        </Card.Body>
      </Card.Root>

      {groupedPrograms.length === 0 ? (
        <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
          <Card.Body p="8">
            <Text color="fg.muted" textAlign="center">
              No programs match your search.
            </Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <VStack align="stretch" gap="8">
          {groupedPrograms.map((group) => (
            <Box key={group.type}>
              <HStack gap="3" mb="4">
                <Box
                  w="10"
                  h="10"
                  borderRadius="lg"
                  bg={`${group.color}.subtle`}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon color={`${group.color}.fg`} boxSize="5">
                    <group.icon />
                  </Icon>
                </Box>
                <Box>
                  <Heading size="md">{group.label}</Heading>
                  <Text color="fg.muted" fontSize="sm">
                    {group.items.length} assigned
                  </Text>
                </Box>
              </HStack>
              <Grid
                templateColumns={{
                  base: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                  xl: "repeat(3, minmax(0, 1fr))",
                }}
                gap="4"
              >
                {group.items.map((program) => (
                  <ProgramCard key={program.id} program={program} />
                ))}
              </Grid>
            </Box>
          ))}
        </VStack>
      )}
    </VStack>
  );
}
