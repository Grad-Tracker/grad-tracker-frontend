# Code Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce SonarCloud duplicated lines density from 3.37% to near 0% by extracting shared helpers, components, and hooks across 6 independent PRs.

**Architecture:** Each task is an independent PR targeting a specific duplication category. Tasks can run in parallel via isolated git worktrees since they touch non-overlapping files. Each PR branches from `dev`.

**Tech Stack:** Next.js 16, React 19, Chakra UI v3, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-04-06-code-deduplication-design.md`

---

## Task 1: Test Helper Centralization

**Branch:** `dedup/test-helpers`

**Files:**
- Modify: `src/__tests__/helpers/mocks.ts` (add mock factories)
- Modify: 33 test files (replace local `renderWithChakra` with import, use mock factories)

**Context:** The file `src/__tests__/helpers/mocks.ts` already exports `renderWithChakra`, `createChainMock`, `createMockRouter`, `createMockAuth`. We need to add more factories and update 33 test files to import instead of defining locally.

### Step-by-step:

- [ ] **Step 1: Add mock factories to `src/__tests__/helpers/mocks.ts`**

Add these exports to the end of the existing file:

```typescript
/**
 * Mock next/navigation module.
 * Supports useRouter, useSearchParams, redirect, usePathname.
 */
export function createMockNavigation(overrides: Record<string, unknown> = {}) {
  return {
    useRouter: () => createMockRouter(),
    useSearchParams: () => ({ get: vi.fn().mockReturnValue(null) }),
    redirect: vi.fn(),
    usePathname: vi.fn().mockReturnValue("/"),
    ...overrides,
  };
}

/**
 * Mock Supabase client with optional auth and from.
 */
export function createMockSupabaseClient(overrides: Record<string, unknown> = {}) {
  return {
    createClient: () => ({
      auth: createMockAuth(),
      from: vi.fn().mockReturnValue(createChainMock()),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "" }, error: null }),
        }),
      },
      ...overrides,
    }),
  };
}

/** Mock toaster with create/success/error methods. */
export function createMockToaster() {
  return { toaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() } };
}

/** Mock next/link as a simple <a> tag. */
export function createMockNextLink() {
  return {
    __esModule: true,
    default: ({ href, children }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href }, children),
  };
}

/** Mock ColorModeButton as null. */
export function createMockColorMode() {
  return { ColorModeButton: () => null };
}

/** Mock Field component for form tests. */
export function createMockField() {
  return {
    Field: ({ label, children }: { label?: string; children?: React.ReactNode }) =>
      React.createElement("div", null, label ? React.createElement("label", null, label) : null, children),
  };
}

