import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateAdvisorResponse, createAdvisorTools } from "@/lib/ai-advisor/tools";
import type { AdvisorToolDependencies } from "@/lib/ai-advisor/tools";
import type { AdvisorStudentProfile } from "@/lib/ai-advisor/data";

function makeProfile(): AdvisorStudentProfile {
  return {
    studentId: 99,
    fullName: "Alex Johnson",
    email: "alex@test.com",
    hasCompletedOnboarding: true,
    expectedGradSemester: "May",
    expectedGradYear: 2026,
    expectedGraduation: "May 2026",
    programs: [
      { id: 1, name: "B.S. Computer Science", catalogYear: "2022-2023", programType: "MAJOR" },
    ],
    primaryProgram: {
      id: 1,
      name: "B.S. Computer Science",
      catalogYear: "2022-2023",
      programType: "MAJOR",
    },
  };
}

function makeDependencies(): AdvisorToolDependencies {
  return {
    getStudentProfile: vi.fn().mockResolvedValue(makeProfile()),
    getPlanSnapshot: vi.fn().mockResolvedValue({
      planId: 7,
      planName: "My Plan",
      planDescription: null,
      programIds: [1],
      terms: [],
      plannedCourses: [],
      totalPlannedCredits: 0,
    }),
    getDegreeProgress: vi.fn().mockResolvedValue({
      planId: 7,
      overall: {
        completedCredits: 78,
        inProgressCredits: 12,
        remainingCredits: 30,
        totalCreditsRequired: 120,
        percentage: 75,
      },
      blocks: [],
    }),
    getRemainingRequirements: vi.fn().mockResolvedValue({
      planId: 7,
      totalRemainingCourses: 3,
      blocks: [
        {
          blockId: 1,
          blockName: "Major Core",
          remainingCourses: [
            { id: 340, courseCode: "CSCI 340", title: "Data Structures", credits: 3 },
            { id: 361, courseCode: "CSCI 361", title: "Computer Organization", credits: 3 },
            { id: 280, courseCode: "MATH 280", title: "Discrete Mathematics", credits: 3 },
          ],
        },
      ],
    }),
    resolveCourseIdsByCodes: vi.fn().mockResolvedValue({
      resolvedIds: [340],
      resolvedCodes: ["CSCI 340"],
      unresolvedCodes: [],
    }),
    createPlan: vi.fn().mockResolvedValue({ planId: 1 }),
    addCourseToPlan: vi.fn().mockResolvedValue({ alreadyPlanned: false }),
    removeCourseFromPlan: vi.fn().mockResolvedValue({ removed: true }),
    moveCourseInPlan: vi.fn().mockResolvedValue({ moved: true }),
    searchCourses: vi.fn().mockResolvedValue([]),
    getCoursePrerequisites: vi.fn().mockResolvedValue(new Map()),
    getCourseHistory: vi.fn().mockResolvedValue([]),
    listPlans: vi.fn().mockResolvedValue([]),
    getProgramRequirements: vi.fn().mockResolvedValue([]),
    getCoursesByIds: vi.fn().mockResolvedValue(new Map()),
    getCourseDetails: vi.fn().mockResolvedValue(new Map()),
    renamePlan: vi.fn().mockResolvedValue({ renamed: true }),
    clearPlanTerm: vi.fn().mockResolvedValue({ cleared: true, coursesRemoved: 0 }),
    addCourseToHistory: vi.fn().mockResolvedValue({ added: true, alreadyExists: false }),
    getGenEdOptions: vi.fn().mockResolvedValue([]),
    getDirectDependents: vi.fn().mockResolvedValue(new Map()),
    duplicatePlan: vi.fn().mockResolvedValue({ planId: 99, coursesCloned: 0 }),
    deletePlan: vi.fn().mockResolvedValue({ deleted: true }),
    getAvailablePrograms: vi.fn().mockResolvedValue([]),
    removeStudentProgram: vi.fn().mockResolvedValue({ removed: true, programId: 1, plansUnlinked: 0 }),
    getStudentProgramCount: vi.fn().mockResolvedValue(2),
    getEnrolledProgramById: vi.fn().mockImplementation(async (programId: number) => {
      if (programId === 1) return { id: 1, name: "B.S. Computer Science", programType: "MAJOR" };
      return null;
    }),
    addStudentProgram: vi.fn().mockResolvedValue({ added: true, alreadyEnrolled: false, programId: 1 }),
    removeCourseFromHistory: vi.fn().mockResolvedValue({ removed: true }),
    updateCourseHistory: vi.fn().mockResolvedValue({ updated: true }),
    evaluatePrereqs: vi.fn().mockImplementation(async (courseIds: number[]) => {
      const map = new Map<number, { unlocked: boolean; summary: string[] }>();
      for (const id of courseIds) {
        if (id === 340) {
          map.set(id, {
            unlocked: false,
            summary: ["Requires course 240"],
          });
        } else {
          map.set(id, { unlocked: true, summary: [] });
        }
      }
      return map;
    }),
  };
}

