import { describe, expect, it } from "vitest";
import type { RequirementBlockWithCourses } from "@/types/planner";
import {
  BREADTH_PACKAGES,
  computePerProgramCreditTarget,
} from "@/types/planner";

function makeBlock(
  overrides: Partial<RequirementBlockWithCourses> = {}
): RequirementBlockWithCourses {
  return {
    id: 1,
    program_id: 1,
    name: "Required Courses",
    rule: "ALL_OF",
    n_required: null,
    credits_required: null,
    courses: [],
    ...overrides,
  };
}

describe("computePerProgramCreditTarget", () => {
  it("uses the largest per-program target (major basis) instead of summing programs", () => {
    const blocks: RequirementBlockWithCourses[] = [
      makeBlock({
        id: 1,
        program_id: 10,
        name: "Required Courses",
        credits_required: 44,
      }),
      makeBlock({
        id: 2,
        program_id: 10,
        name: "Electives",
        credits_required: 61,
      }),
      makeBlock({
        id: 3,
        program_id: 10,
        name: "Math & Chemistry",
        credits_required: 10,
      }),
      makeBlock({
        id: 4,
        program_id: 10,
        name: "Breadth Requirement",
        credits_required: 9,
      }),
      makeBlock({
        id: 5,
        program_id: 20,
        name: "Minor Courses",
        credits_required: 18,
      }),
    ];

    expect(computePerProgramCreditTarget(blocks)).toBe(124);
  });

  it("uses default breadth credits when no package is selected", () => {
    const blocks: RequirementBlockWithCourses[] = [
      makeBlock({
        id: 11,
        program_id: 99,
        name: "Required Computer Science Breadth Requirement",
        rule: "N_OF",
        n_required: 9,
        credits_required: null,
      }),
      makeBlock({
        id: 12,
        program_id: 99,
        name: "Required Courses",
        credits_required: 44,
      }),
    ];

    expect(computePerProgramCreditTarget(blocks)).toBe(53);
  });

  it("uses selected breadth package credits when package is present", () => {
    const blocks: RequirementBlockWithCourses[] = [
      makeBlock({
        id: 21,
        program_id: 88,
        name: "Required Computer Science Breadth Requirement",
        rule: "N_OF",
        n_required: 9,
        credits_required: null,
        courses: [
          { id: 1, subject: "MATH", number: "222", title: "Calc II", credits: 5 },
          { id: 2, subject: "MATH", number: "301", title: "Linear Algebra", credits: 4 },
        ],
      }),
      makeBlock({
        id: 22,
        program_id: 88,
        name: "Required Courses",
        credits_required: 44,
      }),
    ];

    const mathPackage = BREADTH_PACKAGES.find((p) => p.id === "math")!;
    expect(
      computePerProgramCreditTarget(blocks, { selectedPackage: mathPackage })
    ).toBe(53);
  });

  it("can enforce an undergraduate minimum floor", () => {
    const blocks: RequirementBlockWithCourses[] = [
      makeBlock({
        id: 31,
        program_id: 77,
        name: "Required Courses",
        credits_required: 44,
      }),
      makeBlock({
        id: 32,
        program_id: 77,
        name: "Electives",
        credits_required: 12,
      }),
      makeBlock({
        id: 33,
        program_id: 77,
        name: "Math & Chemistry",
        credits_required: 10,
      }),
      makeBlock({
        id: 34,
        program_id: 77,
        name: "Breadth Requirement",
        credits_required: 9,
      }),
    ];

    expect(
      computePerProgramCreditTarget(blocks, { minimumUndergradCredits: 120 })
    ).toBe(120);
  });

  it("supports legacy elective-pool totals for degree target top-up", () => {
    const blocks: RequirementBlockWithCourses[] = [
      makeBlock({
        id: 41,
        program_id: 66,
        name: "Required Courses",
        credits_required: 44,
      }),
      makeBlock({
        id: 42,
        program_id: 66,
        name: "Required Major Courses - Elective Major Courses",
        rule: "N_OF",
        n_required: 4,
        credits_required: 12,
        courses: [
          { id: 1, subject: "CSCI", number: "405", title: "AI", credits: 3 },
          { id: 2, subject: "CSCI", number: "410", title: "DS", credits: 3 },
          { id: 3, subject: "CSCI", number: "411", title: "Viz", credits: 3 },
          { id: 4, subject: "CSCI", number: "412", title: "ML", credits: 3 },
          { id: 5, subject: "CSCI", number: "415", title: "Project", credits: 3 },
          { id: 6, subject: "CSCI", number: "420", title: "Graphics", credits: 3 },
          { id: 7, subject: "CSCI", number: "421", title: "Vision", credits: 3 },
          { id: 8, subject: "CSCI", number: "424", title: "Client/Server", credits: 3 },
          { id: 9, subject: "CSCI", number: "431", title: "Models", credits: 3 },
          { id: 10, subject: "CSCI", number: "435", title: "Linux", credits: 3 },
          { id: 11, subject: "CSCI", number: "440", title: "Compiler", credits: 3 },
          { id: 12, subject: "CSCI", number: "444", title: "Event", credits: 3 },
          { id: 13, subject: "CSCI", number: "445", title: "Web Sec", credits: 3 },
          { id: 14, subject: "CSCI", number: "467", title: "Automation", credits: 3 },
          { id: 15, subject: "CSCI", number: "477", title: "Networks", credits: 3 },
          { id: 16, subject: "CSCI", number: "478", title: "Net Sec", credits: 3 },
          { id: 17, subject: "CSCI", number: "479", title: "Info Sec", credits: 3 },
          { id: 18, subject: "CSCI", number: "480", title: "Adv DB", credits: 3 },
          { id: 19, subject: "CSCI", number: "490", title: "Topics", credits: 1 },
          { id: 20, subject: "CSCI", number: "323", title: "Android", credits: 3 },
          { id: 21, subject: "CSCI", number: "324", title: "iOS", credits: 3 },
        ],
      }),
      makeBlock({
        id: 43,
        program_id: 66,
        name: "Math & Chemistry",
        credits_required: 10,
      }),
      makeBlock({
        id: 44,
        program_id: 66,
        name: "Breadth Requirement",
        credits_required: 9,
      }),
    ];

    expect(
      computePerProgramCreditTarget(blocks, {
        useLegacyElectivePoolForTotal: true,
      })
    ).toBe(124);
  });
});