/** Mock PasswordInput as a simple password input. */
export function createMockPasswordInput() {
  return {
    PasswordInput: (props: Record<string, unknown>) =>
      React.createElement("input", { type: "password", ...props }),
  };
}
```

- [ ] **Step 2: Run existing tests to confirm nothing is broken**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: All existing tests pass.

- [ ] **Step 3: Update all 33 test files to import `renderWithChakra` from helpers**

In each of the following 33 files, **delete** the local `renderWithChakra` function definition and its associated imports (`render` from `@testing-library/react`, `ChakraProvider`/`defaultSystem` from `@chakra-ui/react`), and **add** this import at the top:

```typescript
import { renderWithChakra } from "@/__tests__/helpers/mocks";
```

If the file still needs `render` for other purposes, keep the `@testing-library/react` import. If the file already imports other things from `@/__tests__/helpers/mocks`, merge the import.

Files to update (33 total):
```
src/__tests__/app/dashboard/page.test.tsx
src/__tests__/app/admin/courses/page.test.tsx
src/__tests__/app/admin/courses/CoursesAdminClient.test.tsx
src/__tests__/app/dashboard/courses/CoursesClient.test.tsx
src/__tests__/app/admin/programs/[programId]/ProgramAdminDetailClient.test.tsx
src/__tests__/app/admin/programs/AdminProgramsClient.test.tsx
src/__tests__/app/admin/gen-ed/page.test.tsx
src/__tests__/app/admin/gen-ed/GenEdAdminClient.test.tsx
src/__tests__/components/settings/SettingsSkeleton.test.tsx
src/__tests__/components/requirements/RequirementsSkeleton.test.tsx
src/__tests__/components/requirements/GenEdRequirements.test.tsx
src/__tests__/components/planner/PlannerSkeleton.test.tsx
src/__tests__/components/onboarding/OnboardingWizard.test.tsx
src/__tests__/components/planner/DraggableCourseRow.test.tsx
src/__tests__/components/planner/CourseDetailDrawer.test.tsx
src/__tests__/app/not-found.test.tsx
src/__tests__/app/error.test.tsx
src/__tests__/app/dashboard/error.test.tsx
src/__tests__/components/dashboard/DashboardSkeleton.test.tsx
src/__tests__/components/admin/AdminLayout.test.tsx
src/__tests__/components/LandingPage.test.tsx
src/__tests__/app/signup/page.test.tsx
src/__tests__/app/signin/page.test.tsx
src/__tests__/app/admin/signup/page.test.tsx
src/__tests__/app/admin/signin/page.test.tsx
src/__tests__/components/planner/GenEdProgress.test.tsx
src/__tests__/app/admin/page.test.tsx
src/__tests__/app/admin/layout.test.tsx
src/__tests__/components/ReviewStep.test.tsx
src/__tests__/components/ProgramSelectionStep.test.tsx
src/__tests__/components/ClassSelectionStep.test.tsx
src/__tests__/app/forgot-password/page.test.tsx
src/__tests__/app/reset-password/page.test.tsx
```

- [ ] **Step 4: Update test files to use mock factories where beneficial**

For each test file that has inline `vi.mock()` calls matching the common patterns, replace the inline mock object with the corresponding factory call. Example transformations:

**Toaster mocks** (23 files) — replace:
```typescript
vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));
```
with:
```typescript
vi.mock("@/components/ui/toaster", () => createMockToaster());
```
And remove the `mockToaster` definition from `vi.hoisted()` if it was only used for this.

**next/link mocks** (15 files) — replace inline `<a>` wrapper with:
```typescript
vi.mock("next/link", () => createMockNextLink());
```

**ColorMode mocks** (15 files) — replace with:
```typescript
vi.mock("@/components/ui/color-mode", () => createMockColorMode());
```

**Field mocks** (9 files) — replace with:
```typescript
vi.mock("@/components/ui/field", () => createMockField());
```

**PasswordInput mocks** (6 files) — replace with:
```typescript
vi.mock("@/components/ui/password-input", () => createMockPasswordInput());
```

Note: Each file must import the factory functions it uses from `@/__tests__/helpers/mocks`. The `vi.mock()` calls stay in each file (Vitest hoisting requires this).

- [ ] **Step 5: Run all tests**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -30`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/
git commit -m "$(cat <<'EOF'
Centralize test helpers: remove 33 duplicate renderWithChakra definitions

Extract shared mock factories (navigation, supabase client, toaster,
next/link, color-mode, field, password-input) to helpers/mocks.ts.
Update all test files to import from centralized location.
EOF
)"
```

---

## Task 2: Shared Layout Components (Sidebar, Header, Shell)

**Branch:** `dedup/shared-layouts`

**Files:**
- Create: `src/components/shared/BaseSidebar.tsx`
- Create: `src/components/shared/LayoutShell.tsx`
- Create: `src/lib/hooks/useUserProfile.ts`
- Modify: `src/components/admin/AdminSidebar.tsx`
- Modify: `src/components/dashboard/DashboardSidebar.tsx`
- Modify: `src/components/admin/AdminHeader.tsx`
- Modify: `src/components/dashboard/DashboardHeader.tsx`
- Modify: `src/components/admin/AdminShell.tsx`
- Modify: `src/components/dashboard/DashboardShell.tsx`

### Step-by-step:

- [ ] **Step 1: Create `src/lib/hooks/useUserProfile.ts`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DB_TABLES, STUDENT_COLUMNS } from "@/lib/supabase/queries/schema";

const PROFILE_IMAGE_BUCKET = "profile-images";
const STAFF_TABLE = "staff";

interface UserProfile {
  userName: string;
  avatarUrl: string;
  loading: boolean;
}

export function useUserProfile(options: { includeAvatar?: boolean } = {}): UserProfile {
  const { includeAvatar = false } = options;
  const [userName, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { first_name, last_name } = user.user_metadata ?? {};
      const fallbackName = [first_name, last_name].filter(Boolean).join(" ").trim();
      setUserName(fallbackName);

      // Try student record
      const { data: student } = await supabase
        .from(DB_TABLES.students)
        .select("first_name, last_name, avatar_path")
        .eq(STUDENT_COLUMNS.authUserId, user.id)
        .maybeSingle();

      if (student) {
        const name = [student.first_name, student.last_name].filter(Boolean).join(" ").trim();
        setUserName(name || fallbackName);
        if (includeAvatar && student.avatar_path) {
          await loadAvatar(supabase, student.avatar_path);
        }
        setLoading(false);
        return;
      }

      // Try staff record
      const { data: staff } = await supabase
        .from(STAFF_TABLE)
        .select("first_name, last_name, avatar_path")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (staff) {
        const name = [staff.first_name, staff.last_name].filter(Boolean).join(" ").trim();
        setUserName(name || fallbackName);
        if (includeAvatar && staff.avatar_path) {
          await loadAvatar(supabase, staff.avatar_path);
        }
      }
      setLoading(false);
    }

    async function loadAvatar(supabase: ReturnType<typeof createClient>, path: string) {
      try {
        const { data, error } = await supabase.storage
          .from(PROFILE_IMAGE_BUCKET)
          .createSignedUrl(path, 60 * 60);
        if (!error) setAvatarUrl(data.signedUrl);
      } catch {
        setAvatarUrl("");
      }
    }

    loadUser();
  }, [includeAvatar]);

  return { userName, avatarUrl, loading };
}
```

