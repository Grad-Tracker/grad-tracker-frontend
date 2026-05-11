import type { AdvisorToolDependencies } from "../shared/dependencies";

export type AddStudentProgramInput = {
  programId: number;
  confirm: boolean;
};

export const ADD_STUDENT_PROGRAM_DEFINITION = {
  name: "add_student_program",
  description:
    "Enroll the student in an additional degree program (major, minor, certificate). Use get_available_programs first to find valid program IDs. Before calling, show the student the program name and require explicit confirmation. Requires confirm: true.",
  input_schema: {
    type: "object" as const,
    required: ["programId", "confirm"] as const,
    properties: {
      programId: { type: "integer" as const, description: "The program ID to add to the student's enrollment" },
      confirm: { type: "boolean" as const, description: "Must be true — the student must explicitly confirm before this is called" },
    },
  },
} as const;

export function createAddStudentProgramTool(deps: AdvisorToolDependencies) {
  return async function (input: AddStudentProgramInput) {
    if (!input.confirm) {
      return {
        success: false,
        programId: input.programId,
        error: "Adding a program requires confirm: true. First show the student the program name and ask them to confirm.",
      };
    }

    // Check not already enrolled (handles all program types — no view filter).
    const existing = await deps.getEnrolledProgramById(input.programId);
    if (existing) {
      return {
        success: false,
        programId: input.programId,
        programName: existing.name,
        error: `You are already enrolled in "${existing.name}" (ID: ${input.programId}).`,
      };
    }

    // Verify the program exists in catalog — getAvailablePrograms with no filter returns all types.
    const allPrograms = await deps.getAvailablePrograms();
    const catalogEntry = allPrograms.find((p) => p.id === input.programId);
    if (!catalogEntry) {
      return {
        success: false,
        programId: input.programId,
        error: `Program ID ${input.programId} was not found in the catalog. Use get_available_programs to see valid programs.`,
      };
    }

    try {
      const result = await deps.addStudentProgram(input.programId);
      if (result.alreadyEnrolled) {
        return {
          success: false,
          programId: input.programId,
          programName: catalogEntry.name,
          error: `You are already enrolled in "${catalogEntry.name}".`,
        };
      }
      return { success: true, programId: input.programId, programName: catalogEntry.name };
    } catch (err) {
      return {
        success: false,
        programId: input.programId,
        error: err instanceof Error ? err.message : "Failed to add program.",
      };
    }
  };
}
