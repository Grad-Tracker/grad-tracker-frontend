"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Card,
  Heading,
  HStack,
  Icon,
  Input,
  SimpleGrid,
  Tabs,
  Text,
  VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import {
  LuBookOpen,
  LuGraduationCap,
  LuAward,
  LuSearch,
  LuTarget,
} from "react-icons/lu";
import { EmptyState } from "@/components/ui/empty-state";
import { getProgramColor, getProgramTypeLabel } from "@/lib/program-colors";

export interface Program {
  id: string;
  name: string;
  catalog_year: number | null;
  program_type: string;
}

interface ProgramsClientProps {
  programs: Program[];
}

type TabValue = "undergrad" | "grad" | "certificates";

const TAB_TYPES: Record<TabValue, string[]> = {
  undergrad: ["MAJOR", "MINOR"],
  grad: ["GRADUATE"],
  certificates: ["CERTIFICATE"],
};


function ProgramCard({ program, index }: Readonly<{ program: Program; index: number }>) {
  const colorPalette = getProgramColor(program.program_type);
  return (
    <Link
      href={`/dashboard/requirements/${program.id}`}
      style={{ display: "block" }}
      aria-label={`Open ${program.name}`}
    >
    <Card.Root
      bg="bg"
      borderRadius="xl"
      borderWidth="1px"
      borderColor="border.subtle"
      _hover={{
        borderColor: `${colorPalette}.muted`,
        transform: "translateY(-2px)",
        boxShadow: "lg",
      }}
      transition="all 0.2s"
      className="animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 20) * 0.02}s` }}
    >
      <Card.Body p="5">
        <VStack align="stretch" gap="4">
          <HStack justify="space-between" align="start">
            <Box
              w="10"
              h="10"
              bg={`${colorPalette}.subtle`}
              borderRadius="lg"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon color={`${colorPalette}.fg`} boxSize="5">
                <LuTarget />
              </Icon>
            </Box>
            {program.catalog_year && (
              <Badge colorPalette="gray" variant="subtle" size="sm">
                {program.catalog_year}
              </Badge>
            )}
          </HStack>

          <VStack align="start" gap="1">
            <Text fontWeight="600" fontSize="md" lineClamp={2}>
              {program.name}
            </Text>
          </VStack>

          <Badge
            colorPalette={colorPalette}
            variant="surface"
            size="sm"
            alignSelf="start"
          >
            {getProgramTypeLabel(program.program_type)}
          </Badge>
        </VStack>
      </Card.Body>
    </Card.Root>
    </Link>
  );
}

