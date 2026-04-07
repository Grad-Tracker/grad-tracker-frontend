"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Spinner, Stack, Heading } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";
import { DB_VIEWS } from "@/lib/supabase/queries/schema";
import {
  fetchDefaultTermId,
  fetchMajorRequirementCourses,
  fetchStudentCourseHistory,
  insertCourseHistory,
  deleteCourseHistory,
  type StudentCourseHistoryRow,
  type MajorWithRequirements,
} from "@/lib/supabase/queries/classHistory";
import { fetchGenEdBucketsWithCourses } from "@/lib/supabase/queries/planner";
import type { GenEdBucketWithCourses } from "@/types/auto-generate";
import type { CourseRow } from "@/types/onboarding";
import { GenEdChecklist } from "./GenEdChecklist";
import { MajorChecklist } from "./MajorChecklist";
import { AdditionalCourses } from "./AdditionalCourses";

function getCourseActivityLabel(course: CourseRow): string {
  return `${course.subject} ${course.number}`;
}

export function ClassHistoryTab() {
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [defaultTermId, setDefaultTermId] = useState<number | null>(null);
  const [buckets, setBuckets] = useState<GenEdBucketWithCourses[]>([]);
  const [major, setMajor] = useState<MajorWithRequirements | null>(null);
  const [history, setHistory] = useState<StudentCourseHistoryRow[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: student } = await supabase
          .from(DB_VIEWS.studentProfile)
          .select("student_id")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (!student) return;

        const sid = Number((student as { student_id: number }).student_id);
        setStudentId(sid);

        const [termId, genEdData, majorData, historyData] = await Promise.all([
          fetchDefaultTermId(),
          fetchGenEdBucketsWithCourses(),
          fetchMajorRequirementCourses(sid),
          fetchStudentCourseHistory(sid),
        ]);

        setDefaultTermId(termId);
        setBuckets(genEdData);
        setMajor(majorData);
        setHistory(historyData);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        toaster.create({ title: "Failed to load course history", description: msg, type: "error" });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Compute completed course ID set (memoized)
  const completedCourseIds = useMemo(() => new Set(history.map((h) => h.course_id)), [history]);

  // Compute "known" IDs (gen ed + major) to derive additional courses (memoized)
  const knownCourseIds = useMemo(() => {
    const ids = new Set<number>();
    for (const bucket of buckets) {
      for (const c of bucket.courses) ids.add(c.id);
    }
    if (major) {
      for (const block of major.blocks) {
        for (const c of block.courses) ids.add(c.id);
      }
    }
    return ids;
  }, [buckets, major]);

  const additionalCourses = useMemo(
    () => history.filter((h) => !knownCourseIds.has(h.course_id)).map((h) => h.course),
    [history, knownCourseIds]
  );

  // --- Mutation callbacks ---

  const handleToggle = useCallback(
    async (courseId: number, checked: boolean) => {
      if (!studentId || !defaultTermId) return;

      // Capture existing row before optimistic update (for delete path)
      const existingRow = !checked
        ? history.find((h) => h.course_id === courseId)
        : undefined;
      const existingCourse = existingRow?.course ?? findCourseById(courseId, buckets, major);

      // Optimistic update
      if (checked) {
        setHistory((prev) => [
          ...prev,
          {
            course_id: courseId,
            term_id: defaultTermId,
            completed: true,
            course: findCourseById(courseId, buckets, major) ?? {
              id: courseId,
              subject: "",
              number: "",
              title: "",
              credits: 0,
            },
          },
        ]);
      } else {
        setHistory((prev) => prev.filter((h) => h.course_id !== courseId));
      }

      try {
        if (checked) {
          await insertCourseHistory(
            studentId,
            courseId,
            defaultTermId,
            existingCourse ? getCourseActivityLabel(existingCourse) : undefined
          );
        } else {
          // Use the actual term_id from the history row (may differ from defaultTermId)
          const termId = existingRow?.term_id ?? defaultTermId;
          await deleteCourseHistory(
            studentId,
            courseId,
            termId,
            existingCourse ? getCourseActivityLabel(existingCourse) : undefined
          );
        }
      } catch (e: unknown) {
        // Rollback — re-fetch to get accurate state
        const restored = await fetchStudentCourseHistory(studentId);
        setHistory(restored);
        const msg = e instanceof Error ? e.message : "Unknown error";
        toaster.create({ title: "Failed to update", description: msg, type: "error" });
      }
    },
    [studentId, defaultTermId, buckets, major, history]
  );

  const handleAddCourse = useCallback(
    async (course: CourseRow) => {
      if (!studentId || !defaultTermId) return;

      // Optimistic update
      setHistory((prev) => [
        ...prev,
        { course_id: course.id, term_id: defaultTermId, completed: true, course },
      ]);

      try {
        await insertCourseHistory(
          studentId,
          course.id,
          defaultTermId,
          getCourseActivityLabel(course)
        );
        toaster.create({ title: "Course added to history", type: "success" });
      } catch (e: unknown) {
        // Rollback
        setHistory((prev) => prev.filter((h) => h.course_id !== course.id));
        const msg = e instanceof Error ? e.message : "Unknown error";
        toaster.create({ title: "Failed to add course", description: msg, type: "error" });
      }
    },
    [studentId, defaultTermId]
  );

  const handleDeleteAdditional = useCallback(
    async (courseId: number) => {
      if (!studentId) return;

      // Use the actual term_id from the history row
      const removed = history.find((h) => h.course_id === courseId);
      if (!removed) return;

      setHistory((prev) => prev.filter((h) => h.course_id !== courseId));

      try {
        await deleteCourseHistory(
          studentId,
          courseId,
          removed.term_id,
          getCourseActivityLabel(removed.course)
        );
        toaster.create({ title: "Course removed", type: "success" });
      } catch (e: unknown) {
        // Rollback
        setHistory((prev) => [...prev, removed]);
        const msg = e instanceof Error ? e.message : "Unknown error";
        toaster.create({ title: "Failed to remove course", description: msg, type: "error" });
      }
    },
    [studentId, history]
  );

  if (loading) {
    return (
      <Box p="8" display="flex" justifyContent="center">
        <Spinner colorPalette="blue" />
      </Box>
    );
  }

  return (
    <Stack gap="6">
      {/* Gen Ed Section */}
      <Box>
        <Heading size="md" fontWeight="600" mb="3">
          General Education
        </Heading>
        <GenEdChecklist
          buckets={buckets}
          completedCourseIds={completedCourseIds}
          onToggle={handleToggle}
        />
      </Box>

      {/* Major Section */}
      {major && (
        <Box>
          <MajorChecklist
            major={major}
            completedCourseIds={completedCourseIds}
            onToggle={handleToggle}
          />
        </Box>
      )}

      {/* Additional Courses Section */}
      <Box>
        <AdditionalCourses
          courses={additionalCourses}
          onDelete={handleDeleteAdditional}
          onCourseSelected={handleAddCourse}
        />
      </Box>
    </Stack>
  );
}

/** Helper: find a CourseRow by ID across gen ed buckets and major blocks. */
function findCourseById(
  courseId: number,
  buckets: GenEdBucketWithCourses[],
  major: MajorWithRequirements | null
): CourseRow | undefined {
  for (const bucket of buckets) {
    const found = bucket.courses.find((c) => c.id === courseId);
    if (found) return found;
  }
  if (major) {
    for (const block of major.blocks) {
      const found = block.courses.find((c) => c.id === courseId);
      if (found) return found;
    }
  }
  return undefined;
}
