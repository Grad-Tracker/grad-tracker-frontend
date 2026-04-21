# GitHub Report - Arjun Nyein

Repository URL: https://github.com/Grad-Tracker/grad-tracker-frontend

## PRs Worked On During Reporting Window (2026-04-08 to 2026-04-21)

### 1) Clean up dead/duplicate files + Gen-Ed query dedupe
- Author: ArjunNyein  
- Reviewers: Jack Miller  
- Merge Date: Not merged (N/A)  

**Summary of work:**
- Removed/confirmed removal of dead or duplicate files (ex: duplicate planner constants file, stale sprint doc if present).
- Refactored duplicated Gen-Ed bucket/course loading logic into a shared query helper (`src/lib/supabase/queries/gen-ed.ts`) so server + client refresh use the same source.
- Updated `/admin/gen-ed` page and `GenEdAdminClient` refresh to use the shared helper.
- Cleaned up related types (shared `GenEdBucket`/course typing) to keep data shape consistent.
- Ensured Gen-Ed behavior stayed the same while reducing duplicate code paths.
- Verified with targeted Vitest suites + full `npm test`.

### 2) Replace hard-coded hex colors with Chakra semantic tokens
- Author: ArjunNyein  
- Reviewers: Jack Miller  
- Merge Date: Not merged (N/A)  

**Summary of work:**
- Replaced hard-coded hex colors in key UI pages/components with Chakra token-based colors so themes/dark mode work correctly.
- Updated Signup, Role-based Sign-In, Advisor Signup, Auth layout, and Landing Page to use `colorPalette`, `bg`, `fg`, and token gradients instead of raw hex values.
- Fixed Chakra v3 gradient API usage on Landing Page (migrated old `bgGradient="linear(...)"` to structured v3 props / `bgImage` where needed).
- Kept layout/structure unchanged—only color/tokens updated.
- Verified UI still looks the same but is now theme-safe and maintainable.

### 3) Fix undefined font variables on error + not-found pages
- Author: ArjunNyein  
- Reviewers: Jack Miller  
- Merge Date: 2026-04-20 

**Summary of work:**
- Replaced references to non-existent font CSS vars (`--font-plus-jakarta`, `--font-outfit`) with the project font var (`--font-dm-sans`).
- Applied to: `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/dashboard/error.tsx`.
- Confirmed old font vars are fully removed with grep.
- Verified test suite remained green.

### 4) Fix low-contrast text (WCAG-friendly token adjustments)
- Author: ArjunNyein  
- Reviewers: Jack Miller  
- Merge Date: 2026-04-20  

**Summary of work:**
- Improved text contrast by bumping low-contrast shades to stronger ones (ex: `.400/.500` → `.600`) in the specified components.
- Updated: Password strength indicator, signup password match/mismatch indicator, AI advisor status dot, and planner semester drag highlight color.
- Kept behavior unchanged; only token/shade tweaks to meet accessibility contrast standards.
- Verified with `npm test` and quick UI checks.

### 5) Add page metadata/titles (Dashboard + Admin)
- Author: ArjunNyein  
- Reviewers: Jack Miller  
- Merge Date: 2026-04-20 

**Summary of work:**
- Added per-page metadata so browser tabs show meaningful titles (instead of every page just looking the same).
- Implemented server-wrapper + client-component split where needed to support `metadata` exports without breaking client-side logic.
- Added dynamic title behavior for program-specific pages where applicable (with safe fallbacks).
- Confirmed changes affect browser tab titles (not URL paths—those stay as `/admin/...`, `/dashboard/...`).

### 6) Aria labels & accessibility audit (Stretch)
- Author: ArjunNyein  
- Reviewers: Jack Miller  
- Merge Date: 2026-04-20 

**Summary of work:**
- Audited icon-only buttons and added/cleaned up missing aria-labels (ex: ColorPicker eyedropper label, improved “info” label wording).
- Ensured keyboard activation works properly for custom `role="button"` elements (Enter/Space) where needed.
- Ran browser accessibility checks (Lighthouse) and addressed issues found during review.
- Kept changes minimal and focused on accessibility without altering app flow.

## Commit Activity (Author: ArjunNyein)
- Total number of commits: 19  
- Date range: 2026-04-08 to 2026-04-21