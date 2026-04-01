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
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { createClient } from "@/app/utils/supabase/client";
import { evaluatePrereqsForCourses, type PrereqEvaluationMap } from "@/lib/prereq";
import { DB_TABLES } from "@/lib/supabase/queries/schema";
type Bucket = {
  id: number;
  code: string;
  name: string;
  credits_required: number;
};

type Course = {
  id: number;
  subject: string | null;
  number: string | null;
  title: string | null;
  credits: number | null;
};

type BucketCourseRow = {
  bucket_id: number;
  course_id: number;
};

type HistoryRow = {
  course_id: number;              // <-- matches table column name: "course"
  grade: string | null;
  completed: boolean | null;
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
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [bucketCourses, setBucketCourses] = useState<BucketCourseRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [coursesById, setCoursesById] = useState<Map<number, Course>>(new Map());
  const [prereqByCourse, setPrereqByCourse] = useState<PrereqEvaluationMap>(new Map());
  const [showRemaining, setShowRemaining] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        // 1) Buckets
        const { data: bucketsData, error: bucketsErr } = await supabase
          .from(DB_TABLES.genEdBuckets)
          .select("id, code, name, credits_required")
          .order("id", { ascending: true });

        if (bucketsErr) throw new Error(`Error loading buckets: ${bucketsErr.message}`);
        if (cancelled) return;

        const bucketList = (bucketsData ?? []) as Bucket[];
        setBuckets(bucketList);

        // 2) Bucket -> course mappings
        const { data: mapData, error: mapErr } = await supabase
          .from(DB_TABLES.genEdBucketCourses)
          .select("bucket_id, course_id");

        if (mapErr) throw new Error(`Error loading bucket courses: ${mapErr.message}`);
        if (cancelled) return;

        const mappings = (mapData ?? []) as BucketCourseRow[];
        setBucketCourses(mappings);

        const allCourseIds = Array.from(
          new Set(mappings.map((m) => Number(m.course_id)).filter((n) => Number.isFinite(n)))
        );

        // 3) Student history (IMPORTANT: column is "course", not "course_id")
        const { data: historyData, error: historyErr } = await supabase
          .from(DB_TABLES.studentCourseHistory)
          .select("course_id, grade, completed")
          .eq("student_id", studentId);

        if (historyErr) throw new Error(`Error loading history: ${historyErr.message}`);
        if (cancelled) return;

        setHistory((historyData ?? []) as HistoryRow[]);

        // 4) Course details
        if (allCourseIds.length > 0) {
          const { data: coursesData, error: coursesErr } = await supabase
            .from(DB_TABLES.courses)
            .select("id, subject, number, title, credits")
            .in("id", allCourseIds);

          if (coursesErr) throw new Error(`Error loading courses: ${coursesErr.message}`);
          if (cancelled) return;

          const map = new Map<number, Course>();
          (coursesData ?? []).forEach((c: any) => {
            map.set(Number(c.id), {
              id: Number(c.id),
              subject: c.subject ?? null,
              number: c.number ?? null,
              title: c.title ?? null,
              credits: c.credits == null ? null : Number(c.credits),
            });
          });

          setCoursesById(map);
        } else {
          setCoursesById(new Map());
        }

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
  }, [supabase, studentId]);

  const completedCourseIds = useMemo(() => {
    return new Set<number>(
      (history ?? [])
        .filter((h) => h.completed === true || (h.grade && String(h.grade).trim() !== ""))
        .map((h) => Number(h.course_id)) // <-- use "course"
    );
  }, [history]);

  const bucketToCourseIds = useMemo(() => {
    const map = new Map<number, number[]>();
    (bucketCourses ?? []).forEach((row) => {
      const bId = Number(row.bucket_id);
      const cId = Number(row.course_id);
      if (!Number.isFinite(bId) || !Number.isFinite(cId)) return;
      if (!map.has(bId)) map.set(bId, []);
      map.get(bId)!.push(cId);
    });
    return map;
  }, [bucketCourses]);

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
    return (buckets ?? []).map((b) => {
      const courseIds = bucketToCourseIds.get(b.id) ?? [];

      const detailed = courseIds
        .map((id) => coursesById.get(id))
        .filter(Boolean)
        .map((course) => {
          const c = course as Course;
          return { course: c, completed: completedCourseIds.has(c.id) };
        })
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
  }, [buckets, bucketToCourseIds, coursesById, completedCourseIds]);

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
          <Text color="fg.muted">Loading Gen Ed requirements…</Text>
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
            fontFamily="var(--font-outfit), sans-serif"
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
                            completed ? "0 0 0 1px rgba(59,130,246,0.25)" : undefined
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
                                  {prereq.summary.join(" • ")}
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
                      Completed ({completedCount}) • {completedCredits} cr
                    </Badge>
                    <Badge colorPalette="orange" variant="subtle">
                      In progress ({inProgressCount}) • {inProgressCredits} cr
                    </Badge>
                    <Badge colorPalette="gray" variant="outline">
                      Remaining ({remainingCount}) • {remainingCredits} cr
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
