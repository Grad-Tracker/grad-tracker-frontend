"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Badge,
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  HStack,
  Icon,
  Input,
  Portal,
  Separator,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import {
  LuSearch,
  LuGraduationCap,
  LuBookOpen,
  LuAward,
  LuCheck,
  LuSparkles,
} from "react-icons/lu";
import { Switch } from "@/components/ui/switch";
import { fetchPrograms } from "@/lib/supabase/queries/onboarding";
import type { Program } from "@/types/onboarding";

interface CreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePlan: (
    name: string,
    description: string | null,
    programIds: number[],
    autoGenerate: boolean
  ) => Promise<void>;
  existingPlanCount: number;
}

const TYPE_ORDER: Program["program_type"][] = ["MAJOR", "MINOR", "CERTIFICATE", "GRADUATE"];

const TYPE_META: Record<
  Program["program_type"],
  { label: string; color: string; icon: typeof LuGraduationCap }
> = {
  MAJOR: { label: "Majors", color: "blue", icon: LuGraduationCap },
  MINOR: { label: "Minors", color: "purple", icon: LuBookOpen },
  CERTIFICATE: { label: "Certificates", color: "orange", icon: LuAward },
  GRADUATE: { label: "Graduate Programs", color: "purple", icon: LuGraduationCap },
};

export default function CreatePlanDialog({
  open,
  onOpenChange,
  onCreatePlan,
  existingPlanCount,
}: CreatePlanDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<number>>(
    new Set()
  );
  const [search, setSearch] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [loading, setLoading] = useState(false);

  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(`Plan ${existingPlanCount + 1}`);
    setDescription("");
    setSelectedProgramIds(new Set());
    setAutoGenerate(false);
    setSearch("");

    if (allPrograms.length === 0) {
      setProgramsLoading(true);
      Promise.all([
        fetchPrograms("MAJOR"),
        fetchPrograms("MINOR"),
        fetchPrograms("CERTIFICATE"),
        fetchPrograms("GRADUATE"),
      ])
        .then(([majors, minors, certs, graduate]) => {
          setAllPrograms([...majors, ...minors, ...certs, ...graduate]);
        })
        .finally(() => setProgramsLoading(false));
    }
  }, [open]);

  const filteredByType = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? allPrograms.filter((p) => p.name.toLowerCase().includes(q))
      : allPrograms;

    const grouped: Record<Program["program_type"], Program[]> = {
      MAJOR: [],
      MINOR: [],
      CERTIFICATE: [],
      GRADUATE: [],
    };
    for (const p of filtered) {
      grouped[p.program_type].push(p);
    }
    return grouped;
  }, [allPrograms, search]);

  function toggleProgram(id: number) {
    setSelectedProgramIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreatePlan(
        name.trim(),
        description.trim() || null,
        Array.from(selectedProgramIds),
        autoGenerate
      );
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
      size="lg"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderRadius="xl" maxH="85vh" overflow="hidden">
            <Dialog.Header>
              <Dialog.Title
                fontFamily="var(--font-dm-sans), sans-serif"
                fontWeight="400"
                letterSpacing="-0.02em"
              >
                Create New Plan
              </Dialog.Title>
              <Dialog.Description color="fg.muted" fontSize="sm">
                Set up a new graduation plan for a different program or scenario.
              </Dialog.Description>
            </Dialog.Header>

            <Dialog.Body overflowY="auto" pt="2">
              <VStack gap="5" align="stretch">
                {/* Plan name */}
                <Box>
                  <Text fontSize="sm" fontWeight="600" mb="1.5">
                    Plan Name
                  </Text>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Grad School Plan"
                    size="sm"
                    borderRadius="lg"
                    autoFocus
                  />
                </Box>

                {/* Description */}
                <Box>
                  <Text fontSize="sm" fontWeight="600" mb="1.5">
                    Description{" "}
                    <Text as="span" color="fg.muted" fontWeight="400">
                      (optional)
                    </Text>
                  </Text>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this plan for?"
                    size="sm"
                    borderRadius="lg"
                    rows={2}
                    resize="none"
                  />
                </Box>

                <Separator />

                {/* Program selector */}
                <Box>
                  <Text fontSize="sm" fontWeight="600" mb="1.5">
                    Programs
                  </Text>
                  <Text fontSize="xs" color="fg.muted" mb="3">
                    Select which programs this plan is for. This determines the
                    available courses.
                  </Text>

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
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search programs..."
                      size="sm"
                      borderRadius="lg"
                      pl="9"
                    />
                  </Box>

                  {programsLoading ? (
                    <Text fontSize="sm" color="fg.muted" py="4" textAlign="center">
                      Loading programs...
                    </Text>
                  ) : (
                    <VStack
                      align="stretch"
                      gap="4"
                      maxH="280px"
                      overflowY="auto"
                      pr="1"
                    >
                      {TYPE_ORDER.map((type) => {
                        const programs = filteredByType[type];
                        if (programs.length === 0) return null;
                        const meta = TYPE_META[type];

                        return (
                          <Box key={type}>
                            <HStack gap="2" mb="2">
                              <Icon
                                boxSize="3.5"
                                color={`${meta.color}.fg`}
                              >
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
                                {programs.length}
                              </Badge>
                            </HStack>

                            <Flex gap="2" flexWrap="wrap">
                              {programs.map((program) => {
                                const isSelected = selectedProgramIds.has(
                                  program.id
                                );
                                return (
                                  <Button
                                    key={program.id}
                                    size="xs"
                                    variant={isSelected ? "solid" : "outline"}
                                    colorPalette={
                                      isSelected ? meta.color : "gray"
                                    }
                                    borderRadius="full"
                                    onClick={() => toggleProgram(program.id)}
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

                  <Text fontSize="xs" color={selectedProgramIds.size > 0 ? "fg.muted" : "orange.fg"} mt="3">
                    {selectedProgramIds.size > 0
                      ? `${selectedProgramIds.size} program${selectedProgramIds.size !== 1 ? "s" : ""} selected`
                      : "Select at least one program to create a plan."}
                  </Text>
                </Box>

                <Separator />

                {/* Auto-generate option */}
                <Box>
                  <HStack justify="space-between">
                    <HStack gap="2">
                      <Icon boxSize="4" color="purple.fg">
                        <LuSparkles />
                      </Icon>
                      <Box>
                        <Text fontSize="sm" fontWeight="600">
                          Auto-fill courses
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                          Automatically schedule courses across semesters
                        </Text>
                      </Box>
                    </HStack>
                    <Switch
                      checked={autoGenerate}
                      onCheckedChange={(e) => setAutoGenerate(e.checked)}
                      colorPalette="purple"
                    />
                  </HStack>
                </Box>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline" borderRadius="lg">
                  Cancel
                </Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette={autoGenerate ? "purple" : "blue"}
                borderRadius="lg"
                onClick={handleCreate}
                disabled={!name.trim() || selectedProgramIds.size === 0}
                loading={loading}
              >
                {autoGenerate && <LuSparkles size={14} />}
                {autoGenerate ? "Create & Auto-Fill" : "Create Plan"}
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