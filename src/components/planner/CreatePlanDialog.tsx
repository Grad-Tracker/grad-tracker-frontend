"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  CloseButton,
  Dialog,
  HStack,
  Icon,
  Input,
  Portal,
  Separator,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { LuSparkles } from "react-icons/lu";
import ProgramSelector from "@/components/shared/ProgramSelector";
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

                  <ProgramSelector
                    programs={allPrograms}
                    selectedIds={selectedProgramIds}
                    onToggle={toggleProgram}
                    searchQuery={search}
                    onSearchChange={setSearch}
                    loading={programsLoading}
                  />

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