"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Card,
  Flex,
  Heading,
  HStack,
  Progress,
  Separator,
  Separator as Divider,
  Text,
  VStack,
} from "@chakra-ui/react";
import { evaluatePrereqsForCourses, type PrereqEvaluationMap } from "@/lib/prereq";
import {
  fetchGenEdBucketsWithCourses,
  fetchStudentCourseProgress,
} from "@/lib/supabase/queries/planner";

type Course = {
  id: number;
  subject: string | null;
  number: string | null;
  title: string | null;
  credits: number | null;
};

type Bucket = {
  id: number;
  code: string;
  name: string;
  credits_required: number;
  courses: Course[];
};

function sortByCode(a: Course, b: Course) {
  const aSubject = (a.subject ?? "").toString();
  const bSubject = (b.subject ?? "").toString();
  if (aSubject !== bSubject) return aSubject.localeCompare(bSubject);
  const aNumber = (a.number ?? "").toString();
  const bNumber = (b.number ?? "").toString();
  return aNumber.localeCompare(bNumber);
}

export default function GenEdRequirements({ studentId }: { studentId: number }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [completedCourseIds, setCompletedCourseIds] = useState<Set<number>>(new Set());
  const [prereqByCourse, setPrereqByCourse] = useState<PrereqEvaluationMap>(new Map());
  const [showRemaining, setShowRemaining] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const [bucketRows, progressRows] = await Promise.all([
          fetchGenEdBucketsWithCourses(),
          fetchStudentCourseProgress(studentId),
        ]);

        if (cancelled) return;

        const normalizedBuckets: Bucket[] = bucketRows.map((b) => ({
          id: Number(b.id),
          code: String(b.code),
          name: String(b.name),
          credits_required: Number(b.credits_required ?? 0),
          courses: (b.courses ?? []).map((c) => ({
            id: Number(c.id),
            subject: c.subject ?? null,
            number: c.number ?? null,
            title: c.title ?? null,
            credits: c.credits == null ? null : Number(c.credits),
          })),
        }));

        setBuckets(normalizedBuckets);

        const completed = new Set<number>(
          progressRows
            .filter(
              (r) =>
                r.completed === true ||
                String(r.progress_status ?? "").toUpperCase() === "COMPLETED"
            )
            .map((r) => Number(r.course_id))
            .filter((id) => Number.isFinite(id))
        );
        setCompletedCourseIds(completed);

        const allCourseIds = Array.from(
          new Set(normalizedBuckets.flatMap((b) => b.courses.map((c) => c.id)))
        );
        const prereqMap = await evaluatePrereqsForCourses(allCourseIds, studentId);
        if (cancelled) return;
        setPrereqByCourse(prereqMap);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const computeStatus = useMemo(
    () =>
      (courseId: number) =>
        completedCourseIds.has(courseId)
          ? ("completed" as const)
          : ("remaining" as const),
    [completedCourseIds]
  );

  const splitCourses = useMemo(
    () =>
      (requiredCourses: Course[]) => {
        const completedCourses = requiredCourses
          .filter((c) => computeStatus(c.id) === "completed")
          .sort(sortByCode);
        const inProgressCourses: Course[] = [];
        const remainingCourses = requiredCourses
          .filter((c) => computeStatus(c.id) === "remaining")
          .sort(sortByCode);

        return { completedCourses, inProgressCourses, remainingCourses };
      },
    [computeStatus]
  );

  const bucketsWithProgress = useMemo(() => {
    return buckets.map((b) => {
      const detailed = (b.courses ?? [])
        .map((course) => ({ course, completed: completedCourseIds.has(course.id) }))
        .sort((a, d) => {
          const s1 = a.course.subject ?? "";
          const s2 = d.course.subject ?? "";
          if (s1 !== s2) return s1.localeCompare(s2);
          const n1 = a.course.number ?? "";
          const n2 = d.course.number ?? "";
          return n1.localeCompare(n2);
        });

      let completedCredits = 0;
      for (const item of detailed) {
        if (item.completed) completedCredits += item.course.credits ?? 0;
      }

      const required = b.credits_required ?? 0;
      const pct = required > 0 ? Math.min(100, (completedCredits / required) * 100) : 0;
      const remaining = Math.max(0, required - completedCredits);

      return {
        ...b,
        detailed,
        completedCredits,
        remaining,
        pct,
      };
    });
  }, [buckets, completedCourseIds]);

  useEffect(() => {
    setShowRemaining((prev) => {
      const next = { ...prev };
      for (const b of bucketsWithProgress) {
        const key = String(b.id);
        if (next[key] === undefined) next[key] = false;
      }
      return next;
    });
  }, [bucketsWithProgress]);

  if (loading) {
    return (
      <Box px={{ base: "4", md: "8" }} py="8">
        <HStack gap="3">
          <Spinner />
          <Text color="fg.muted">Loading Gen Ed requirements...</Text>
        </HStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box px={{ base: "4", md: "8" }} py="8">
        <Card.Root borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
          <Card.Body>
            <Text fontWeight="600" color="red.fg">
              {error}
            </Text>
          </Card.Body>
        </Card.Root>
      </Box>
    );
  }

  return (
    <Box px={{ base: "4", md: "8" }} py="6">
      <VStack align="stretch" gap="5">
        <Box>
          <Text fontSize="sm" color="fg.muted" fontWeight="500">
            Requirements
          </Text>
          <Heading
            size="lg"
            fontFamily="var(--font-dm-sans), sans-serif"
            fontWeight="400"
            letterSpacing="-0.02em"
          >
            Gen Ed Requirements
          </Heading>
        </Box>

        <VStack align="stretch" gap="4">
          {bucketsWithProgress.map((b) => (
            <Card.Root
              key={b.id}
              bg="bg"
              borderRadius="xl"
              borderWidth="1px"
              borderColor="border.subtle"
            >
              <Card.Body p="5">
                <VStack align="stretch" gap="3">
                  {(() => {
                    const sectionedCourses = b.detailed.map((item) => item.course);
                    const { completedCourses, inProgressCourses, remainingCourses } =
                      splitCourses(sectionedCourses);
                    const completedCount = completedCourses.length;
                    const inProgressCount = inProgressCourses.length;
                    const remainingCount = remainingCourses.length;
                    const completedCredits = completedCourses.reduce(
                      (sum, course) => sum + Number(course.credits ?? 0),
                      0
                    );
                    const inProgressCredits = inProgressCourses.reduce(
                      (sum, course) => sum + Number(course.credits ?? 0),
                      0
                    );
                    const remainingCredits = remainingCourses.reduce(
                      (sum, course) => sum + Number(course.credits ?? 0),
                      0
                    );
                    const bucketKey = String(b.id);
                    const isRemainingOpen = !!showRemaining[bucketKey];

                    const renderCourseRow = (course: Course) => {
                      const completed = computeStatus(course.id) === "completed";
                      const prereq = prereqByCourse.get(course.id);
                      const showPrereqWarning =
                        !completed && prereq != null && !prereq.unlocked;

                      return (
                        <HStack
                          key={course.id}
                          justify="space-between"
                          py="1"
                          px="2"
                          borderRadius="md"
                          border={completed ? "1px solid" : undefined}
                          borderWidth="1px"
                          boxShadow={
                            completed ? "0 0 0 1px color-mix(in srgb, var(--chakra-colors-blue-500) 25%, transparent)" : undefined
                          }
                          bg={completed ? "blue.700" : "bg.subtle"}
                          borderColor={completed ? "blue.500" : "border.subtle"}
                          _hover={{ bg: completed ? "blue.600" : "bg.subtle" }}
                        >
                          <HStack gap="3">
                            <Box>
                              <Text
                                fontWeight={completed ? "bold" : "600"}
                                fontSize="sm"
                                color={completed ? "white" : undefined}
                              >
                                {(course.subject ?? "").toString()} {(course.number ?? "").toString()}
                                {course.credits != null ? ` · ${course.credits} cr` : ""}
                              </Text>
                              {course.title ? (
                                <Text
                                  fontSize="sm"
                                  color={completed ? "whiteAlpha.900" : "fg.subtle"}
                                  fontWeight={completed ? "bold" : "500"}
                                  lineClamp={1}
                                >
                                  {course.title}
                                </Text>
                              ) : null}
                              {showPrereqWarning && prereq.summary.length > 0 ? (
                                <Text fontSize="xs" color="orange.600" fontWeight="400">
                                  {prereq.summary.join("  ")}
                                </Text>
                              ) : null}
                            </Box>
                          </HStack>

                          <HStack gap="2">
                            {showPrereqWarning ? (
                              <Badge colorPalette="orange" variant="subtle" size="sm">
                                Prereq not met
                              </Badge>
                            ) : null}
                          </HStack>
                        </HStack>
                      );
                    };

                    return (
                      <>
                  <Flex justify="space-between" align="start" gap="3">
                    <Box>
                      <HStack gap="2" wrap="wrap">
                        <Heading size="md">{b.name}</Heading>
                        <Badge colorPalette="blue" variant="subtle">
                          {b.code}
                        </Badge>
                      </HStack>
                    </Box>

                    <Badge colorPalette={b.remaining === 0 ? "blue" : "gray"} variant="surface">
                      {b.remaining === 0 ? "Done" : "In progress"}
                    </Badge>
                  </Flex>

                  <HStack gap="2" wrap="wrap">
                    <Badge colorPalette="blue" variant="subtle">
                      Completed ({completedCount}) â¢ {completedCredits} cr
                    </Badge>
                    <Badge colorPalette="orange" variant="subtle">
                      In progress ({inProgressCount}) â¢ {inProgressCredits} cr
                    </Badge>
                    <Badge colorPalette="gray" variant="outline">
                      Remaining ({remainingCount}) â¢ {remainingCredits} cr
                    </Badge>
                  </HStack>

                  <Progress.Root value={b.pct} max={100} colorPalette="blue" size="sm">
                    <Progress.Track borderRadius="md">
                      <Progress.Range borderRadius="md" />
                    </Progress.Track>
                  </Progress.Root>

                  <Separator />

                  <Box>
                    <Text fontSize="sm" fontWeight="600" color="fg.muted" mb="2">
                      Courses in this bucket
                    </Text>

                    {b.detailed.length === 0 ? (
                      <Text color="fg.muted" fontSize="sm">
                        No courses found for this bucket.
                      </Text>
                    ) : (
                      <VStack align="stretch" gap="1">
                        {completedCourses.length > 0 ? (
                          <>
                            <Divider opacity={0.4} mt="3" mb="2" />
                            <HStack justify="space-between" mt="3" mb="2">
                              <Text fontSize="sm" fontWeight="600" color="fg.muted">
                                Completed
                              </Text>
                              <Badge variant="subtle" colorPalette="blue">
                                {completedCourses.length}
                              </Badge>
                            </HStack>
                          {completedCourses.map(renderCourseRow)}
                          </>
                        ) : null}
                              {inProgressCourses.length > 0 ? (
                                <>
                                  <Divider opacity={0.4} mt="3" mb="2" />
                                  <HStack justify="space-between" mt="3" mb="2">
                                    <Text fontSize="sm" fontWeight="600" color="fg.muted">
                                      In progress
                                    </Text>
                                    <Badge variant="subtle" colorPalette="orange">
                                      {inProgressCourses.length}
                                    </Badge>
                                  </HStack>
                                  {inProgressCourses.map(renderCourseRow)}
                                </>
                              ) : null}

                              {remainingCourses.length > 0 ? (
                                <>
                                  <Divider opacity={0.4} mt="3" mb="2" />
                                  <HStack justify="flex-end" align="center" mt="3" mb="2">
                                    <Text
                                      fontSize="sm"
                                      color="fg.muted"
                                      cursor="pointer"
                                      onClick={() =>
                                        setShowRemaining((prev) => ({
                                          ...prev,
                                          [bucketKey]: !prev[bucketKey],
                                        }))
                                      }
                                    >
                                      {isRemainingOpen
                                        ? "Hide remaining"
                                        : `Show remaining (${remainingCourses.length})`}
                                    </Text>
                                  </HStack>
                                  {isRemainingOpen ? remainingCourses.map(renderCourseRow) : null}
                                </>
                              ) : null}
                            </VStack>
                          )}
                        </Box>
                      </>
                    );
                  })()}
                </VStack>
              </Card.Body>
            </Card.Root>
          ))}
        </VStack>
      </VStack>
    </Box>
  );
}