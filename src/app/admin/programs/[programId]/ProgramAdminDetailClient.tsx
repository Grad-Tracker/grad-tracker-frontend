"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  HStack,
  Icon,
  Input,
  Portal,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import { LuArrowLeft, LuPencil, LuPlus, LuSearch, LuTrash2 } from "react-icons/lu";

import { Field } from "@/components/ui/field";
import { NativeSelectField, NativeSelectRoot } from "@/components/ui/native-select";
import { toaster } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";
import { DB_TABLES } from "@/lib/supabase/queries/schema";

type Program = {
  id: number;
  name: string;
  catalog_year: number | null;
  program_type: string;
};

type Course = {
  id: number;
  subject: string | null;
  number: string | null;
  title: string | null;
  credits: number | null;
};

type Block = {
  id: number;
  program_id: number;
  name: string;
  rule: string;
  n_required: number | null;
  credits_required: number | null;
  display_order: number | null;
  courses: Course[];
};

type BlockFormState = {
  name: string;
  rule: string;
  n_required: string;
  credits_required: string;
};

const PROGRAM_TYPE_OPTIONS = ["MAJOR", "MINOR", "CERTIFICATE", "GRADUATE"];
const RULE_OPTIONS = ["ALL_OF", "ANY_OF", "N_OF", "CREDITS_OF"];

function emptyBlockForm(): BlockFormState {
  return {
    name: "",
    rule: "ALL_OF",
    n_required: "",
    credits_required: "",
  };
}

function getProgramColor(type: string) {
  const colorMap: Record<string, string> = {
    MAJOR: "blue",
    MINOR: "purple",
    GRADUATE: "green",
    CERTIFICATE: "orange",
  };
  return colorMap[type] || "gray";
}

function formatCourse(course: Course) {
  return `${course.subject ?? ""} ${course.number ?? ""}`.trim();
}

function getRuleSummary(block: Block) {
  if (block.rule === "N_OF") {
    return `${block.n_required ?? 0} of ${block.courses.length} courses required`;
  }
  if (block.rule === "CREDITS_OF") {
    return `${block.credits_required ?? 0} credits required`;
  }
  if (block.rule === "ALL_OF") {
    return "All listed courses required";
  }
  if (block.rule === "ANY_OF") {
    return "Any listed course can satisfy the block";
  }
  return block.rule;
}

