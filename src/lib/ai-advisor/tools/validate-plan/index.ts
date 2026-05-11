import type { AdvisorToolDependencies } from "../shared/dependencies";

export type ValidatePlanInput = {
  planId?: number | null;
};

export const VALIDATE_PLAN_DEFINITION = {
  name: "validate_plan",
  description:
    "Validate a graduation plan for structural issues: prerequisite ordering violations, term credit overloads (>18 credits), unplanned requirement blocks, and courses left in past terms. Returns a list of errors and warnings. Use when the student asks to review or validate their plan.",
  input_schema: {
    type: "object" as const,
    properties: {
      planId: { type: "integer" as const, description: "Plan ID to validate (defaults to active plan)" },
    },
  },
} as const;

export function createValidatePlanTool(deps: AdvisorToolDependencies) {
  return async function (input?: ValidatePlanInput) {
    const planId = input?.planId ?? null;

    type PlanIssue = {
      type: "prereq_order" | "credit_overload" | "requirement_gap" | "past_due_term";
      severity: "error" | "warning";
      message: string;
    };

    const [snapshot, historyEntries, remaining] = await Promise.all([
      deps.getPlanSnapshot(planId),
      deps.getCourseHistory({ completedOnly: true }),
      deps.getRemainingRequirements(planId, 200),
    ]);

    if (!snapshot) {
      return {
        planId,
        valid: false,
        issues: [{
          type: "prereq_order" as const,
          severity: "error" as const,
          message: "No plan found to validate.",
        }],
        summary: "No plan found.",
      };
    }

    const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
    const termKey = (season: string, year: number) => year * 10 + (SEASON_ORDER[season] ?? 0);
    const now = new Date();
    const month = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentSeason = month <= 5 ? "Spring" : month <= 7 ? "Summer" : "Fall";
    const currentKey = termKey(currentSeason, currentYear);

    const issues: PlanIssue[] = [];

    // Build term lookup
    const termById = new Map<number, { season: string; year: number; key: number }>();
    for (const term of snapshot.terms) {
      termById.set(term.id, { season: term.season, year: term.year, key: termKey(term.season, term.year) });
    }

    // Build courseId → term key for all planned courses and sum credits per term
    const courseToTermKey = new Map<number, number>();
    const termCreditTotals = new Map<number, { season: string; year: number; credits: number }>();
    for (const planned of snapshot.plannedCourses) {
      if (planned.termId == null) continue;
      const term = termById.get(planned.termId);
      if (!term) continue;
      courseToTermKey.set(planned.courseId, term.key);
      const existing = termCreditTotals.get(planned.termId);
      if (existing) {
        existing.credits += planned.credits;
      } else {
        termCreditTotals.set(planned.termId, { season: term.season, year: term.year, credits: planned.credits });
      }
    }

    // Completed course IDs from history
    const completedIds = new Set(historyEntries.map((h) => h.courseId));

    // 1. Credit overloads
    for (const [, termInfo] of termCreditTotals) {
      if (termInfo.credits > 18) {
        issues.push({
          type: "credit_overload",
          severity: "warning",
          message: `${termInfo.season} ${termInfo.year} has ${termInfo.credits} credits scheduled (recommended max is 18).`,
        });
      }
    }

    // 2. Past-due terms with planned courses
    for (const term of snapshot.terms) {
      const key = termKey(term.season, term.year);
      if (key < currentKey) {
        const coursesInTerm = snapshot.plannedCourses.filter((c) => c.termId === term.id);
        if (coursesInTerm.length > 0) {
          issues.push({
            type: "past_due_term",
            severity: "warning",
            message: `${term.season} ${term.year} is in the past but still has ${coursesInTerm.length} planned course(s): ${coursesInTerm.map((c) => c.courseCode).join(", ")}.`,
          });
        }
      }
    }

    // 3. Prereq ordering violations
    const plannedCourseIds = snapshot.plannedCourses
      .filter((c) => c.termId != null)
      .map((c) => c.courseId);

    if (plannedCourseIds.length > 0) {
      const prereqDefs = await deps.getCoursePrerequisites(plannedCourseIds);

      for (const planned of snapshot.plannedCourses) {
        if (planned.termId == null) continue;
        const def = prereqDefs.get(planned.courseId);
        if (!def || !def.hasPrereqs || def.requiredCourseIds.length === 0) continue;

        const plannedTermInfo = termById.get(planned.termId);
        if (!plannedTermInfo) continue;

        for (const reqId of def.requiredCourseIds) {
          if (completedIds.has(reqId)) continue;
          const prereqKey = courseToTermKey.get(reqId);
          if (prereqKey == null) continue; // not planned — skip (handled elsewhere)

          if (prereqKey >= plannedTermInfo.key) {
            const prereqEntry = snapshot.plannedCourses.find((c) => c.courseId === reqId);
            const prereqTermInfo = prereqEntry?.termId != null ? termById.get(prereqEntry.termId) : null;
            issues.push({
              type: "prereq_order",
              severity: "error",
              message: `${planned.courseCode} is in ${plannedTermInfo.season} ${plannedTermInfo.year}, but its prerequisite${prereqEntry ? ` ${prereqEntry.courseCode}` : ` #${reqId}`} is ${prereqTermInfo ? `not completed until ${prereqTermInfo.season} ${prereqTermInfo.year}` : "in the same or a later term"}.`,
            });
          }
        }
      }
    }

    // 4. Requirement gaps — blocks with no planned courses
    const plannedCourseIdSet = new Set(plannedCourseIds);
    for (const block of remaining.blocks) {
      const hasAnyPlanned = block.remainingCourses.some((c) => plannedCourseIdSet.has(c.id));
      if (!hasAnyPlanned && block.remainingCourses.length > 0) {
        issues.push({
          type: "requirement_gap",
          severity: "warning",
          message: `"${block.blockName}" has ${block.remainingCourses.length} unmet requirement(s) with none currently planned.`,
        });
      }
    }

    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const valid = errorCount === 0;
    const summary =
      valid && warningCount === 0
        ? "Plan looks good — no issues detected."
        : `Found ${errorCount} error(s) and ${warningCount} warning(s).`;

    return { planId, valid, issues, summary };
  };
}
