"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type * as React from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Badge,
  Box,
  Button,
  ButtonGroup,
  Card,
  Circle,
  CloseButton,
  Dialog,
  Drawer,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  Pagination,
  Portal,
  Separator,
  SimpleGrid,
  Spinner,
  Tabs,
  Text,
  VStack,
  createListCollection,
} from "@chakra-ui/react";
import { Select } from "@chakra-ui/react";
import Link from "next/link";
import { toaster } from "@/components/ui/toaster";
import {
  LuLayoutDashboard,
  LuBookOpen,
  LuGraduationCap,
  LuCalendar,
  LuSettings,
  LuBell,
  LuTarget,
  LuFileText,
  LuLogOut,
  LuSearch,
  LuBookMarked,
  LuClock,
  LuCircleAlert,
  LuChevronLeft,
  LuChevronRight,
} from "react-icons/lu";
import type { Course, CourseFilters } from "@/types/course";
import { getSubjectColor } from "@/lib/subject-colors";
import { createClient } from "@/lib/supabase/client";
import {
  addPlannedCourse,
  addTermPlan,
  createPlan,
  fetchPlans,
  fetchPlannedCourses,
  fetchStudentTerms,
  getOrCreateTerm,
} from "@/lib/supabase/queries/planner";
import { DB_TABLES, DB_VIEWS } from "@/lib/supabase/queries/schema";
import { compareTerms, type Term } from "@/types/planner";
import { getCurrentAcademicTerm } from "@/lib/academic-term";
import { COURSES_PAGE_SIZE } from "@/lib/constants";

const navItems = [
  { icon: LuLayoutDashboard, label: "Dashboard", href: "/dashboard", active: false },
  { icon: LuBookOpen, label: "Courses", href: "/dashboard/courses", active: true },
  { icon: LuTarget, label: "Requirements", href: "/dashboard/requirements", active: false },
  { icon: LuCalendar, label: "Planner", href: "/dashboard/planner", active: false },
  { icon: LuFileText, label: "Reports", href: "/dashboard/reports", active: false },
];

interface CoursesClientProps {
  initialCourses: Course[];
  subjects: string[];
}

function handleKeyboardActivate(
  e: React.KeyboardEvent,
  onActivate: () => void
) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onActivate();
  }
}

function getCourseActivityLabel(course: Course): string {
  return `${course.subject} ${course.number}`;
}