describe("AI advisor tools orchestration", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns next-semester recommendations for planning questions", async () => {
    const response = await generateAdvisorResponse({
      message: "What should I take next semester?",
      history: [],
      activePlanId: 7,
      profile: makeProfile(),
      dependencies: makeDependencies(),
    });

    expect(response.recommendations.length).toBeGreaterThan(0);
    expect(response.citations).toContain("tool:recommend_next_semester");
  });

  it("checks course prerequisites for direct eligibility questions", async () => {
    const response = await generateAdvisorResponse({
      message: "Can I take CSCI 340?",
      history: [],
      activePlanId: 7,
      profile: makeProfile(),
      dependencies: makeDependencies(),
    });

    expect(response.answer.toLowerCase()).toContain("csci 340");
    expect(response.risks.join(" ").toLowerCase()).toContain("requires");
    expect(response.citations).toContain("tool:check_course_prereqs");
  });

  it("summarizes grouped remaining requirements", async () => {
    const response = await generateAdvisorResponse({
      message: "Show my remaining requirements",
      history: [],
      activePlanId: 7,
      profile: makeProfile(),
      dependencies: makeDependencies(),
    });

    expect(response.answer.toLowerCase()).toContain("remaining");
    expect(response.citations).toContain("tool:get_remaining_requirements");
  });

  it("handles unknown questions conservatively", async () => {
    const response = await generateAdvisorResponse({
      message: "Tell me something random",
      history: [],
      activePlanId: 7,
      profile: makeProfile(),
      dependencies: makeDependencies(),
    });

    expect(response.answer.toLowerCase()).toContain("not certain");
    expect(response.recommendations).toEqual([]);
  });

  it("returns degree progress for graduation questions", async () => {
    const response = await generateAdvisorResponse({
      message: "Am I on track to graduate?",
      history: [],
      activePlanId: 7,
      profile: makeProfile(),
      dependencies: makeDependencies(),
    });

    expect(response.answer).toContain("75%");
    expect(response.citations).toContain("tool:get_degree_progress");
  });

  it("asks for course code when prereq message has no codes", async () => {
    const response = await generateAdvisorResponse({
      message: "Can I take that class?",
      history: [],
      activePlanId: 7,
      profile: makeProfile(),
      dependencies: makeDependencies(),
    });

    expect(response.answer.toLowerCase()).toContain("course code");
  });

  it("handles progress tool failure gracefully", async () => {
    const deps = makeDependencies();
    deps.getDegreeProgress = vi.fn().mockRejectedValue(new Error("DB down"));
    const response = await generateAdvisorResponse({
      message: "How many credits do I have left?",
      history: [],
      activePlanId: null,
      profile: makeProfile(),
      dependencies: deps,
    });

    expect(response.answer.toLowerCase()).toContain("could not");
  });

  it("handles remaining requirements tool failure gracefully", async () => {
    const deps = makeDependencies();
    deps.getRemainingRequirements = vi.fn().mockRejectedValue(new Error("DB down"));
    const response = await generateAdvisorResponse({
      message: "Show my remaining requirements",
      history: [],
      activePlanId: null,
      profile: makeProfile(),
      dependencies: deps,
    });

    expect(response.answer.toLowerCase()).toContain("could not");
  });

  it("handles recommend tool failure gracefully", async () => {
    const deps = makeDependencies();
    deps.getRemainingRequirements = vi.fn().mockRejectedValue(new Error("DB down"));
    const response = await generateAdvisorResponse({
      message: "What should I take next semester?",
      history: [],
      activePlanId: null,
      profile: makeProfile(),
      dependencies: deps,
    });

    expect(response.answer.toLowerCase()).toContain("could not");
  });
});

