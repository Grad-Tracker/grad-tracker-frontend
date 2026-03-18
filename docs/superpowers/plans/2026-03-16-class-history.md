# Class History Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Class History tab to the Settings page so students can view/manage completed courses across Gen Ed, Major, and Additional categories.

**Architecture:** Orchestrator + Section Components. `ClassHistoryTab` fetches all data and owns all mutations. Presentational components (`GenEdChecklist`, `MajorChecklist`, `AdditionalCourses`) receive data + callbacks. `CourseSearchDialog` and `ManualCourseForm` handle the add-course flow, delegating DB operations to the orchestrator.

**Tech Stack:** Next.js 16 (App Router), React 19, Chakra UI v3, Supabase (client-side), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-16-class-history-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/supabase/queries/classHistory.ts` | All Supabase queries for class history |
| Create | `src/components/settings/GenEdChecklist.tsx` | Gen ed bucket checklist UI |
| Create | `src/components/settings/MajorChecklist.tsx` | Major requirements checklist UI |
| Create | `src/components/settings/AdditionalCourses.tsx` | Additional courses list + add/delete |
| Create | `src/components/settings/CourseSearchDialog.tsx` | Search dialog for adding courses |
| Create | `src/components/settings/ManualCourseForm.tsx` | Manual course entry form |
| Create | `src/components/settings/ClassHistoryTab.tsx` | Orchestrator: data fetching, state, mutations |
| Modify | `src/app/dashboard/settings/page.tsx` | Add Tabs wrapper, Profile + Class History tabs |

---

### Task 1: RLS Migration — Allow authenticated course inserts

**Files:**
- Migration via Supabase MCP

- [ ] **Step 1: Apply RLS INSERT policy on `courses` for authenticated users**

Use `mcp__supabase__apply_migration` with name `allow_authenticated_insert_courses`:

```sql
CREATE POLICY "allow_authenticated_insert_courses"
ON courses
FOR INSERT
TO authenticated
WITH CHECK (true);
```

- [ ] **Step 2: Verify the policy works**

Use `mcp__supabase__execute_sql`:

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'courses' AND cmd = 'INSERT';
```

Expected: row with `allow_authenticated_insert_courses`.

- [ ] **Step 3: Commit**

No local file changes for this task (migration applied via MCP). Skip git commit.

---

### Task 2: Data Layer — `classHistory.ts`

**Files:**
- Create: `src/lib/supabase/queries/classHistory.ts`

**References:**
- `src/lib/supabase/queries/schema.ts` — `DB_TABLES`, `PROGRAM_TYPES`
- `src/lib/supabase/queries/planner.ts:535-588` — `fetchGenEdBucketsWithCourses` (reuse, do NOT duplicate)
- `src/types/onboarding.ts` — `CourseRow`, `RequirementBlock`
- `src/types/course.ts` — `Course`
- `src/lib/supabase/client.ts` — `createClient`

- [ ] **Step 1: Create `classHistory.ts` with types and all query functions**

