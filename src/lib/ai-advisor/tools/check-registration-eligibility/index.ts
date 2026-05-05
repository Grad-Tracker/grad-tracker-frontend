import type { AdvisorToolDependencies } from "../shared/dependencies";

export type CheckRegistrationEligibilityInput = {
  planId?: number | null;
  season?: string;
  year?: number;
};

export const CHECK_REGISTRATION_ELIGIBILITY_DEFINITION = {
  name: "check_registration_eligibility",
  description:
    "For a specific term, determine which of the student's planned courses they are currently eligible to register for (prereqs met) vs. not yet eligible for (prereqs unmet). Defaults to the current term.",
  input_schema: {
    type: "object" as const,
    properties: {
      planId: { type: "integer" as const, description: "Plan ID (defaults to active plan)" },
      season: { type: "string" as const, enum: ["Fall", "Spring", "Summer"] as const, description: "Target semester season" },
      year: { type: "integer" as const, description: "Target semester year" },
    },
  },
} as const;

export function createCheckRegistrationEligibilityTool(deps: AdvisorToolDependencies) {
  return async function (input?: CheckRegistrationEligibilityInput) {
    const planId = input?.planId ?? null;

    const now = new Date();
    const month = now.getMonth() + 1;
    const defaultSeason = month <= 5 ? "Spring" : month <= 7 ? "Summer" : "Fall";
    const defaultYear = now.getFullYear();

    const season = input?.season ?? defaultSeason;
    const year = Number(input?.year ?? defaultYear);

    const snapshot = await deps.getPlanSnapshot(planId);
    const terms = snapshot?.terms ?? [];
    const plannedCourses = snapshot?.plannedCourses ?? [];

    const matchingTerm = terms.find((t) => t.season === season && t.year === year);
    if (!matchingTerm) {
      return { season, year, eligible: [], ineligible: [], notPlanned: true };
    }

    const termCourses = plannedCourses.filter((c) => c.termId === matchingTerm.id);
    if (termCourses.length === 0) {
      return { season, year, eligible: [], ineligible: [], notPlanned: false };
    }

    const courseIds = termCourses.map((c) => c.courseId);
    const prereqMap = await deps.evaluatePrereqs(courseIds);

    const eligible: Array<{ courseId: number; courseCode: string; title: string; credits: number }> = [];
    const ineligible: Array<{ courseId: number; courseCode: string; title: string; credits: number; reasons: string[] }> = [];

    for (const course of termCourses) {
      const prereq = prereqMap.get(course.courseId) ?? { unlocked: true, summary: [] };
      if (prereq.unlocked) {
        eligible.push({ courseId: course.courseId, courseCode: course.courseCode, title: course.title, credits: course.credits });
      } else {
        ineligible.push({
          courseId: course.courseId,
          courseCode: course.courseCode,
          title: course.title,
          credits: course.credits,
          reasons: prereq.summary,
        });
      }
    }

    return { season, year, eligible, ineligible, notPlanned: false };
  };
}
