import type { AdvisorToolDependencies } from "../shared/dependencies";

export const GET_STUDENT_PROFILE_DEFINITION = {
  name: "get_student_profile",
  description: "Get the student profile context, programs, and expected graduation information.",
  input_schema: { type: "object" as const, properties: {} },
} as const;

export function createGetStudentProfileTool(deps: AdvisorToolDependencies) {
  return async function () {
    const profile = await deps.getStudentProfile();
    return {
      studentId: profile.studentId,
      name: profile.fullName,
      email: profile.email,
      hasCompletedOnboarding: profile.hasCompletedOnboarding,
      expectedGraduation: profile.expectedGraduation,
      programs: profile.programs.map((program) => ({
        id: program.id,
        name: program.name,
        programType: program.programType,
        catalogYear: program.catalogYear,
      })),
    };
  };
}
