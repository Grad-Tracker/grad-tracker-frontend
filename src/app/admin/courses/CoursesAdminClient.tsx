"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Card,
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
  Select,
  Separator,
  Spinner,
  Stack,
  Table,
  Text,
  Textarea,
  VStack,
  createListCollection,
} from "@chakra-ui/react";
import {
  LuBookMarked,
  LuChevronLeft,
  LuChevronRight,
  LuCircleAlert,
  LuClock,
  LuEye,
  LuPencil,
  LuPlus,
  LuSearch,
  LuX,
} from "react-icons/lu";
import { getSubjectColor } from "@/lib/subject-colors";
import { Field } from "@/components/ui/field";
import { toaster } from "@/components/ui/toaster";
import {
  addCourse,
  updateCourse,
  deactivateCourse,
  reactivateCourse,
} from "@/lib/supabase/queries/courses";
import type { CourseDetail, CourseInput } from "@/types/course";

// ── constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

// ── helpers ───────────────────────────────────────────────────────────────────

function emptyForm(): CourseInput & { creditsStr: string } {
  return {
    subject: "",
    number: "",
    title: "",
    credits: 0,
    creditsStr: "",
    description: null,
    prereq_text: null,
  };
}

// ── types ─────────────────────────────────────────────────────────────────────

type DialogMode = "add" | "edit";

interface FormState extends CourseInput {
  creditsStr: string;
}

interface FormErrors {
  subject?: string;
  number?: string;
  title?: string;
  credits?: string;
  general?: string;
}

// ── component ─────────────────────────────────────────────────────────────────

interface CoursesAdminClientProps {
  initialCourses: CourseDetail[];
  subjects: string[];
}