```typescript
import { createClient } from "@/lib/supabase/client";
import { DB_TABLES, PROGRAM_TYPES } from "./schema";
import type { CourseRow } from "@/types/onboarding";

// --- Types ---

export interface StudentCourseHistoryRow {
  course_id: number;
  term_id: number;
  completed: boolean;
  course: CourseRow;
}

export interface MajorWithRequirements {
  majorName: string;
  blocks: {
    id: number;
    name: string;
    courses: CourseRow[];
  }[];
}

// --- Queries ---

/** Get the lowest-ID term to use as default for inserts (term_id is NOT NULL). */
export async function fetchDefaultTermId(): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.terms)
    .select("id")
    .order("id", { ascending: true })
    .limit(1)
    .single();
  if (error) throw error;
  return data.id;
}

/** Fetch student's major and its requirement blocks with courses. Returns null if no major. */
export async function fetchMajorRequirementCourses(
  studentId: number
): Promise<MajorWithRequirements | null> {
  const supabase = createClient();

  // Step 1: Get all program_ids for this student
  const { data: studentPrograms, error: spErr } = await supabase
    .from(DB_TABLES.studentPrograms)
    .select("program_id")
    .eq("student_id", studentId);

  if (spErr) throw spErr;
  if (!studentPrograms?.length) return null;

  const programIds = studentPrograms.map((sp: { program_id: number }) => sp.program_id);

  // Step 2: Find which of those programs is a MAJOR
  const { data: majorProgram, error: progErr } = await supabase
    .from(DB_TABLES.programs)
    .select("id, name")
    .in("id", programIds)
    .eq("program_type", PROGRAM_TYPES.major)
    .maybeSingle();

  if (progErr) throw progErr;
  if (!majorProgram) return null;

  const program = majorProgram as { id: number; name: string };

  // Get requirement blocks for this program
  const { data: blocks, error: blocksErr } = await supabase
    .from(DB_TABLES.programRequirementBlocks)
    .select("id, name")
    .eq("program_id", program.id);

  if (blocksErr) throw blocksErr;
  if (!blocks?.length) return { majorName: program.name, blocks: [] };

  const blockIds = blocks.map((b: { id: number }) => b.id);

  // Get courses for all blocks
  const { data: reqCourses, error: rcErr } = await supabase
    .from(DB_TABLES.programRequirementCourses)
    .select("block_id, course_id, courses:course_id (id, subject, number, title, credits)")
    .in("block_id", blockIds);

  if (rcErr) throw rcErr;

  // Group courses by block
  const blockMap = new Map<number, CourseRow[]>();
  for (const rc of reqCourses ?? []) {
    const course = rc.courses as unknown as CourseRow;
    if (!course) continue;
    const existing = blockMap.get(rc.block_id) ?? [];
    existing.push(course);
    blockMap.set(rc.block_id, existing);
  }

  return {
    majorName: program.name,
    blocks: blocks.map((b: { id: number; name: string }) => ({
      id: b.id,
      name: b.name,
      courses: blockMap.get(b.id) ?? [],
    })),
  };
}

/** Fetch all course history rows for a student, joined with course details. */
export async function fetchStudentCourseHistory(
  studentId: number
): Promise<StudentCourseHistoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .select(
      "course_id, term_id, completed, courses:course_id (id, subject, number, title, credits)"
    )
    .eq("student_id", studentId);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    course_id: row.course_id,
    term_id: row.term_id,
    completed: row.completed,
    course: row.courses as CourseRow,
  }));
}

/** Insert a course into student_course_history. Plain INSERT (no upsert).
 *  Silently ignores duplicate inserts (Postgres error 23505). */
export async function insertCourseHistory(
  studentId: number,
  courseId: number,
  termId: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from(DB_TABLES.studentCourseHistory).insert({
    student_id: studentId,
    course_id: courseId,
    term_id: termId,
    completed: true,
  });
  if (error) {
    // Ignore unique constraint violation (course already in history)
    if (error.code === "23505") return;
    throw error;
  }
}

/** Delete a course from student_course_history by all 3 PK columns. */
export async function deleteCourseHistory(
  studentId: number,
  courseId: number,
  termId: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from(DB_TABLES.studentCourseHistory)
    .delete()
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .eq("term_id", termId);
  if (error) throw error;
}

/** Search courses by subject+number or title. Min 2 chars. Max 20 results. */
export async function searchCourses(query: string): Promise<CourseRow[]> {
  if (query.length < 2) return [];
  const supabase = createClient();
  const pattern = `%${query}%`;

  const { data, error } = await supabase
    .from(DB_TABLES.courses)
    .select("id, subject, number, title, credits")
    .or(`title.ilike.${pattern},subject.ilike.${pattern},number.ilike.${pattern}`)
    .limit(20);

  if (error) throw error;
  return (data ?? []) as CourseRow[];
}

/** Insert a manually-entered course into the courses table. Returns the new row. */
export async function insertManualCourse(
  subject: string,
  number: string,
  title: string,
  credits: number
): Promise<CourseRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.courses)
    .insert({ subject, number, title, credits })
    .select("id, subject, number, title, credits")
    .single();
  if (error) throw error;
  return data as CourseRow;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep classHistory || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/queries/classHistory.ts
git commit -m "feat: add classHistory query functions for course history management"
```

---

### Task 3: GenEdChecklist Component

**Files:**
- Create: `src/components/settings/GenEdChecklist.tsx`

**References:**
- `src/components/ui/checkbox.tsx` — `Checkbox` wrapper
- `src/types/auto-generate.ts:77-83` — `GenEdBucketWithCourses`

- [ ] **Step 1: Create `GenEdChecklist.tsx`**