export default function ProgramsClient({ programs }: ProgramsClientProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("undergrad");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    return {
      undergrad: programs.filter((p) => TAB_TYPES.undergrad.includes(p.program_type)).length,
      grad: programs.filter((p) => TAB_TYPES.grad.includes(p.program_type)).length,
      certificates: programs.filter((p) => TAB_TYPES.certificates.includes(p.program_type)).length,
    };
  }, [programs]);

  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      const matchesTab = TAB_TYPES[activeTab].includes(p.program_type);
      const matchesSearch =
        search === "" || p.name.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [programs, activeTab, search]);

  return (
    <Box className="mesh-gradient-subtle">
      <Box mb="6">
        <Text fontSize="sm" color="fg.muted" fontWeight="500">
          Programs
        </Text>
        <Heading
          size="lg"
          fontFamily="var(--font-dm-sans), sans-serif"
          fontWeight="400"
          letterSpacing="-0.02em"
        >
          All Programs
        </Heading>
      </Box>

      <Tabs.Root
        value={activeTab}
        onValueChange={(e) => setActiveTab(e.value as TabValue)}
        variant="enclosed"
        colorPalette="blue"
        lazyMount
        unmountOnExit
      >
      <VStack gap="6" align="stretch">
          <Tabs.List bg="bg" borderRadius="lg" p="1">
            <Tabs.Trigger value="undergrad" px="6">
              <Icon boxSize="4" mr="2">
                <LuBookOpen />
              </Icon>
              Undergrad
              <Badge
                ml="2"
                colorPalette={activeTab === "undergrad" ? "blue" : "gray"}
                variant="solid"
                size="sm"
              >
                {counts.undergrad}
              </Badge>
            </Tabs.Trigger>
            <Tabs.Trigger value="grad" px="6">
              <Icon boxSize="4" mr="2">
                <LuGraduationCap />
              </Icon>
              Grad
              <Badge
                ml="2"
                colorPalette={activeTab === "grad" ? "blue" : "gray"}
                variant="solid"
                size="sm"
              >
                {counts.grad}
              </Badge>
            </Tabs.Trigger>
            <Tabs.Trigger value="certificates" px="6">
              <Icon boxSize="4" mr="2">
                <LuAward />
              </Icon>
              Certificates
              <Badge
                ml="2"
                colorPalette={activeTab === "certificates" ? "blue" : "gray"}
                variant="solid"
                size="sm"
              >
                {counts.certificates}
              </Badge>
            </Tabs.Trigger>
          </Tabs.List>

        {/* Search */}
        <Card.Root
          bg="bg"
          borderRadius="xl"
          borderWidth="1px"
          borderColor="border.subtle"
          className="animate-fade-up"
        >
          <Card.Body p="5">
            <Box position="relative">
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
                pl="10"
                placeholder="Search programs by name..."
                aria-label="Search programs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                rounded="lg"
                size="md"
              />
            </Box>
          </Card.Body>
        </Card.Root>

        {/* Results count */}
        <Text fontSize="sm" color="fg.muted">
          {filteredPrograms.length} program{filteredPrograms.length === 1 ? "" : "s"} found
        </Text>

        {/* Program Grid */}
        {(["undergrad", "grad", "certificates"] as const).map((tabValue) => (
          <Tabs.Content key={tabValue} value={tabValue} p="0">
            {filteredPrograms.length > 0 ? (
              <VStack align="stretch" gap="8">
                {tabValue === "undergrad" ? (
                  <>
                    {(["MAJOR", "MINOR"] as const).map((type) => {
                      const group = filteredPrograms.filter((p) => p.program_type === type);
                      if (group.length === 0) return null;
                      return (
                        <VStack key={type} align="stretch" gap="4">
                          <HStack gap="2">
                            <Heading
                              size="sm"
                              fontFamily="var(--font-dm-sans), sans-serif"
                              fontWeight="500"
                              color="fg.muted"
                              letterSpacing="0.05em"
                              textTransform="uppercase"
                            >
                              {getProgramTypeLabel(type)}s
                            </Heading>
                            <Badge colorPalette={getProgramColor(type)} variant="subtle" size="sm">
                              {group.length}
                            </Badge>
                          </HStack>
                          <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} gap="4">
                            {group.map((program, index) => (
                              <ProgramCard key={program.id} program={program} index={index} />
                            ))}
                          </SimpleGrid>
                        </VStack>
                      );
                    })}
                  </>
                ) : (
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} gap="4">
                    {filteredPrograms.map((program, index) => (
                      <ProgramCard key={program.id} program={program} index={index} />
                    ))}
                  </SimpleGrid>
                )}
              </VStack>
            ) : (
              <Card.Root
                bg="bg"
                borderRadius="xl"
                borderWidth="1px"
                borderColor="border.subtle"
                className="animate-fade-up"
              >
                <Card.Body p="12">
                  <EmptyState
                    icon={<LuTarget />}
                    title="No programs found"
                    description={
                      programs.length === 0
                        ? "No programs have been added to the database yet."
                        : "Try adjusting your search to find programs."
                    }
                  />
                </Card.Body>
              </Card.Root>
            )}
          </Tabs.Content>
        ))}
      </VStack>
      </Tabs.Root>
    </Box>
  );
}