describe("validate_plan tool", () => {
  it("returns no issues for a clean empty plan", async () => {
    const deps = makeDependencies();
    deps.getPlanSnapshot = vi.fn().mockResolvedValue({
      planId: 7,
      planName: "My Plan",
      planDescription: null,
      programIds: [1],
      terms: [],
      plannedCourses: [],
      totalPlannedCredits: 0,
    });
    deps.getRemainingRequirements = vi.fn().mockResolvedValue({
      planId: 7,
      totalRemainingCourses: 0,
      blocks: [],
    });
    deps.getCourseHistory = vi.fn().mockResolvedValue([]);

    const toolset = createAdvisorTools(deps);
    const result = await toolset.validate_plan({ planId: 7 });

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.summary).toContain("no issues");
  });

  it("flags credit overload when a term has more than 18 credits", async () => {
    const deps = makeDependencies();
    deps.getPlanSnapshot = vi.fn().mockResolvedValue({
      planId: 7,
      planName: "My Plan",
      planDescription: null,
      programIds: [1],
      terms: [{ id: 1, season: "Fall", year: 2030 }],
      plannedCourses: [
        { courseId: 100, courseCode: "CSCI 100", title: "Intro", credits: 7, status: "planned", termId: 1 },
        { courseId: 101, courseCode: "CSCI 101", title: "Intro 2", credits: 7, status: "planned", termId: 1 },
        { courseId: 102, courseCode: "CSCI 102", title: "Intro 3", credits: 7, status: "planned", termId: 1 },
      ],
      totalPlannedCredits: 21,
    });
    deps.getRemainingRequirements = vi.fn().mockResolvedValue({ planId: 7, totalRemainingCourses: 0, blocks: [] });
    deps.getCourseHistory = vi.fn().mockResolvedValue([]);
    deps.getCoursePrerequisites = vi.fn().mockResolvedValue(new Map());

    const toolset = createAdvisorTools(deps);
    const result = await toolset.validate_plan({ planId: 7 });

    const overload = result.issues.find((i) => i.type === "credit_overload");
    expect(overload).toBeDefined();
    expect(overload?.severity).toBe("warning");
    expect(overload?.message).toContain("21 credits");
  });

  it("flags prereq ordering violation when a prereq is planned after the dependent course", async () => {
    const deps = makeDependencies();
    deps.getPlanSnapshot = vi.fn().mockResolvedValue({
      planId: 7,
      planName: "My Plan",
      planDescription: null,
      programIds: [1],
      terms: [
        { id: 1, season: "Spring", year: 2026 },
        { id: 2, season: "Fall", year: 2026 },
      ],
      plannedCourses: [
        // CSCI 340 (needs 240) is in Spring 2026
        { courseId: 340, courseCode: "CSCI 340", title: "Data Structures", credits: 3, status: "planned", termId: 1 },
        // CSCI 240 (the prereq) is in Fall 2026 — AFTER the dependent
        { courseId: 240, courseCode: "CSCI 240", title: "Intro", credits: 3, status: "planned", termId: 2 },
      ],
      totalPlannedCredits: 6,
    });
    deps.getRemainingRequirements = vi.fn().mockResolvedValue({ planId: 7, totalRemainingCourses: 0, blocks: [] });
    deps.getCourseHistory = vi.fn().mockResolvedValue([]);
    deps.getCoursePrerequisites = vi.fn().mockResolvedValue(
      new Map([[340, { hasPrereqs: true, items: ["CSCI 240"], requiredCourseIds: [240] }]])
    );

    const toolset = createAdvisorTools(deps);
    const result = await toolset.validate_plan({ planId: 7 });

    const violation = result.issues.find((i) => i.type === "prereq_order");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("error");
    expect(violation?.message).toContain("CSCI 340");
    expect(result.valid).toBe(false);
  });

  it("flags requirement gaps for blocks with no planned courses", async () => {
    const deps = makeDependencies();
    deps.getPlanSnapshot = vi.fn().mockResolvedValue({
      planId: 7,
      planName: "My Plan",
      planDescription: null,
      programIds: [1],
      terms: [{ id: 1, season: "Fall", year: 2030 }],
      plannedCourses: [
        { courseId: 999, courseCode: "ELEC 101", title: "Elective", credits: 3, status: "planned", termId: 1 },
      ],
      totalPlannedCredits: 3,
    });
    deps.getRemainingRequirements = vi.fn().mockResolvedValue({
      planId: 7,
      totalRemainingCourses: 3,
      blocks: [
        {
          blockId: 1,
          blockName: "Major Core",
          remainingCourses: [
            { id: 340, courseCode: "CSCI 340", title: "Data Structures", credits: 3 },
          ],
        },
      ],
    });
    deps.getCourseHistory = vi.fn().mockResolvedValue([]);
    deps.getCoursePrerequisites = vi.fn().mockResolvedValue(new Map());

    const toolset = createAdvisorTools(deps);
    const result = await toolset.validate_plan({ planId: 7 });

    const gap = result.issues.find((i) => i.type === "requirement_gap");
    expect(gap).toBeDefined();
    expect(gap?.message).toContain("Major Core");
  });
});