- [ ] **Step 2: Create `src/components/shared/BaseSidebar.tsx`**

Extract the shared sidebar structure. The component accepts nav items, branding, and an optional account section slot. Both AdminSidebar and DashboardSidebar will use this.

Props interface:
```typescript
interface NavItem {
  icon: React.ComponentType;
  label: string;
  href: string;
}

interface BaseSidebarProps {
  navItems: NavItem[];
  logoIcon: React.ComponentType;
  logoText: string;
  logoSubtext?: string;
  logoColor?: string;
  accountSection?: React.ReactNode;
  mobileTrailing?: React.ReactNode;
  onSignOut?: () => void;
}
```

The component renders:
- **Mobile**: Fixed top bar with logo icon, nav items (horizontal scroll), and `mobileTrailing` slot (sign-out button for admin, nothing for dashboard since it's in the account menu)
- **Desktop**: Fixed left 260px sidebar with logo header, vertical nav items, and `accountSection` slot at bottom (sign-out for admin, avatar menu for dashboard)

Both mobile and desktop nav items use identical active-state styling: `bg: active ? "blue.subtle" : "transparent"`, `color: active ? "blue.fg" : "fg.muted"`, `_hover` transitions.

- [ ] **Step 3: Create `src/components/shared/LayoutShell.tsx`**

```typescript
"use client";

import React from "react";
import { Box, Flex } from "@chakra-ui/react";

interface LayoutShellProps {
  sidebar: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
}

export default function LayoutShell({ sidebar, header, children }: LayoutShellProps) {
  return (
    <Box minH="100vh" bg="bg" fontFamily="var(--font-dm-sans), sans-serif">
      <Flex>
        {sidebar}
        <Box
          flex="1"
          ml={{ base: "0", lg: "260px" }}
          pt={{ base: "56px", lg: "0" }}
          minH="100vh"
          position="relative"
          className="mesh-gradient-subtle"
        >
          {header}
          <Box px={{ base: "4", md: "8" }} py="6" position="relative" zIndex="1">
            {children}
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}
```

- [ ] **Step 4: Refactor `AdminSidebar.tsx` to use `BaseSidebar`**

Replace the full component body with a thin wrapper that passes admin-specific nav items, branding, and a sign-out button to `BaseSidebar`.

- [ ] **Step 5: Refactor `DashboardSidebar.tsx` to use `BaseSidebar` and `useUserProfile`**

Replace the user loading logic (lines 44-106) with `useUserProfile({ includeAvatar: true })`. Pass the avatar menu as `accountSection` to `BaseSidebar`.

- [ ] **Step 6: Refactor `AdminHeader.tsx` to use `useUserProfile`**

Replace lines 15-25 (user loading logic) with `const { userName } = useUserProfile();`.

- [ ] **Step 7: Refactor `DashboardHeader.tsx` to use `useUserProfile`**

Replace lines 30-101 (user loading + avatar logic) with `const { userName, avatarUrl } = useUserProfile({ includeAvatar: true });`.

- [ ] **Step 8: Refactor `AdminShell.tsx` to use `LayoutShell`**

```typescript
"use client";

import React from "react";
import LayoutShell from "@/components/shared/LayoutShell";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

export default function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <LayoutShell sidebar={<AdminSidebar />} header={<AdminHeader />}>
      {children}
    </LayoutShell>
  );
}
```

- [ ] **Step 9: Refactor `DashboardShell.tsx` to use `LayoutShell`**

```typescript
"use client";

import React from "react";
import LayoutShell from "@/components/shared/LayoutShell";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { AtlasPanelProvider } from "@/contexts/AtlasPanelContext";
import AtlasPanel from "@/components/dashboard/AtlasPanel";
import AtlasFAB from "@/components/dashboard/AtlasFAB";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AtlasPanelProvider>
      <LayoutShell sidebar={<DashboardSidebar />}>
        {children}
      </LayoutShell>
      <AtlasPanel />
      <AtlasFAB />
    </AtlasPanelProvider>
  );
}
```

- [ ] **Step 10: Run tests and verify the app builds**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -20`
Run: `npm run build 2>&1 | tail -10`
Expected: All tests pass, build succeeds.

- [ ] **Step 11: Commit**

```bash
git add src/components/shared/ src/lib/hooks/ src/components/admin/ src/components/dashboard/
git commit -m "$(cat <<'EOF'
Extract shared layout components: BaseSidebar, LayoutShell, useUserProfile

Deduplicate sidebar, header, and shell code between admin and dashboard.
Admin/Dashboard variants are now thin wrappers over shared components.
EOF
)"
```

---

## Task 3: Shared UI Patterns (Dialog, Skeleton, Checklist)

**Branch:** `dedup/shared-ui-patterns`

**Files:**
- Create: `src/components/shared/ConfirmationDialog.tsx`
- Create: `src/components/shared/SkeletonParts.tsx`
- Create: `src/components/shared/RequirementCard.tsx`
- Modify: `src/components/planner/DeletePlanDialog.tsx`
- Modify: `src/components/planner/RemoveSemesterDialog.tsx`
- Modify: `src/components/planner/AddSemesterDialog.tsx`
- Modify: `src/components/dashboard/DashboardSkeleton.tsx`
- Modify: `src/components/planner/PlannerSkeleton.tsx`
- Modify: `src/components/settings/SettingsSkeleton.tsx`
- Modify: `src/components/requirements/RequirementsSkeleton.tsx`
- Modify: `src/components/settings/GenEdChecklist.tsx`
- Modify: `src/components/settings/MajorChecklist.tsx`

### Step-by-step:

- [ ] **Step 1: Create `src/components/shared/ConfirmationDialog.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Button, CloseButton, Dialog, Portal } from "@chakra-ui/react";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  title: string;
  children: React.ReactNode;
  confirmText: string;
  confirmColor?: "red" | "blue" | "orange";
  cancelText?: string;
}

