---
name: github-report
description: Generate a Sprint GitHub Activity Report showing merged PRs and commit activity for a student on any branch.
disable-model-invocation: true
argument-hint: "[sprint-number] [github-username] [start-date] [end-date] [display-name]"
allowed-tools: Bash(gh*), Bash(mkdir*), Write
---

Generate a GitHub activity report for a student's sprint. Arguments come from $ARGUMENTS in this order: `[sprint-number] [github-username] [start-date] [end-date] [display-name]`

Example: `/github-report 2 jdoe 2026-01-10 2026-01-24 "Jane Doe"`

## Steps

1. **Parse `$ARGUMENTS`** into variables:
   - SPRINT = first argument
   - USERNAME = second argument
   - START_DATE = third argument (YYYY-MM-DD)
   - END_DATE = fourth argument (YYYY-MM-DD)
   - NAME = fifth argument (display name, may be quoted)

2. **Verify `gh` is authenticated** by running:
   ```bash
   gh auth status
   ```
   If this fails, report the error and stop — do not generate the file.

3. **Get the repository URL:**
   ```bash
   gh repo view --json url -q .url
   ```

4. **Fetch merged PRs** authored by USERNAME in the date range:
   ```bash
   gh pr list \
     --search "is:pr is:merged author:$USERNAME merged:$START_DATE..$END_DATE" \
     --json title,url,author,reviews,mergedAt \
     --limit 100
   ```
   For each PR extract: title, url, author login, reviewer logins (from reviews[].author.login, deduplicated), and mergedAt date (formatted as YYYY-MM-DD).

5. **Fetch commit activity** for USERNAME across all branches:
   ```bash
   gh api "repos/{owner}/{repo}/commits?author=$USERNAME&since=${START_DATE}T00:00:00Z&until=${END_DATE}T23:59:59Z&per_page=100" \
     --paginate \
     --jq '[.[] | {sha: .sha, date: .commit.author.date}]'
   ```
   From the result compute: total commit count, earliest commit date, latest commit date.

6. **Ensure the output directory exists** by running:
   ```bash
   mkdir -p git_reports
   ```

7. **Generate `git_reports/Sprint-$SPRINT-GitHub-Report_$NAME.md`** in the `git_reports/` folder at the repo root (create the folder if it doesn't exist). Replace spaces in NAME with hyphens for the filename. Use this exact template, substituting real data:

```markdown
# Sprint $SPRINT — GitHub Activity Report

**Student:** $NAME
**GitHub Username:** $USERNAME
**Sprint Dates:** $START_DATE — $END_DATE

---

## Repository

$REPO_URL

---

## Pull Requests Merged This Sprint

| PR Title | Link | Author | Reviewers | Merge Date |
|----------|------|--------|-----------|------------|
[one row per PR, or the message below if none]

_Total PRs merged: N_

---

## Commit Activity

| Metric | Value |
|--------|-------|
| Total Commits | $TOTAL_COMMITS |
| First Commit | $FIRST_COMMIT_DATE |
| Last Commit | $LAST_COMMIT_DATE |

---

## Notes

- Only PRs **merged** to any branch are counted; closed/unmerged PRs are excluded.
- Direct pushes to `main` are not counted per project rules.
- Commit count includes commits on all branches authored by $USERNAME.
```

   **PR table rules:**
   - Each row: `| $TITLE | [$URL]($URL) | $AUTHOR | $REVIEWERS | $MERGE_DATE |`
   - If no PRs found, replace the table rows with a single row: `| No PRs merged during this sprint. | — | — | — | — |`

   **Commit activity rules:**
   - If no commits found, set all three values to "No commits found for this user in the date range."

8. **Show the user** a summary: the generated file path, PR count, and commit count.

## Important

- Use REAL data from `gh` CLI — never guess or fabricate PR titles, links, or counts.
- If any `gh` command fails, report the exact error and do not generate the file.
- If `gh` is not authenticated, instruct the user to run `gh auth login` first.
