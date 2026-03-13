"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Spacer,
  Flex,
  HStack,
  Input,
  Portal,
  Separator,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  LuBlocks,
  LuChevronDown,
  LuChevronUp,
  LuPencil,
  LuPlus,
  LuSearch,
  LuTrash2,
} from "react-icons/lu";
import { Field } from "@/components/ui/field";
import { Tooltip } from "@/components/ui/tooltip";
import { toaster } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";
import { DB_TABLES } from "@/lib/supabase/queries/schema";

type Course = {
  id: number;
  subject: string | null;
  number: string | null;
  title: string | null;
  credits: number | null;
};

export type GenEdBucket = {
  id: number;
  code: string | null;
  name: string;
  credits_required: number;
  courses: Course[];
};

type BucketForm = {
  code: string;
  name: string;
  credits_required: string;
};

function emptyBucketForm(): BucketForm {
  return {
    code: "",
    name: "",
    credits_required: "12",
  };
}

function formatCourse(course: Course) {
  const code = `${course.subject ?? ""} ${course.number ?? ""}`.trim();
  return code ? `${code} - ${course.title ?? "Untitled course"}` : course.title ?? "Untitled course";
}

const CORE_BUCKET_CODES = new Set(["HUM_ART", "SOC_BEH", "NAT_SCI"]);