export default function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  children,
  confirmText,
  confirmColor = "red",
  cancelText = "Cancel",
}: ConfirmationDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root lazyMount open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderRadius="xl">
            <Dialog.Header>
              <Dialog.Title
                fontFamily="var(--font-dm-sans), sans-serif"
                fontWeight="400"
                letterSpacing="-0.02em"
              >
                {title}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>{children}</Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline" borderRadius="lg">
                  {cancelText}
                </Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette={confirmColor}
                borderRadius="lg"
                onClick={handleConfirm}
                loading={loading}
              >
                {confirmText}
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Refactor `DeletePlanDialog.tsx` to use `ConfirmationDialog`**

Replace the entire dialog structure. The component becomes:

```typescript
"use client";

import { Text } from "@chakra-ui/react";
import ConfirmationDialog from "@/components/shared/ConfirmationDialog";
import type { PlanWithMeta } from "@/types/planner";

interface DeletePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  plan: PlanWithMeta | null;
}

export default function DeletePlanDialog({ open, onOpenChange, onConfirm, plan }: DeletePlanDialogProps) {
  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title="Delete Plan"
      confirmText="Delete Plan"
      confirmColor="red"
    >
      <Text fontSize="sm" color="fg.muted">
        Are you sure you want to delete{" "}
        <Text as="span" fontWeight="600" color="fg">{plan?.name}</Text>
        ? This will remove all {plan?.term_count ?? 0} semesters and{" "}
        {plan?.course_count ?? 0} planned courses. This action cannot be undone.
      </Text>
    </ConfirmationDialog>
  );
}
```

- [ ] **Step 3: Refactor `RemoveSemesterDialog.tsx` to use `ConfirmationDialog`**

Same pattern — replace dialog boilerplate, keep only the unique body content.

