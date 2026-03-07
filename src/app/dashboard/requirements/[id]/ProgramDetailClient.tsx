"use client";

import { useState } from "react";
import {
  Badge,
  Box,
  Card,
  CloseButton,
  Drawer,
  Heading,
  HStack,
  Icon,
  Portal,
  Separator,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import {
  LuArrowLeft,
  LuBookMarked,
  LuCircleAlert,
  LuClock,
} from "react-icons/lu";
import type { Course } from "@/types/course";
import { BREADTH_PACKAGES, getPackageCourseKeys, courseKey } from "@/types/planner";

interface Program {
  id: string;
  name: string;
  catalog_year: string | null;
  program_type: string;
}

interface Block {
  id: string;
  name: string;
  rule: string;
  n_required: number | null;
  credits_required: number | null;
  courses: Course[];
  options: Course[][] | null;
  crossPairs: number[][];
}

interface ProgramDetailClientProps {
  program: Program;
  blocks: Block[];
}

function getProgramColor(type: string): string {
  const colorMap: Record<string, string> = {
    MAJOR: "blue",
    MINOR: "purple",
    GRADUATE: "green",
    CERTIFICATE: "orange",
  };
  return colorMap[type] || "gray";
}

function getProgramTypeLabel(type: string): string {
  const labelMap: Record<string, string> = {
    MAJOR: "Major",
    MINOR: "Minor",
    GRADUATE: "Graduate",
    CERTIFICATE: "Certificate",
  };
  return labelMap[type] || type;
}

function getSubjectColor(subject: string): string {
  const colorMap: Record<string, string> = {
    CS: "green",
    CSCI: "green",
    MATH: "blue",
    ENGL: "purple",
    COMM: "orange",
    PHIL: "teal",
    PSYC: "pink",
    BUSI: "cyan",
    BIOL: "emerald",
    CHEM: "orange",
    PHYS: "blue",
    HIST: "yellow",
    ECON: "cyan",
    ART: "red",
    MUSC: "purple",
    SOCI: "pink",
  };
  return colorMap[subject] || "gray";
}

function isBreadthBlock(blockName: string): boolean {
  return /breadth/i.test(blockName);
}

function CourseTable({
  courses,
  onCourseClick,
  crossPairs = [],
}: {
  courses: Course[];
  onCourseClick: (course: Course) => void;
  crossPairs?: number[][];
}) {
  // Map every course id to its full cross-pair group
  const groupByCourseId = new Map<number, number[]>();
  for (const group of crossPairs) {
    for (const id of group) groupByCourseId.set(id, group);
  }

  // Ids that are non-primary in a cross-pair (skip rendering separately)
  const skipIds = new Set<number>();
  for (const group of crossPairs) {
    group.slice(1).forEach((id) => skipIds.add(id));
  }

  const courseById = new Map(courses.map((c) => [c.id, c]));

  return (
    <Table.Root size="sm" interactive>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Course</Table.ColumnHeader>
          <Table.ColumnHeader>Title</Table.ColumnHeader>
          <Table.ColumnHeader textAlign="end">Credits</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {courses
          .filter((c) => !skipIds.has(c.id))
          .map((course) => {
            const group = groupByCourseId.get(course.id);
            const alts = group
              ? group.slice(1).map((id) => courseById.get(id)).filter(Boolean) as Course[]
              : [];
            const color = getSubjectColor(course.subject);

            return (
              <Table.Row
                key={course.id}
                onClick={() => onCourseClick(course)}
                cursor="pointer"
              >
                <Table.Cell>
                  <HStack gap="1.5" wrap="wrap">
                    <Badge colorPalette={color} variant="surface" size="sm" fontFamily="mono">
                      {course.subject} {course.number}
                    </Badge>
                    {alts.map((alt) => (
                      <>
                        <Text key={`or-${alt.id}`} fontSize="xs" color="fg.muted" fontStyle="italic">
                          or
                        </Text>
                        <Badge
                          key={alt.id}
                          colorPalette={getSubjectColor(alt.subject)}
                          variant="surface"
                          size="sm"
                          fontFamily="mono"
                          cursor="pointer"
                          onClick={(e) => { e.stopPropagation(); onCourseClick(alt); }}
                        >
                          {alt.subject} {alt.number}
                        </Badge>
                      </>
                    ))}
                  </HStack>
                </Table.Cell>
                <Table.Cell color="fg.muted">{course.title}</Table.Cell>
                <Table.Cell textAlign="end" color="fg.muted">
                  {course.credits}
                </Table.Cell>
              </Table.Row>
            );
          })}
      </Table.Body>
    </Table.Root>
  );
}

function OptionGroupView({
  options,
  onCourseClick,
  crossPairs,
}: {
  options: Course[][];
  onCourseClick: (course: Course) => void;
  crossPairs?: number[][];
}) {
  return (
    <VStack align="stretch" gap="0">
      {options.map((group, i) => {
        const totalCredits = group.reduce((sum, c) => sum + Number(c.credits), 0);
        return (
          <Box key={i}>
            {i > 0 && (
              <HStack my="3">
                <Separator flex="1" />
                <Badge variant="outline" size="sm" colorPalette="gray">
                  OR
                </Badge>
                <Separator flex="1" />
              </HStack>
            )}
            <HStack justify="space-between" mb="1.5">
              <Text fontSize="xs" fontWeight="600" color="fg.muted" textTransform="uppercase" letterSpacing="0.05em">
                Option {String.fromCharCode(65 + i)}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {totalCredits} credits total
                {group.length > 1 && " · must take all"}
              </Text>
            </HStack>
            <CourseTable courses={group} onCourseClick={onCourseClick} crossPairs={crossPairs} />
          </Box>
        );
      })}
    </VStack>
  );
}

function BreadthPackageView({
  courses,
  onCourseClick,
  crossPairs,
}: {
  courses: Course[];
  onCourseClick: (course: Course) => void;
  crossPairs?: number[][];
}) {
  return (
    <VStack align="stretch" gap="5">
      {BREADTH_PACKAGES.map((pkg, i) => {
        const pkgKeys = getPackageCourseKeys(pkg);
        const pkgCourses = courses.filter((c) => pkgKeys.has(courseKey(c)));
        if (pkgCourses.length === 0) return null;

        return (
          <Box key={pkg.id}>
            {i > 0 && <Separator mb="5" />}
            <HStack gap="2" mb="2" align="baseline">
              <Text fontWeight="600" fontSize="sm">
                {pkg.name}
              </Text>
              <Text color="fg.muted" fontSize="xs">
                — {pkg.description}
              </Text>
              <Badge colorPalette="gray" variant="subtle" size="sm" ml="auto">
                {pkg.totalCreditsRequired} cr
              </Badge>
            </HStack>
            <Box pl="4" borderLeftWidth="2px" borderColor="border.subtle">
              <CourseTable courses={pkgCourses} onCourseClick={onCourseClick} crossPairs={crossPairs} />
            </Box>
          </Box>
        );
      })}
    </VStack>
  );
}

function getRuleLabel(block: Block): string {
  switch (block.rule) {
    case "ALL_OF":
      return "Complete all of the following";
    case "ANY_OF":
      return "Choose any from the following";
    case "N_OF":
      return `Complete ${block.n_required} of the following`;
    case "CREDITS_OF":
      return `Complete ${block.credits_required} credits from the following`;
    default:
      return block.rule;
  }
}

export default function ProgramDetailClient({
  program,
  blocks,
}: ProgramDetailClientProps) {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const colorPalette = getProgramColor(program.program_type);

  const handleCourseClick = (course: Course) => {
    setSelectedCourse(course);
    setDrawerOpen(true);
  };

  return (
    <Box className="mesh-gradient-subtle">
      <VStack align="stretch" gap="6">
        {/* Back link */}
        <Box>
          <Link href="/dashboard/requirements">
            <HStack
              gap="1"
              color="fg.muted"
              _hover={{ color: "fg" }}
              transition="color 0.15s"
              display="inline-flex"
              fontSize="sm"
            >
              <Icon boxSize="4">
                <LuArrowLeft />
              </Icon>
              <Text>All Programs</Text>
            </HStack>
          </Link>
        </Box>

        {/* Header */}
        <VStack align="start" gap="3" className="animate-fade-up">
          <HStack gap="2">
            <Badge colorPalette={colorPalette} variant="surface" size="sm">
              {getProgramTypeLabel(program.program_type)}
            </Badge>
            {program.catalog_year && (
              <Badge colorPalette="gray" variant="subtle" size="sm">
                {program.catalog_year}
              </Badge>
            )}
          </HStack>
          <Heading
            size="2xl"
            fontFamily="var(--font-outfit), sans-serif"
            fontWeight="400"
            letterSpacing="-0.02em"
          >
            {program.name}
          </Heading>
          <Text color="fg.muted" fontStyle="italic" fontSize="sm">
            Description coming soon.
          </Text>
        </VStack>

        {/* Requirements */}
        <Box>
          <Heading
            size="md"
            fontFamily="var(--font-outfit), sans-serif"
            fontWeight="500"
            mb="4"
          >
            Requirements
          </Heading>

          <VStack align="stretch" gap="4">
            {blocks.length === 0 ? (
              <Card.Root
                bg="bg"
                borderRadius="xl"
                borderWidth="1px"
                borderColor="border.subtle"
              >
                <Card.Body p="8">
                  <Text color="fg.muted" textAlign="center" fontSize="sm">
                    No requirement blocks found for this program.
                  </Text>
                </Card.Body>
              </Card.Root>
            ) : (
              blocks.map((block, index) => {
                const courses = block.courses;

                return (
                  <Card.Root
                    key={block.id}
                    bg="bg"
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    className="animate-fade-up"
                    style={{
                      animationDelay: `${Math.min(index, 20) * 0.05}s`,
                    }}
                  >
                    <Card.Header pb="2">
                      <VStack align="start" gap="0.5">
                        <Text fontWeight="600" fontSize="md">
                          {block.name}
                        </Text>
                        <Text color="fg.muted" fontSize="sm">
                          {getRuleLabel(block)}
                        </Text>
                      </VStack>
                    </Card.Header>
                    <Card.Body pt="2">
                      {courses.length === 0 ? (
                        <Text color="fg.muted" fontSize="sm" fontStyle="italic">
                          No courses listed for this requirement.
                        </Text>
                      ) : block.options ? (
                        <OptionGroupView
                          options={block.options}
                          onCourseClick={handleCourseClick}
                          crossPairs={block.crossPairs}
                        />
                      ) : isBreadthBlock(block.name) ? (
                        <BreadthPackageView
                          courses={courses}
                          onCourseClick={handleCourseClick}
                          crossPairs={block.crossPairs}
                        />
                      ) : (
                        <CourseTable
                          courses={courses}
                          onCourseClick={handleCourseClick}
                          crossPairs={block.crossPairs}
                        />
                      )}
                    </Card.Body>
                  </Card.Root>
                );
              })
            )}
          </VStack>
        </Box>
      </VStack>

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
                            fontFamily="var(--font-outfit), sans-serif"
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
                      <Box>
                        <Text fontSize="sm" fontWeight="600" color="fg.muted" mb="2">
                          Course Title
                        </Text>
                        <Text fontSize="lg" fontWeight="500">
                          {selectedCourse.title}
                        </Text>
                      </Box>

                      <Separator />

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
                          <Text fontSize="2xl" fontWeight="700" color="green.fg">
                            {selectedCourse.credits}
                          </Text>
                        </Box>
                      </HStack>

                      <Separator />

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
