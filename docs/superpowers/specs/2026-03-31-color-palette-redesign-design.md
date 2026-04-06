# GradTracker Color Palette & Typography Redesign

## Context

The current app uses a green-dominant color palette with inconsistent accent colors across components, pure black dark mode, and pure white light mode. The user wants a cohesive, modern-academic visual identity that feels warm and student-friendly. The dot pattern background should be preserved but softened.

## Design Direction

**Navy + Warm Gray** — academic navy as the primary brand color, warm gray neutrals that avoid being too brown or too white, cool charcoal dark mode that avoids being too black. Single font (DM Sans) replaces the current Outfit + Plus Jakarta Sans pairing.

---

## Color Palette

### Primary / Brand

| Token        | Value     | Usage                                      |
|-------------|-----------|---------------------------------------------|
| Navy        | `#1E3A5F` | Logo mark, active nav (light), sidebar accent |
| Blue 600    | `#2563EB` | Primary buttons, links, progress bars, logo (dark) |
| Blue 500    | `#3B82F6` | Hover states, secondary emphasis             |
| Blue 400    | `#60A5FA` | Active nav text (dark), lighter accents      |
| Blue 100    | `#DBEAFE` | Subtle backgrounds, badges (light)           |

### Accent Colors

| Token    | Value     | Usage                                |
|----------|-----------|--------------------------------------|
| Amber    | `#D97706` | Credits/secondary progress, warnings |
| Emerald  | `#059669` | Success states, major requirements   |
| Red      | `#DC2626` | Errors, destructive actions          |
| Violet   | `#7C3AED` | Gen-ed progress, tertiary accent     |

### Light Mode Neutrals

| Token      | Value     | Usage                          |
|-----------|-----------|--------------------------------|
| Text      | `#1C1D1F` | Primary text, headings         |
| Muted     | `#7C7D80` | Secondary text, inactive nav   |
| Border    | `#E5E4E0` | Card borders, dividers         |
| Track     | `#ECEAE7` | Progress bar tracks, subtle bg |
| Background| `#F9F9F7` | Page background                |

### Dark Mode Neutrals

| Token      | Value     | Usage                          |
|-----------|-----------|--------------------------------|
| Text      | `#E4E2DE` | Primary text, headings         |
| Muted     | `#8B8D95` | Secondary text, inactive nav   |
| Border    | `#2E3038` | Card borders, dividers         |
| Card      | `#24262C` | Elevated surfaces              |
| Background| `#1A1C20` | Page background                |

---

## Typography

### Font Change

- **Remove:** Outfit (display) + Plus Jakarta Sans (body)
- **Add:** DM Sans (single font for everything)
- **Weights:** 400 (body), 500 (nav/labels), 600 (emphasis), 700 (headings/stats)
- **Source:** Google Fonts, loaded via `next/font/google`

---

## Decorative Effects

### Dot Pattern (`.mesh-gradient-subtle`)

Preserved but softened:

- **Light mode:** `rgba(28, 29, 31, 0.08)` — down from current `rgba(0, 0, 0, 0.15)`
- **Dark mode:** `rgba(228, 226, 222, 0.06)` — down from current `rgba(255, 255, 255, 0.12)`
- **Grid size:** 24px × 24px (unchanged)
- **Vignette mask:** unchanged

### Glass Card Effect (`.glass-card`)

- **Light:** `rgba(249, 249, 247, 0.85)` + backdrop-blur(12px)
- **Dark:** `rgba(26, 28, 32, 0.85)` + backdrop-blur(12px)

### Mesh Gradient (`.mesh-gradient`, landing page)

Shift from green radials to navy/blue:
- **Light:** `rgba(30, 58, 95, 0.12)`, `rgba(37, 99, 235, 0.10)`, `rgba(59, 130, 246, 0.08)`
- **Dark:** `rgba(30, 58, 95, 0.16)`, `rgba(37, 99, 235, 0.14)`, `rgba(59, 130, 246, 0.12)`

### Noise Overlay

Unchanged — `opacity: 0.03`

---

## Component-Level Changes

### Sidebar (Dashboard + Admin)

- **Logo mark:** `bg="blue.solid"` (maps to navy/blue primary) instead of `green.solid`
- **Active nav (light):** solid navy fill (`#1E3A5F`) with white text
- **Active nav (dark):** `rgba(37, 99, 235, 0.15)` bg with `#60A5FA` text
- **Inactive nav:** muted text (`#7C7D80` light / `#8B8D95` dark)

### Header (Dashboard + Admin)

- Glass card effect updated to new neutral values
- Avatar circle uses primary blue instead of green
- Notification dot remains `red.500`

### Landing Page

- CTA buttons: `colorPalette="blue"` instead of `green`
- CTA section background: navy-based (`#1E3A5F` dark / `#2563EB` light) instead of green
- Feature card colors: keep varied accents but use the new palette accents
- "Parkside" badge: `blue` color palette instead of `green`

