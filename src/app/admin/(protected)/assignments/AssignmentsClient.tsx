"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  LuCheck,
  LuPlus,
  LuSearch,
  LuTarget,
  LuBookOpen,
  LuScrollText,
  LuGraduationCap,
  LuX,
} from "react-icons/lu";
import { createClient } from "@/lib/supabase/client";
import { DB_TABLES } from "@/lib/supabase/queries/schema";
import { toaster } from "@/components/ui/toaster";

type Program = {
  id: number;
  name: string;
  program_type: string;
  catalog_year: number | null;
};

interface AssignmentsClientProps {
  programs: Program[];
  initialAssignedIds: number[];
  advisorId: number;
}

const TYPE_META: Record<string, { label: string; color: string; icon: typeof LuTarget }> = {
  MAJOR: { label: "Majors", color: "blue", icon: LuTarget },
  MINOR: { label: "Minors", color: "purple", icon: LuBookOpen },
  CERTIFICATE: { label: "Certificates", color: "orange", icon: LuScrollText },
  GRADUATE: { label: "Graduate", color: "green", icon: LuGraduationCap },
};

const TYPE_ORDER = ["MAJOR", "MINOR", "CERTIFICATE", "GRADUATE"];

export default function AssignmentsClient({
  programs,
  initialAssignedIds,
  advisorId,
}: AssignmentsClientProps) {
  const [assignedIds, setAssignedIds] = useState<Set<number>>(
    new Set(initialAssignedIds)
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<number | null>(null);

  const assignedPrograms = useMemo(
    () => programs.filter((p) => assignedIds.has(p.id)),
    [programs, assignedIds]
  );

  const availableByType = useMemo(() => {
    const q = search.toLowerCase().trim();
    const available = programs.filter((p) => {
      if (assignedIds.has(p.id)) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });

    const grouped: Record<string, Program[]> = {};
    for (const type of TYPE_ORDER) grouped[type] = [];
    for (const p of available) {
      if (grouped[p.program_type]) grouped[p.program_type].push(p);
    }
    return grouped;
  }, [programs, assignedIds, search]);

  async function handleAdd(programId: number) {
    setLoading(programId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from(DB_TABLES.programAdvisors)
        .insert({ advisor_id: advisorId, program_id: programId });

      if (error) throw error;

      setAssignedIds((prev) => new Set([...prev, programId]));
      const program = programs.find((p) => p.id === programId);
      toaster.create({
        title: "Program added",
        description: `You are now advising ${program?.name ?? "this program"}.`,
        type: "success",
      });
    } catch (err: any) {
      toaster.create({
        title: "Failed to add program",
        description: err?.message || "Please try again.",
        type: "error",
      });
    } finally {
      setLoading(null);
    }
  }

  async function handleRemove(programId: number) {
    setLoading(programId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from(DB_TABLES.programAdvisors)
        .delete()
        .eq("advisor_id", advisorId)
        .eq("program_id", programId);

      if (error) throw error;

      setAssignedIds((prev) => {
        const next = new Set(prev);
        next.delete(programId);
        return next;
      });
      const program = programs.find((p) => p.id === programId);
      toaster.create({
        title: "Program removed",
        description: `You are no longer advising ${program?.name ?? "this program"}.`,
        type: "info",
      });
    } catch (err: any) {
      toaster.create({
        title: "Failed to remove program",
        description: err?.message || "Please try again.",
        type: "error",
      });
    } finally {
      setLoading(null);
    }
  }

  return (
    <Stack gap="8">
      {/* Header */}
      <Box>
        <Heading
          fontSize={{ base: "2xl", md: "3xl" }}
          fontFamily="var(--font-dm-sans), sans-serif"
          fontWeight="700"
          letterSpacing="-0.02em"
        >
          My Programs
        </Heading>
        <Text color="fg.muted" mt="1">
          Select which programs you advise. Students in these programs will appear on your Students page.
        </Text>
      </Box>

      {/* Assigned programs */}
      <Box>
        <HStack gap="2" mb="3">
          <Text fontSize="sm" fontWeight="600" color="fg.muted" textTransform="uppercase" letterSpacing="0.05em">
            Your Programs
          </Text>
          <Badge variant="subtle" size="sm">
            {assignedPrograms.length}
          </Badge>
        </HStack>

        {assignedPrograms.length === 0 ? (
          <Card.Root borderWidth="1px" borderColor="border.subtle" borderStyle="dashed">
            <Card.Body py="10" textAlign="center">
              <Text color="fg.muted" fontWeight="500">
                No programs assigned yet
              </Text>
              <Text fontSize="sm" color="fg.subtle" mt="1">
                Add programs below to start seeing students.
              </Text>
            </Card.Body>
          </Card.Root>
        ) : (
          <Flex gap="2" flexWrap="wrap">
            {assignedPrograms.map((program) => {
              const meta = TYPE_META[program.program_type] ?? TYPE_META.MAJOR;
              return (
                <HStack
                  key={program.id}
                  px="3"
                  py="2"
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor={`${meta.color}.muted`}
                  bg={`${meta.color}.subtle`}
                  gap="2"
                  transition="all 0.15s"
                >
                  <Icon boxSize="3.5" color={`${meta.color}.fg`}>
                    <meta.icon />
                  </Icon>
                  <Text fontSize="sm" fontWeight="500" color="fg">
                    {program.name}
                  </Text>
                  <IconButton
                    aria-label={`Remove ${program.name}`}
                    size="2xs"
                    variant="ghost"
                    borderRadius="full"
                    color="fg.muted"
                    _hover={{ color: "red.fg", bg: "red.subtle" }}
                    onClick={() => handleRemove(program.id)}
                    loading={loading === program.id}
                  >
                    <LuX />
                  </IconButton>
                </HStack>
              );
            })}
          </Flex>
        )}
      </Box>

      {/* Available programs */}
      <Box>
        <Text fontSize="sm" fontWeight="600" color="fg.muted" textTransform="uppercase" letterSpacing="0.05em" mb="3">
          Available Programs
        </Text>

        {/* Search */}
        <Box position="relative" mb="4">
          <Box
            position="absolute"
            left="3"
            top="50%"
            transform="translateY(-50%)"
            color="fg.muted"
            zIndex="1"
          >
            <LuSearch size={16} />
          </Box>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search programs..."
            size="sm"
            borderRadius="lg"
            pl="9"
          />
        </Box>

        {/* Grouped list */}
        <VStack gap="6" align="stretch">
          {TYPE_ORDER.map((type) => {
            const group = availableByType[type];
            if (!group || group.length === 0) return null;
            const meta = TYPE_META[type] ?? TYPE_META.MAJOR;

            return (
              <Box key={type}>
                <HStack gap="2" mb="2">
                  <Icon boxSize="3.5" color={`${meta.color}.fg`}>
                    <meta.icon />
                  </Icon>
                  <Text fontSize="xs" fontWeight="600" color="fg.muted" textTransform="uppercase" letterSpacing="0.05em">
                    {meta.label}
                  </Text>
                  <Badge size="sm" variant="subtle" colorPalette={meta.color}>
                    {group.length}
                  </Badge>
                </HStack>

                <SimpleGrid columns={{ base: 1, md: 2 }} gap="2">
                  {group.map((program) => (
                    <HStack
                      key={program.id}
                      px="3"
                      py="2.5"
                      borderRadius="lg"
                      borderWidth="1px"
                      borderColor="border.subtle"
                      bg="bg"
                      justify="space-between"
                      _hover={{ borderColor: `${meta.color}.muted`, bg: "bg.subtle" }}
                      transition="all 0.15s"
                    >
                      <Box minW="0" flex="1">
                        <Text fontSize="sm" fontWeight="500" truncate>
                          {program.name}
                        </Text>
                        {program.catalog_year && (
                          <Text fontSize="xs" color="fg.subtle">
                            Catalog {program.catalog_year}
                          </Text>
                        )}
                      </Box>
                      <IconButton
                        aria-label={`Add ${program.name}`}
                        size="xs"
                        variant="outline"
                        borderRadius="full"
                        colorPalette={meta.color}
                        onClick={() => handleAdd(program.id)}
                        loading={loading === program.id}
                      >
                        <LuPlus />
                      </IconButton>
                    </HStack>
                  ))}
                </SimpleGrid>
              </Box>
            );
          })}

          {/* No results */}
          {TYPE_ORDER.every((t) => (availableByType[t]?.length ?? 0) === 0) && (
            <Box textAlign="center" py="8">
              <Text color="fg.muted" fontSize="sm">
                {search
                  ? "No programs match your search."
                  : "All programs are already assigned."}
              </Text>
            </Box>
          )}
        </VStack>
      </Box>
    </Stack>
  );
}