```typescript
"use client";

import { Text } from "@chakra-ui/react";
import ConfirmationDialog from "@/components/shared/ConfirmationDialog";
import type { Term } from "@/types/planner";

interface RemoveSemesterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  term: Term | null;
  courseCount: number;
}

export default function RemoveSemesterDialog({
  open, onOpenChange, onConfirm, term, courseCount,
}: RemoveSemesterDialogProps) {
  if (!term) return null;

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={`Remove ${term.season} ${term.year}?`}
      confirmText="Remove Semester"
      confirmColor="red"
    >
      <Text fontSize="sm" color="fg.muted">
        This semester has{" "}
        <Text as="span" fontWeight="600" color="fg">
          {courseCount} {courseCount === 1 ? "course" : "courses"}
        </Text>{" "}
        planned. Removing it will unplan all courses and return them to the course pool.
      </Text>
    </ConfirmationDialog>
  );
}
```

- [ ] **Step 4: Refactor `AddSemesterDialog.tsx` to use `ConfirmationDialog`**

This one has form inputs in the body, so pass the season/year form as `children`. The `onConfirm` calls the existing `handleAdd` logic. Keep the season buttons, year input, and validation logic inside the component but use `ConfirmationDialog` for the wrapper.

- [ ] **Step 5: Create `src/components/shared/SkeletonParts.tsx`**

```typescript
import { Box, Card, Flex, HStack, Stack } from "@chakra-ui/react";
import { Skeleton } from "@/components/ui/skeleton";

/** Standard skeleton card wrapper matching the app's card styling. */
export function SkeletonCard({
  header,
  children,
}: {
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
      {header && <Card.Header p="5" pb="0">{header}</Card.Header>}
      <Card.Body p="5">{children}</Card.Body>
    </Card.Root>
  );
}

/** Skeleton row with an optional icon placeholder and text. */
export function SkeletonRow({
  iconSize = "8",
  textWidth = "60%",
  textHeight = "4",
}: {
  iconSize?: string;
  textWidth?: string;
  textHeight?: string;
}) {
  return (
    <HStack gap="3">
      <Skeleton height={iconSize} width={iconSize} borderRadius="md" />
      <Skeleton height={textHeight} width={textWidth} />
    </HStack>
  );
}

/** Skeleton progress bar with label. */
export function SkeletonProgressBar() {
  return (
    <Stack gap="2">
      <Flex justify="space-between">
        <Skeleton height="3" width="80px" />
        <Skeleton height="3" width="40px" />
      </Flex>
      <Skeleton height="2" width="100%" borderRadius="full" />
    </Stack>
  );
}

/** Repeats a skeleton row N times. */
export function SkeletonList({ count, ...rowProps }: { count: number } & Parameters<typeof SkeletonRow>[0]) {
  return (
    <Stack gap="3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} {...rowProps} />
      ))}
    </Stack>
  );
}
```

- [ ] **Step 6: Refactor skeleton files to use `SkeletonParts`**

Update `DashboardSkeleton.tsx`, `PlannerSkeleton.tsx`, `SettingsSkeleton.tsx`, and `RequirementsSkeleton.tsx` to import and use `SkeletonCard`, `SkeletonRow`, `SkeletonProgressBar`, and `SkeletonList` instead of repeating Card.Root + Skeleton patterns inline. Each file keeps its unique layout composition.

- [ ] **Step 7: Create `src/components/shared/RequirementCard.tsx`**

```typescript
import { Card, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { Checkbox } from "@/components/ui/checkbox";

interface RequirementItem {
  id: number;
  label: string;
  checked: boolean;
}

interface RequirementCardProps {
  title: string;
  badge: React.ReactNode;
  items: RequirementItem[];
  onToggleItem: (id: number, checked: boolean) => void;
}

export default function RequirementCard({ title, badge, items, onToggleItem }: RequirementCardProps) {
  return (
    <Card.Root bg="bg" borderRadius="xl" borderWidth="1px" borderColor="border.subtle">
      <Card.Header p="5" pb="3">
        <HStack justify="space-between">
          <Heading size="sm" fontWeight="600">{title}</Heading>
          {badge}
        </HStack>
      </Card.Header>
      <Card.Body p="5" pt="0">
        <Stack gap="2">
          {items.map((item) => (
            <Checkbox
              key={item.id}
              colorPalette="blue"
              checked={item.checked}
              onCheckedChange={(e) => onToggleItem(item.id, !!e.checked)}
            >
              <Text fontSize="sm">{item.label}</Text>
            </Checkbox>
          ))}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
```