export default function CoursesAdminClient({
  initialCourses,
  subjects,
}: CoursesAdminClientProps) {
  // ── data state ──────────────────────────────────────────────────────────────
  const [courses, setCourses] = useState<CourseDetail[]>(initialCourses);

  // ── filter state ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // ── dialog state ────────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("add");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // ── view drawer state ───────────────────────────────────────────────────────
  const [viewOpen, setViewOpen] = useState(false);
  const [viewCourse, setViewCourse] = useState<CourseDetail | null>(null);

  // ── deactivate state ────────────────────────────────────────────────────────
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // ── subject collection for Select ───────────────────────────────────────────
  // Derived from mutable `courses` state so newly added subjects appear immediately.
  const subjectCollection = useMemo(() => {
    const seen = new Set<string>();
    courses.forEach((c) => seen.add(c.subject));
    const sorted = Array.from(seen).sort();
    return createListCollection({
      items: sorted.map((s) => ({ label: s, value: s })),
    });
  }, [courses]);

  // ── filtering + pagination ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      const matchesSearch =
        !q ||
        c.subject.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q);
      const matchesSubject = !subjectFilter || c.subject === subjectFilter;
      return matchesSearch && matchesSubject;
    });
  }, [courses, search, subjectFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Clamp page whenever the filtered set changes (filters or data mutations).
  useEffect(() => {
    setPage((prev) => Math.min(prev, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))));
  }, [filtered]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // ── dialog helpers ───────────────────────────────────────────────────────────
  function openAdd() {
    setDialogMode("add");
    setEditingId(null);
    setForm(emptyForm());
    setFormErrors({});
    setDialogOpen(true);
  }

  function openEdit(course: CourseDetail) {
    setDialogMode("edit");
    setEditingId(course.id);
    setForm({
      subject: course.subject,
      number: course.number,
      title: course.title,
      credits: course.credits,
      creditsStr: String(course.credits),
      description: course.description,
      prereq_text: course.prereq_text,
    });
    setFormErrors({});
    setDialogOpen(true);
  }

  function openView(course: CourseDetail) {
    setViewCourse(course);
    setViewOpen(true);
  }

  // ── validation ───────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errors: FormErrors = {};
    if (!form.subject.trim()) errors.subject = "Subject is required.";
    if (!form.number.trim()) errors.number = "Number is required.";
    if (!form.title.trim()) errors.title = "Title is required.";
    const credits = parseFloat(form.creditsStr);
    if (!form.creditsStr.trim() || isNaN(credits) || credits <= 0) {
      errors.credits = "Credits must be a positive number.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setFormErrors({});

    const input: CourseInput = {
      subject: form.subject,
      number: form.number,
      title: form.title,
      credits: parseFloat(form.creditsStr),
      description: form.description || null,
      prereq_text: form.prereq_text || null,
    };

    try {
      if (dialogMode === "add") {
        const { id } = await addCourse(input);
        const newCourse: CourseDetail = {
          id,
          subject: input.subject.trim().toUpperCase(),
          number: input.number.trim(),
          title: input.title,
          credits: input.credits,
          description: input.description ?? null,
          prereq_text: input.prereq_text ?? null,
          is_active: true,
        };
        setCourses((prev) =>
          [...prev, newCourse].sort((a, b) =>
            a.subject !== b.subject
              ? a.subject.localeCompare(b.subject)
              : a.number.localeCompare(b.number)
          )
        );
        toaster.create({ title: "Course added", type: "success" });
      } else if (editingId !== null) {
        await updateCourse(editingId, input);
        setCourses((prev) =>
          prev.map((c) =>
            c.id === editingId
              ? {
                  ...c,
                  subject: input.subject.trim().toUpperCase(),
                  number: input.number.trim(),
                  title: input.title,
                  credits: input.credits,
                  description: input.description ?? null,
                  prereq_text: input.prereq_text ?? null,
                }
              : c
          )
        );
        toaster.create({ title: "Course updated", type: "success" });
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === "23505") {
        setFormErrors({
          general: `A course with subject "${form.subject.trim().toUpperCase()}" and number "${form.number.trim()}" already exists.`,
        });
      } else {
        setFormErrors({ general: "An unexpected error occurred. Please try again." });
      }
    } finally {
      setSaving(false);
    }
  }

  // ── deactivate / reactivate ──────────────────────────────────────────────────
  async function handleToggleActive(course: CourseDetail) {
    setTogglingId(course.id);
    try {
      if (course.is_active) {
        await deactivateCourse(course.id);
        setCourses((prev) =>
          prev.map((c) => (c.id === course.id ? { ...c, is_active: false } : c))
        );
        toaster.create({ title: "Course deactivated", type: "info" });
      } else {
        await reactivateCourse(course.id);
        setCourses((prev) =>
          prev.map((c) => (c.id === course.id ? { ...c, is_active: true } : c))
        );
        toaster.create({ title: "Course reactivated", type: "success" });
      }
    } catch {
      toaster.create({ title: "Failed to update course status", type: "error" });
    } finally {
      setTogglingId(null);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* Header */}
      <Flex mb="6" align="center" justify="space-between" wrap="wrap" gap="3">
        <Box>
          <Text fontSize="sm" color="fg.muted" fontWeight="500">
            Admin
          </Text>
          <Heading
            size="lg"
            fontFamily="var(--font-outfit), sans-serif"
            fontWeight="400"
            letterSpacing="-0.02em"
          >
            Course Catalog
          </Heading>
        </Box>
        <Button colorPalette="blue" size="sm" onClick={openAdd}>
          <Icon boxSize="4" mr="1"><LuPlus /></Icon>
          Add Course
        </Button>
      </Flex>

      {/* Filters */}
      <Card.Root
        bg="bg"
        borderRadius="xl"
        borderWidth="1px"
        borderColor="border.subtle"
        mb="4"
      >
        <Card.Body p="4">
          <Flex direction={{ base: "column", md: "row" }} gap="3" align={{ base: "stretch", md: "center" }}>
            {/* Search */}
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
                placeholder="Search by subject, number, or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                rounded="lg"
                size="sm"
              />
            </Box>

            {/* Subject filter */}
            <Select.Root
              collection={subjectCollection}
              value={subjectFilter ? [subjectFilter] : []}
              onValueChange={({ value }) => setSubjectFilter(value[0] || null)}
              size="sm"
              width={{ base: "full", md: "160px" }}
            >
              <Select.HiddenSelect />
              <Select.Control>
                <Select.Trigger rounded="lg">
                  <Select.ValueText placeholder="All Subjects" />
                </Select.Trigger>
                <Select.IndicatorGroup>
                  {subjectFilter && <Select.ClearTrigger />}
                  <Select.Indicator />
                </Select.IndicatorGroup>
              </Select.Control>
              <Portal>
                <Select.Positioner>
                  <Select.Content>
                    {subjectCollection.items.map((item) => (
                      <Select.Item item={item} key={item.value}>
                        {item.label}
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>

            {/* Clear filters */}
            {(search || subjectFilter) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setSearch(""); setSubjectFilter(null); }}
              >
                <Icon boxSize="3.5" mr="1"><LuX /></Icon>
                Clear
              </Button>
            )}
          </Flex>
        </Card.Body>
      </Card.Root>

      {/* Result count */}
      <Text fontSize="sm" color="fg.muted" mb="3">
        {filtered.length === courses.length
          ? `${courses.length} courses`
          : `${filtered.length} of ${courses.length} courses`}
      </Text>

      {/* Table */}
      <Card.Root
        bg="bg"
        borderRadius="xl"
        borderWidth="1px"
        borderColor="border.subtle"
        overflow="hidden"
      >
        <Box overflowX="auto">
          <Table.Root size="sm" variant="outline">
            <Table.Header>
              <Table.Row bg="bg.subtle">
                <Table.ColumnHeader w="90px" fontWeight="600" fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wider">
                  Subject
                </Table.ColumnHeader>
                <Table.ColumnHeader w="90px" fontWeight="600" fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wider">
                  Number
                </Table.ColumnHeader>
                <Table.ColumnHeader fontWeight="600" fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wider">
                  Title
                </Table.ColumnHeader>
                <Table.ColumnHeader w="80px" fontWeight="600" fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wider" textAlign="center">
                  Credits
                </Table.ColumnHeader>
                <Table.ColumnHeader w="90px" fontWeight="600" fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wider" textAlign="center">
                  Status
                </Table.ColumnHeader>
                <Table.ColumnHeader w="120px" fontWeight="600" fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wider" textAlign="right">
                  Actions
                </Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {paginated.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={6} py="12" textAlign="center">
                    <VStack gap="2">
                      <Icon boxSize="8" color="fg.subtle"><LuBookMarked /></Icon>
                      <Text color="fg.muted" fontSize="sm">
                        {courses.length === 0
                          ? "No courses in the database yet."
                          : "No courses match your filters."}
                      </Text>
                    </VStack>
                  </Table.Cell>
                </Table.Row>
              ) : (
                paginated.map((course) => (
                  <Table.Row
                    key={course.id}
                    opacity={course.is_active ? 1 : 0.55}
                    _hover={{ bg: "bg.subtle" }}
                    transition="background 0.1s"
                  >
                    <Table.Cell>
                      <Badge
                        colorPalette={getSubjectColor(course.subject)}
                        variant="surface"
                        size="sm"
                      >
                        {course.subject}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="sm" fontWeight="500">
                        {course.number}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="sm" lineClamp={1}>
                        {course.title}
                      </Text>
                    </Table.Cell>
                    <Table.Cell textAlign="center">
                      <Text fontSize="sm">{course.credits}</Text>
                    </Table.Cell>
                    <Table.Cell textAlign="center">
                      <Badge
                        colorPalette={course.is_active ? "blue" : "gray"}
                        variant="subtle"
                        size="sm"
                      >
                        {course.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell textAlign="right">
                      <HStack gap="1" justify="flex-end">
                        <IconButton
                          size="xs"
                          variant="ghost"
                          aria-label="View course"
                          title="View"
                          onClick={() => openView(course)}
                        >
                          <LuEye />
                        </IconButton>
                        <IconButton
                          size="xs"
                          variant="ghost"
                          aria-label="Edit course"
                          title="Edit"
                          onClick={() => openEdit(course)}
                        >
                          <LuPencil />
                        </IconButton>
                        <Button
                          size="xs"
                          variant="ghost"
                          colorPalette={course.is_active ? "red" : "blue"}
                          aria-label={course.is_active ? "Deactivate course" : "Reactivate course"}
                          title={course.is_active ? "Deactivate" : "Reactivate"}
                          loading={togglingId === course.id}
                          onClick={() => handleToggleActive(course)}
                        >
                          {course.is_active ? "Deactivate" : "Reactivate"}
                        </Button>
                      </HStack>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Box>

        {/* Pagination */}
        {totalPages > 1 && (
          <Flex
            px="4"
            py="3"
            borderTopWidth="1px"
            borderColor="border.subtle"
            align="center"
            justify="space-between"
            bg="bg.subtle"
          >
            <Text fontSize="xs" color="fg.muted">
              Page {page} of {totalPages}
            </Text>
            <Pagination.Root
              count={filtered.length}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={(e) => setPage(e.page)}
              siblingCount={1}
            >
              <ButtonGroup variant="ghost" size="xs">
                <Pagination.PrevTrigger asChild>
                  <IconButton aria-label="Previous page">
                    <LuChevronLeft />
                  </IconButton>
                </Pagination.PrevTrigger>
                <Pagination.Items
                  render={(item) => (
                    <IconButton
                      aria-label={`Page ${item.value}`}
                      variant={{ base: "ghost", _selected: "outline" }}
                    >
                      {item.value}
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
      </Card.Root>

      {/* ── Add / Edit Dialog ────────────────────────────────────────────────── */}
      <Dialog.Root
        open={dialogOpen}
        onOpenChange={(e) => !saving && setDialogOpen(e.open)}
        size="md"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header borderBottomWidth="1px" borderColor="border.subtle">
                <Dialog.Title fontFamily="var(--font-outfit), sans-serif" fontWeight="400">
                  {dialogMode === "add" ? "Add Course" : "Edit Course"}
                </Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" disabled={saving} />
                </Dialog.CloseTrigger>
              </Dialog.Header>

              <Dialog.Body py="5">
                <VStack gap="4" align="stretch">
                  {formErrors.general && (
                    <Box
                      bg="red.subtle"
                      borderRadius="lg"
                      p="3"
                      borderWidth="1px"
                      borderColor="red.muted"
                    >
                      <HStack gap="2">
                        <Icon color="red.fg" boxSize="4"><LuCircleAlert /></Icon>
                        <Text fontSize="sm" color="red.fg">
                          {formErrors.general}
                        </Text>
                      </HStack>
                    </Box>
                  )}

                  <Flex gap="3" direction={{ base: "column", sm: "row" }}>
                    <Field
                      label="Subject"
                      required
                      invalid={!!formErrors.subject}
                      errorText={formErrors.subject}
                      flex="1"
                    >
                      <Input
                        placeholder="e.g. CSCI"
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        size="sm"
                      />
                    </Field>
                    <Field
                      label="Number"
                      required
                      invalid={!!formErrors.number}
                      errorText={formErrors.number}
                      flex="1"
                    >
                      <Input
                        placeholder="e.g. 101"
                        value={form.number}
                        onChange={(e) => setForm({ ...form, number: e.target.value })}
                        size="sm"
                      />
                    </Field>
                  </Flex>

                  <Field
                    label="Title"
                    required
                    invalid={!!formErrors.title}
                    errorText={formErrors.title}
                  >
                    <Input
                      placeholder="e.g. Introduction to Computer Science"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      size="sm"
                    />
                  </Field>

                  <Field
                    label="Credits"
                    required
                    invalid={!!formErrors.credits}
                    errorText={formErrors.credits}
                    maxW="140px"
                  >
                    <Input
                      type="number"
                      min={0.5}
                      step={0.5}
                      placeholder="3"
                      value={form.creditsStr}
                      onChange={(e) =>
                        setForm({ ...form, creditsStr: e.target.value, credits: parseFloat(e.target.value) || 0 })
                      }
                      size="sm"
                    />
                  </Field>

                  <Field label="Description" helperText="Optional — full course description.">
                    <Textarea
                      placeholder="Course description..."
                      value={form.description ?? ""}
                      onChange={(e) => setForm({ ...form, description: e.target.value || null })}
                      size="sm"
                      rows={3}
                    />
                  </Field>

                  <Field label="Prerequisite Text" helperText="Optional — e.g. 'CSCI 101 or consent of instructor.'">
                    <Textarea
                      placeholder="Prerequisite text..."
                      value={form.prereq_text ?? ""}
                      onChange={(e) => setForm({ ...form, prereq_text: e.target.value || null })}
                      size="sm"
                      rows={2}
                    />
                  </Field>
                </VStack>
              </Dialog.Body>

              <Dialog.Footer borderTopWidth="1px" borderColor="border.subtle" gap="2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialogOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  colorPalette="blue"
                  size="sm"
                  onClick={handleSave}
                  loading={saving}
                >
                  {dialogMode === "add" ? "Add Course" : "Save Changes"}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* ── View Drawer ───────────────────────────────────────────────────────── */}
      <Drawer.Root
        open={viewOpen}
        onOpenChange={(e) => setViewOpen(e.open)}
        size="md"
        placement="end"
      >
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              {viewCourse && (
                <>
                  <Drawer.Header borderBottomWidth="1px" borderColor="border.subtle">
                    <VStack align="start" gap="1" flex="1">
                      <HStack gap="2">
                        <Badge
                          colorPalette={getSubjectColor(viewCourse.subject)}
                          variant="surface"
                          size="sm"
                        >
                          {viewCourse.subject}
                        </Badge>
                        {!viewCourse.is_active && (
                          <Badge colorPalette="gray" variant="subtle" size="sm">
                            Inactive
                          </Badge>
                        )}
                      </HStack>
                      <Drawer.Title
                        fontFamily="var(--font-outfit), sans-serif"
                        fontWeight="400"
                        fontSize="xl"
                      >
                        {viewCourse.subject} {viewCourse.number}
                      </Drawer.Title>
                    </VStack>
                    <Drawer.CloseTrigger asChild>
                      <CloseButton size="sm" />
                    </Drawer.CloseTrigger>
                  </Drawer.Header>

                  <Drawer.Body py="6">
                    <VStack align="stretch" gap="5">
                      <Box>
                        <Text fontSize="xs" fontWeight="600" color="fg.muted" mb="1" textTransform="uppercase" letterSpacing="wider">
                          Title
                        </Text>
                        <Text fontSize="lg" fontWeight="500">
                          {viewCourse.title}
                        </Text>
                      </Box>

                      <Separator />

                      <HStack gap="3">
                        <Icon color="fg.muted" boxSize="4"><LuClock /></Icon>
                        <Box>
                          <Text fontSize="xs" fontWeight="600" color="fg.muted" textTransform="uppercase" letterSpacing="wider">
                            Credits
                          </Text>
                          <Text fontSize="xl" fontWeight="700" color="blue.fg">
                            {viewCourse.credits}
                          </Text>
                        </Box>
                      </HStack>

                      <Separator />

                      <Box>
                        <Text fontSize="xs" fontWeight="600" color="fg.muted" mb="2" textTransform="uppercase" letterSpacing="wider">
                          Description
                        </Text>
                        {viewCourse.description ? (
                          <Text fontSize="sm" lineHeight="tall">
                            {viewCourse.description}
                          </Text>
                        ) : (
                          <Text fontSize="sm" color="fg.muted" fontStyle="italic">
                            No description available.
                          </Text>
                        )}
                      </Box>

                      {viewCourse.prereq_text && (
                        <>
                          <Separator />
                          <Box>
                            <HStack gap="2" mb="2">
                              <Icon color="orange.fg" boxSize="4"><LuCircleAlert /></Icon>
                              <Text fontSize="xs" fontWeight="600" color="fg.muted" textTransform="uppercase" letterSpacing="wider">
                                Prerequisites
                              </Text>
                            </HStack>
                            <Box
                              bg="orange.subtle"
                              borderRadius="lg"
                              p="3"
                              borderWidth="1px"
                              borderColor="orange.muted"
                            >
                              <Text color="orange.fg" fontSize="sm">
                                {viewCourse.prereq_text}
                              </Text>
                            </Box>
                          </Box>
                        </>
                      )}
                    </VStack>
                  </Drawer.Body>

                  <Drawer.Footer borderTopWidth="1px" borderColor="border.subtle" gap="2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setViewOpen(false);
                        openEdit(viewCourse);
                      }}
                    >
                      <Icon boxSize="3.5" mr="1"><LuPencil /></Icon>
                      Edit
                    </Button>
                    <Drawer.ActionTrigger asChild>
                      <Button size="sm" variant="ghost">Close</Button>
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
