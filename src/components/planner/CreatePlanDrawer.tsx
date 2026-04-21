"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  CloseButton,
  Collapsible,
  Drawer,
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
  LuSparkles,
  LuRotateCcw,
  LuPackage,
  LuCheck,
  LuTriangleAlert,
  LuCircleCheck,
  LuCircleX,
  LuChevronDown,
  LuEye,
  LuPencil,
  LuLoader,
} from "react-icons/lu";
import ProgramSelector from "@/components/shared/ProgramSelector";
import { Switch } from "@/components/ui/switch";
import { autoGeneratePlan } from "@/lib/planner/auto-generate-orchestrator";
import type { Season, PlanWithMeta } from "@/types/planner";
import { BREADTH_PACKAGES } from "@/types/planner";
import type { AutoGenerateResult } from "@/types/auto-generate";
import { fetchPrograms } from "@/lib/supabase/queries/onboarding";
import type { Program } from "@/types/onboarding";

/* ── Types ─────────────────────────────────────────────── */

type Phase = "config" | "generating" | "results" | "error";

interface CreatePlanDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number;
  /** Program IDs from the student's profile (pre-selected) */
  programIds: number[];
  /** Existing plans, used for auto-fill-existing mode */
  plans: PlanWithMeta[];
  activePlanId: number | null;
  existingPlanCount: number;
  /** Called after a blank plan is created (no auto-fill) */
  onCreatePlan: (
    name: string,
    description: string | null,
    programIds: number[],
    autoGenerate: boolean
  ) => Promise<void>;
  /** Called after auto-fill completes, to refresh and navigate */
  onAutoFillComplete: (planId: number) => void;
}

function getNextSemester(): { season: Season; year: number } {
  const now = new Date();
  const month = now.getMonth();
  if (month < 5) return { season: "Fall", year: now.getFullYear() };
  return { season: "Spring", year: now.getFullYear() + 1 };
}

/* ── Collapsible section ───────────────────────────────── */

