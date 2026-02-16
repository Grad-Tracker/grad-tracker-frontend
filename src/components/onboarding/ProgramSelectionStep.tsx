"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  RadioCard,
  CheckboxGroup,
  Badge,
  Icon,
  Input,
  NativeSelect,
  Collapsible,
  Button,
} from "@chakra-ui/react";
import {
  LuGraduationCap,
  LuAward,
  LuSearch,
  LuCalendar,
  LuZap,
} from "react-icons/lu";
import { CheckboxCard } from "@/components/ui/checkbox-card";
import type { Program } from "@/types/onboarding";

interface ProgramSelectionStepProps {
  majors: Program[];
  certificates: Program[];
  selectedMajor: number | null;
  selectedCertificates: number[];
  onMajorChange: (majorId: number | null) => void;
  onCertificatesChange: (certificateIds: number[]) => void;
  expectedGradSemester: string | null;
  expectedGradYear: number | null;
  onGradChange: (semester: string | null, year: number | null) => void;
}

const SEMESTERS = ["Spring", "Summer", "Fall"];

function getAsapGraduation(): { semester: string; year: number } {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();

  if (month < 4) return { semester: "Spring", year };
  if (month < 7) return { semester: "Summer", year };
  if (month < 11) return { semester: "Fall", year };
  return { semester: "Spring", year: year + 1 };
}

function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => currentYear + i);
}

