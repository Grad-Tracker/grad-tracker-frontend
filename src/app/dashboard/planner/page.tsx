"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { toaster } from "@/components/ui/toaster";
import {
  LuCalendar,
  LuPlus,
  LuSparkles,
  LuArrowLeft,
  LuChevronRight,
} from "react-icons/lu";

import {
  fetchStudentTerms,
  fetchPlannedCourses,
  fetchAvailableCourses,
  fetchCompletedCourseIds,
  fetchPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getOrCreateTerm,
  addTermPlan,
  removeTermPlan,
  addPlannedCourse,
  removePlannedCourse,
  movePlannedCourse,
} from "@/lib/supabase/queries/planner";
import { DB_TABLES, PLANNED_COURSE_STATUS } from "@/lib/supabase/queries/schema";

import type {
  Term,
  PlanWithMeta,
  PlannedCourseWithDetails,
  RequirementBlockWithCourses,
  BreadthPackage,
  GraduateTrack,
} from "@/types/planner";
import {
  deduplicateBlocks,
  getGraduateTracks,
  BREADTH_PACKAGES,
} from "@/types/planner";
import type { Course } from "@/types/course";

import CoursePanel from "@/components/planner/CoursePanel";
import SemesterGrid from "@/components/planner/SemesterGrid";
import PlannerSummary from "@/components/planner/PlannerSummary";
import AddSemesterDialog from "@/components/planner/AddSemesterDialog";
import RemoveSemesterDialog from "@/components/planner/RemoveSemesterDialog";
import DraggableCourseCard from "@/components/planner/DraggableCourseCard";
import CreatePlanDialog from "@/components/planner/CreatePlanDialog";
import DeletePlanDialog from "@/components/planner/DeletePlanDialog";
import PlansHub from "@/components/planner/PlansHub";