function ResultSection({
  title,
  count,
  defaultOpen = false,
  color = "fg.muted",
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen}>
      <Collapsible.Trigger
        w="full"
        display="flex"
        alignItems="center"
        gap="2"
        py="2"
        cursor="pointer"
        _hover={{ color: "fg" }}
        transition="color 0.15s"
      >
        <Text fontSize="xs" fontWeight="600" color={color} flex="1" textAlign="left">
          {title}
          {count != null && (
            <Text as="span" fontWeight="400" color="fg.subtle" ml="1.5">
              ({count})
            </Text>
          )}
        </Text>
        <Collapsible.Indicator
          transition="transform 0.2s"
          _open={{ transform: "rotate(180deg)" }}
        >
          <LuChevronDown size={14} />
        </Collapsible.Indicator>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Box pb="2">{children}</Box>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

/* ── Main component ────────────────────────────────────── */

export default function CreatePlanDrawer({
  open,
  onOpenChange,
  studentId,
  programIds,
  plans,
  activePlanId,
  existingPlanCount,
  onCreatePlan,
  onAutoFillComplete,
}: Readonly<CreatePlanDrawerProps>) {
  /* ── Phase ── */
  const [phase, setPhase] = useState<Phase>("config");

  /* ── Config state ── */
  const [planName, setPlanName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<number>>(new Set());
  const [autoFill, setAutoFill] = useState(false);
  const [selectedBreadthId, setSelectedBreadthId] = useState<string | null>(null);
  const [includeSummers, setIncludeSummers] = useState(false);
  const [programSearch, setProgramSearch] = useState("");

  /* ── Generation state ── */
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AutoGenerateResult | null>(null);
  const [creating, setCreating] = useState(false);

  /* ── Program data ── */
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);

  /* ── Reset on open ── */
  useEffect(() => {
    if (!open) return;
    setPhase("config");
    setPlanName(`Plan ${existingPlanCount + 1}`);
    setDescription("");
    setSelectedProgramIds(new Set(programIds));
    setAutoFill(false);
    setSelectedBreadthId(null);
    setIncludeSummers(false);
    setProgramSearch("");
    setProgress("");
    setError(null);
    setResult(null);
    setCreating(false);

    if (allPrograms.length === 0) {
      setProgramsLoading(true);
      Promise.all([
        fetchPrograms("MAJOR"),
        fetchPrograms("MINOR"),
        fetchPrograms("CERTIFICATE"),
        fetchPrograms("GRADUATE"),
      ])
        .then(([majors, minors, certs, grad]) =>
          setAllPrograms([...majors, ...minors, ...certs, ...grad])
        )
        .finally(() => setProgramsLoading(false));
    }
  }, [open]);

  /* ── Handlers ── */

  function toggleProgram(id: number) {
    setSelectedProgramIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!planName.trim() || selectedProgramIds.size === 0) return;

    if (!autoFill) {
      // Blank plan — delegate to parent
      setCreating(true);
      try {
        await onCreatePlan(
          planName.trim(),
          description.trim() || null,
          Array.from(selectedProgramIds),
          false
        );
        onOpenChange(false);
      } finally {
        setCreating(false);
      }
      return;
    }

    // Auto-fill flow
    setPhase("generating");
    setProgress("Preparing...");
    setError(null);
    setResult(null);

    const { season, year } = getNextSemester();

    try {
      const breadthPackage =
        BREADTH_PACKAGES.find((p) => p.id === selectedBreadthId) ?? null;

      const res = await autoGeneratePlan(
        studentId,
        Array.from(selectedProgramIds),
        {
          mode: "new",
          planName: planName.trim() || "Auto Plan",
          includeSummers,
          startSeason: season,
          startYear: year,
          breadthPackage,
        },
        setProgress
      );
      setResult(res);
      setPhase("results");
    } catch (err: any) {
      console.error("Auto-generate failed:", err);
      setError(err?.message || "Failed to generate plan. Please try again.");
      setPhase("error");
    }
  }

  function handleModifyAndRegenerate() {
    setPhase("config");
    setResult(null);
    setError(null);
    // Config state is preserved so the user can tweak and retry
    setTimeout(() => bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  }

  function handleViewPlan() {
    if (result) onAutoFillComplete(result.planId);
    onOpenChange(false);
  }

  const isGenerating = phase === "generating";
  const canCreate =
    planName.trim().length > 0 &&
    selectedProgramIds.size > 0 &&
    (!autoFill || selectedBreadthId != null);

  /* ── Render ──────────────────────────────────────────── */

  return (
    <Drawer.Root
      lazyMount
      open={open}
      onOpenChange={(e) => {
        if (!isGenerating) onOpenChange(e.open);
      }}
      size="md"
      placement="end"
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title
                fontFamily="var(--font-dm-sans), sans-serif"
                fontWeight="400"
                letterSpacing="-0.02em"
              >
                {phase === "results"
                  ? "Plan Generated"
                  : phase === "generating"
                    ? "Generating..."
                    : "Create Plan"}
              </Drawer.Title>
              {phase === "config" && (
                <Drawer.Description color="fg.muted" fontSize="sm">
                  Set up a new graduation plan, optionally with auto-filled courses.
                </Drawer.Description>
              )}
            </Drawer.Header>

            <Drawer.Body ref={bodyRef}>
              {/* ── Results phase ── */}
              {phase === "results" && result && <ResultsView result={result} />}

              {/* ── Error phase ── */}
              {phase === "error" && (
                <VStack gap="4" align="stretch">
                  <Box bg="red.subtle" borderRadius="lg" p="4" textAlign="center">
                    <HStack gap="2" justify="center" mb="2">
                      <LuCircleX size={18} />
                      <Text fontWeight="600" color="red.fg">
                        Generation Failed
                      </Text>
                    </HStack>
                    <Text fontSize="sm" color="fg.muted">
                      {error}
                    </Text>
                  </Box>
                </VStack>
              )}

              {/* ── Generating phase ── */}
              {phase === "generating" && (
                <VStack gap="6" align="center" justify="center" minH="200px" py="12">
                  <Box
                    animation="spin 1.2s linear infinite"
                    color="blue.fg"
                  >
                    <LuLoader size={28} />
                  </Box>
                  <VStack gap="1">
                    <Text fontSize="sm" fontWeight="500" color="fg">
                      Building your plan
                    </Text>
                    <Text fontSize="xs" color="fg.muted" textAlign="center">
                      {progress}
                    </Text>
                  </VStack>
                </VStack>
              )}

              {/* ── Config phase ── */}
              {phase === "config" && (
                <VStack gap="5" align="stretch">
                  {/* Plan name */}
                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb="1.5">
                      Plan Name
                    </Text>
                    <Input
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
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

                  {/* Programs */}
                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb="1.5">
                      Programs
                    </Text>
                    <Text fontSize="xs" color="fg.muted" mb="3">
                      Select which programs this plan covers.
                    </Text>
                    <ProgramSelector
                      programs={allPrograms}
                      selectedIds={selectedProgramIds}
                      onToggle={toggleProgram}
                      searchQuery={programSearch}
                      onSearchChange={setProgramSearch}
                      loading={programsLoading}
                    />
                    <Text
                      fontSize="xs"
                      color={selectedProgramIds.size > 0 ? "fg.muted" : "orange.fg"}
                      mt="3"
                    >
                      {selectedProgramIds.size > 0
                        ? `${selectedProgramIds.size} program${selectedProgramIds.size !== 1 ? "s" : ""} selected`
                        : "Select at least one program."}
                    </Text>
                  </Box>

                  <Separator />

                  {/* Auto-fill toggle */}
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
                        checked={autoFill}
                        onCheckedChange={(e) => setAutoFill(e.checked)}
                        colorPalette="purple"
                      />
                    </HStack>
                  </Box>

                  {/* Auto-fill options (inline, revealed when toggled) */}
                  {autoFill && (
                    <VStack
                      gap="5"
                      align="stretch"
                      pl="4"
                      borderLeftWidth="2px"
                      borderColor="purple.muted"
                    >
                      {/* Breadth package */}
                      <Box>
                        <HStack gap="1.5" mb="2">
                          <Icon boxSize="3.5" color="fg.muted">
                            <LuPackage />
                          </Icon>
                          <Text fontSize="sm" fontWeight="600">
                            Breadth Package
                          </Text>
                        </HStack>
                        <Text fontSize="xs" color="fg.muted" mb="2">
                          Choose which breadth package to include.
                        </Text>
                        <VStack gap="1" align="stretch">
                          {BREADTH_PACKAGES.map((pkg) => {
                            const isSelected = pkg.id === selectedBreadthId;
                            return (
                              <Box
                                key={pkg.id}
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
                                onClick={() => setSelectedBreadthId(pkg.id)}
                              >
                                <HStack justify="space-between" gap="2">
                                  <Box minW="0" flex="1">
                                    <Text
                                      fontSize="xs"
                                      fontWeight={isSelected ? "700" : "600"}
                                      color={isSelected ? "purple.fg" : "fg"}
                                    >
                                      {isSelected && (
                                        <LuCheck
                                          size={12}
                                          style={{ display: "inline", marginRight: 4 }}
                                        />
                                      )}
                                      {pkg.name}
                                    </Text>
                                    <Text fontSize="2xs" color="fg.muted" truncate>
                                      {pkg.description}
                                    </Text>
                                  </Box>
                                  <Text fontSize="2xs" color="fg.subtle" flexShrink={0}>
                                    {pkg.totalCreditsRequired} cr
                                  </Text>
                                </HStack>
                              </Box>
                            );
                          })}
                        </VStack>
                        {autoFill && !selectedBreadthId && (
                          <Text fontSize="xs" color="orange.fg" mt="2">
                            Select a breadth package to continue.
                          </Text>
                        )}
                      </Box>

                      {/* Summer toggle */}
                      <HStack justify="space-between">
                        <Box>
                          <Text fontSize="sm" fontWeight="600">
                            Include summers
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            Schedule courses in summer semesters too
                          </Text>
                        </Box>
                        <Switch
                          checked={includeSummers}
                          onCheckedChange={(e) => setIncludeSummers(e.checked)}
                          colorPalette="purple"
                          size="sm"
                        />
                      </HStack>
                    </VStack>
                  )}
                </VStack>
              )}
            </Drawer.Body>

            {/* ── Footer ── */}
            <Drawer.Footer>
              {phase === "config" && (
                <>
                  <Drawer.ActionTrigger asChild>
                    <Button variant="outline" borderRadius="lg" disabled={creating}>
                      Cancel
                    </Button>
                  </Drawer.ActionTrigger>
                  <Button
                    colorPalette={autoFill ? "purple" : "blue"}
                    borderRadius="lg"
                    onClick={handleCreate}
                    disabled={!canCreate}
                    loading={creating}
                  >
                    {autoFill && <LuSparkles size={14} />}
                    {autoFill ? "Create & Auto-Fill" : "Create Plan"}
                  </Button>
                </>
              )}

              {phase === "error" && (
                <>
                  <Button
                    variant="outline"
                    borderRadius="lg"
                    onClick={handleModifyAndRegenerate}
                  >
                    <LuPencil size={14} />
                    Edit Settings
                  </Button>
                  <Button
                    colorPalette="purple"
                    borderRadius="lg"
                    onClick={handleCreate}
                  >
                    <LuRotateCcw size={14} />
                    Retry
                  </Button>
                </>
              )}

              {phase === "results" && (
                <>
                  <Button
                    variant="outline"
                    borderRadius="lg"
                    onClick={handleModifyAndRegenerate}
                  >
                    <LuPencil size={14} />
                    Modify & Regenerate
                  </Button>
                  <Button
                    colorPalette="blue"
                    borderRadius="lg"
                    onClick={handleViewPlan}
                  >
                    <LuEye size={14} />
                    View Plan
                  </Button>
                </>
              )}
            </Drawer.Footer>

            {!isGenerating && (
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Drawer.CloseTrigger>
            )}
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}

/* ── Results sub-component ─────────────────────────────── */

function ResultsView({ result }: { result: AutoGenerateResult }) {
  const { validation } = result;
  const errors = validation.issues.filter((i) => i.severity === "error");
  const warnings = validation.issues.filter((i) => i.severity === "warning");
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <VStack gap="3" align="stretch">
      {/* Summary header */}
      <Box
        bg={hasErrors ? "orange.subtle" : "green.subtle"}
        borderRadius="lg"
        p="4"
        textAlign="center"
      >
        <HStack gap="2" justify="center" mb="1">
          {hasErrors ? <LuTriangleAlert size={18} /> : <LuCircleCheck size={18} />}
          <Text
            fontWeight="600"
            fontSize="sm"
            color={hasErrors ? "orange.fg" : "green.fg"}
          >
            {hasErrors
              ? "Plan created with some issues"
              : "Plan created successfully"}
          </Text>
        </HStack>
        <Text fontSize="xs" color="fg.muted">
          {result.totalCourses} courses &middot; {result.semesters.length} semesters
          &middot; {result.totalCredits} credits
        </Text>
      </Box>

      {/* Errors */}
      {hasErrors && (
        <ResultSection
          title="Errors"
          count={errors.length}
          defaultOpen
          color="red.fg"
        >
          <VStack gap="1.5" align="stretch">
            {errors.map((issue, i) => (
              <HStack key={`err-${i}`} gap="2" fontSize="xs">
                <Icon color="red.fg" boxSize="3.5" flexShrink={0}>
                  <LuCircleX />
                </Icon>
                <Text color="fg.muted">{issue.message}</Text>
              </HStack>
            ))}
          </VStack>
        </ResultSection>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <ResultSection
          title="Warnings"
          count={warnings.length}
          defaultOpen={!hasErrors}
          color="orange.fg"
        >
          <VStack gap="1.5" align="stretch">
            {warnings.map((issue, i) => (
              <HStack key={`warn-${i}`} gap="2" fontSize="xs">
                <Icon color="orange.fg" boxSize="3.5" flexShrink={0}>
                  <LuTriangleAlert />
                </Icon>
                <Text color="fg.muted">{issue.message}</Text>
              </HStack>
            ))}
          </VStack>
        </ResultSection>
      )}

      {/* Unscheduled courses */}
      {validation.unscheduledCourses.length > 0 && (
        <ResultSection
          title="Unscheduled Courses"
          count={validation.unscheduledCourses.length}
          defaultOpen
          color="orange.fg"
        >
          <Text fontSize="xs" color="fg.muted" lineHeight="tall">
            {validation.unscheduledCourses
              .map((c) => `${c.subject} ${c.number}`)
              .join(", ")}
          </Text>
        </ResultSection>
      )}

      <Separator />

      {/* Requirements */}
      {validation.blockStatuses.length > 0 && (
        <ResultSection
          title="Requirements"
          count={validation.blockStatuses.length}
          defaultOpen={false}
        >
          <VStack gap="1.5" align="stretch">
            {validation.blockStatuses.map((block) => (
              <HStack key={block.blockId} gap="2" fontSize="xs">
                <Icon
                  color={block.satisfied ? "green.fg" : "red.fg"}
                  boxSize="3.5"
                  flexShrink={0}
                >
                  {block.satisfied ? <LuCircleCheck /> : <LuCircleX />}
                </Icon>
                <Text flex="1" truncate>
                  {block.blockName}
                </Text>
                <Text color="fg.muted" flexShrink={0}>
                  {block.requiredCredits == null
                    ? `${block.scheduledCredits} cr`
                    : `${block.scheduledCredits}/${block.requiredCredits} cr`}
                </Text>
              </HStack>
            ))}
          </VStack>
        </ResultSection>
      )}

      {/* Gen Ed */}
      {validation.genEdStatuses.length > 0 && (
        <ResultSection
          title="General Education"
          count={validation.genEdStatuses.length}
          defaultOpen={false}
        >
          <VStack gap="1.5" align="stretch">
            {validation.genEdStatuses.map((ge) => (
              <HStack key={ge.bucketId} gap="2" fontSize="xs">
                <Icon
                  color={ge.satisfied ? "green.fg" : "red.fg"}
                  boxSize="3.5"
                  flexShrink={0}
                >
                  {ge.satisfied ? <LuCircleCheck /> : <LuCircleX />}
                </Icon>
                <Text flex="1" truncate>
                  {ge.bucketName}
                </Text>
                <Text color="fg.muted" flexShrink={0}>
                  {ge.coveredCredits}/{ge.requiredCredits} cr
                </Text>
              </HStack>
            ))}
          </VStack>
        </ResultSection>
      )}

      <Separator />

      {/* Semester breakdown */}
      <ResultSection
        title="Semester Breakdown"
        count={result.semesters.length}
        defaultOpen={false}
      >
        <VStack gap="3" align="stretch">
          {result.semesters.map((sem, i) => (
            <Box key={i}>
              <HStack justify="space-between" mb="1">
                <Text fontSize="xs" fontWeight="600">
                  {sem.season} {sem.year}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {sem.courses.length} courses &middot; {sem.totalCredits} cr
                </Text>
              </HStack>
              <Text fontSize="xs" color="fg.subtle" lineHeight="tall">
                {sem.courses.map((c) => `${c.subject} ${c.number}`).join(", ")}
              </Text>
            </Box>
          ))}
        </VStack>
      </ResultSection>
    </VStack>
  );
}
