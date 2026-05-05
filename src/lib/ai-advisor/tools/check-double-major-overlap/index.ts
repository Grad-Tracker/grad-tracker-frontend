import type { AdvisorToolDependencies } from "../shared/dependencies";

export type CheckDoubleMajorOverlapInput = {
  programId1: number;
  programId2: number;
};

export const CHECK_DOUBLE_MAJOR_OVERLAP_DEFINITION = {
  name: "check_double_major_overlap",
  description:
    "Given two program IDs, compute how many courses overlap (count toward both), how many credits are unique to each, and how many total additional credits the second major would require beyond the first. Use when students ask about adding a second major.",
  input_schema: {
    type: "object" as const,
    required: ["programId1", "programId2"] as const,
    properties: {
      programId1: { type: "integer" as const, description: "The first program ID (typically the student's current major)" },
      programId2: { type: "integer" as const, description: "The second program ID to compare" },
    },
  },
} as const;

export function createCheckDoubleMajorOverlapTool(deps: AdvisorToolDependencies) {
  return async function (input: CheckDoubleMajorOverlapInput) {
    const [blocks1, blocks2] = await Promise.all([
      deps.getProgramRequirements([input.programId1]),
      deps.getProgramRequirements([input.programId2]),
    ]);

    const name1 = blocks1[0]?.programName ?? `Program ${input.programId1}`;
    const name2 = blocks2[0]?.programName ?? `Program ${input.programId2}`;

    const courseMap1 = new Map<number, { courseCode: string; title: string; credits: number }>();
    const courseMap2 = new Map<number, { courseCode: string; title: string; credits: number }>();

    for (const block of blocks1) {
      for (const c of block.courses) courseMap1.set(c.courseId, { courseCode: c.courseCode, title: c.title, credits: c.credits });
    }
    for (const block of blocks2) {
      for (const c of block.courses) courseMap2.set(c.courseId, { courseCode: c.courseCode, title: c.title, credits: c.credits });
    }

    const overlapCourses: Array<{ courseId: number; courseCode: string; title: string; credits: number }> = [];
    for (const [id, info] of courseMap1) {
      if (courseMap2.has(id)) {
        overlapCourses.push({ courseId: id, ...info });
      }
    }

    const overlapIds = new Set(overlapCourses.map((c) => c.courseId));
    const overlapCredits = overlapCourses.reduce((sum, c) => sum + c.credits, 0);

    // Additional credits for second major = all of program2 credits minus what overlaps.
    let additionalCreditsForSecond = 0;
    for (const [id, info] of courseMap2) {
      if (!overlapIds.has(id)) additionalCreditsForSecond += info.credits;
    }

    const totalCredits1 = Array.from(courseMap1.values()).reduce((s, c) => s + c.credits, 0);
    const totalCredits2 = Array.from(courseMap2.values()).reduce((s, c) => s + c.credits, 0);

    return {
      program1: { id: input.programId1, name: name1, totalCourses: courseMap1.size, totalCredits: totalCredits1 },
      program2: { id: input.programId2, name: name2, totalCourses: courseMap2.size, totalCredits: totalCredits2 },
      overlapCourses,
      overlapCount: overlapCourses.length,
      overlapCredits,
      additionalCreditsForSecond,
    };
  };
}
