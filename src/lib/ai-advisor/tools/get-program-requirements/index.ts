import type { AdvisorToolDependencies } from "../shared/dependencies";

export type GetProgramRequirementsInput = {
  programIds?: number[];
};

export const GET_PROGRAM_REQUIREMENTS_DEFINITION = {
  name: "get_program_requirements",
  description:
    "Return the complete requirement block structure for one or more degree programs: all blocks, the completion rule (ALL_OF / N_OF / ANY_OF / CREDITS_OF), required credit counts, and the specific courses in each block. Use when the student asks what their degree requires in full, or what courses are in a specific requirement block.",
  input_schema: {
    type: "object" as const,
    properties: {
      programIds: {
        type: "array" as const,
        items: { type: "integer" as const },
        description: "Program IDs to fetch requirements for. Defaults to the student's enrolled programs.",
      },
    },
  },
} as const;

export function createGetProgramRequirementsTool(deps: AdvisorToolDependencies) {
  return async function (input?: GetProgramRequirementsInput) {
    // Use provided programIds or default to student's enrolled programs.
    let programIds: number[] = (input?.programIds ?? [])
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0);

    if (programIds.length === 0) {
      const profile = await deps.getStudentProfile();
      programIds = profile.programs.map((p) => p.id);
    }

    const blocks = await deps.getProgramRequirements(programIds);
    const totalCourses = blocks.reduce((s, b) => s + b.courses.length, 0);

    return { programIds, blocks, totalCourses };
  };
}