```tsx
"use client";

import { Box, Card, Heading, HStack, Stack, Text, Badge } from "@chakra-ui/react";
import { Checkbox } from "@/components/ui/checkbox";
import type { GenEdBucketWithCourses } from "@/types/auto-generate";

interface GenEdChecklistProps {
  buckets: GenEdBucketWithCourses[];
  completedCourseIds: Set<number>;
  onToggle: (courseId: number, checked: boolean) => void;
}

export function GenEdChecklist({ buckets, completedCourseIds, onToggle }: GenEdChecklistProps) {
  return (
    <Stack gap="4">
      {buckets.map((bucket) => {
        const completedCredits = bucket.courses
          .filter((c) => completedCourseIds.has(c.id))
          .reduce((sum, c) => sum + c.credits, 0);

        return (
          <Card.Root
            key={bucket.id}
            bg="bg"
            borderRadius="xl"
            borderWidth="1px"
            borderColor="border.subtle"
          >
            <Card.Header p="5" pb="3">
              <HStack justify="space-between">
                <Heading size="sm" fontWeight="600">
                  {bucket.name}
                </Heading>
                <Badge colorPalette="green" variant="subtle">
                  {completedCredits}/{bucket.credits_required} credits
                </Badge>
              </HStack>
            </Card.Header>
            <Card.Body p="5" pt="0">
              <Stack gap="2">
                {bucket.courses.map((course) => (
                  <Checkbox
                    key={course.id}
                    colorPalette="green"
                    checked={completedCourseIds.has(course.id)}
                    onCheckedChange={(e) => onToggle(course.id, !!e.checked)}
                  >
                    <Text fontSize="sm">
                      {course.subject} {course.number} — {course.title}
                    </Text>
                  </Checkbox>
                ))}
              </Stack>
            </Card.Body>
          </Card.Root>
        );
      })}
    </Stack>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep GenEdChecklist || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/GenEdChecklist.tsx
git commit -m "feat: add GenEdChecklist component for gen ed course tracking"
```

---

### Task 4: MajorChecklist Component

**Files:**
- Create: `src/components/settings/MajorChecklist.tsx`

**References:**
- Same UI patterns as `GenEdChecklist.tsx`
- `src/lib/supabase/queries/classHistory.ts` — `MajorWithRequirements`

- [ ] **Step 1: Create `MajorChecklist.tsx`**

```tsx
"use client";

import { Badge, Card, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { Checkbox } from "@/components/ui/checkbox";
import type { MajorWithRequirements } from "@/lib/supabase/queries/classHistory";

interface MajorChecklistProps {
  major: MajorWithRequirements;
  completedCourseIds: Set<number>;
  onToggle: (courseId: number, checked: boolean) => void;
}

export function MajorChecklist({ major, completedCourseIds, onToggle }: MajorChecklistProps) {
  const allCourses = major.blocks.flatMap((b) => b.courses);
  const completedCount = allCourses.filter((c) => completedCourseIds.has(c.id)).length;

  return (
    <Stack gap="4">
      <HStack justify="space-between">
        <Heading size="md" fontWeight="600">
          {major.majorName}
        </Heading>
        <Badge colorPalette="green" variant="subtle">
          {completedCount}/{allCourses.length} courses
        </Badge>
      </HStack>

      {major.blocks.map((block) => {
        const blockCompleted = block.courses.filter((c) => completedCourseIds.has(c.id)).length;
        return (
          <Card.Root
            key={block.id}
            bg="bg"
            borderRadius="xl"
            borderWidth="1px"
            borderColor="border.subtle"
          >
            <Card.Header p="5" pb="3">
              <HStack justify="space-between">
                <Heading size="sm" fontWeight="600">
                  {block.name}
                </Heading>
                <Badge colorPalette="green" variant="outline">
                  {blockCompleted}/{block.courses.length}
                </Badge>
              </HStack>
            </Card.Header>
            <Card.Body p="5" pt="0">
              <Stack gap="2">
                {block.courses.map((course) => (
                  <Checkbox
                    key={course.id}
                    colorPalette="green"
                    checked={completedCourseIds.has(course.id)}
                    onCheckedChange={(e) => onToggle(course.id, !!e.checked)}
                  >
                    <Text fontSize="sm">
                      {course.subject} {course.number} — {course.title}
                    </Text>
                  </Checkbox>
                ))}
              </Stack>
            </Card.Body>
          </Card.Root>
        );
      })}
    </Stack>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep MajorChecklist || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/MajorChecklist.tsx
git commit -m "feat: add MajorChecklist component for major course tracking"
```