- [ ] **Step 8: Refactor `GenEdChecklist.tsx` and `MajorChecklist.tsx` to use `RequirementCard`**

Each becomes a thin wrapper that maps its domain data (buckets / major blocks) into `RequirementCard` props.

- [ ] **Step 9: Run tests and build**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -20`
Run: `npm run build 2>&1 | tail -10`
Expected: All tests pass, build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/components/shared/ src/components/planner/ src/components/dashboard/ src/components/settings/ src/components/requirements/
git commit -m "$(cat <<'EOF'
Extract shared UI patterns: ConfirmationDialog, SkeletonParts, RequirementCard

Deduplicate dialog boilerplate, skeleton card patterns, and checklist
components into reusable shared components.
EOF
)"
```

---

## Task 4: Program Selector + Constants

**Branch:** `dedup/program-selector`

**Files:**
- Create: `src/lib/program-constants.ts`
- Create: `src/components/shared/ProgramSelector.tsx`
- Modify: `src/components/planner/CreatePlanDialog.tsx`
- Modify: `src/components/planner/AutoGenerateDialog.tsx`
- Modify: `src/components/onboarding/ProgramSelectionStep.tsx`

### Step-by-step:

- [ ] **Step 1: Create `src/lib/program-constants.ts`**

```typescript
import { LuGraduationCap, LuBookOpen, LuAward } from "react-icons/lu";
import type { Program } from "@/types/onboarding";

export const TYPE_ORDER: Program["program_type"][] = ["MAJOR", "MINOR", "CERTIFICATE", "GRADUATE"];

export const TYPE_META: Record<
  string,
  { label: string; color: string; icon: typeof LuGraduationCap }
> = {
  MAJOR: { label: "Majors", color: "blue", icon: LuGraduationCap },
  MINOR: { label: "Minors", color: "purple", icon: LuBookOpen },
  CERTIFICATE: { label: "Certificates", color: "orange", icon: LuAward },
  GRADUATE: { label: "Graduate Programs", color: "purple", icon: LuGraduationCap },
};
```

- [ ] **Step 2: Create `src/components/shared/ProgramSelector.tsx`**

Build the shared program selector component with:
- Props: `programs`, `selectedIds: Set<number>`, `onToggle: (id: number) => void`, `searchQuery: string`, `onSearchChange: (q: string) => void`, `groupByType?: boolean`, `typeOrder?: Program["program_type"][]`
- Search input with `LuSearch` icon (absolute positioned left)
- Filter logic: `program.name.toLowerCase().includes(query.toLowerCase())`
- Type-grouped rendering: iterate `typeOrder`, show icon + label + badge header, then program buttons
- Selected state: `colorPalette="blue" variant="subtle"` for selected, `variant="outline"` for unselected
- Import `TYPE_ORDER` and `TYPE_META` from `@/lib/program-constants`

Reference the existing code in `CreatePlanDialog.tsx:202-312` for the exact UI structure.

- [ ] **Step 3: Refactor `CreatePlanDialog.tsx`**

- Remove local `TYPE_ORDER` and `TYPE_META` (lines 44-54)
- Remove the inline program selector JSX (lines ~202-312)
- Import and use `<ProgramSelector>` component
- Keep: dialog structure, plan name/description inputs, auto-generate switch

- [ ] **Step 4: Refactor `AutoGenerateDialog.tsx`**

- Remove local `TYPE_ORDER` and `TYPE_META` (lines 61-71)
- Remove the inline program selector JSX (lines ~544-672)
- Import and use `<ProgramSelector>` component
- Keep: drawer structure, generation config, results display
- Note: AutoGenerateDialog's `TYPE_ORDER` excludes `"GRADUATE"` — pass `typeOrder={["MAJOR", "MINOR", "CERTIFICATE"]}` as prop

- [ ] **Step 5: Refactor `ProgramSelectionStep.tsx`**

- Replace inline program rendering with `<ProgramSelector>` component
- This file uses RadioCards instead of Buttons — the `ProgramSelector` should support this via a `mode="single"` prop that renders buttons with single-select behavior (matching the existing button-based UI in CreatePlan/AutoGenerate)
- Keep: onboarding-specific messaging, semester selection, certificates collapsible section

