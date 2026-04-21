# GitHub Report - Arjun Nyein

Repository URL: https://github.com/Grad-Tracker/grad-tracker-frontend

## PRs Merged During Reporting Window (2026-03-18 to 2026-04-07)

### 1) Role-based sign-in UX + Advisor gated signup
- Author: ArjunNyein  
- Reviewers: Jack Miller, Mekhi Walker  
- Merge Date: N/A  

**Summary of work:**
- Built a clearer role-based sign-in experience so users can choose **Student** vs **Advisor** without confusion.
- Added role-aware validations (student email domain vs advisor email domain) and role mismatch protection (prevents signing into the wrong portal).
- Implemented advisor signup gating using an **access code** flow.
- Added server-side verification for the access code and added protections so `/admin/signup` can’t be accessed directly without passing the gate.
- Ensured advisor accounts are created with `user_metadata.role = "advisor"` and inserted into the **staff/advisors table**, redirecting to `/admin`.
- Updated routing/guards so advisor routes stay protected and auth pages behave correctly.
- Added/updated Vitest tests for the role selection UI, gating flow, redirects, and error handling.

### 2) Admin discovery improvements (Programs + Gen-Ed)
- Author: ArjunNyein  
- Reviewers: Jack Miller, Mekhi Walker  
- Merge Date: N/A  

**Summary of work:**
- Added client-side **sorting** controls for `/admin/programs` to make large program lists easier to scan.
- Improved the Programs page ordering logic to ensure the selected sort actually applies to the rendered grouped lists.
- Updated `/admin/gen-ed` UI controls to be cleaner (controls near the header, consistent admin styling).
- Kept expand/collapse stable across interactions while improving organization of the page.
- Updated/added tests to cover sorting behavior and UI ordering expectations.

## Commit Activity (Author: ArjunNyein)
- Total number of commits: 17  
- Date range: 2026-03-18 to 2026-04-07  