### Progress Bars

Standardized across the app:
- Overall/primary: Blue (`#2563EB`)
- Credits/secondary: Amber (`#D97706`)
- Major requirements: Emerald (`#059669`)
- Gen-ed requirements: Violet (`#7C3AED`)

### Course Subject Color Map

Standardize the two inconsistent maps into one shared utility:

| Subject Prefix | Color Palette |
|---------------|---------------|
| CS / CSCI     | blue          |
| MATH          | violet        |
| ENGL          | orange        |
| COMM          | amber         |
| PHIL          | teal          |
| PSYC          | pink          |
| BUSI          | cyan          |
| BIOL / BIOS  | emerald       |
| CHEM          | red           |
| PHYS          | teal          |
| HIST          | yellow        |
| ECON          | cyan          |
| ART           | orange        |
| MUSC          | violet        |
| SOCI          | pink          |
| default       | gray          |

### Admin Components

- Advisor badge: `blue` instead of `green`
- Active/inactive course toggles: `blue` / `gray` instead of `green` / `gray`

### Auth Pages (Sign In / Sign Up)

- Accent colors shift from green to blue

---

## Icon Cleanup — Minimal Approach

The app uses Lucide icons (react-icons/lu) consistently, but many pages are icon-heavy. Goal: reduce decorative icons, keep only functional ones, and make the UI feel cleaner.

### Principles

1. **Navigation icons** — keep (functional, aid wayfinding)
2. **Action icons** — keep (buttons, delete, add, search, drag handles)
3. **Status icons** — keep (check marks, alerts, loaders)
4. **Decorative feature card icons** — reduce or remove (the colored icon circles on landing page feature cards add visual noise)
5. **Redundant icons** — remove where text labels are sufficient

### Specific Changes

**`src/components/LandingPage.tsx`** (currently 11 icons):
- Feature cards: remove the large colored icon circles above each feature title. Let the titles and descriptions speak for themselves. Keep the graduation cap in the hero/branding only.
- CTA sections: remove decorative icons like LuZap, LuSparkles
- Keep: LuArrowRight on buttons, LuCheck on checklist items, LuGraduationCap on branding

**`src/app/dashboard/page.tsx`** (currently 13 icons):
- Quick action cards: remove decorative icons, use text labels
- Keep: LuArrowRight for navigation, LuCircleCheck/LuCircleAlert for status, LuSparkles for AI Advisor link
- Remove: LuTrendingUp, LuFileText, LuCalendar where they're purely decorative

**Planner components:**
- Keep functional icons: LuGripVertical (drag), LuTrash2 (delete), LuPlus (add), LuSearch
- Remove decorative icons on cards where the text is sufficient

---

## Files to Modify

1. **`src/app/globals.css`** — dot pattern, glass card, mesh gradient colors
2. **`src/app/layout.tsx`** — font imports (DM Sans replacing Outfit + Plus Jakarta Sans)
3. **`src/components/dashboard/DashboardSidebar.tsx`** — nav colors
4. **`src/components/dashboard/DashboardHeader.tsx`** — avatar/accent colors
5. **`src/components/dashboard/DashboardShell.tsx`** — font-family variable
6. **`src/components/admin/AdminSidebar.tsx`** — nav colors
7. **`src/components/admin/AdminHeader.tsx`** — badge/accent colors
8. **`src/components/admin/AdminShell.tsx`** — font-family variable
9. **`src/components/LandingPage.tsx`** — CTA, badges, feature colors, mesh gradient
10. **`src/app/admin/courses/CoursesAdminClient.tsx`** — subject color map, active toggle
11. **`src/components/planner/DraggableCourseCard.tsx`** — subject color map (consolidate)
12. **`src/app/signup/page.tsx`** — accent colors
13. **`src/app/signin/page.tsx`** — accent colors (if exists)
14. **`src/app/dashboard/page.tsx`** — progress bar colors
15. **New: `src/lib/subject-colors.ts`** — shared subject color map utility

---

## Verification

1. **Visual check:** Run `npm run dev`, open both light and dark mode, verify:
   - Sidebar uses navy/blue, no green remnants
   - Backgrounds are warm gray (#F9F9F7) / cool charcoal (#1A1C20)
   - Dot pattern is visible but subtle
   - Glass card effect works on header
   - Progress bars use correct accent colors
   - Landing page CTA and mesh gradient use blue tones
2. **Font check:** All text renders in DM Sans, no fallback to system fonts
3. **Build check:** `npm run build` passes with no errors
4. **Lint check:** `npm run lint` passes
5. **Grep for remnants:** Search for `green.solid`, `green.subtle`, `green.fg` — should be zero matches in component files (except possibly for emerald accent usage)
6. **Subject color consistency:** Verify `CoursesAdminClient.tsx` and `DraggableCourseCard.tsx` both import from the shared utility