---

### Task 5: ManualCourseForm Component

**Files:**
- Create: `src/components/settings/ManualCourseForm.tsx`

**References:**
- `src/components/ui/field.tsx` — `Field` wrapper
- `src/lib/supabase/queries/classHistory.ts` — `insertManualCourse`
- `src/components/ui/toaster.tsx` — `toaster`

- [ ] **Step 1: Create `ManualCourseForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button, Input, Stack, Text } from "@chakra-ui/react";
import { Field } from "@/components/ui/field";
import { toaster } from "@/components/ui/toaster";
import { insertManualCourse } from "@/lib/supabase/queries/classHistory";
import type { CourseRow } from "@/types/onboarding";

interface ManualCourseFormProps {
  onCourseCreated: (course: CourseRow) => void;
  onBack: () => void;
}

export function ManualCourseForm({ onCourseCreated, onBack }: ManualCourseFormProps) {
  const [subject, setSubject] = useState("");
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [credits, setCredits] = useState("");
  const [saving, setSaving] = useState(false);

  const validate = (): string | null => {
    const s = subject.trim().toUpperCase();
    if (!/^[A-Z]{2,10}$/.test(s)) return "Subject must be 2-10 uppercase letters (e.g. MATH)";
    const n = number.trim();
    if (!/^[0-9]{3,4}$/.test(n)) return "Number must be 3-4 digits (e.g. 101)";
    if (!title.trim()) return "Title is required";
    const c = parseFloat(credits);
    if (isNaN(c) || c < 0) return "Credits must be a non-negative number";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toaster.create({ title: err, type: "error" });
      return;
    }
    setSaving(true);
    try {
      const course = await insertManualCourse(
        subject.trim().toUpperCase(),
        number.trim(),
        title.trim(),
        parseFloat(credits)
      );
      toaster.create({ title: "Course added", type: "success" });
      onCourseCreated(course);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toaster.create({ title: "Failed to add course", description: msg, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="4">
      <Field label="Subject">
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. MATH"
          borderRadius="lg"
        />
      </Field>
      <Field label="Course Number">
        <Input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="e.g. 101"
          borderRadius="lg"
        />
      </Field>
      <Field label="Title">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Calculus I"
          borderRadius="lg"
        />
      </Field>
      <Field label="Credits">
        <Input
          type="number"
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          placeholder="e.g. 3"
          min={0}
          borderRadius="lg"
        />
      </Field>
      <Button colorPalette="green" onClick={handleSubmit} loading={saving} borderRadius="lg">
        Add Course
      </Button>
      <Button variant="ghost" size="sm" onClick={onBack} alignSelf="flex-start">
        <Text fontSize="sm" color="fg.muted">
          Back to search
        </Text>
      </Button>
    </Stack>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep ManualCourseForm || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/ManualCourseForm.tsx
git commit -m "feat: add ManualCourseForm for manual course entry"
```

---

### Task 6: CourseSearchDialog Component

**Files:**
- Create: `src/components/settings/CourseSearchDialog.tsx`

**References:**
- `src/components/ui/dialog.tsx` — `DialogRoot`, `DialogContent`, `DialogHeader`, `DialogBody`, `DialogTitle`, `DialogCloseTrigger`
- `src/lib/supabase/queries/classHistory.ts` — `searchCourses`
- `src/components/settings/ManualCourseForm.tsx`

- [ ] **Step 1: Create `CourseSearchDialog.tsx`**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Input, Stack, Text, HStack, Button } from "@chakra-ui/react";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { searchCourses } from "@/lib/supabase/queries/classHistory";
import { ManualCourseForm } from "./ManualCourseForm";
import type { CourseRow } from "@/types/onboarding";

interface CourseSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onCourseSelected: (course: CourseRow) => void;
}