- [ ] **Step 6: Run tests and build**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -20`
Run: `npm run build 2>&1 | tail -10`
Expected: All tests pass, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/program-constants.ts src/components/shared/ProgramSelector.tsx src/components/planner/ src/components/onboarding/
git commit -m "$(cat <<'EOF'
Extract shared ProgramSelector component and program constants

Deduplicate program type metadata and selection UI across
CreatePlanDialog, AutoGenerateDialog, and ProgramSelectionStep.
EOF
)"
```

---

## Task 5: Query Layer Cleanup

**Branch:** `dedup/query-cleanup`

**Files:**
- Modify: `src/lib/supabase/queries/helpers.ts`
- Modify: `src/lib/supabase/queries/planner.ts`
- Modify: `src/lib/supabase/queries/onboarding.ts`
- Modify: `src/lib/supabase/queries/classHistory.ts`
- Modify: `src/lib/auth-helpers.ts`
- Modify: `src/app/api/ai-advisor/context/route.ts`
- Modify: `src/app/api/ai-advisor/chat/route.ts`
- Modify: `src/app/api/ai-advisor/chat/stream/route.ts`
- Modify: `src/app/api/advisor/verify-signup-code/route.ts`

### Step-by-step:

- [ ] **Step 1: Add `mapViewBlockToCourseBlock` to `helpers.ts`**

Add to `src/lib/supabase/queries/helpers.ts`:

```typescript
import type { ViewProgramBlockCoursesRow } from "./view-types";

/** Map a view block row to a typed course block object. */
export function mapViewBlockToCourseBlock(row: ViewProgramBlockCoursesRow) {
  return {
    id: Number(row.block_id),
    program_id: Number(row.program_id),
    name: row.block_name,
    rule: row.rule,
    n_required: row.n_required,
    credits_required: row.credits_required,
    courses: (row.courses ?? []).map(viewItemToCourse),
  };
}
```

- [ ] **Step 2: Remove local aliases in `planner.ts`**

Delete these lines from `src/lib/supabase/queries/planner.ts`:
```typescript
const toCourseFromBlockItem = viewItemToCourse;
const toCourseFromGenEdItem = viewItemToCourse;
```

Replace all usages of `toCourseFromBlockItem` and `toCourseFromGenEdItem` in the file with `viewItemToCourse`. Also replace inline block mapping with `mapViewBlockToCourseBlock` where applicable.

- [ ] **Step 3: Remove local alias in `onboarding.ts`**

Delete from `src/lib/supabase/queries/onboarding.ts`:
```typescript
const toCourseRowFromView = viewItemToCourse;
```

Replace usages with `viewItemToCourse`. Replace inline block mapping with `mapViewBlockToCourseBlock`.

- [ ] **Step 4: Remove local alias in `classHistory.ts`**

Delete from `src/lib/supabase/queries/classHistory.ts`:
```typescript
const toCourseRow = viewItemToCourse;
```

Replace usages with `viewItemToCourse`.

- [ ] **Step 5: Have `planner.ts` use `mapPlannedCourses` from `shared-plans.ts`**

In `src/lib/supabase/queries/planner.ts`, find the `fetchPlannedCourses` function's inline `.map()` that duplicates `mapPlannedCourses` from `shared-plans.ts`. Import and use the shared version instead.

- [ ] **Step 6: Add `requireAuthUser` to `src/lib/auth-helpers.ts`**

Add to the existing file:

```typescript
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Require an authenticated user in an API route.
 * Returns the user and supabase client, or a 401 NextResponse.
 */
export async function requireAuthUser() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      supabase,
      errorResponse: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  return { user, supabase, errorResponse: null };
}
```

- [ ] **Step 7: Refactor API routes to use `requireAuthUser`**

In each API route file (`ai-advisor/context/route.ts`, `ai-advisor/chat/route.ts`, `ai-advisor/chat/stream/route.ts`, `advisor/verify-signup-code/route.ts`), replace the inline auth check pattern:

```typescript
// Before:
const supabase = await createClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

// After:
const { user, supabase, errorResponse } = await requireAuthUser();
if (errorResponse) return errorResponse;
```

- [ ] **Step 8: Run tests and build**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -20`
Run: `npm run build 2>&1 | tail -10`
Expected: All tests pass, build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/lib/supabase/queries/ src/lib/auth-helpers.ts src/app/api/
git commit -m "$(cat <<'EOF'
Consolidate query helpers: remove aliases, extract shared mappers, add requireAuthUser

Remove redundant viewItemToCourse aliases across query files.
Extract mapViewBlockToCourseBlock helper. Reuse mapPlannedCourses
from shared-plans. Add requireAuthUser for API route auth checks.
EOF
)"
```

