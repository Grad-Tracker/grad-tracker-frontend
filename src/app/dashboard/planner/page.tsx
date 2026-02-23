"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Avatar,
  Box,
  Button,
  Circle,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import Link from "next/link";
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
import { ColorModeButton } from "@/components/ui/color-mode";
import {
  LuLayoutDashboard,
  LuBookOpen,
  LuGraduationCap,
  LuCalendar,
  LuSettings,
  LuFileText,
  LuTarget,
  LuLogOut,
  LuPlus,
  LuSparkles,
  LuBell,
} from "react-icons/lu";

import {
  fetchStudentTerms,
  fetchPlannedCourses,
  fetchAvailableCourses,
  fetchCompletedCourseIds,
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
  PlannedCourseWithDetails,
  RequirementBlockWithCourses,
  BreadthPackage,
} from "@/types/planner";
import { deduplicateBlocks, BREADTH_PACKAGES } from "@/types/planner";
import type { Course } from "@/types/course";

import CoursePanel from "@/components/planner/CoursePanel";
import SemesterGrid from "@/components/planner/SemesterGrid";
import PlannerSummary from "@/components/planner/PlannerSummary";
import AddSemesterDialog from "@/components/planner/AddSemesterDialog";
import RemoveSemesterDialog from "@/components/planner/RemoveSemesterDialog";
import DraggableCourseCard from "@/components/planner/DraggableCourseCard";

const navItems = [
  { icon: LuLayoutDashboard, label: "Dashboard", href: "/dashboard", active: false },
  { icon: LuBookOpen, label: "Courses", href: "/dashboard/courses", active: false },
  { icon: LuTarget, label: "Requirements", href: "/dashboard/requirements", active: false },
  { icon: LuCalendar, label: "Planner", href: "/dashboard/planner", active: true },
  { icon: LuFileText, label: "Reports", href: "/dashboard/reports", active: false },
];