export default function CoursesClient({
  initialCourses,
  subjects,
}: CoursesClientProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<CourseFilters>({
    search: "",
    subject: null,
  });
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [courseLevel, setCourseLevel] = useState<string>("undergraduate");
  const [page, setPage] = useState(1);
  const [addingToSemester, setAddingToSemester] = useState(false);
  const [addToPlanOpen, setAddToPlanOpen] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [addingToSelectedPlan, setAddingToSelectedPlan] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<Array<{ id: number; name: string }>>([]);
  const [planTerms, setPlanTerms] = useState<Record<number, Term[]>>({});
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  const handleCourseClick = (course: Course) => {
    setSelectedCourse(course);
    setDrawerOpen(true);
    setAddToPlanOpen(false);
    setLoadingPlans(false);
    setAddingToSelectedPlan(false);
    setAvailablePlans([]);
    setPlanTerms({});
    setSelectedPlanId(null);
  };

  const ensureDefaultPlan = async (studentId: number): Promise<number> => {
    const supabase = createClient();
    let plans = await fetchPlans(studentId);

    if (plans.length === 0) {
      const { data: studentPrograms, error } = await supabase
        .from(DB_TABLES.studentPrograms)
        .select("program_id")
        .eq("student_id", studentId);

      if (error) throw error;

      const programIds = (studentPrograms ?? []).map((row: any) => Number(row.program_id));
      const createdPlan = await createPlan(studentId, "My Plan", null, programIds);
      return createdPlan.id;
    }

    return plans[0].id;
  };

  const ensureCurrentTerm = async (studentId: number, planId: number): Promise<Term> => {
    const current = getCurrentAcademicTerm();
    const terms = await fetchStudentTerms(studentId, planId);
    const existingCurrent = terms.find(
      (term) => term.season === current.season && term.year === current.year
    );

    if (existingCurrent) return existingCurrent;

    const createdTerm = await getOrCreateTerm(current.season, current.year);
    const alreadyLinked = terms.some((term) => term.id === createdTerm.id);
    if (!alreadyLinked) {
      await addTermPlan(studentId, createdTerm.id, planId);
    }
    return createdTerm;
  };

  const getStudentIdForPlannerActions = async (): Promise<number | null> => {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.push("/signin");
      return null;
    }

    const { data: studentRow, error: studentError } = await supabase
      .from(DB_VIEWS.studentProfile)
      .select("student_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (studentError || !studentRow) {
      toaster.create({
        title: "Profile not found",
        description: "Complete onboarding before adding courses to your planner.",
        type: "error",
      });
      return null;
    }

    return Number((studentRow as any).student_id ?? (studentRow as any).id);
  };

  const handleOpenAddToPlan = async () => {
    if (!selectedCourse || loadingPlans) return;

    setAddToPlanOpen(true);
    setLoadingPlans(true);
    setSelectedPlanId(null);

    try {
      const studentId = await getStudentIdForPlannerActions();
      if (!studentId) return;

      const plans = await fetchPlans(studentId);
      const ensuredPlans =
        plans.length > 0
          ? plans
          : [
              {
                ...(await createPlan(studentId, "My Plan", null, [])),
                name: "My Plan",
              },
            ];

      const normalizedPlans = ensuredPlans.map((plan) => ({
        id: Number(plan.id),
        name: plan.name,
      }));

      const termsEntries = await Promise.all(
        normalizedPlans.map(async (plan) => [
          plan.id,
          [...(await fetchStudentTerms(studentId, plan.id))].sort(compareTerms),
        ] as const)
      );

      const nextPlanTerms = Object.fromEntries(termsEntries);
      setAvailablePlans(normalizedPlans);
      setPlanTerms(nextPlanTerms);
      setSelectedPlanId(normalizedPlans[0]?.id ?? null);
    } catch (error) {
      setAddToPlanOpen(false);
      toaster.create({
        title: "Failed to load plans",
        description: error instanceof Error ? error.message : "Please try again.",
        type: "error",
      });
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleAddToSelectedPlan = async (planId: number, term: Term) => {
    if (!selectedCourse || addingToSelectedPlan) return;

    setAddingToSelectedPlan(true);
    try {
      const studentId = await getStudentIdForPlannerActions();
      if (!studentId) return;

      const plannedCourses = await fetchPlannedCourses(studentId, planId);
      const alreadyPlanned = plannedCourses.some(
        (plannedCourse) => plannedCourse.course_id === selectedCourse.id
      );

      if (alreadyPlanned) {
        toaster.create({
          title: "Already in this plan",
          description: `${selectedCourse.subject} ${selectedCourse.number} is already scheduled in ${availablePlans.find((plan) => plan.id === planId)?.name ?? "this plan"}.`,
          type: "info",
        });
        return;
      }

      await addPlannedCourse(
        studentId,
        term.id,
        selectedCourse.id,
        planId
      );
      toaster.create({
        title: "Added to plan",
        description: `${selectedCourse.subject} ${selectedCourse.number} was added to ${term.season} ${term.year}.`,
        type: "success",
      });
      setDrawerOpen(false);
      setAddToPlanOpen(false);
      setSelectedPlanId(null);
    } catch (error) {
      toaster.create({
        title: "Failed to add course",
        description: error instanceof Error ? error.message : "Please try again.",
        type: "error",
      });
    } finally {
      setAddingToSelectedPlan(false);
    }
  };

  const handleAddToCurrentSemester = async () => {
    if (!selectedCourse || addingToSemester) return;

    setAddingToSemester(true);
    try {
      const studentId = await getStudentIdForPlannerActions();
      if (!studentId) {
        return;
      }

      const planId = await ensureDefaultPlan(studentId);
      const currentTerm = await ensureCurrentTerm(studentId, planId);
      const plannedCourses = await fetchPlannedCourses(studentId, planId);

      const alreadyPlanned = plannedCourses.some(
        (plannedCourse) => plannedCourse.course_id === selectedCourse.id
      );

      if (alreadyPlanned) {
        toaster.create({
          title: "Already in your planner",
          description: `${selectedCourse.subject} ${selectedCourse.number} is already in one of your semesters.`,
          type: "info",
        });
        return;
      }

      await addPlannedCourse(
        studentId,
        currentTerm.id,
        selectedCourse.id,
        planId
      );
      toaster.create({
        title: "Added to current semester",
        description: `${selectedCourse.subject} ${selectedCourse.number} was added to ${currentTerm.season} ${currentTerm.year}.`,
        type: "success",
      });
      setDrawerOpen(false);
    } catch (error) {
      const description = error instanceof Error ? error.message : "Please try again.";
      toaster.create({
        title: "Failed to add course",
        description,
        type: "error",
      });
    } finally {
      setAddingToSemester(false);
    }
  };

  const handleCourseCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, course: Course) => {
    handleKeyboardActivate(event, () => handleCourseClick(course));
  };

  const subjectCollection = useMemo(
    () =>
      createListCollection({
        items: subjects.map((subj) => ({ label: subj, value: subj })),
      }),
    [subjects]
  );

  const filteredCourses = useMemo(() => {
    return initialCourses.filter((course) => {
      const courseCode = `${course.subject} ${course.number}`;
      const matchesSearch =
        filters.search === "" ||
        courseCode.toLowerCase().includes(filters.search.toLowerCase()) ||
        course.title.toLowerCase().includes(filters.search.toLowerCase());

      const matchesSubject =
        !filters.subject || course.subject === filters.subject;

      // Parse course number to determine level
      const courseNum = parseInt(course.number, 10);
      const isGraduate = !isNaN(courseNum) && courseNum >= 500;
      const matchesLevel =
        courseLevel === "undergraduate" ? !isGraduate : isGraduate;

      return matchesSearch && matchesSubject && matchesLevel;
    });
  }, [initialCourses, filters, courseLevel]);

  // Count courses by level for tab badges
  const courseCounts = useMemo(() => {
    const undergrad = initialCourses.filter((course) => {
      const num = parseInt(course.number, 10);
      return isNaN(num) || num < 500;
    }).length;
    return {
      undergraduate: undergrad,
      graduate: initialCourses.length - undergrad,
    };
  }, [initialCourses]);

  // Reset to page 1 when filters or course level change
  useEffect(() => {
    setPage(1);
  }, [filters, courseLevel]);

  // Paginate the filtered courses
  const paginatedCourses = useMemo(() => {
    const startIndex = (page - 1) * COURSES_PAGE_SIZE;
    return filteredCourses.slice(startIndex, startIndex + COURSES_PAGE_SIZE);
  }, [filteredCourses, page]);

  const totalPages = Math.ceil(filteredCourses.length / COURSES_PAGE_SIZE);

  function renderAddToPlanBody() {
    if (loadingPlans) {
      return (
        <Flex minH="240px" align="center" justify="center">
          <VStack gap="3">
            <Spinner color="blue.500" />
            <Text fontSize="sm" color="fg.muted">
              Loading your plans...
            </Text>
          </VStack>
        </Flex>
      );
    }
    if (availablePlans.length === 0) {
      return (
        <Flex minH="240px" align="center" justify="center">
          <Text fontSize="sm" color="fg.muted">
            No plans available yet.
          </Text>
        </Flex>
      );
    }
    return (
      <VStack align="stretch" gap="6">
        <Box>
          <Text fontSize="sm" color="fg.muted" mb="3">
            1. Pick a plan
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            {availablePlans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const termCount = planTerms[plan.id]?.length ?? 0;
              return (
                <Button
                  key={plan.id}
                  type="button"
                  variant="plain"
                  h="auto"
                  justifyContent="flex-start"
                  whiteSpace="normal"
                  textAlign="left"
                  borderWidth="1px"
                  borderColor={isSelected ? "blue.500" : "border.subtle"}
                  bg={isSelected ? "blue.subtle" : "bg"}
                  borderRadius="2xl"
                  p="5"
                  transition="all 0.15s"
                  _hover={{ borderColor: "blue.400", bg: "blue.subtle" }}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <HStack gap="2" mb="4" color="fg.muted" fontSize="sm">
                    <Text fontWeight="600">{plan.name}</Text>
                    <Badge variant="subtle" colorPalette={isSelected ? "blue" : "gray"}>
                      {termCount} {termCount === 1 ? "semester" : "semesters"}
                    </Badge>
                  </HStack>
                  <Text fontSize="lg" fontWeight="600">
                    {plan.name}
                  </Text>
                  <Text color="fg.muted" mt="2">
                    {termCount > 0
                      ? "Select this plan to choose a semester."
                      : "This plan does not have any semesters yet."}
                  </Text>
                </Button>
              );
            })}
          </SimpleGrid>
        </Box>

        {selectedPlanId && (
          <Box>
            <Text fontSize="sm" color="fg.muted" mb="3">
              2. Pick a semester
            </Text>
            {(planTerms[selectedPlanId] ?? []).length > 0 ? (
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
                {(planTerms[selectedPlanId] ?? []).map((term) => (
                  <Button
                    key={term.id}
                    size="lg"
                    justifyContent="space-between"
                    variant="outline"
                    colorPalette="blue"
                    borderRadius="xl"
                    onClick={() => handleAddToSelectedPlan(selectedPlanId, term)}
                    loading={addingToSelectedPlan}
                  >
                    {term.season} {term.year}
                  </Button>
                ))}
              </SimpleGrid>
            ) : (
              <Box
                borderWidth="1px"
                borderColor="border.subtle"
                borderRadius="xl"
                p="5"
                bg="bg.subtle"
              >
                <Text fontSize="sm" color="fg.muted">
                  This plan does not have any semesters yet. Add one in the planner first.
                </Text>
              </Box>
            )}
          </Box>
        )}
      </VStack>
    );
  }

  return (
  <Box className="mesh-gradient-subtle">
    {/* Page title only (layout already provides sidebar + top header) */}
    <Box mb="6">
      <Text fontSize="sm" color="fg.muted" fontWeight="500">
        Course Catalog
      </Text>
      <Heading
        size="lg"
        fontFamily="var(--font-dm-sans), sans-serif"
        fontWeight="400"
        letterSpacing="-0.02em"
      >
        All Courses
      </Heading>
    </Box>

    {/* Course Content */}
    <Box>
      <VStack gap="6" align="stretch">
        {/* Course Level Tabs */}
        <Tabs.Root
          value={courseLevel}
          onValueChange={(e) => setCourseLevel(e.value)}
          variant="enclosed"
          colorPalette="blue"
        >
          <Tabs.List bg="bg" borderRadius="lg" p="1">
            <Tabs.Trigger value="undergraduate" px="6">
              <Icon boxSize="4" mr="2">
                <LuBookOpen />
              </Icon>
              Undergraduate
              <Badge
                ml="2"
                colorPalette={courseLevel === "undergraduate" ? "blue" : "gray"}
                variant="solid"
                size="sm"
              >
                {courseCounts.undergraduate}
              </Badge>
            </Tabs.Trigger>
            <Tabs.Trigger value="graduate" px="6">
              <Icon boxSize="4" mr="2">
                <LuGraduationCap />
              </Icon>
              Graduate
              <Badge
                ml="2"
                colorPalette={courseLevel === "graduate" ? "blue" : "gray"}
                variant="solid"
                size="sm"
              >
                {courseCounts.graduate}
              </Badge>
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>

        {/* Filters */}
        <Card.Root
          bg="bg"
          borderRadius="xl"
          borderWidth="1px"
          borderColor="border.subtle"
          className="animate-fade-up"
        >
          <Card.Body p="5">
            <Flex
              direction={{ base: "column", md: "row" }}
              gap="4"
              align={{ base: "stretch", md: "center" }}
            >
              {/* Search Input */}
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
                  pl="10"
                  placeholder="Search courses by code or title..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                  rounded="lg"
                  size="md"
                />
              </Box>

              {/* Subject Select */}
              <Select.Root
                collection={subjectCollection}
                value={filters.subject ? [filters.subject] : []}
                onValueChange={({ value }) =>
                  setFilters({
                    ...filters,
                    subject: value[0] || null,
                  })
                }
                size="md"
                width={{ base: "full", md: "180px" }}
              >
                <Select.HiddenSelect />
                <Select.Control>
                  <Select.Trigger rounded="lg">
                    <Select.ValueText placeholder="All Subjects" />
                  </Select.Trigger>
                  <Select.IndicatorGroup>
                    {filters.subject && <Select.ClearTrigger />}
                    <Select.Indicator />
                  </Select.IndicatorGroup>
                </Select.Control>
                <Portal>
                  <Select.Positioner>
                    <Select.Content>
                      {subjectCollection.items.map((subj) => (
                        <Select.Item item={subj} key={subj.value}>
                          {subj.label}
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
              </Select.Root>
            </Flex>
          </Card.Body>
        </Card.Root>

        {/* Results count */}
        <Text fontSize="sm" color="fg.muted">
          Showing {Math.min((page - 1) * COURSES_PAGE_SIZE + 1, filteredCourses.length)}-
          {Math.min(page * COURSES_PAGE_SIZE, filteredCourses.length)} of{" "}
          {filteredCourses.length} courses
        </Text>

        {/* Course Grid */}
        {filteredCourses.length > 0 ? (
          <>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} gap="4">
              {paginatedCourses.map((course, index) => {
                const colorPalette = getSubjectColor(course.subject);
                const courseCode = `${course.subject} ${course.number}`;
                return (
                  <Card.Root
                    key={course.id}
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
                    cursor="pointer"
                    className="animate-fade-up"
                    style={{ animationDelay: `${Math.min(index, 20) * 0.02}s` }}
                    onClick={() => handleCourseClick(course)}
                    onKeyDown={(event) => handleCourseCardKeyDown(event, course)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open details for ${courseCode}`}
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
                              <LuBookMarked />
                            </Icon>
                          </Box>
                          <Badge colorPalette="gray" variant="subtle" size="sm">
                            {course.credits} cr
                          </Badge>
                        </HStack>

                        <VStack align="start" gap="1">
                          <Text fontWeight="600" fontSize="md">
                            {courseCode}
                          </Text>
                          <Text color="fg.muted" fontSize="sm" lineClamp={2}>
                            {course.title}
                          </Text>
                        </VStack>

                        <Badge
                          colorPalette={colorPalette}
                          variant="surface"
                          size="sm"
                          alignSelf="start"
                        >
                          {course.subject}
                        </Badge>
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                );
              })}
            </SimpleGrid>

            {/* Pagination */}
            {totalPages > 1 && (
              <Flex justify="center" pt="4">
                <Pagination.Root
                  count={filteredCourses.length}
                  pageSize={COURSES_PAGE_SIZE}
                  page={page}
                  onPageChange={(e) => setPage(e.page)}
                  siblingCount={1}
                >
                  <ButtonGroup variant="ghost" size="sm">
                    <Pagination.PrevTrigger asChild>
                      <IconButton aria-label="Previous page">
                        <LuChevronLeft />
                      </IconButton>
                    </Pagination.PrevTrigger>

                    <Pagination.Items
                      render={(pageItem) => (
                        <IconButton
                          aria-label={`Page ${pageItem.value}`}
                          variant={{ base: "ghost", _selected: "outline" }}
                        >
                          {pageItem.value}
                        </IconButton>
                      )}
                    />

                    <Pagination.NextTrigger asChild>
                      <IconButton aria-label="Next page">
                        <LuChevronRight />
                      </IconButton>
                    </Pagination.NextTrigger>
                  </ButtonGroup>
                </Pagination.Root>
              </Flex>
            )}
          </>
        ) : (
          <Card.Root
            bg="bg"
            borderRadius="xl"
            borderWidth="1px"
            borderColor="border.subtle"
            className="animate-fade-up"
          >
            <Card.Body p="12">
              <VStack gap="4" textAlign="center">
                <Box
                  w="16"
                  h="16"
                  bg="gray.subtle"
                  borderRadius="full"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon color="fg.muted" boxSize="8">
                    <LuBookOpen />
                  </Icon>
                </Box>
                <Heading
                  size="md"
                  fontFamily="var(--font-dm-sans), sans-serif"
                  fontWeight="400"
                >
                  No courses found
                </Heading>
                <Text color="fg.muted" fontSize="sm" maxW="sm">
                  {initialCourses.length === 0
                    ? "No courses have been added to the database yet."
                    : "Try adjusting your search or filter criteria to find courses."}
                </Text>
              </VStack>
            </Card.Body>
          </Card.Root>
        )}
      </VStack>
    </Box>

    {/* Course Details Drawer */}
    <Drawer.Root
      open={drawerOpen}
        onOpenChange={(e) => setDrawerOpen(e.open)}
        size="md"
        placement="end"
      >
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              {selectedCourse && (
                <>
                  <Drawer.Header borderBottomWidth="1px" borderColor="border.subtle">
                    <VStack align="start" gap="3" flex="1">
                      <HStack gap="3">
                        <Box
                          w="12"
                          h="12"
                          bg={`${getSubjectColor(selectedCourse.subject)}.subtle`}
                          borderRadius="xl"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Icon
                            color={`${getSubjectColor(selectedCourse.subject)}.fg`}
                            boxSize="6"
                          >
                            <LuBookMarked />
                          </Icon>
                        </Box>
                        <VStack align="start" gap="0">
                          <Drawer.Title
                            fontFamily="var(--font-dm-sans), sans-serif"
                            fontWeight="400"
                            fontSize="xl"
                          >
                            {selectedCourse.subject} {selectedCourse.number}
                          </Drawer.Title>
                          <Badge
                            colorPalette={getSubjectColor(selectedCourse.subject)}
                            variant="surface"
                            size="sm"
                          >
                            {selectedCourse.subject}
                          </Badge>
                        </VStack>
                      </HStack>
                    </VStack>
                    <Drawer.CloseTrigger asChild>
                      <CloseButton size="sm" />
                    </Drawer.CloseTrigger>
                  </Drawer.Header>

                  <Drawer.Body py="6">
                    <VStack align="stretch" gap="6">
                      {/* Course Title */}
                      <Box>
                        <Text fontSize="sm" fontWeight="600" color="fg.muted" mb="2">
                          Course Title
                        </Text>
                        <Text fontSize="lg" fontWeight="500">
                          {selectedCourse.title}
                        </Text>
                      </Box>

                      <Separator />

                      {/* Credits */}
                      <HStack gap="8">
                        <Box>
                          <HStack gap="2" mb="1">
                            <Icon color="fg.muted" boxSize="4">
                              <LuClock />
                            </Icon>
                            <Text fontSize="sm" fontWeight="600" color="fg.muted">
                              Credits
                            </Text>
                          </HStack>
                          <Text fontSize="2xl" fontWeight="700" color="blue.fg">
                            {selectedCourse.credits}
                          </Text>
                        </Box>
                      </HStack>

                      <Separator />

                      {/* Description */}
                      <Box>
                        <Text fontSize="sm" fontWeight="600" color="fg.muted" mb="2">
                          Description
                        </Text>
                        {selectedCourse.description ? (
                          <Text color="fg" lineHeight="tall">
                            {selectedCourse.description}
                          </Text>
                        ) : (
                          <Text color="fg.muted" fontStyle="italic">
                            No description available.
                          </Text>
                        )}
                      </Box>

                      {/* Prerequisites */}
                      {selectedCourse.prereq_text && (
                        <>
                          <Separator />
                          <Box>
                            <HStack gap="2" mb="2">
                              <Icon color="orange.fg" boxSize="4">
                                <LuCircleAlert />
                              </Icon>
                              <Text fontSize="sm" fontWeight="600" color="fg.muted">
                                Prerequisites
                              </Text>
                            </HStack>
                            <Box
                              bg="orange.subtle"
                              borderRadius="lg"
                              p="4"
                              borderWidth="1px"
                              borderColor="orange.muted"
                            >
                              <Text color="orange.fg" fontSize="sm">
                                {selectedCourse.prereq_text}
                              </Text>
                            </Box>
                          </Box>
                        </>
                      )}

                    </VStack>
                  </Drawer.Body>

                  <Drawer.Footer borderTopWidth="1px" borderColor="border.subtle">
                    <HStack gap="2" w="full" justify="flex-end" flexWrap="wrap">
                      <Button
                        size="sm"
                        colorPalette="orange"
                        variant="outline"
                        onClick={handleOpenAddToPlan}
                        loading={loadingPlans}
                      >
                        Add to Plan
                      </Button>
                      <Button
                        size="sm"
                        colorPalette="blue"
                        onClick={handleAddToCurrentSemester}
                        loading={addingToSemester}
                      >
                        Add Class to Current Semester
                      </Button>
                      <Drawer.ActionTrigger asChild>
                        <Button
                          variant="plain"
                          borderRadius="lg"
                          fontWeight="500"
                          fontSize="sm"
                          bg="bg.subtle"
                          _hover={{ bg: "bg.emphasized" }}
                          transition="all 0.15s"
                        >
                          Close
                        </Button>
                      </Drawer.ActionTrigger>
                    </HStack>
                  </Drawer.Footer>
                </>
              )}
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>

      <Dialog.Root open={addToPlanOpen} onOpenChange={(e) => setAddToPlanOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content
              maxW="1100px"
              width="calc(100vw - 2rem)"
              maxH="calc(100vh - 2rem)"
              display="flex"
              flexDirection="column"
              overflow="hidden"
              borderRadius="2xl"
            >
              <Dialog.Header borderBottomWidth="1px" borderColor="border.subtle">
                <VStack align="start" gap="1" flex="1">
                  <Dialog.Title
                    fontFamily="var(--font-dm-sans), sans-serif"
                    fontWeight="400"
                    fontSize="2xl"
                    letterSpacing="-0.02em"
                  >
                    Add Course to Plan
                  </Dialog.Title>
                  {selectedCourse && (
                    <Text color="fg.muted" fontSize="sm">
                      Choose where to add {selectedCourse.subject} {selectedCourse.number}.
                    </Text>
                  )}
                </VStack>
              </Dialog.Header>

              <Dialog.Body overflowY="auto" py="6">
                {renderAddToPlanBody()}
              </Dialog.Body>

              <Dialog.Footer borderTopWidth="1px" borderColor="border.subtle">
                <Dialog.ActionTrigger asChild>
                  <Button variant="ghost">Close</Button>
                </Dialog.ActionTrigger>
              </Dialog.Footer>

              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}
