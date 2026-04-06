"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  ButtonGroup,
  Card,
  Circle,
  CloseButton,
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
  Tabs,
  Text,
  VStack,
  createListCollection,
} from "@chakra-ui/react";
import { Select } from "@chakra-ui/react";
import Link from "next/link";
import { ColorModeButton } from "@/components/ui/color-mode";
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

const PAGE_SIZE = 52;

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

export default function CoursesClient({
  initialCourses,
  subjects,
}: CoursesClientProps) {
  const [filters, setFilters] = useState<CourseFilters>({
    search: "",
    subject: null,
  });
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [courseLevel, setCourseLevel] = useState<string>("undergraduate");
  const [page, setPage] = useState(1);

  const handleCourseClick = (course: Course) => {
    setSelectedCourse(course);
    setDrawerOpen(true);
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
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredCourses.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredCourses, page]);

  const totalPages = Math.ceil(filteredCourses.length / PAGE_SIZE);

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
          Showing {Math.min((page - 1) * PAGE_SIZE + 1, filteredCourses.length)}-
          {Math.min(page * PAGE_SIZE, filteredCourses.length)} of{" "}
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
                  pageSize={PAGE_SIZE}
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
                    <Drawer.ActionTrigger asChild>
                      <Box
                        as="button"
                        px="4"
                        py="2"
                        borderRadius="lg"
                        fontWeight="500"
                        fontSize="sm"
                        bg="bg.subtle"
                        _hover={{ bg: "bg.emphasized" }}
                        transition="all 0.15s"
                      >
                        Close
                      </Box>
                    </Drawer.ActionTrigger>
                  </Drawer.Footer>
                </>
              )}
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </Box>
  );
}