export default function PlannerPage() {
  const router = useRouter();

  // Auth + student
  const [studentId, setStudentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Planner data
  const [terms, setTerms] = useState<Term[]>([]);
  const [plannedCourses, setPlannedCourses] = useState<PlannedCourseWithDetails[]>([]);
  const [blocks, setBlocks] = useState<RequirementBlockWithCourses[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

  // Breadth package selection (persisted to localStorage)
  const [selectedBreadthPackageId, setSelectedBreadthPackageId] = useState<string | null>(null);

  const selectedBreadthPackage: BreadthPackage | null = useMemo(
    () => BREADTH_PACKAGES.find((p) => p.id === selectedBreadthPackageId) ?? null,
    [selectedBreadthPackageId]
  );

  const handleBreadthPackageSelect = useCallback(
    (packageId: string) => {
      setSelectedBreadthPackageId(packageId);
      if (studentId) {
        localStorage.setItem(`gradtracker:breadthPackage:${studentId}`, packageId);
      }
    },
    [studentId]
  );

  // UI state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
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
  const plannedCourseIds = new Set(plannedCourses.map((pc) => pc.course_id));
  const allDedupedBlocks = useMemo(() => deduplicateBlocks(blocks), [blocks]);
  const displayBlocks = useMemo(
    () => deduplicateBlocks(blocks, selectedBreadthPackage),
    [blocks, selectedBreadthPackage]
  );

  // ── Load data ──────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/signin");
        return;
      }

      const { data: studentRow, error: studentErr } = await supabase
        .from(DB_TABLES.students)
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (studentErr || !studentRow) {
        toaster.create({
          title: "Profile not found",
          description: "Complete onboarding first.",
          type: "error",
        });
        router.push("/dashboard");
        return;
      }

      const sid = studentRow.id;
      setStudentId(sid);

      // Restore breadth package selection from localStorage
      const savedPkg = localStorage.getItem(`gradtracker:breadthPackage:${sid}`);
      if (savedPkg && BREADTH_PACKAGES.some((p) => p.id === savedPkg)) {
        setSelectedBreadthPackageId(savedPkg);
      }

      // Parallel fetch
      const [termsData, coursesData, blocksData, completedData] =
        await Promise.all([
          fetchStudentTerms(sid),
          fetchPlannedCourses(sid),
          fetchAvailableCourses(sid),
          fetchCompletedCourseIds(sid),
        ]);

      setTerms(termsData);
      setPlannedCourses(coursesData);
      setBlocks(blocksData);
      setCompletedIds(completedData);
      setLoading(false);
    }

    init();
  }, [router]);

  // ── Add semester ────────────────────────────────────────
  const handleAddSemester = useCallback(
    async (season: Term["season"], year: number) => {
      if (!studentId) return;
      const term = await getOrCreateTerm(season, year);
      await addTermPlan(studentId, term.id);
      setTerms((prev) => [...prev, term]);
      toaster.create({
        title: `${season} ${year} added`,
        type: "success",
      });
    },
    [studentId]
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
      if (!studentId || !id) return;
      await removeTermPlan(studentId, id);
      setTerms((prev) => prev.filter((t) => t.id !== id));
      setPlannedCourses((prev) => prev.filter((pc) => pc.term_id !== id));
      toaster.create({ title: "Semester removed", type: "info" });
    },
    [studentId, removeDialog.termId]
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
    if (!over || !studentId) return;

    const { course, fromTermId } = active.data.current as {
      course: Course;
      fromTermId?: number;
    };

    const overId = String(over.id);

    // Dropped on a semester column
    if (overId.startsWith("term-")) {
      const toTermId = over.data.current?.term?.id as number | undefined;
      if (!toTermId) return;

      // Same semester — no-op
      if (fromTermId === toTermId) return;

      try {
        if (fromTermId) {
          // Move between semesters
          await movePlannedCourse(studentId, course.id, fromTermId, toTermId);
          setPlannedCourses((prev) =>
            prev.map((pc) =>
              pc.course_id === course.id && pc.term_id === fromTermId
                ? { ...pc, term_id: toTermId }
                : pc
            )
          );
        } else {
          // New course from panel → semester
          if (plannedCourseIds.has(course.id)) return; // already planned
          await addPlannedCourse(studentId, toTermId, course.id);
          setPlannedCourses((prev) => [
            ...prev,
            {
              student_id: studentId,
              term_id: toTermId,
              course_id: course.id,
              status: PLANNED_COURSE_STATUS.planned,
              course,
            },
          ]);
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

    // Dropped on course panel or outside a semester — remove from semester
    if (fromTermId && (overId === "course-panel" || !overId.startsWith("term-"))) {
      try {
        await removePlannedCourse(studentId, fromTermId, course.id);
        setPlannedCourses((prev) =>
          prev.filter(
            (pc) =>
              !(pc.course_id === course.id && pc.term_id === fromTermId)
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

  // ── Sign out ────────────────────────────────────────────
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toaster.create({
      title: "Signed out",
      description: "You've been signed out successfully.",
      type: "success",
    });
    router.push("/signin");
  }

  // ── Loading state ───────────────────────────────────────
  if (loading) {
    return (
      <Box
        minH="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        fontFamily="'Plus Jakarta Sans', sans-serif"
      >
        <VStack gap="4">
          <Spinner size="xl" color="green.500" />
          <Text color="fg.muted">Loading your planner...</Text>
        </VStack>
      </Box>
    );
  }

  // ── Render ──────────────────────────────────────────────
  return (
    <Box minH="100vh" bg="bg" fontFamily="'Plus Jakarta Sans', sans-serif">
      <Flex>
        {/* ──────── Sidebar ──────── */}
        <Box
          as="aside"
          w="260px"
          minH="100vh"
          bg="bg"
          borderRightWidth="1px"
          borderColor="border.subtle"
          position="fixed"
          left="0"
          top="0"
          display={{ base: "none", lg: "flex" }}
          flexDirection="column"
          zIndex="docked"
        >
          <HStack
            gap="3"
            px="6"
            py="5"
            borderBottomWidth="1px"
            borderColor="border.subtle"
          >
            <Box p="2" bg="green.solid" borderRadius="lg">
              <Icon color="white" boxSize="5">
                <LuGraduationCap />
              </Icon>
            </Box>
            <Text
              fontWeight="700"
              fontSize="lg"
              fontFamily="'DM Serif Display', serif"
              letterSpacing="-0.02em"
            >
              GradTracker
            </Text>
          </HStack>

          <VStack align="stretch" flex="1" py="4" px="3" gap="1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                style={{ textDecoration: "none" }}
              >
                <HStack
                  px="4"
                  py="2.5"
                  borderRadius="lg"
                  cursor="pointer"
                  bg={item.active ? "green.subtle" : "transparent"}
                  color={item.active ? "green.fg" : "fg.muted"}
                  fontWeight={item.active ? "600" : "500"}
                  _hover={{
                    bg: item.active ? "green.subtle" : "bg.subtle",
                    color: item.active ? "green.fg" : "fg",
                  }}
                  transition="all 0.15s"
                >
                  <Icon boxSize="5">
                    <item.icon />
                  </Icon>
                  <Text fontSize="sm">{item.label}</Text>
                </HStack>
              </Link>
            ))}
          </VStack>

          <VStack
            align="stretch"
            p="4"
            gap="2"
            borderTopWidth="1px"
            borderColor="border.subtle"
          >
            <Link href="/dashboard/settings" style={{ textDecoration: "none" }}>
              <HStack
                px="4"
                py="2.5"
                borderRadius="lg"
                cursor="pointer"
                color="fg.muted"
                fontWeight="500"
                _hover={{ bg: "bg.subtle", color: "fg" }}
                transition="all 0.15s"
              >
                <Icon boxSize="5">
                  <LuSettings />
                </Icon>
                <Text fontSize="sm">Settings</Text>
              </HStack>
            </Link>
            <HStack
              px="4"
              py="2.5"
              borderRadius="lg"
              cursor="pointer"
              color="fg.muted"
              fontWeight="500"
              _hover={{ bg: "red.subtle", color: "red.fg" }}
              transition="all 0.15s"
              onClick={handleSignOut}
            >
              <Icon boxSize="5">
                <LuLogOut />
              </Icon>
              <Text fontSize="sm">Sign Out</Text>
            </HStack>
          </VStack>
        </Box>

        {/* ──────── Main Content ──────── */}
        <Box
          flex="1"
          ml={{ base: "0", lg: "260px" }}
          minH="100vh"
          display="flex"
          flexDirection="column"
          className="mesh-gradient-subtle"
        >
          {/* Header */}
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
            <Flex
              justify="space-between"
              align="center"
              px={{ base: "4", md: "6" }}
              py="4"
            >
              <Box>
                <Text fontSize="sm" color="fg.muted" fontWeight="500">
                  Plan your path to graduation
                </Text>
                <Heading
                  size="lg"
                  fontFamily="'DM Serif Display', serif"
                  fontWeight="400"
                  letterSpacing="-0.02em"
                >
                  Semester Planner
                </Heading>
              </Box>
              <HStack gap="3">
                <Button
                  size="sm"
                  variant="outline"
                  borderRadius="lg"
                  onClick={() => setAddDialogOpen(true)}
                >
                  <LuPlus size={16} />
                  Add Semester
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  borderRadius="lg"
                  disabled
                  title="Coming soon"
                >
                  <LuSparkles size={16} />
                  Auto Generate
                </Button>
                <IconButton
                  aria-label="Notifications"
                  variant="ghost"
                  size="sm"
                  position="relative"
                >
                  <LuBell />
                  <Circle
                    size="2"
                    bg="red.500"
                    position="absolute"
                    top="1.5"
                    right="1.5"
                  />
                </IconButton>
                <ColorModeButton variant="ghost" size="sm" />
                <Avatar.Root size="sm">
                  <Avatar.Fallback name="Student" />
                </Avatar.Root>
              </HStack>
            </Flex>
          </Box>

          {/* DnD Context wraps both CoursePanel and SemesterGrid */}
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <Flex flex="1" overflow="hidden" className="animate-fade-up">
              {/* Course Panel (droppable target for removing courses) */}
              <CoursePanel
                blocks={displayBlocks}
                allDedupedBlocks={allDedupedBlocks}
                completedCourseIds={completedIds}
                plannedCourseIds={plannedCourseIds}
                plannedCourses={plannedCourses}
                isDragActive={!!activeDrag}
                selectedBreadthPackageId={selectedBreadthPackageId}
                onBreadthPackageSelect={handleBreadthPackageSelect}
              />

              {/* Semester Grid */}
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
                      fontFamily="'DM Serif Display', serif"
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
                />
              )}
            </Flex>

            {/* Drag Overlay */}
            <DragOverlay>
              {activeDrag ? (
                <Box w="260px" opacity={0.9}>
                  <DraggableCourseCard
                    course={activeDrag.course}
                    termId={activeDrag.fromTermId}
                  />
                </Box>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Summary Bar */}
          <PlannerSummary
            terms={terms}
            plannedCourses={plannedCourses}
            blocks={displayBlocks}
            completedCourseIds={completedIds}
          />
        </Box>
      </Flex>

      {/* Add Semester Dialog */}
      <AddSemesterDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddSemester}
        existingTerms={terms}
      />

      {/* Remove Semester Confirmation */}
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
    </Box>
  );
}
