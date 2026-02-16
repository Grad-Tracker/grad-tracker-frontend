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
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { createClient } from "@/app/utils/supabase/client";

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
  course_id: number;
  grade: string | null;
  completed: boolean | null;
};

export default function GenEdRequirements({ studentId }: { studentId: number }) {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [bucketCourses, setBucketCourses] = useState<BucketCourseRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [coursesById, setCoursesById] = useState<Map<number, Course>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        // 1) Buckets
        const { data: bucketsData, error: bucketsErr } = await supabase
          .from("gen_ed_buckets")
          .select("id, code, name, credits_required")
          .order("id", { ascending: true });

        if (bucketsErr) throw new Error(`Error loading buckets: ${bucketsErr.message}`);
        if (cancelled) return;

        const bucketList = (bucketsData ?? []) as Bucket[];
        setBuckets(bucketList);

        // 2) Bucket -> course mappings
        const { data: mapData, error: mapErr } = await supabase
          .from("gen_ed_bucket_courses")
          .select("bucket_id, course_id");

        if (mapErr) throw new Error(`Error loading bucket courses: ${mapErr.message}`);
        if (cancelled) return;

        const mappings = (mapData ?? []) as BucketCourseRow[];
        setBucketCourses(mappings);

        // Collect all Gen Ed course IDs
        const allCourseIds = Array.from(
          new Set(
            mappings.map((m) => Number(m.course_id)).filter((n) => Number.isFinite(n))
          )
        );

        // 3) Student history
        const { data: historyData, error: historyErr } = await supabase
          .from("student_course_history")
          .select("course_id, grade, completed")
          .eq("student_id", studentId);

        if (historyErr) throw new Error(`Error loading history: ${historyErr.message}`);
        if (cancelled) return;

        setHistory((historyData ?? []) as HistoryRow[]);

        // 4) Course details
        if (allCourseIds.length > 0) {
          const { data: coursesData, error: coursesErr } = await supabase
            .from("courses")
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
        .map((h) => Number(h.course_id))
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
            fontFamily="'DM Serif Display', serif"
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
                  <Flex justify="space-between" align="start" gap="3">
                    <Box>
                      <HStack gap="2" wrap="wrap">
                        <Heading size="md">{b.name}</Heading>
                        <Badge colorPalette="green" variant="subtle">
                          {b.code}
                        </Badge>
                      </HStack>
                      <Text mt="1" fontSize="sm" color="fg.muted">
                        Completed <strong>{b.completedCredits}</strong> / {b.credits_required} credits{" "}
                        · Remaining <strong>{b.remaining}</strong>
                      </Text>
                    </Box>

                    <Badge colorPalette={b.remaining === 0 ? "green" : "gray"} variant="surface">
                      {b.remaining === 0 ? "Done" : "In progress"}
                    </Badge>
                  </Flex>

                  {/* Chakra v3 Progress (your version uses Range, not Indicator) */}
                  <Progress.Root value={b.pct} max={100} colorPalette="green" size="sm">
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
                        {b.detailed.map(({ course, completed }) => (
                          <HStack
                            key={course.id}
                            justify="space-between"
                            py="1"
                            px="2"
                            borderRadius="md"
                            _hover={{ bg: "bg.subtle" }}
                          >
                            <HStack gap="3">
                              <Text>{completed ? "✅" : "⬜"}</Text>
                              <Box>
                                <Text fontWeight="600" fontSize="sm">
                                  {(course.subject ?? "").toString()} {(course.number ?? "").toString()}
                                  {course.credits != null ? ` · ${course.credits} cr` : ""}
                                </Text>
                                {course.title ? (
                                  <Text fontSize="sm" color="fg.muted" lineClamp={1}>
                                    {course.title}
                                  </Text>
                                ) : null}
                              </Box>
                            </HStack>

                            <Text fontSize="xs" color="fg.muted">
                              id: {course.id}
                            </Text>
                          </HStack>
                        ))}
                      </VStack>
                    )}
                  </Box>
                </VStack>
              </Card.Body>
            </Card.Root>
          ))}
        </VStack>
      </VStack>
    </Box>
  );
}