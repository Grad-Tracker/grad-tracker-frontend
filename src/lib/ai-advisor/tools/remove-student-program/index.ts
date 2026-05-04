import type { AdvisorToolDependencies } from "../shared/dependencies";

export type RemoveStudentProgramInput = {
  programId: number;
  confirm: boolean;
};

export const REMOVE_STUDENT_PROGRAM_DEFINITION = {
  name: "remove_student_program",
  description:
    "Permanently remove a degree program from the student's enrollment record. This is irreversible. Before calling, use get_student_profile to confirm the program name, tell the student exactly which program will be removed, and require explicit confirmation. Requires confirm: true.",
  input_schema: {
    type: "object" as const,
    required: ["programId", "confirm"] as const,
    properties: {
      programId: { type: "integer" as const, description: "The program ID to remove from the student's enrollment" },
      confirm: { type: "boolean" as const, description: "Must be true — the student must explicitly confirm the removal before this is called" },
    },
  },
} as const;

export function createRemoveStudentProgramTool(deps: AdvisorToolDependencies) {
  return async function (input: RemoveStudentProgramInput) {
    if (!input.confirm) {
      return {
        success: false,
        programId: input.programId,
        error: "Removal requires confirm: true. First tell the student which program will be removed and ask them to explicitly confirm.",
      };
    }

    // Query student_programs JOIN programs directly (not via v_student_major_program which only returns MAJORs).
    const enrolled = await deps.getEnrolledProgramById(input.programId);
    if (!enrolled) {
      return {
        success: false,
        programId: input.programId,
        error: `You are not enrolled in program ID ${input.programId}. Use get_student_profile or get_available_programs to see valid programs.`,
      };
    }

    // Guard: cannot remove the last program.
    const programCount = await deps.getStudentProgramCount();
    if (programCount <= 1) {
      return {
        success: false,
        programId: input.programId,
        programName: enrolled.name,
        error: `Cannot remove "${enrolled.name}" — it is your only enrolled program. Add a replacement program first.`,
      };
    }

    try {
      const { plansUnlinked } = await deps.removeStudentProgram(input.programId);
      return { success: true, programId: input.programId, programName: enrolled.name, plansUnlinked };
    } catch (err) {
      return {
        success: false,
        programId: input.programId,
        programName: enrolled.name,
        error: err instanceof Error ? err.message : "Failed to remove program.",
      };
    }
  };
}