export function CourseSearchDialog({ open, onClose, onCourseSelected }: CourseSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setShowManual(false);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchCourses(query);
        setResults(data);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = (course: CourseRow) => {
    onCourseSelected(course);
    onClose();
  };

  const handleManualCreated = (course: CourseRow) => {
    onCourseSelected(course);
    onClose();
  };

  return (
    <DialogRoot open={open} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{showManual ? "Add Course Manually" : "Search Courses"}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody pb="6">
          {showManual ? (
            <ManualCourseForm
              onCourseCreated={handleManualCreated}
              onBack={() => setShowManual(false)}
            />
          ) : (
            <Stack gap="4">
              <Input
                placeholder="Search by subject, number, or title..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                borderRadius="lg"
                autoFocus
              />
              {searching && (
                <Text fontSize="sm" color="fg.muted">
                  Searching...
                </Text>
              )}
              {!searching && results.length > 0 && (
                <Stack gap="1" maxH="300px" overflowY="auto">
                  {results.map((course) => (
                    <HStack
                      key={course.id}
                      p="2"
                      borderRadius="md"
                      cursor="pointer"
                      _hover={{ bg: "bg.subtle" }}
                      onClick={() => handleSelect(course)}
                    >
                      <Text fontSize="sm" fontWeight="500">
                        {course.subject} {course.number}
                      </Text>
                      <Text fontSize="sm" color="fg.muted">
                        — {course.title} ({course.credits} cr)
                      </Text>
                    </HStack>
                  ))}
                </Stack>
              )}
              {!searching && query.length >= 2 && results.length === 0 && (
                <Text fontSize="sm" color="fg.muted">
                  No courses found.
                </Text>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowManual(true)}
                alignSelf="flex-start"
              >
                <Text fontSize="sm" color="fg.muted">
                  Can&apos;t find your course? Add it manually
                </Text>
              </Button>
            </Stack>
          )}
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep CourseSearchDialog || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/CourseSearchDialog.tsx
git commit -m "feat: add CourseSearchDialog with search and manual entry"
```

---

### Task 7: AdditionalCourses Component

**Files:**
- Create: `src/components/settings/AdditionalCourses.tsx`

**References:**
- `src/components/settings/CourseSearchDialog.tsx`

- [ ] **Step 1: Create `AdditionalCourses.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button, Card, Heading, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import { CourseSearchDialog } from "./CourseSearchDialog";
import type { CourseRow } from "@/types/onboarding";

interface AdditionalCoursesProps {
  courses: CourseRow[];
  onDelete: (courseId: number) => void;
  onCourseSelected: (course: CourseRow) => void;
}

export function AdditionalCourses({ courses, onDelete, onCourseSelected }: AdditionalCoursesProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Stack gap="4">
      <HStack justify="space-between">
        <Heading size="md" fontWeight="600">
          Additional Courses
        </Heading>
        <Button
          colorPalette="green"
          size="sm"
          borderRadius="lg"
          onClick={() => setDialogOpen(true)}
        >
          <Icon>
            <LuPlus />
          </Icon>
          Add Course
        </Button>
      </HStack>

      {courses.length === 0 ? (
        <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
          <Card.Body p="5">
            <Text fontSize="sm" color="fg.muted">
              No additional courses added yet.
            </Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
          <Card.Body p="5">
            <Stack gap="2">
              {courses.map((course) => (
                <HStack key={course.id} justify="space-between">
                  <Text fontSize="sm">
                    {course.subject} {course.number} — {course.title} ({course.credits} cr)
                  </Text>
                  <Button
                    variant="ghost"
                    size="xs"
                    colorPalette="red"
                    onClick={() => onDelete(course.id)}
                  >
                    <Icon>
                      <LuTrash2 />
                    </Icon>
                  </Button>
                </HStack>
              ))}
            </Stack>
          </Card.Body>
        </Card.Root>
      )}

      <CourseSearchDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCourseSelected={onCourseSelected}
      />
    </Stack>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep AdditionalCourses || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/AdditionalCourses.tsx
git commit -m "feat: add AdditionalCourses component with add/delete"
```

---

### Task 8: ClassHistoryTab Orchestrator

**Files:**
- Create: `src/components/settings/ClassHistoryTab.tsx`

**References:**
- `src/lib/supabase/queries/classHistory.ts` — all query functions
- `src/lib/supabase/queries/planner.ts:535-588` — `fetchGenEdBucketsWithCourses` (import, do not duplicate)
- `src/lib/supabase/queries/schema.ts` — `DB_TABLES`, `STUDENT_COLUMNS`
- `src/lib/supabase/client.ts` — `createClient`
- All 4 section components created in Tasks 3-7

- [ ] **Step 1: Create `ClassHistoryTab.tsx`**

```tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Spinner, Stack, Heading, Text } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";
import { DB_TABLES, STUDENT_COLUMNS } from "@/lib/supabase/queries/schema";
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
          .from(DB_TABLES.students)
          .select("id")
          .eq(STUDENT_COLUMNS.authUserId, user.id)
          .maybeSingle();

        if (!student) return;

        const sid = student.id as number;
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
          await insertCourseHistory(studentId, courseId, defaultTermId);
        } else {
          // Use the actual term_id from the history row (may differ from defaultTermId)
          const existingRow = history.find((h) => h.course_id === courseId);
          const termId = existingRow?.term_id ?? defaultTermId;
          await deleteCourseHistory(studentId, courseId, termId);
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
        await insertCourseHistory(studentId, course.id, defaultTermId);
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
        await deleteCourseHistory(studentId, courseId, removed.term_id);
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
        <Spinner colorPalette="green" />
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep ClassHistoryTab || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/ClassHistoryTab.tsx
git commit -m "feat: add ClassHistoryTab orchestrator component"
```

---

### Task 9: Modify Settings Page — Add Tabs

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`

**References:**
- Current file has all settings content in a single `<Stack>` (lines 222-452)
- Chakra UI v3 Tabs compound pattern: `Tabs.Root`, `Tabs.List`, `Tabs.Trigger`, `Tabs.Content`
- Use MCP tool `mcp__chakra-ui__get_component_example` for Tabs before implementing
- `src/components/settings/ClassHistoryTab.tsx`

- [ ] **Step 1: Check Chakra v3 Tabs API**

Use `mcp__chakra-ui__get_component_example` with component "tabs" to verify the v3 compound pattern.

- [ ] **Step 2: Add Tabs import and ClassHistoryTab import**

At the top of `src/app/dashboard/settings/page.tsx`, add to the `@chakra-ui/react` import:

```typescript
import {
  Box,
  Button,
  chakra,
  Card,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  Stack,
  Switch,
  Tabs,
  Text,
} from "@chakra-ui/react";
```

And add:

```typescript
import { ClassHistoryTab } from "@/components/settings/ClassHistoryTab";
```

- [ ] **Step 3: Wrap the return JSX with Tabs**

Replace the returned `<Stack gap="6">` with a Tabs structure. The page header stays outside the tabs. All existing cards go inside the Profile tab content. Class History tab renders `<ClassHistoryTab />`.

The return should become:

```tsx
return (
  <Stack gap="6">
    <Box>
      <Text fontSize="sm" color="fg.muted" fontWeight="500">
        Settings
      </Text>
      <Heading size="lg" fontFamily="'DM Serif Display', serif" fontWeight="400">
        Account Settings
      </Heading>
    </Box>

    <Tabs.Root defaultValue="profile" variant="enclosed" colorPalette="green">
      <Tabs.List>
        <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
        <Tabs.Trigger value="class-history">Class History</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="profile">
        <Stack gap="6" pt="4">
          {/* All 5 existing cards (Profile, Email, Expected Graduation, Notifications, Password) go here — unchanged */}
        </Stack>
      </Tabs.Content>

      <Tabs.Content value="class-history">
        <Box pt="4">
          <ClassHistoryTab />
        </Box>
      </Tabs.Content>
    </Tabs.Root>
  </Stack>
);
```

The 5 existing `<Card.Root>` blocks (lines 233-450 of original) move inside `<Tabs.Content value="profile">` unchanged.

- [ ] **Step 4: Verify it compiles and run dev server**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Run: `npm run dev` (check for rendering in browser)

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/settings/page.tsx
git commit -m "feat: add tabbed layout to settings page with Class History tab"
```

---

### Task 10: Verify with `v2_to_v3_code_review`

- [ ] **Step 1: Run Chakra v2-to-v3 review on all new components**

Use `mcp__chakra-ui__v2_to_v3_code_review` on:
- `src/components/settings/ClassHistoryTab.tsx`
- `src/components/settings/GenEdChecklist.tsx`
- `src/components/settings/MajorChecklist.tsx`
- `src/components/settings/AdditionalCourses.tsx`
- `src/components/settings/CourseSearchDialog.tsx`
- `src/components/settings/ManualCourseForm.tsx`
- `src/app/dashboard/settings/page.tsx`

Fix any v2 patterns flagged.

- [ ] **Step 2: Final build check**

Run: `npm run build 2>&1 | tail -20`

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: address Chakra v3 compatibility issues"
```

(Skip this commit if no fixes were needed.)