export default function PlannerPage() {
  const router = useRouter();

  // Auth + student
  const [studentId, setStudentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Plan state
  const [plans, setPlans] = useState<PlanWithMeta[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [planDataLoading, setPlanDataLoading] = useState(false);

  // Planner data (scoped to active plan)
  const [terms, setTerms] = useState<Term[]>([]);
  const [plannedCourses, setPlannedCourses] = useState<
    PlannedCourseWithDetails[]
  >([]);
  const [blocks, setBlocks] = useState<RequirementBlockWithCourses[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

  // Breadth package selection (persisted per plan)
  const [selectedBreadthPackageId, setSelectedBreadthPackageId] = useState<
    string | null
  >(null);

  const selectedBreadthPackage: BreadthPackage | null = useMemo(
    () => BREADTH_PACKAGES.find((p) => p.id === selectedBreadthPackageId) ?? null,
    [selectedBreadthPackageId]
  );

  const handleBreadthPackageSelect = useCallback(
    (packageId: string) => {
      setSelectedBreadthPackageId(packageId);
      if (studentId && activePlanId) {
        localStorage.setItem(
          `gradtracker:breadthPackage:${studentId}:${activePlanId}`,
          packageId
        );
      }
    },
    [studentId, activePlanId]
  );

  // Graduate track selection (persisted per plan)
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);

  const handleTrackSelect = useCallback(
    (trackId: number) => {
      setSelectedTrackId(trackId);
      if (studentId && activePlanId) {
        localStorage.setItem(
          `gradtracker:track:${studentId}:${activePlanId}`,
          String(trackId)
        );
      }
    },
    [studentId, activePlanId]
  );

  // View state: hub (plan cards) or workspace (planner grid)
  const [view, setView] = useState<"hub" | "workspace">("hub");

  // UI state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [createPlanDialogOpen, setCreatePlanDialogOpen] = useState(false);
  const [deletePlanDialog, setDeletePlanDialog] = useState<{
    open: boolean;
    planId: number | null;
  }>({ open: false, planId: null });
  const [removeDialog, setRemoveDialog] = useState<{
    open: boolean;
    termId: number | null;
  }>({ open: false, termId: null });
  const [activeDrag, setActiveDrag] = useState<{
    course: Course;
    fromTermId?: number;
  } | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Derived data
  const activePlan = plans.find((p) => p.id === activePlanId) ?? null;
  const isGraduatePlan = activePlan?.has_graduate_program ?? false;
  const plannedCourseIds = new Set(plannedCourses.map((pc) => pc.course_id));
  const graduateTracks: GraduateTrack[] = useMemo(
    () => (isGraduatePlan ? getGraduateTracks(blocks) : []),
    [blocks, isGraduatePlan]
  );

  // Auto-select first concentration track when a graduate plan loads
  useEffect(() => {
    if (isGraduatePlan && graduateTracks.length >= 2 && selectedTrackId === null) {
      handleTrackSelect(graduateTracks[0].blockId);
    }
  }, [isGraduatePlan, graduateTracks, selectedTrackId, handleTrackSelect]);

  const allDedupedBlocks = useMemo(
    () => deduplicateBlocks(blocks, { isGraduate: isGraduatePlan }),
    [blocks, isGraduatePlan]
  );

  const displayBlocks = useMemo(
    () =>
      deduplicateBlocks(blocks, {
        selectedPackage: isGraduatePlan ? null : selectedBreadthPackage,
        isGraduate: isGraduatePlan,
        selectedTrackId: isGraduatePlan ? selectedTrackId : null,
      }),
    [blocks, selectedBreadthPackage, isGraduatePlan, selectedTrackId]
  );

  // ── Load plan-specific data ────────────────────────────
  const loadPlanData = useCallback(
    async (sid: number, planId: number, graduate = false) => {
      setPlanDataLoading(true);
      try {
        if (graduate) {
          setSelectedBreadthPackageId(null);
          const savedTrack = localStorage.getItem(
            `gradtracker:track:${sid}:${planId}`
          );
          setSelectedTrackId(savedTrack ? Number(savedTrack) : null);
        } else {
          setSelectedTrackId(null);
          const savedPkg = localStorage.getItem(
            `gradtracker:breadthPackage:${sid}:${planId}`
          );
          if (savedPkg && BREADTH_PACKAGES.some((p) => p.id === savedPkg)) {
            setSelectedBreadthPackageId(savedPkg);
          } else {
            setSelectedBreadthPackageId(null);
          }
        }

        const [termsData, coursesData, blocksData, completedData] =
          await Promise.all([
            fetchStudentTerms(sid, planId),
            fetchPlannedCourses(sid, planId),
            fetchAvailableCourses(sid, planId),
            fetchCompletedCourseIds(sid),
          ]);

        setTerms(termsData);
        setPlannedCourses(coursesData);
        setBlocks(blocksData);
        setCompletedIds(completedData);
      } catch (err) {
        console.error("Failed to load plan data:", err);
        toaster.create({
          title: "Failed to load plan",
          description: "Please try again.",
          type: "error",
        });
        // Ensure we don't keep stale data around on failure
        setTerms([]);
        setPlannedCourses([]);
        setBlocks([]);
        setCompletedIds(new Set());
      } finally {
        setPlanDataLoading(false);
      }
    },
    []
  );

  // ── Initial load ───────────────────────────────────────
  useEffect(() => {
    let alive = true;

    async function init() {
      setLoading(true);

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!alive) return;

        if (!user) {
          setLoading(false);
          router.push("/signin");
          return;
        }

        const { data: studentRow, error: studentErr } = await supabase
          .from(DB_TABLES.students)
          .select("id")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (!alive) return;

        if (studentErr || !studentRow) {
          toaster.create({
            title: "Profile not found",
            description: "Complete onboarding first.",
            type: "error",
          });
          setLoading(false);
          router.push("/dashboard");
          return;
        }

        const sid = studentRow.id;
        setStudentId(sid);

        // Fetch plans (can fail — must be caught to avoid unhandled rejection)
        let plansData: PlanWithMeta[] = await fetchPlans(sid);

        // Auto-create default plan if none exist
        if (plansData.length === 0) {
          const { data: studentPrograms, error: spErr } = await supabase
            .from(DB_TABLES.studentPrograms)
            .select("program_id")
            .eq("student_id", sid);

          if (spErr) {
            toaster.create({
              title: "Failed to load programs",
              description: "Please try again.",
              type: "error",
            });
            if (alive) setPlans([]);
            return;
          }

          const programIds = (studentPrograms ?? []).map(
            (sp: any) => sp.program_id
          );

          // createPlan can fail too — allow outer catch to handle
          await createPlan(sid, "My Plan", null, programIds);
          plansData = await fetchPlans(sid);
        }

        if (!alive) return;

        setPlans(plansData);
      } catch (err) {
        console.error("Planner init failed:", err);
        toaster.create({
          title: "Failed to load planner",
          description: "Please try again.",
          type: "error",
        });
        if (alive) setPlans([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    init();

    return () => {
      alive = false;
    };
  }, [router]);

  // ── Open plan from hub ──────────────────────────────────
  const handleOpenPlan = useCallback(
    async (planId: number) => {
      if (!studentId) return;
      setActivePlanId(planId);
      setView("workspace");
      const plan = plans.find((p) => p.id === planId);
      await loadPlanData(studentId, planId, plan?.has_graduate_program ?? false);
    },
    [studentId, plans, loadPlanData]
  );

  // ── Switch plan (within workspace) ────────────────────
  const handleSwitchPlan = useCallback(
    async (planId: number) => {
      if (planId === activePlanId || !studentId) return;
      setActivePlanId(planId);
      const plan = plans.find((p) => p.id === planId);
      await loadPlanData(studentId, planId, plan?.has_graduate_program ?? false);
    },
    [activePlanId, studentId, plans, loadPlanData]
  );

  // ── Back to hub ───────────────────────────────────────
  const handleBackToHub = useCallback(() => {
    setView("hub");
  }, []);

  // ── Create plan ────────────────────────────────────────
  const handleCreatePlan = useCallback(
    async (name: string, description: string | null, programIds: number[]) => {
      if (!studentId) return;
      try {
        const newPlan = await createPlan(studentId, name, description, programIds);
        const refreshedPlans = await fetchPlans(studentId);
        setPlans(refreshedPlans);
        setActivePlanId(newPlan.id);
        setView("workspace");
        const created = refreshedPlans.find((p) => p.id === newPlan.id);
        await loadPlanData(studentId, newPlan.id, created?.has_graduate_program ?? false);
        toaster.create({ title: `"${name}" created`, type: "success" });
      } catch (err) {
        console.error("Create plan failed:", err);
        toaster.create({
          title: "Failed to create plan",
          description: "Please try again.",
          type: "error",
        });
      }
    },
    [studentId, loadPlanData]
  );

  // ── Rename plan ────────────────────────────────────────
  const handleRenamePlan = useCallback(async (planId: number, newName: string) => {
    try {
      await updatePlan(planId, { name: newName });
      setPlans((prev) =>
        prev.map((p) => (p.id === planId ? { ...p, name: newName } : p))
      );
    } catch (err) {
      console.error("Rename plan failed:", err);
      toaster.create({
        title: "Failed to rename plan",
        description: "Please try again.",
        type: "error",
      });
    }
  }, []);

  // ── Delete plan ────────────────────────────────────────
  const handleDeletePlanRequest = useCallback((planId: number) => {
    setDeletePlanDialog({ open: true, planId });
  }, []);

  const handleDeletePlanConfirmed = useCallback(async () => {
    const planId = deletePlanDialog.planId;
    if (!planId || !studentId) return;

    try {
      await deletePlan(planId);
      const refreshedPlans = await fetchPlans(studentId);
      setPlans(refreshedPlans);

      if (activePlanId === planId) {
        if (view === "workspace" && refreshedPlans.length > 0) {
          const nextPlan = refreshedPlans[0];
          setActivePlanId(nextPlan.id);
          await loadPlanData(studentId, nextPlan.id);
        } else {
          setActivePlanId(null);
          setView("hub");
        }
      }

      toaster.create({ title: "Plan deleted", type: "info" });
    } catch (err) {
      console.error("Delete plan failed:", err);
      toaster.create({
        title: "Failed to delete plan",
        description: "Please try again.",
        type: "error",
      });
    }
  }, [deletePlanDialog.planId, studentId, activePlanId, view, loadPlanData]);

  // ── Add semester ────────────────────────────────────────
  const handleAddSemester = useCallback(
    async (season: Term["season"], year: number) => {
      if (!studentId || !activePlanId) return;

      try {
        const term = await getOrCreateTerm(season, year);
        await addTermPlan(studentId, term.id, activePlanId);
        setTerms((prev) => [...prev, term]);
        setPlans((prev) =>
          prev.map((p) =>
            p.id === activePlanId ? { ...p, term_count: p.term_count + 1 } : p
          )
        );
        toaster.create({
          title: `${season} ${year} added`,
          type: "success",
        });
      } catch (err) {
        console.error("Add semester failed:", err);
        toaster.create({
          title: "Failed to add semester",
          description: "Please try again.",
          type: "error",
        });
      }
    },
    [studentId, activePlanId]
  );

  // ── Remove semester ─────────────────────────────────────
  const handleRemoveTermRequest = useCallback(
    (termId: number) => {
      const coursesInTerm = plannedCourses.filter((pc) => pc.term_id === termId);
      if (coursesInTerm.length > 0) {
        setRemoveDialog({ open: true, termId });
      } else {
        handleRemoveTermConfirmed(termId);
      }
    },
    [plannedCourses]
  );

  const handleRemoveTermConfirmed = useCallback(
    async (termId?: number) => {
      const id = termId ?? removeDialog.termId;
      if (!studentId || !id || !activePlanId) return;

      const removedCourseCount = plannedCourses.filter((pc) => pc.term_id === id).length;

      try {
        await removeTermPlan(studentId, id, activePlanId);
        setTerms((prev) => prev.filter((t) => t.id !== id));
        setPlannedCourses((prev) => prev.filter((pc) => pc.term_id !== id));
        setPlans((prev) =>
          prev.map((p) =>
            p.id === activePlanId
              ? {
                  ...p,
                  term_count: Math.max(0, p.term_count - 1),
                  course_count: Math.max(0, p.course_count - removedCourseCount),
                }
              : p
          )
        );
        toaster.create({ title: "Semester removed", type: "info" });
      } catch (err: any) {
        toaster.create({
          title: "Error",
          description: err?.message || "Failed to remove semester",
          type: "error",
        });
      }
    },
    [studentId, activePlanId, removeDialog.termId, plannedCourses]
  );

  // ── Drag handlers ───────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    const { course, fromTermId } = event.active.data.current as {
      course: Course;
      fromTermId?: number;
    };
    setActiveDrag({ course, fromTermId });
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);

    const { active, over } = event;
    if (!over || !studentId || !activePlanId) return;

    const { course, fromTermId } = active.data.current as {
      course: Course;
      fromTermId?: number;
    };

    const overId = String(over.id);

    if (overId.startsWith("term-")) {
      const toTermId = over.data.current?.term?.id as number | undefined;
      if (!toTermId) return;
      if (fromTermId === toTermId) return;

      try {
        if (fromTermId) {
          await movePlannedCourse(
            studentId,
            course.id,
            fromTermId,
            toTermId,
            activePlanId
          );
          setPlannedCourses((prev) =>
            prev.map((pc) =>
              pc.course_id === course.id && pc.term_id === fromTermId
                ? { ...pc, term_id: toTermId }
                : pc
            )
          );
        } else {
          if (plannedCourseIds.has(course.id)) return;
          await addPlannedCourse(studentId, toTermId, course.id, activePlanId);
          setPlannedCourses((prev) => [
            ...prev,
            {
              student_id: studentId,
              term_id: toTermId,
              course_id: course.id,
              status: PLANNED_COURSE_STATUS.planned,
              plan_id: activePlanId,
              course,
            },
          ]);
          setPlans((prev) =>
            prev.map((p) =>
              p.id === activePlanId
                ? {
                    ...p,
                    course_count: p.course_count + 1,
                    total_credits: p.total_credits + (course.credits ?? 0),
                  }
                : p
            )
          );
        }
      } catch (err: any) {
        toaster.create({
          title: "Error",
          description: err?.message || "Failed to update plan",
          type: "error",
        });
      }
      return;
    }

    if (fromTermId && (overId === "course-panel" || !overId.startsWith("term-"))) {
      try {
        await removePlannedCourse(studentId, fromTermId, course.id, activePlanId);
        setPlannedCourses((prev) =>
          prev.filter(
            (pc) => !(pc.course_id === course.id && pc.term_id === fromTermId)
          )
        );
        setPlans((prev) =>
          prev.map((p) =>
            p.id === activePlanId
              ? {
                  ...p,
                  course_count: Math.max(0, p.course_count - 1),
                  total_credits: Math.max(0, p.total_credits - (course.credits ?? 0)),
                }
              : p
          )
        );
      } catch (err: any) {
        toaster.create({
          title: "Error",
          description: err?.message || "Failed to remove course",
          type: "error",
        });
      }
    }
  }

  // ── Loading state ───────────────────────────────────────
  if (loading) {
    return (
      <Flex align="center" justify="center" minH="60vh">
        <VStack gap="4">
          <Spinner size="xl" color="green.500" />
          <Text color="fg.muted">Loading your planner...</Text>
        </VStack>
      </Flex>
    );
  }

  // ── Render ──────────────────────────────────────────────
  return (
    <Box
      mx={{ base: "-4", md: "-8" }}
      mt="-6"
      display="flex"
      flexDirection="column"
      minH="calc(100vh - 80px)"
    >
      {view === "hub" ? (
        <>
          <PlansHub
            plans={plans}
            onOpenPlan={handleOpenPlan}
            onCreatePlan={() => setCreatePlanDialogOpen(true)}
            onRenamePlan={handleRenamePlan}
            onDeletePlan={handleDeletePlanRequest}
          />
        </>
      ) : (
        <>
          {/* Workspace header */}
          <Box
            as="header"
            position="sticky"
            top="0"
            bg="bg"
            borderBottomWidth="1px"
            borderColor="border.subtle"
            zIndex="sticky"
            className="glass-card"
          >
            <Flex justify="space-between" align="center" px={{ base: "4", md: "6" }} py="3">
              {/* Breadcrumb navigation */}
              <HStack gap="2">
                <IconButton
                  aria-label="Back to plans"
                  variant="ghost"
                  size="sm"
                  borderRadius="lg"
                  onClick={handleBackToHub}
                  _hover={{ bg: "bg.subtle" }}
                >
                  <LuArrowLeft />
                </IconButton>
                <HStack gap="1.5" fontSize="sm">
                  <Text
                    color="fg.muted"
                    cursor="pointer"
                    _hover={{ color: "green.fg" }}
                    onClick={handleBackToHub}
                    fontWeight="500"
                    transition="color 0.15s"
                  >
                    Plans
                  </Text>
                  <Icon color="fg.subtle" boxSize="3.5">
                    <LuChevronRight />
                  </Icon>
                  <Heading
                    size="md"
                    fontFamily="var(--font-outfit), sans-serif"
                    fontWeight="400"
                    letterSpacing="-0.02em"
                  >
                    {activePlan?.name ?? "Plan"}
                  </Heading>
                </HStack>
              </HStack>

              <HStack gap="2">
                {/* Compact plan tabs for quick switching */}
                {plans.length > 1 && (
                  <HStack gap="0" bg="bg.subtle" borderRadius="lg" p="0.5" mr="1">
                    {plans.map((p) => (
                      <Button
                        key={p.id}
                        size="xs"
                        variant={p.id === activePlanId ? "solid" : "ghost"}
                        colorPalette={p.id === activePlanId ? "green" : "gray"}
                        borderRadius="md"
                        fontSize="xs"
                        fontWeight={p.id === activePlanId ? "600" : "500"}
                        onClick={() => handleSwitchPlan(p.id)}
                        px="3"
                        transition="all 0.15s"
                      >
                        {p.name}
                      </Button>
                    ))}
                  </HStack>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  borderRadius="lg"
                  onClick={() => setAddDialogOpen(true)}
                >
                  <LuPlus size={16} />
                  Add Semester
                </Button>
                <Button size="sm" variant="ghost" borderRadius="lg" disabled title="Coming soon">
                  <LuSparkles size={16} />
                  Auto Generate
                </Button>
              </HStack>
            </Flex>
          </Box>

          {/* Plan data loading overlay */}
          {planDataLoading ? (
            <Flex flex="1" align="center" justify="center">
              <VStack gap="3">
                <Spinner size="lg" color="green.500" />
                <Text fontSize="sm" color="fg.muted">
                  Loading plan...
                </Text>
              </VStack>
            </Flex>
          ) : (
            <>
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <Flex flex="1" overflow="hidden" className="animate-fade-up">
                  <CoursePanel
                    blocks={displayBlocks}
                    allDedupedBlocks={allDedupedBlocks}
                    completedCourseIds={completedIds}
                    plannedCourseIds={plannedCourseIds}
                    plannedCourses={plannedCourses}
                    isDragActive={!!activeDrag}
                    selectedBreadthPackageId={selectedBreadthPackageId}
                    onBreadthPackageSelect={handleBreadthPackageSelect}
                    isGraduatePlan={isGraduatePlan}
                    graduateTracks={graduateTracks}
                    selectedTrackId={selectedTrackId}
                    onTrackSelect={handleTrackSelect}
                  />

                  {terms.length === 0 ? (
                    <Flex
                      flex="1"
                      align="center"
                      justify="center"
                      direction="column"
                      gap="4"
                      p="8"
                      className="animate-fade-up-delay-1"
                    >
                      <Box
                        p="8"
                        borderWidth="2px"
                        borderStyle="dashed"
                        borderColor="border.subtle"
                        borderRadius="2xl"
                        textAlign="center"
                        maxW="420px"
                        bg="bg"
                      >
                        <Box
                          w="16"
                          h="16"
                          borderRadius="2xl"
                          bg="green.subtle"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          mx="auto"
                          mb="4"
                        >
                          <LuCalendar size={32} color="var(--chakra-colors-green-fg)" />
                        </Box>
                        <Heading
                          size="md"
                          mb="2"
                          fontFamily="var(--font-outfit), sans-serif"
                          fontWeight="400"
                          letterSpacing="-0.02em"
                        >
                          No semesters yet
                        </Heading>
                        <Text fontSize="sm" color="fg.muted" mb="2">
                          Add your first semester to start planning your courses.
                        </Text>
                        <Text fontSize="xs" color="fg.muted" mb="5">
                          Drag courses from the pool on the left into your semesters to build your plan.
                        </Text>
                        <Button
                          colorPalette="green"
                          borderRadius="lg"
                          size="sm"
                          onClick={() => setAddDialogOpen(true)}
                        >
                          <LuPlus size={16} />
                          Add First Semester
                        </Button>
                      </Box>
                    </Flex>
                  ) : (
                    <SemesterGrid
                      terms={terms}
                      plannedCourses={plannedCourses}
                      onRemoveTerm={handleRemoveTermRequest}
                      isGraduatePlan={isGraduatePlan}
                    />
                  )}
                </Flex>

                <DragOverlay>
                  {activeDrag ? (
                    <Box w="260px" opacity={0.9}>
                      <DraggableCourseCard course={activeDrag.course} termId={activeDrag.fromTermId} />
                    </Box>
                  ) : null}
                </DragOverlay>
              </DndContext>

              <PlannerSummary
                terms={terms}
                plannedCourses={plannedCourses}
                blocks={displayBlocks}
                completedCourseIds={completedIds}
                isGraduatePlan={isGraduatePlan}
              />
            </>
          )}
        </>
      )}

      {/* Dialogs */}
      <AddSemesterDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddSemester}
        existingTerms={terms}
      />

      <RemoveSemesterDialog
        open={removeDialog.open}
        onOpenChange={(open) => setRemoveDialog((prev) => ({ ...prev, open }))}
        onConfirm={() => handleRemoveTermConfirmed()}
        term={terms.find((t) => t.id === removeDialog.termId) ?? null}
        courseCount={
          removeDialog.termId
            ? plannedCourses.filter((pc) => pc.term_id === removeDialog.termId).length
            : 0
        }
      />

      <CreatePlanDialog
        open={createPlanDialogOpen}
        onOpenChange={setCreatePlanDialogOpen}
        onCreatePlan={handleCreatePlan}
        existingPlanCount={plans.length}
      />

      <DeletePlanDialog
        open={deletePlanDialog.open}
        onOpenChange={(open) => setDeletePlanDialog((prev) => ({ ...prev, open }))}
        onConfirm={handleDeletePlanConfirmed}
        plan={plans.find((p) => p.id === deletePlanDialog.planId) ?? null}
      />
    </Box>
  );
}