export default function ProgramSelectionStep({
  majors,
  certificates,
  selectedMajor,
  selectedCertificates,
  onMajorChange,
  onCertificatesChange,
  expectedGradSemester,
  expectedGradYear,
  onGradChange,
}: ProgramSelectionStepProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMajors = useMemo(() => {
    if (!searchQuery.trim()) return majors;
    const q = searchQuery.toLowerCase();
    return majors.filter((m) => m.name.toLowerCase().includes(q));
  }, [majors, searchQuery]);

  const yearOptions = useMemo(() => getYearOptions(), []);

  const handleAsap = () => {
    const { semester, year } = getAsapGraduation();
    onGradChange(semester, year);
  };

  const asapGrad = useMemo(() => getAsapGraduation(), []);
  const isAsapSelected =
    expectedGradSemester === asapGrad.semester &&
    expectedGradYear === asapGrad.year;

  return (
    <VStack gap="10" align="stretch">
      {/* Major Selection */}
      <Box>
        <VStack gap="2" align="start" mb="5">
          <Badge colorPalette="green" variant="surface" rounded="full" px="3" py="1">
            <Icon mr="1.5" boxSize="3.5">
              <LuGraduationCap />
            </Icon>
            Required
          </Badge>
          <Heading
            fontFamily="'DM Serif Display', serif"
            size="xl"
            fontWeight="400"
            letterSpacing="-0.01em"
          >
            Select Your Major
          </Heading>
          <Text color="fg.muted" fontSize="sm">
            Choose the degree program you are pursuing.
          </Text>
        </VStack>

        {/* Search Input */}
        <Box position="relative" mb="4">
          <Box
            position="absolute"
            left="3"
            top="50%"
            transform="translateY(-50%)"
            color="fg.muted"
            zIndex="1"
            pointerEvents="none"
          >
            <LuSearch />
          </Box>
          <Input
            placeholder="Search majors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            pl="10"
            borderRadius="xl"
            size="lg"
            bg="bg.subtle"
            _focus={{ bg: "bg", borderColor: "green.solid" }}
          />
        </Box>

        {/* Results counter */}
        <Text color="fg.muted" fontSize="xs" mb="3">
          {filteredMajors.length} of {majors.length} majors
        </Text>

        <RadioCard.Root
          value={selectedMajor?.toString() ?? undefined}
          onValueChange={(details) =>
            onMajorChange(details.value ? Number(details.value) : null)
          }
          colorPalette="green"
        >
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="3">
            {filteredMajors.map((major) => (
              <RadioCard.Item
                key={major.id}
                value={major.id.toString()}
                borderRadius="xl"
                _checked={{
                  borderColor: "green.solid",
                  bg: "green.subtle",
                }}
              >
                <RadioCard.ItemHiddenInput />
                <RadioCard.ItemControl>
                  <RadioCard.ItemContent>
                    <RadioCard.ItemText fontWeight="600" fontSize="sm">
                      {major.name}
                    </RadioCard.ItemText>
                    <RadioCard.ItemDescription color="fg.muted" fontSize="xs">
                      {major.catalog_year}
                    </RadioCard.ItemDescription>
                  </RadioCard.ItemContent>
                  <RadioCard.ItemIndicator />
                </RadioCard.ItemControl>
              </RadioCard.Item>
            ))}
          </SimpleGrid>
        </RadioCard.Root>

        {filteredMajors.length === 0 && (
          <Box textAlign="center" py="8">
            <Text color="fg.muted" fontSize="sm">
              No majors match &ldquo;{searchQuery}&rdquo;
            </Text>
          </Box>
        )}
      </Box>

      {/* Certificates Section — progressive disclosure */}
      <Collapsible.Root open={selectedMajor !== null} unmountOnExit>
        <Collapsible.Content>
          <Box>
            <VStack gap="2" align="start" mb="5">
              <Badge colorPalette="blue" variant="surface" rounded="full" px="3" py="1">
                <Icon mr="1.5" boxSize="3.5">
                  <LuAward />
                </Icon>
                Optional
              </Badge>
              <Heading
                fontFamily="'DM Serif Display', serif"
                size="xl"
                fontWeight="400"
                letterSpacing="-0.01em"
              >
                Add Certificates
              </Heading>
              <Text color="fg.muted" fontSize="sm">
                Select any certificate programs you want to pursue alongside your major.
              </Text>
            </VStack>

            <CheckboxGroup
              value={selectedCertificates.map(String)}
              onValueChange={(values) => onCertificatesChange(values.map(Number))}
            >
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
                {certificates.map((cert) => (
                  <CheckboxCard
                    key={cert.id}
                    value={cert.id.toString()}
                    label={cert.name}
                    description={
                      <Text fontSize="sm" color="fg.muted">
                        {cert.catalog_year}
                      </Text>
                    }
                    colorPalette="green"
                    borderRadius="xl"
                  />
                ))}
              </SimpleGrid>
            </CheckboxGroup>

            {certificates.length === 0 && (
              <Box
                textAlign="center"
                py="6"
                bg="bg.subtle"
                borderRadius="xl"
              >
                <Text color="fg.muted" fontSize="sm">
                  No certificates available for this major yet.
                </Text>
              </Box>
            )}
          </Box>
        </Collapsible.Content>
      </Collapsible.Root>

      {/* Expected Graduation */}
      <Box>
        <VStack gap="2" align="start" mb="5">
          <Badge colorPalette="purple" variant="surface" rounded="full" px="3" py="1">
            <Icon mr="1.5" boxSize="3.5">
              <LuCalendar />
            </Icon>
            Optional
          </Badge>
          <Heading
            fontFamily="'DM Serif Display', serif"
            size="xl"
            fontWeight="400"
            letterSpacing="-0.01em"
          >
            Expected Graduation
          </Heading>
          <Text color="fg.muted" fontSize="sm">
            When do you plan to graduate? You can always change this later.
          </Text>
        </VStack>

        <HStack gap="3" flexWrap="wrap" align="end">
          <Box flex="1" minW="140px">
            <Text fontSize="xs" fontWeight="600" color="fg.muted" mb="1">
              Semester
            </Text>
            <NativeSelect.Root size="lg">
              <NativeSelect.Field
                placeholder="Select semester"
                value={expectedGradSemester ?? ""}
                onChange={(e) =>
                  onGradChange(e.target.value || null, expectedGradYear)
                }
                borderRadius="xl"
              >
                {SEMESTERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Box>

          <Box flex="1" minW="120px">
            <Text fontSize="xs" fontWeight="600" color="fg.muted" mb="1">
              Year
            </Text>
            <NativeSelect.Root size="lg">
              <NativeSelect.Field
                placeholder="Select year"
                value={expectedGradYear?.toString() ?? ""}
                onChange={(e) =>
                  onGradChange(
                    expectedGradSemester,
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                borderRadius="xl"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Box>

          <Button
            variant={isAsapSelected ? "solid" : "outline"}
            colorPalette="green"
            size="lg"
            borderRadius="xl"
            onClick={handleAsap}
            flexShrink={0}
          >
            <LuZap />
            As soon as possible
          </Button>
        </HStack>

        {expectedGradSemester && expectedGradYear && (
          <Text fontSize="sm" color="green.fg" mt="3" fontWeight="500">
            Target: {expectedGradSemester} {expectedGradYear}
          </Text>
        )}
      </Box>
    </VStack>
  );
}