export default function ProgramAdminDetailClient({
  initialProgram,
  initialBlocks,
}: {
  initialProgram: Program;
  initialBlocks: Block[];
}) {
  const [supabase] = useState(() => createClient());
  const [program, setProgram] = useState(initialProgram);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [editBlockOpen, setEditBlockOpen] = useState(false);
  const [coursesDialogOpen, setCoursesDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [courseResults, setCourseResults] = useState<Course[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [programForm, setProgramForm] = useState({
    name: initialProgram.name,
    catalog_year: initialProgram.catalog_year?.toString() ?? "",
    program_type: initialProgram.program_type,
  });
  const [blockForm, setBlockForm] = useState<BlockFormState>(emptyBlockForm());

  async function loadBlocks() {
    const withDisplayOrder = await supabase
      .from(DB_TABLES.programRequirementBlocks)
      .select(`
        id,
        program_id,
        name,
        rule,
        n_required,
        credits_required,
        display_order,
        program_requirement_courses (
          course_id,
          courses:course_id (
            id,
            subject,
            number,
            title,
            credits
          )
        )
      `)
      .eq("program_id", program.id)
      .order("display_order")
      .order("id");

    const fallback = withDisplayOrder.error
      ? await supabase
          .from(DB_TABLES.programRequirementBlocks)
          .select(`
            id,
            program_id,
            name,
            rule,
            n_required,
            credits_required,
            program_requirement_courses (
              course_id,
              courses:course_id (
                id,
                subject,
                number,
                title,
                credits
              )
            )
          `)
          .eq("program_id", program.id)
          .order("id")
      : null;

    const result = fallback ?? withDisplayOrder;

    if (result.error) {
      throw result.error;
    }

    setBlocks(
      (result.data ?? []).map((block: any) => ({
        id: Number(block.id),
        program_id: Number(block.program_id),
        name: block.name,
        rule: block.rule,
        n_required: block.n_required,
        credits_required: block.credits_required,
        display_order:
          "display_order" in block && block.display_order != null
            ? Number(block.display_order)
            : null,
        courses: (block.program_requirement_courses ?? [])
          .map((row: any) => row.courses)
          .filter(Boolean)
          .map((course: any) => ({
            id: Number(course.id),
            subject: course.subject,
            number: course.number,
            title: course.title,
            credits: course.credits,
          })),
      }))
    );
  }

  useEffect(() => {
    if (!coursesDialogOpen || activeBlockId == null) return;

    let cancelled = false;

    async function runSearch() {
      const query = searchTerm.trim();
      let builder = supabase
        .from(DB_TABLES.courses)
        .select("id, subject, number, title, credits");

      if (query) {
        builder = builder.or(
          `subject.ilike.%${query}%,number.ilike.%${query}%,title.ilike.%${query}%`
        );
      }

      const { data, error } = await builder.order("subject").order("number").limit(25);
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
          subject: course.subject,
          number: course.number,
          title: course.title,
          credits: course.credits,
        }))
      );
    }

    runSearch();

    return () => {
      cancelled = true;
    };
  }, [activeBlockId, coursesDialogOpen, searchTerm, supabase]);

  async function handleSaveProgram() {
    setLoading(true);
    const { error } = await supabase
      .from(DB_TABLES.programs)
      .update({
        name: programForm.name,
        catalog_year: programForm.catalog_year ? Number(programForm.catalog_year) : null,
        program_type: programForm.program_type,
      })
      .eq("id", program.id);

    setLoading(false);

    if (error) {
      toaster.create({
        title: "Failed to update program",
        description: error.message,
        type: "error",
      });
      return;
    }

    setProgram((prev) => ({
      ...prev,
      name: programForm.name,
      catalog_year: programForm.catalog_year ? Number(programForm.catalog_year) : null,
      program_type: programForm.program_type,
    }));
    setProgramDialogOpen(false);
  }

  async function handleSaveBlock() {
    if (!blockForm.name.trim()) {
      toaster.create({
        title: "Missing block name",
        description: "Please provide a block name.",
        type: "error",
      });
      return;
    }

    const payload = {
      name: blockForm.name.trim(),
      rule: blockForm.rule,
      n_required: blockForm.rule === "N_OF" ? Number(blockForm.n_required || 0) : null,
      credits_required:
        blockForm.rule === "CREDITS_OF" ? Number(blockForm.credits_required || 0) : null,
    };

    setLoading(true);

    const result = editingBlock
      ? await supabase
          .from(DB_TABLES.programRequirementBlocks)
          .update(payload)
          .eq("id", editingBlock.id)
      : await (async () => {
          const withDisplayOrder = await supabase
            .from(DB_TABLES.programRequirementBlocks)
            .insert({
              ...payload,
              program_id: program.id,
              display_order: blocks.length + 1,
            });

          if (
            withDisplayOrder.error &&
            String(withDisplayOrder.error.message ?? "").includes("display_order")
          ) {
            return supabase
              .from(DB_TABLES.programRequirementBlocks)
              .insert({
                ...payload,
                program_id: program.id,
              });
          }

          return withDisplayOrder;
        })();

    if (result.error) {
      setLoading(false);
      toaster.create({
        title: "Failed to save block",
        description: result.error.message,
        type: "error",
      });
      return;
    }

    await loadBlocks();
    setLoading(false);
    setEditingBlock(null);
    setBlockForm(emptyBlockForm());
    setAddBlockOpen(false);
    setEditBlockOpen(false);
  }

  async function handleDeleteBlock(block: Block) {
    if (!window.confirm(`Delete ${block.name}?`)) return;

    setLoading(true);

    const { error: mapError } = await supabase
      .from(DB_TABLES.programRequirementCourses)
      .delete()
      .eq("block_id", block.id);

    if (mapError) {
      setLoading(false);
      toaster.create({
        title: "Failed to delete block courses",
        description: mapError.message,
        type: "error",
      });
      return;
    }

    const { error } = await supabase
      .from(DB_TABLES.programRequirementBlocks)
      .delete()
      .eq("id", block.id);

    setLoading(false);

    if (error) {
      toaster.create({
        title: "Failed to delete block",
        description: error.message,
        type: "error",
      });
      return;
    }

    await loadBlocks();
  }

  async function handleRemoveCourse(blockId: number, courseId: number) {
    const { error } = await supabase
      .from(DB_TABLES.programRequirementCourses)
      .delete()
      .eq("block_id", blockId)
      .eq("course_id", courseId);

    if (error) {
      toaster.create({
        title: "Failed to remove course",
        description: error.message,
        type: "error",
      });
      return;
    }

    await loadBlocks();
  }

  async function handleAddCourses() {
    if (activeBlockId == null || selectedCourseIds.length === 0) {
      toaster.create({
        title: "No courses selected",
        description: "Select at least one course to add.",
        type: "error",
      });
      return;
    }

    const existing = blocks.find((block) => block.id === activeBlockId)?.courses ?? [];
    const existingIds = new Set(existing.map((course) => course.id));
    const rows = selectedCourseIds
      .filter((courseId) => !existingIds.has(courseId))
      .map((courseId) => ({ block_id: activeBlockId, course_id: courseId }));

    if (rows.length === 0) {
      setCoursesDialogOpen(false);
      setSelectedCourseIds([]);
      return;
    }

    const { error } = await supabase
      .from(DB_TABLES.programRequirementCourses)
      .insert(rows);

    if (error) {
      toaster.create({
        title: "Failed to add courses",
        description: error.message,
        type: "error",
      });
      return;
    }

    await loadBlocks();
    setSelectedCourseIds([]);
    setCoursesDialogOpen(false);
  }

  return (
    <Box className="mesh-gradient-subtle" minH="100vh">
      <Box maxW="7xl" mx="auto" px={{ base: "4", md: "6", lg: "8" }} py="8">
        <VStack align="stretch" gap="6">
          <Link href="/admin/programs">
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
              <Text>Back to Programs</Text>
            </HStack>
          </Link>

          <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
            <Card.Body p="6">
              <Flex justify="space-between" align={{ base: "start", md: "center" }} gap="4" wrap="wrap">
                <Box>
                  <HStack gap="2" mb="2" wrap="wrap">
                    <Badge colorPalette={getProgramColor(program.program_type)} variant="surface">
                      {program.program_type}
                    </Badge>
                    {program.catalog_year ? (
                      <Badge colorPalette="gray" variant="subtle">
                        {program.catalog_year}
                      </Badge>
                    ) : null}
                  </HStack>
                  <Text
                    fontSize="2xl"
                    fontWeight="700"
                    fontFamily="var(--font-outfit), sans-serif"
                    letterSpacing="-0.02em"
                  >
                    {program.name}
                  </Text>
                </Box>
                <HStack gap="3">
                  <Button variant="outline" borderRadius="lg" onClick={() => setProgramDialogOpen(true)}>
                    <LuPencil />
                    Edit Program
                  </Button>
                  <Button colorPalette="green" borderRadius="lg" onClick={() => setAddBlockOpen(true)}>
                    <LuPlus />
                    Add Block
                  </Button>
                </HStack>
              </Flex>
            </Card.Body>
          </Card.Root>

          <VStack align="stretch" gap="4">
            {blocks.map((block) => (
              <Card.Root key={block.id} bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
                <Card.Body p="5">
                  <VStack align="stretch" gap="4">
                    <Flex justify="space-between" align="start" gap="4" wrap="wrap">
                      <Box>
                        <HStack gap="2" mb="2" wrap="wrap">
                          <Badge colorPalette="green" variant="subtle">
                            {block.rule}
                          </Badge>
                          <Badge colorPalette="gray" variant="outline">
                            {block.courses.length} course{block.courses.length === 1 ? "" : "s"}
                          </Badge>
                        </HStack>
                        <Text fontWeight="700" fontSize="lg">
                          {block.name}
                        </Text>
                        <Text color="fg.muted" fontSize="sm">
                          {getRuleSummary(block)}
                        </Text>
                      </Box>

                      <HStack gap="2" wrap="wrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setExpanded((prev) => ({ ...prev, [block.id]: !prev[block.id] }))
                          }
                        >
                          {expanded[block.id] ? "Collapse" : "Expand"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingBlock(block);
                            setBlockForm({
                              name: block.name,
                              rule: block.rule,
                              n_required: block.n_required?.toString() ?? "",
                              credits_required: block.credits_required?.toString() ?? "",
                            });
                            setEditBlockOpen(true);
                          }}
                        >
                          <LuPencil />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActiveBlockId(block.id);
                            setSelectedCourseIds([]);
                            setSearchTerm("");
                            setCoursesDialogOpen(true);
                          }}
                        >
                          <LuPlus />
                          Add Courses
                        </Button>
                        <Button
                          size="sm"
                          colorPalette="red"
                          variant="ghost"
                          onClick={() => handleDeleteBlock(block)}
                        >
                          <LuTrash2 />
                          Delete Block
                        </Button>
                      </HStack>
                    </Flex>

                    {expanded[block.id] ? (
                      <>
                        <Separator />
                        <VStack align="stretch" gap="3">
                          {block.courses.length === 0 ? (
                            <Text color="fg.muted" fontSize="sm">
                              No courses added to this block yet.
                            </Text>
                          ) : (
                            block.courses.map((course) => (
                              <Flex
                                key={`${block.id}-${course.id}`}
                                justify="space-between"
                                align="center"
                                p="3"
                                borderWidth="1px"
                                borderColor="border.subtle"
                                borderRadius="lg"
                              >
                                <Box>
                                  <Text fontWeight="600">
                                    {formatCourse(course)}
                                    {course.credits ? ` • ${course.credits} cr` : ""}
                                  </Text>
                                  <Text color="fg.muted" fontSize="sm">
                                    {course.title}
                                  </Text>
                                </Box>
                                <Button
                                  size="xs"
                                  colorPalette="red"
                                  variant="ghost"
                                  onClick={() => handleRemoveCourse(block.id, course.id)}
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
          </VStack>
        </VStack>
      </Box>

      <Dialog.Root open={programDialogOpen} onOpenChange={(e) => setProgramDialogOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content borderRadius="xl">
              <Dialog.Header>
                <Dialog.Title>Edit Program</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <VStack align="stretch" gap="4">
                  <Field label="Program Name">
                    <Input
                      value={programForm.name}
                      onChange={(e) => setProgramForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </Field>
                  <Field label="Catalog Year">
                    <Input
                      value={programForm.catalog_year}
                      onChange={(e) =>
                        setProgramForm((prev) => ({ ...prev, catalog_year: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Program Type">
                    <NativeSelectRoot>
                      <NativeSelectField
                        value={programForm.program_type}
                        onChange={(e) =>
                          setProgramForm((prev) => ({ ...prev, program_type: e.target.value }))
                        }
                      >
                        {PROGRAM_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </NativeSelectField>
                    </NativeSelectRoot>
                  </Field>
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setProgramDialogOpen(false)}>
                  Cancel
                </Button>
                <Button colorPalette="green" loading={loading} onClick={handleSaveProgram}>
                  Save
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root open={addBlockOpen} onOpenChange={(e) => setAddBlockOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content borderRadius="xl">
              <Dialog.Header>
                <Dialog.Title>Add Block</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <VStack align="stretch" gap="4">
                  <Field label="Block Name">
                    <Input
                      value={blockForm.name}
                      onChange={(e) => setBlockForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </Field>
                  <Field label="Rule">
                    <NativeSelectRoot>
                      <NativeSelectField
                        value={blockForm.rule}
                        onChange={(e) =>
                          setBlockForm((prev) => ({ ...prev, rule: e.target.value }))
                        }
                      >
                        {RULE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </NativeSelectField>
                    </NativeSelectRoot>
                  </Field>
                  {blockForm.rule === "N_OF" ? (
                    <Field label="N Required">
                      <Input
                        value={blockForm.n_required}
                        onChange={(e) =>
                          setBlockForm((prev) => ({ ...prev, n_required: e.target.value }))
                        }
                      />
                    </Field>
                  ) : null}
                  {blockForm.rule === "CREDITS_OF" ? (
                    <Field label="Credits Required">
                      <Input
                        value={blockForm.credits_required}
                        onChange={(e) =>
                          setBlockForm((prev) => ({ ...prev, credits_required: e.target.value }))
                        }
                      />
                    </Field>
                  ) : null}
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddBlockOpen(false);
                    setBlockForm(emptyBlockForm());
                  }}
                >
                  Cancel
                </Button>
                <Button colorPalette="green" loading={loading} onClick={handleSaveBlock}>
                  Save Block
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root open={editBlockOpen} onOpenChange={(e) => setEditBlockOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content borderRadius="xl">
              <Dialog.Header>
                <Dialog.Title>Edit Block</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <VStack align="stretch" gap="4">
                  <Field label="Block Name">
                    <Input
                      value={blockForm.name}
                      onChange={(e) => setBlockForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </Field>
                  <Field label="Rule">
                    <NativeSelectRoot>
                      <NativeSelectField
                        value={blockForm.rule}
                        onChange={(e) =>
                          setBlockForm((prev) => ({ ...prev, rule: e.target.value }))
                        }
                      >
                        {RULE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </NativeSelectField>
                    </NativeSelectRoot>
                  </Field>
                  {blockForm.rule === "N_OF" ? (
                    <Field label="N Required">
                      <Input
                        value={blockForm.n_required}
                        onChange={(e) =>
                          setBlockForm((prev) => ({ ...prev, n_required: e.target.value }))
                        }
                      />
                    </Field>
                  ) : null}
                  {blockForm.rule === "CREDITS_OF" ? (
                    <Field label="Credits Required">
                      <Input
                        value={blockForm.credits_required}
                        onChange={(e) =>
                          setBlockForm((prev) => ({ ...prev, credits_required: e.target.value }))
                        }
                      />
                    </Field>
                  ) : null}
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditBlockOpen(false);
                    setEditingBlock(null);
                    setBlockForm(emptyBlockForm());
                  }}
                >
                  Cancel
                </Button>
                <Button colorPalette="green" loading={loading} onClick={handleSaveBlock}>
                  Save Changes
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
                    {courseResults.map((course) => {
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
                          <Text>{formatCourse(course)} - {course.title}</Text>
                          <Text>{course.credits ?? 0} cr</Text>
                        </Button>
                      );
                    })}
                    {courseResults.length === 0 ? (
                      <Text color="fg.muted" fontSize="sm">
                        No matching courses found.
                      </Text>
                    ) : null}
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
    </Box>
  );
}