---

## Task 6: Miscellaneous Cleanup

**Branch:** `dedup/misc-cleanup`

**Files:**
- Create: `src/lib/email-validation.ts`
- Create: `src/lib/constants.ts`
- Modify: `src/app/dashboard/requirements/[id]/ProgramDetailClient.tsx`
- Modify: `src/components/auth/RoleSignInForm.tsx`
- Modify: `src/app/admin/(public)/signup/AdvisorSignupClient.tsx`
- Modify: `src/app/signup/page.tsx`
- Modify: `src/app/shared/layout.tsx`
- Modify: `src/app/admin/(protected)/courses/CoursesAdminClient.tsx`
- Modify: `src/app/dashboard/courses/CoursesClient.tsx`
- Modify: `src/lib/supabase/queries/courses.ts`

### Step-by-step:

- [ ] **Step 1: Fix subject color duplication in `ProgramDetailClient.tsx`**

In `src/app/dashboard/requirements/[id]/ProgramDetailClient.tsx`:
- Delete the inline `getSubjectColor` function (lines ~55-75)
- Add import: `import { getSubjectColor } from "@/lib/subject-colors";`
- This fixes 6 color inconsistencies (CS, CSCI, MATH, ENGL, CHEM, PHYS, ART, MUSC)

- [ ] **Step 2: Create `src/lib/email-validation.ts`**

```typescript
export type UserRole = "student" | "advisor";

interface EmailValidationResult {
  isValid: boolean;
  errorTitle?: string;
  errorDescription?: string;
}

const STUDENT_DOMAIN = "@rangers.uwp.edu";
const ADVISOR_DOMAIN = "@uwp.edu";

export function validateEmailDomain(role: UserRole, email: string): EmailValidationResult {
  const normalizedEmail = email.trim().toLowerCase();

  if (role === "student") {
    if (!normalizedEmail.endsWith(STUDENT_DOMAIN)) {
      return {
        isValid: false,
        errorTitle: "Invalid email domain",
        errorDescription: "Student sign up requires a @rangers.uwp.edu email address.",
      };
    }
  } else {
    if (!normalizedEmail.endsWith(ADVISOR_DOMAIN) || normalizedEmail.endsWith(STUDENT_DOMAIN)) {
      return {
        isValid: false,
        errorTitle: "Invalid email domain",
        errorDescription: "Advisor sign up requires a @uwp.edu email address.",
      };
    }
  }

  return { isValid: true };
}

/** Normalize an email for comparison/submission. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
```

- [ ] **Step 3: Refactor email validation consumers**

In `src/components/auth/RoleSignInForm.tsx`, `src/app/admin/(public)/signup/AdvisorSignupClient.tsx`, and `src/app/signup/page.tsx`:
- Import `validateEmailDomain` and `normalizeEmail` from `@/lib/email-validation`
- Replace inline domain checks with:
```typescript
const validation = validateEmailDomain(role, email);
if (!validation.isValid) {
  toaster.create({ title: validation.errorTitle, description: validation.errorDescription, type: "error" });
  return;
}
```

- [ ] **Step 4: Deduplicate shared layout**

In `src/app/shared/layout.tsx`, if it's identical to `src/app/dashboard/layout.tsx`, replace with a re-export:
```typescript
export { default } from "@/app/dashboard/layout";
```

Or if the layout uses DashboardShell directly, import from the same source.

- [ ] **Step 5: Create `src/lib/constants.ts` for pagination**

```typescript
/** Admin courses table page size. */
export const ADMIN_PAGE_SIZE = 25;

/** Dashboard courses view page size. */
export const DASHBOARD_PAGE_SIZE = 52;

/** API/query default page size. */
export const API_PAGE_SIZE = 20;
```

Update imports in `CoursesAdminClient.tsx`, `CoursesClient.tsx`, and `queries/courses.ts`.

- [ ] **Step 6: Run tests and build**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -20`
Run: `npm run build 2>&1 | tail -10`
Expected: All tests pass, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/email-validation.ts src/lib/constants.ts src/lib/subject-colors.ts src/app/ src/components/auth/
git commit -m "$(cat <<'EOF'
Misc deduplication: fix subject colors, centralize email validation and constants

Remove divergent inline getSubjectColor (fixes 6 color mismatches).
Extract validateEmailDomain helper. Centralize pagination constants.
Deduplicate shared layout.
EOF
)"
```
