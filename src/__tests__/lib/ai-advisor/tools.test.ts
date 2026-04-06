import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateAdvisorResponse } from "@/lib/ai-advisor/tools";
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