describe("remove_student_program tool", () => {
  it("blocks removal when confirm is false", async () => {
    const toolset = createAdvisorTools(makeDependencies());
    const result = await toolset.remove_student_program({ programId: 1, confirm: false });

    expect(result.success).toBe(false);
    expect(result.error).toContain("confirm: true");
  });

  it("blocks removal when student is not enrolled in that program", async () => {
    const toolset = createAdvisorTools(makeDependencies());
    // programId 999 doesn't appear in the mock profile's programs
    const result = await toolset.remove_student_program({ programId: 999, confirm: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not enrolled");
  });

  it("removes the program and returns its name when confirmed", async () => {
    const deps = makeDependencies();
    const toolset = createAdvisorTools(deps);
    // programId 1 = "B.S. Computer Science" in the mock profile
    const result = await toolset.remove_student_program({ programId: 1, confirm: true });

    expect(result.success).toBe(true);
    expect(result.programName).toBe("B.S. Computer Science");
    expect(deps.removeStudentProgram).toHaveBeenCalledWith(1);
  });

  it("surfaces plansUnlinked count in the response", async () => {
    const deps = makeDependencies();
    deps.removeStudentProgram = vi.fn().mockResolvedValue({ removed: true, programId: 1, plansUnlinked: 2 });
    const toolset = createAdvisorTools(deps);

    const result = await toolset.remove_student_program({ programId: 1, confirm: true });

    expect(result.success).toBe(true);
    expect(result.plansUnlinked).toBe(2);
  });

  it("returns error when the mutation throws", async () => {
    const deps = makeDependencies();
    deps.removeStudentProgram = vi.fn().mockRejectedValue(new Error("DB error"));
    const toolset = createAdvisorTools(deps);

    const result = await toolset.remove_student_program({ programId: 1, confirm: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("DB error");
  });

  it("blocks removal when it would leave the student with no programs", async () => {
    const deps = makeDependencies();
    deps.getStudentProgramCount = vi.fn().mockResolvedValue(1);
    const toolset = createAdvisorTools(deps);

    const result = await toolset.remove_student_program({ programId: 1, confirm: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("only enrolled program");
  });

  it("correctly identifies non-MAJOR enrolled programs (no MAJOR-only bug)", async () => {
    const deps = makeDependencies();
    // Simulate a certificate program (not returned by v_student_major_program view)
    deps.getEnrolledProgramById = vi.fn().mockImplementation(async (programId: number) => {
      if (programId === 5) return { id: 5, name: "Web Development Certificate", programType: "CERTIFICATE" };
      return null;
    });
    deps.getStudentProgramCount = vi.fn().mockResolvedValue(2);
    deps.removeStudentProgram = vi.fn().mockResolvedValue({ removed: true, programId: 5, plansUnlinked: 0 });
    const toolset = createAdvisorTools(deps);

    const result = await toolset.remove_student_program({ programId: 5, confirm: true });

    expect(result.success).toBe(true);
    expect(result.programName).toBe("Web Development Certificate");
  });
});

describe("delete_plan tool", () => {
  it("blocks deletion when confirm is false", async () => {
    const toolset = createAdvisorTools(makeDependencies());
    const result = await toolset.delete_plan({ planId: 7, confirm: false });

    expect(result.success).toBe(false);
    expect(result.error).toContain("confirm: true");
  });

  it("blocks deletion when it is the student's only plan", async () => {
    const deps = makeDependencies();
    deps.listPlans = vi.fn().mockResolvedValue([{ id: 7, name: "My Plan", updatedAt: "" }]);
    const toolset = createAdvisorTools(deps);

    const result = await toolset.delete_plan({ planId: 7, confirm: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("only plan");
  });

  it("deletes the plan when confirmed and more than one plan exists", async () => {
    const deps = makeDependencies();
    deps.listPlans = vi.fn().mockResolvedValue([
      { id: 7, name: "My Plan", updatedAt: "" },
      { id: 8, name: "Backup Plan", updatedAt: "" },
    ]);
    const toolset = createAdvisorTools(deps);

    const result = await toolset.delete_plan({ planId: 7, confirm: true });

    expect(result.success).toBe(true);
    expect(deps.deletePlan).toHaveBeenCalledWith(7);
  });

  it("returns error when the mutation throws", async () => {
    const deps = makeDependencies();
    deps.listPlans = vi.fn().mockResolvedValue([
      { id: 7, name: "My Plan", updatedAt: "" },
      { id: 8, name: "Backup Plan", updatedAt: "" },
    ]);
    deps.deletePlan = vi.fn().mockRejectedValue(new Error("DB error"));
    const toolset = createAdvisorTools(deps);

    const result = await toolset.delete_plan({ planId: 7, confirm: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("DB error");
  });
});

describe("create_plan error handling", () => {
  it("returns error object when createPlan throws (e.g., FK violation on stale programId)", async () => {
    const deps = makeDependencies();
    deps.createPlan = vi.fn().mockRejectedValue(new Error("insert or update on table violates foreign key constraint"));
    const toolset = createAdvisorTools(deps);

    const result = await toolset.create_plan({ name: "New Plan", programIds: [9999] });

    expect(result.error).toBeDefined();
    expect(result.planId).toBeUndefined();
  });
});

describe("add_student_program tool", () => {
  it("blocks when confirm is false", async () => {
    const toolset = createAdvisorTools(makeDependencies());
    const result = await toolset.add_student_program({ programId: 2, confirm: false });

    expect(result.success).toBe(false);
    expect(result.error).toContain("confirm: true");
  });

  it("blocks when student is already enrolled in that program", async () => {
    const deps = makeDependencies();
    // programId 1 is returned as enrolled by default mock
    const toolset = createAdvisorTools(deps);
    const result = await toolset.add_student_program({ programId: 1, confirm: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("already enrolled");
  });

  it("blocks when program does not exist in catalog", async () => {
    const deps = makeDependencies();
    // programId 99 — not enrolled (getEnrolledProgramById returns null) and not in catalog
    deps.getAvailablePrograms = vi.fn().mockResolvedValue([]);
    const toolset = createAdvisorTools(deps);
    const result = await toolset.add_student_program({ programId: 99, confirm: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found in the catalog");
  });

  it("enrolls the student and returns program name on success", async () => {
    const deps = makeDependencies();
    // programId 2 — not enrolled and available in catalog
    deps.getEnrolledProgramById = vi.fn().mockResolvedValue(null);
    deps.getAvailablePrograms = vi.fn().mockResolvedValue([
      { id: 2, name: "Minor in Mathematics", programType: "MINOR" },
    ]);
    deps.addStudentProgram = vi.fn().mockResolvedValue({ added: true, alreadyEnrolled: false, programId: 2 });
    const toolset = createAdvisorTools(deps);

    const result = await toolset.add_student_program({ programId: 2, confirm: true });

    expect(result.success).toBe(true);
    expect(result.programName).toBe("Minor in Mathematics");
    expect(deps.addStudentProgram).toHaveBeenCalledWith(2);
  });

  it("returns error when the mutation throws", async () => {
    const deps = makeDependencies();
    deps.getEnrolledProgramById = vi.fn().mockResolvedValue(null);
    deps.getAvailablePrograms = vi.fn().mockResolvedValue([
      { id: 2, name: "Minor in Mathematics", programType: "MINOR" },
    ]);
    deps.addStudentProgram = vi.fn().mockRejectedValue(new Error("DB error"));
    const toolset = createAdvisorTools(deps);

    const result = await toolset.add_student_program({ programId: 2, confirm: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("DB error");
  });
});

describe("remove_course_from_history tool", () => {
  const historyEntry = {
    courseId: 340,
    courseCode: "CSCI 340",
    title: "Data Structures",
    credits: 3,
    grade: "A",
    completed: true,
    term: "Fall 2024",
  };

  it("blocks when confirm is false", async () => {
    const toolset = createAdvisorTools(makeDependencies());
    const result = await toolset.remove_course_from_history({ courseCode: "CSCI 340", confirm: false });

    expect(result.success).toBe(false);
    expect(result.error).toContain("confirm: true");
  });

  it("returns error when course code is not in catalog", async () => {
    const deps = makeDependencies();
    deps.resolveCourseIdsByCodes = vi.fn().mockResolvedValue({
      resolvedIds: [],
      resolvedCodes: [],
      unresolvedCodes: ["CSCI 999"],
    });
    const toolset = createAdvisorTools(deps);

    const result = await toolset.remove_course_from_history({ courseCode: "CSCI 999", confirm: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns error when course is not in student history", async () => {
    const deps = makeDependencies();
    // getCourseHistory returns empty by default — course not in history
    const toolset = createAdvisorTools(deps);

    const result = await toolset.remove_course_from_history({ courseCode: "CSCI 340", confirm: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not in your course history");
  });

  it("removes the course and returns success", async () => {
    const deps = makeDependencies();
    deps.getCourseHistory = vi.fn().mockResolvedValue([historyEntry]);
    const toolset = createAdvisorTools(deps);

    const result = await toolset.remove_course_from_history({ courseCode: "CSCI 340", confirm: true });

    expect(result.success).toBe(true);
    expect(deps.removeCourseFromHistory).toHaveBeenCalledWith(340);
  });

  it("returns error when the mutation throws", async () => {
    const deps = makeDependencies();
    deps.getCourseHistory = vi.fn().mockResolvedValue([historyEntry]);
    deps.removeCourseFromHistory = vi.fn().mockRejectedValue(new Error("DB error"));
    const toolset = createAdvisorTools(deps);

    const result = await toolset.remove_course_from_history({ courseCode: "CSCI 340", confirm: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("DB error");
  });
});

describe("update_course_history tool", () => {
  const historyEntry = {
    courseId: 340,
    courseCode: "CSCI 340",
    title: "Data Structures",
    credits: 3,
    grade: null,
    completed: true,
    term: "Fall 2024",
  };

  it("returns error when course code is not in catalog", async () => {
    const deps = makeDependencies();
    deps.resolveCourseIdsByCodes = vi.fn().mockResolvedValue({
      resolvedIds: [],
      resolvedCodes: [],
      unresolvedCodes: ["CSCI 999"],
    });
    const toolset = createAdvisorTools(deps);

    const result = await toolset.update_course_history({ courseCode: "CSCI 999", grade: "A" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns error when course is not in student history", async () => {
    const toolset = createAdvisorTools(makeDependencies());

    const result = await toolset.update_course_history({ courseCode: "CSCI 340", grade: "B" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not in your course history");
  });

  it("returns error when no updates are provided", async () => {
    const deps = makeDependencies();
    deps.getCourseHistory = vi.fn().mockResolvedValue([historyEntry]);
    const toolset = createAdvisorTools(deps);

    const result = await toolset.update_course_history({ courseCode: "CSCI 340" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("No updates");
  });

  it("updates the grade and returns success", async () => {
    const deps = makeDependencies();
    deps.getCourseHistory = vi.fn().mockResolvedValue([historyEntry]);
    const toolset = createAdvisorTools(deps);

    const result = await toolset.update_course_history({ courseCode: "CSCI 340", grade: "A" });

    expect(result.success).toBe(true);
    expect(deps.updateCourseHistory).toHaveBeenCalledWith(340, "A", undefined);
  });

  it("updates the completed flag and returns success", async () => {
    const deps = makeDependencies();
    deps.getCourseHistory = vi.fn().mockResolvedValue([historyEntry]);
    const toolset = createAdvisorTools(deps);

    const result = await toolset.update_course_history({ courseCode: "CSCI 340", completed: false });

    expect(result.success).toBe(true);
    expect(deps.updateCourseHistory).toHaveBeenCalledWith(340, undefined, false);
  });

  it("returns error when the mutation throws", async () => {
    const deps = makeDependencies();
    deps.getCourseHistory = vi.fn().mockResolvedValue([historyEntry]);
    deps.updateCourseHistory = vi.fn().mockRejectedValue(new Error("DB error"));
    const toolset = createAdvisorTools(deps);

    const result = await toolset.update_course_history({ courseCode: "CSCI 340", grade: "A" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("DB error");
  });
});