export default function GenEdAdminClient({
  initialBuckets,
}: {
  initialBuckets: GenEdBucket[];
}) {
  const [supabase] = useState(() => createClient());
  const [buckets, setBuckets] = useState(initialBuckets);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [bucketDialogOpen, setBucketDialogOpen] = useState(false);
  const [coursesDialogOpen, setCoursesDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingBucket, setEditingBucket] = useState<GenEdBucket | null>(null);
  const [pendingDeleteBucket, setPendingDeleteBucket] = useState<GenEdBucket | null>(null);
  const [activeBucketId, setActiveBucketId] = useState<number | null>(null);
  const [bucketForm, setBucketForm] = useState<BucketForm>(emptyBucketForm());
  const [courseResults, setCourseResults] = useState<Course[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  async function loadBuckets() {
    const { data: bucketRows, error: bucketsError } = await supabase
      .from(DB_TABLES.genEdBuckets)
      .select("id, code, name, credits_required")
      .order("name");

    if (bucketsError) {
      throw bucketsError;
    }

    const { data: mappingRows, error: mappingsError } = await supabase
      .from(DB_TABLES.genEdBucketCourses)
      .select("bucket_id, course_id");

    if (mappingsError) {
      throw mappingsError;
    }

    const courseIds = Array.from(
      new Set((mappingRows ?? []).map((row: any) => Number(row.course_id)).filter(Number.isFinite))
    );

    const coursesResult = courseIds.length
      ? await supabase
          .from(DB_TABLES.courses)
          .select("id, subject, number, title, credits")
          .in("id", courseIds)
      : { data: [], error: null };

    if (coursesResult.error) {
      throw coursesResult.error;
    }

    const coursesById = new Map<number, Course>();
    for (const course of coursesResult.data ?? []) {
      coursesById.set(Number((course as any).id), {
        id: Number((course as any).id),
        subject: (course as any).subject ?? null,
        number: (course as any).number ?? null,
        title: (course as any).title ?? null,
        credits: (course as any).credits == null ? null : Number((course as any).credits),
      });
    }

    const bucketToCourses = new Map<number, Course[]>();
    for (const row of mappingRows ?? []) {
      const bucketId = Number((row as any).bucket_id);
      const course = coursesById.get(Number((row as any).course_id));
      if (!course) continue;
      if (!bucketToCourses.has(bucketId)) bucketToCourses.set(bucketId, []);
      bucketToCourses.get(bucketId)!.push(course);
    }

    setBuckets(
      (bucketRows ?? []).map((bucket: any) => ({
        id: Number(bucket.id),
        code: bucket.code ?? null,
        name: bucket.name,
        credits_required: Number(bucket.credits_required ?? 12),
        courses: (bucketToCourses.get(Number(bucket.id)) ?? []).sort((a, b) =>
          formatCourse(a).localeCompare(formatCourse(b))
        ),
      }))
    );
  }

  useEffect(() => {
    if (!coursesDialogOpen || activeBucketId == null) return;

    let cancelled = false;

    async function runSearch() {
      let query = supabase
        .from(DB_TABLES.courses)
        .select("id, subject, number, title, credits");

      const term = searchTerm.trim();
      if (term) {
        query = query.or(`subject.ilike.%${term}%,number.ilike.%${term}%,title.ilike.%${term}%`);
      }

      const { data, error } = await query.order("subject").order("number").limit(25);
      if (cancelled) return;

      if (error) {
        toaster.create({
          title: "Course search failed",
          description: error.message,
          type: "error",
        });
        return;
      }

      setCourseResults(
        (data ?? []).map((course: any) => ({
          id: Number(course.id),
          subject: course.subject ?? null,
          number: course.number ?? null,
          title: course.title ?? null,
          credits: course.credits == null ? null : Number(course.credits),
        }))
      );
    }

    runSearch();
    return () => {
      cancelled = true;
    };
  }, [activeBucketId, coursesDialogOpen, searchTerm, supabase]);

  async function handleSaveBucket() {
    if (!bucketForm.name.trim()) {
      toaster.create({
        title: "Missing bucket name",
        description: "Please provide a bucket name.",
        type: "error",
      });
      return;
    }

    setLoading(true);
    const payload = {
      code: bucketForm.code.trim() || null,
      name: bucketForm.name.trim(),
      credits_required: Number(bucketForm.credits_required || 12),
    };

    const result = editingBucket
      ? await supabase.from(DB_TABLES.genEdBuckets).update(payload).eq("id", editingBucket.id)
      : await supabase.from(DB_TABLES.genEdBuckets).insert(payload);

    setLoading(false);

    if (result.error) {
      toaster.create({
        title: "Failed to save bucket",
        description: result.error.message,
        type: "error",
      });
      return;
    }

    await loadBuckets();
    setBucketDialogOpen(false);
    setEditingBucket(null);
    setBucketForm(emptyBucketForm());
  }

  async function handleDeleteBucket(bucket: GenEdBucket) {
    setLoading(true);
    const { error: mappingsError } = await supabase
      .from(DB_TABLES.genEdBucketCourses)
      .delete()
      .eq("bucket_id", bucket.id);

    if (mappingsError) {
      setLoading(false);
      toaster.create({
        title: "Failed to delete bucket courses",
        description: mappingsError.message,
        type: "error",
      });
      return;
    }

    const { error } = await supabase.from(DB_TABLES.genEdBuckets).delete().eq("id", bucket.id);
    setLoading(false);

    if (error) {
      toaster.create({
        title: "Failed to delete bucket",
        description: error.message,
        type: "error",
      });
      return;
    }

    await loadBuckets();
    setDeleteDialogOpen(false);
    setPendingDeleteBucket(null);
  }

  async function handleRemoveCourse(bucketId: number, courseId: number) {
    const { error } = await supabase
      .from(DB_TABLES.genEdBucketCourses)
      .delete()
      .eq("bucket_id", bucketId)
      .eq("course_id", courseId);

    if (error) {
      toaster.create({
        title: "Failed to remove course",
        description: error.message,
        type: "error",
      });
      return;
    }

    await loadBuckets();
  }

  async function handleAddCourses() {
    if (activeBucketId == null || selectedCourseIds.length === 0) {
      toaster.create({
        title: "No courses selected",
        description: "Select at least one course to add.",
        type: "error",
      });
      return;
    }

    const existingIds = new Set(
      (buckets.find((bucket) => bucket.id === activeBucketId)?.courses ?? []).map((course) => course.id)
    );

    const rows = selectedCourseIds
      .filter((courseId) => !existingIds.has(courseId))
      .map((courseId) => ({ bucket_id: activeBucketId, course_id: courseId }));

    if (rows.length === 0) {
      setCoursesDialogOpen(false);
      setSelectedCourseIds([]);
      return;
    }

    const { error } = await supabase.from(DB_TABLES.genEdBucketCourses).insert(rows);

    if (error) {
      toaster.create({
        title: "Failed to add courses",
        description: error.message,
        type: "error",
      });
      return;
    }

    await loadBuckets();
    setSelectedCourseIds([]);
    setCoursesDialogOpen(false);
  }

  const bucketCountText = useMemo(
    () => `${buckets.length} bucket${buckets.length === 1 ? "" : "s"}`,
    [buckets.length]
  );

  return (
    <VStack align="stretch" gap="6">
      <Flex justify="space-between" align={{ base: "start", md: "center" }} gap="4" wrap="wrap">
        <Box>
          <Text
            fontSize={{ base: "2xl", md: "3xl" }}
            fontWeight="700"
            fontFamily="var(--font-outfit), sans-serif"
            letterSpacing="-0.02em"
          >
            Gen-Ed Buckets
          </Text>
          <Text color="fg.muted">{bucketCountText}</Text>
        </Box>
        <Button
          colorPalette="green"
          borderRadius="lg"
          onClick={() => {
            setEditingBucket(null);
            setBucketForm(emptyBucketForm());
            setBucketDialogOpen(true);
          }}
        >
          <LuPlus />
          Add Bucket
        </Button>
      </Flex>

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4">
        {buckets.map((bucket) => (
          <Card.Root
            key={bucket.id}
            bg="bg"
            borderRadius="xl"
            borderWidth="1px"
            borderColor="border.subtle"
            minH="140px"
          >
            <Card.Body p="5" display="flex" flexDirection="column">
              <VStack align="stretch" gap="4" flex="1">
                <Flex justify="space-between" align="start" gap="4" wrap="wrap">
                  <Box>
                    <HStack gap="2" mb="2" wrap="wrap">
                      {bucket.code ? (
                        <Badge colorPalette="green" variant="subtle">
                          {bucket.code}
                        </Badge>
                      ) : null}
                      <Badge colorPalette="gray" variant="outline">
                        {bucket.credits_required} credits
                      </Badge>
                      <Badge colorPalette="gray" variant="outline">
                        {bucket.courses.length} course{bucket.courses.length === 1 ? "" : "s"}
                      </Badge>
                    </HStack>
                    <Text fontWeight="700" fontSize="lg">
                      {bucket.name}
                    </Text>
                  </Box>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpanded((prev) => ({ ...prev, [bucket.id]: !prev[bucket.id] }))}
                  >
                    {expanded[bucket.id] ? <LuChevronUp /> : <LuChevronDown />}
                    {expanded[bucket.id] ? "Collapse" : "Expand"}
                  </Button>
                </Flex>

                <Spacer />

                <HStack gap="2" wrap="wrap" alignSelf="start">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingBucket(bucket);
                      setBucketForm({
                        code: bucket.code ?? "",
                        name: bucket.name,
                        credits_required: String(bucket.credits_required),
                      });
                      setBucketDialogOpen(true);
                    }}
                  >
                    <LuPencil />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setActiveBucketId(bucket.id);
                      setSelectedCourseIds([]);
                      setSearchTerm("");
                      setCoursesDialogOpen(true);
                    }}
                  >
                    <LuPlus />
                    Add Courses
                  </Button>
                  {CORE_BUCKET_CODES.has(bucket.code ?? "") ? (
                    <Tooltip content="Core bucket cannot be deleted">
                      <Box>
                        <Button size="sm" variant="ghost" colorPalette="red" disabled>
                          <LuTrash2 />
                          Delete
                        </Button>
                      </Box>
                    </Tooltip>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      colorPalette="red"
                      onClick={() => {
                        setPendingDeleteBucket(bucket);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <LuTrash2 />
                      Delete
                    </Button>
                  )}
                </HStack>

                {expanded[bucket.id] ? (
                  <>
                    <Separator />
                    <VStack align="stretch" gap="3">
                      {bucket.courses.length === 0 ? (
                        <Text color="fg.muted" fontSize="sm">
                          No courses in this bucket yet.
                        </Text>
                      ) : (
                        bucket.courses.map((course) => (
                          <Flex
                            key={`${bucket.id}-${course.id}`}
                            justify="space-between"
                            align="center"
                            p="3"
                            borderWidth="1px"
                            borderColor="border.subtle"
                            borderRadius="lg"
                            gap="3"
                          >
                            <Box>
                              <Text fontWeight="600">{formatCourse(course)}</Text>
                              <Text color="fg.muted" fontSize="sm">
                                {course.credits ?? 0} credits
                              </Text>
                            </Box>
                            <Button
                              size="xs"
                              variant="ghost"
                              colorPalette="red"
                              onClick={() => handleRemoveCourse(bucket.id, course.id)}
                            >
                              Remove
                            </Button>
                          </Flex>
                        ))
                      )}
                    </VStack>
                  </>
                ) : null}
              </VStack>
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>

      <Dialog.Root open={bucketDialogOpen} onOpenChange={(e) => setBucketDialogOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content borderRadius="xl">
              <Dialog.Header>
                <Dialog.Title>{editingBucket ? "Edit Bucket" : "Add Bucket"}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <VStack align="stretch" gap="4">
                  <Field label="Bucket Name">
                    <Input
                      value={bucketForm.name}
                      onChange={(e) => setBucketForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </Field>
                  <Field label="Code">
                    <Input
                      value={bucketForm.code}
                      onChange={(e) => setBucketForm((prev) => ({ ...prev, code: e.target.value }))}
                    />
                  </Field>
                  <Field label="Credits Required">
                    <Input
                      value={bucketForm.credits_required}
                      onChange={(e) =>
                        setBucketForm((prev) => ({ ...prev, credits_required: e.target.value }))
                      }
                    />
                  </Field>
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBucketDialogOpen(false);
                    setEditingBucket(null);
                    setBucketForm(emptyBucketForm());
                  }}
                >
                  Cancel
                </Button>
                <Button colorPalette="green" loading={loading} onClick={handleSaveBucket}>
                  {editingBucket ? "Save Changes" : "Save Bucket"}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root open={coursesDialogOpen} onOpenChange={(e) => setCoursesDialogOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content borderRadius="xl">
              <Dialog.Header>
                <Dialog.Title>Add Courses</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <VStack align="stretch" gap="4">
                  <Field label="Search Courses">
                    <Box position="relative">
                      <Box position="absolute" left="3" top="50%" transform="translateY(-50%)" color="fg.muted">
                        <LuSearch />
                      </Box>
                      <Input
                        pl="10"
                        placeholder="Search by subject, number, or title"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </Box>
                  </Field>

                  <VStack align="stretch" gap="2" maxH="320px" overflowY="auto">
                    {courseResults.length === 0 ? (
                      <Text color="fg.muted" fontSize="sm">
                        No matching courses found.
                      </Text>
                    ) : (
                      courseResults.map((course) => {
                        const selected = selectedCourseIds.includes(course.id);
                        return (
                          <Button
                            key={course.id}
                            variant={selected ? "solid" : "outline"}
                            colorPalette={selected ? "green" : "gray"}
                            justifyContent="space-between"
                            onClick={() =>
                              setSelectedCourseIds((prev) =>
                                selected
                                  ? prev.filter((id) => id !== course.id)
                                  : [...prev, course.id]
                              )
                            }
                          >
                            <Text>{formatCourse(course)}</Text>
                            <Text>{course.credits ?? 0} cr</Text>
                          </Button>
                        );
                      })
                    )}
                  </VStack>
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCoursesDialogOpen(false);
                    setSelectedCourseIds([]);
                  }}
                >
                  Cancel
                </Button>
                <Button colorPalette="green" onClick={handleAddCourses}>
                  Add Selected
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root open={deleteDialogOpen} onOpenChange={(e) => setDeleteDialogOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content borderRadius="xl">
              <Dialog.Header>
                <Dialog.Title>Delete Bucket</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <VStack align="stretch" gap="3">
                  <Text fontWeight="600">
                    Delete {pendingDeleteBucket?.name ?? "this bucket"}?
                  </Text>
                  <Text color="fg.muted">
                    Deleting this bucket will also remove all course mappings in
                    {" "}
                    <Text as="span" fontFamily="mono" fontSize="sm">
                      gen_ed_bucket_courses
                    </Text>
                    . This cannot be undone.
                  </Text>
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setPendingDeleteBucket(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  colorPalette="red"
                  loading={loading}
                  onClick={() => (pendingDeleteBucket ? handleDeleteBucket(pendingDeleteBucket) : undefined)}
                >
                  Delete Bucket
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </VStack>
  );
}
