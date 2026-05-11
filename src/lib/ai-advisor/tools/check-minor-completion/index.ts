import type { AdvisorToolDependencies } from "../shared/dependencies";

export type CheckMinorCompletionInput = {
  programId: number;
};

export const CHECK_MINOR_COMPLETION_DEFINITION = {
  name: "check_minor_completion",
  description:
    "Given a specific minor program ID, compute how many of its requirements the student has already satisfied and what remains. Use when the student asks how close they are to completing a minor.",
  input_schema: {
    type: "object" as const,
    required: ["programId"] as const,
    properties: {
      programId: { type: "integer" as const, description: "The program ID of the minor to evaluate" },
    },
  },
} as const;

export function createCheckMinorCompletionTool(deps: AdvisorToolDependencies) {
  return async function (input: CheckMinorCompletionInput) {
    const [blocks, history] = await Promise.all([
      deps.getProgramRequirements([input.programId]),
      deps.getCourseHistory(),
    ]);

    const completedIds = new Set(history.map((h) => h.courseId));

    let totalRequirements = 0;
    let completedCount = 0;
    let completedCredits = 0;
    const remainingCourses: Array<{ courseId: number; courseCode: string; title: string; credits: number }> = [];

    // Use first block's programName for the program name.
    const programName = blocks[0]?.programName ?? `Program ${input.programId}`;

    for (const block of blocks) {
      for (const course of block.courses) {
        totalRequirements += 1;
        if (completedIds.has(course.courseId)) {
          completedCount += 1;
          completedCredits += course.credits;
        } else {
          remainingCourses.push({
            courseId: course.courseId,
            courseCode: course.courseCode,
            title: course.title,
            credits: course.credits,
          });
        }
      }
    }

    const percentComplete = totalRequirements > 0 ? Math.round((completedCount / totalRequirements) * 100) : 0;

    return {
      programId: input.programId,
      programName,
      totalRequirements,
      completedCount,
      completedCredits,
      remainingCourses,
      percentComplete,
    };
  };
}
