import React from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

vi.mock("@/components/shared-plans/ComparePlanPicker", () => ({
  default: ({ selectedPlanId }: { selectedPlanId?: number | null }) => (
    <div>COMPARE PICKER selected={String(selectedPlanId ?? null)}</div>
  ),
}));

vi.mock("@/components/shared-plans/SharedPlanComparePicker", () => ({
  default: ({ sharedPlans, ownPlans }: { sharedPlans: unknown[]; ownPlans: unknown[] }) => (
    <div>
      SHARED PLAN COMPARE PICKER shared={sharedPlans.length} own={ownPlans.length}
    </div>
  ),
}));

import {
  SharedPlanUnavailable,
  SharedPlansIndex,
  SharedPlanView,
} from "@/app/dashboard/planner/shared";
import type {
  ComparablePlanDetail,
  OwnPlanSummary,
  SharedPlanDetail,
  SharedPlanSummary,
} from "@/types/shared-plan";

function makeSharedPlanSummary(overrides: Partial<SharedPlanSummary> = {}): SharedPlanSummary {
  return {
    shareToken: "shared-1",
    planId: 1,
    planName: "Computer Science Major 4 Year Plan",
    description: "A sample shared plan",
    studentFirstName: "Shared",
    programNames: ["B.S. Computer Science"],
    termCount: 8,
    totalPlannedCredits: 120,
    updatedAt: null,
    ...overrides,
  };
}

function makeOwnPlanSummary(overrides: Partial<OwnPlanSummary> = {}): OwnPlanSummary {
  return {
    planId: 22,
    planName: "My Plan",
    description: "My description",
    programNames: ["B.S. Computer Science"],
    totalPlannedCredits: 15,
    termCount: 2,
    ...overrides,
  };
}

function makeSharedPlanDetail(): SharedPlanDetail {
  return {
    shareToken: "shared-1",
    planId: 1,
    planName: "Computer Science Major 4 Year Plan",
    description: "A sample shared plan",
    ownerLabel: "Shared plan",
    studentFirstName: "Shared",
    programNames: ["B.S. Computer Science"],
    terms: [
      { id: 1, season: "Fall", year: 2026 },
      { id: 2, season: "Spring", year: 2027 },
    ],
    plannedCourses: [
      {
        student_id: 0,
        term_id: 1,
        course_id: 101,
        status: "planned",
        plan_id: 1,
        course: { id: 101, subject: "CSCI", number: "241", title: "Computer Science I", credits: 5 },
        requirementLabel: "Required Major",
      },
      {
        student_id: 0,
        term_id: 2,
        course_id: 102,
        status: "planned",
        plan_id: 1,
        course: { id: 102, subject: "MATH", number: "221", title: "Calculus I", credits: 5 },
        requirementLabel: "Required Mathematics",
      },
    ],
    totalPlannedCredits: 10,
    completedCredits: 0,
    expiresAt: null,
  };
}

function makeComparablePlan(): ComparablePlanDetail {
  return {
    planId: 22,
    planName: "My Plan",
    description: "Mine",
    ownerLabel: "My plan",
    programNames: ["B.S. Computer Science"],
    terms: [
      { id: 11, season: "Fall", year: 2026 },
      { id: 12, season: "Spring", year: 2027 },
    ],
    plannedCourses: [
      {
        student_id: 1,
        term_id: 11,
        course_id: 101,
        status: "planned",
        plan_id: 22,
        course: { id: 101, subject: "CSCI", number: "241", title: "Computer Science I", credits: 5 },
        requirementLabel: "Required Major",
      },
      {
        student_id: 1,
        term_id: 12,
        course_id: 999,
        status: "planned",
        plan_id: 22,
        course: { id: 999, subject: "ENGL", number: "101", title: "Composition and Reading", credits: 3 },
        requirementLabel: "Written Communication",
      },
    ],
    totalPlannedCredits: 8,
    completedCredits: 0,
  };
}

describe("shared planner views", () => {
  it("renders the unavailable state with custom text", () => {
    renderWithChakra(
      <SharedPlanUnavailable title="Missing plan" description="This link has expired." />
    );

    expect(screen.getByText("Missing plan")).toBeInTheDocument();
    expect(screen.getByText("This link has expired.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse shared plans/i })).toHaveAttribute(
      "href",
      "/shared/plans"
    );
  });

  it("renders the shared plans empty state", () => {
    renderWithChakra(<SharedPlansIndex plans={[]} ownPlans={[]} />);

    expect(screen.getByText("No shared plans yet")).toBeInTheDocument();
    expect(screen.queryByText(/SHARED PLAN COMPARE PICKER/i)).not.toBeInTheDocument();
  });

  it("renders shared plan cards and compare action on the index page", () => {
    renderWithChakra(
      <SharedPlansIndex
        plans={[
          makeSharedPlanSummary(),
          makeSharedPlanSummary({
            shareToken: "shared-2",
            planId: 2,
            planName: "Accounting Major 4 Year Plan",
            description: null,
            programNames: [],
          }),
        ]}
        ownPlans={[makeOwnPlanSummary()]}
      />
    );

    expect(screen.getByText("Shared Plans")).toBeInTheDocument();
    expect(screen.getByText("Computer Science Major 4 Year Plan")).toBeInTheDocument();
    expect(screen.getByText("Accounting Major 4 Year Plan")).toBeInTheDocument();
    expect(screen.getByText("Program details unavailable")).toBeInTheDocument();
    expect(screen.getByText("SHARED PLAN COMPARE PICKER shared=2 own=1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return to the planner/i })).toHaveAttribute(
      "href",
      "/dashboard/planner"
    );
  });

  it("renders a single shared plan view with planner actions", () => {
    renderWithChakra(
      <SharedPlanView
        plan={makeSharedPlanDetail()}
        showPlannerCta
        ownPlans={[]}
        comparisonPlan={null}
      />
    );

    expect(screen.getByText("Shared read-only plan")).toBeInTheDocument();
    expect(screen.getByText("Back to Shared Plans")).toBeInTheDocument();
    expect(screen.getByText("View-only shared plan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compare with my plan/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /compare with my plan/i }).parentElement).toHaveAttribute(
      "data-scope",
      "tooltip"
    );
    expect(screen.getByRole("link", { name: /open planner/i })).toHaveAttribute(
      "href",
      "/dashboard/planner"
    );
    expect(screen.getByText("Computer Science I")).toBeInTheDocument();
    expect(screen.getByText("Required Major")).toBeInTheDocument();
    expect(screen.getAllByText("Semester total")).toHaveLength(2);
  });

  it("renders the comparison view and overlap stats", () => {
    renderWithChakra(
      <SharedPlanView
        plan={makeSharedPlanDetail()}
        showPlannerCta
        ownPlans={[makeOwnPlanSummary()]}
        comparisonPlan={makeComparablePlan()}
      />
    );

    expect(screen.getByText(/Comparison View/i)).toBeInTheDocument();
    expect(screen.getByText(/Computer Science Major 4 Year Plan vs My Plan/i)).toBeInTheDocument();
    expect(screen.getAllByText("In both plans").length).toBeGreaterThan(0);
    expect(screen.getByText("Courses in Common")).toBeInTheDocument();
    expect(screen.getByText("Unique to Shared Plan")).toBeInTheDocument();
    expect(screen.getByText("Unique to My Plan")).toBeInTheDocument();
    expect(screen.getByText("Planned Credit Difference")).toBeInTheDocument();
    expect(screen.getByText("COMPARE PICKER selected=22")).toBeInTheDocument();
  });

  it("renders the compare picker and empty-semester state when no terms exist", () => {
    const emptyPlan: SharedPlanDetail = {
      ...makeSharedPlanDetail(),
      terms: [],
      plannedCourses: [],
      totalPlannedCredits: 0,
    };

    renderWithChakra(
      <SharedPlanView
        plan={emptyPlan}
        showPlannerCta
        ownPlans={[makeOwnPlanSummary()]}
        comparisonPlan={null}
      />
    );

    expect(screen.getByText("COMPARE PICKER selected=null")).toBeInTheDocument();
    expect(screen.getByText("No semesters have been added yet")).toBeInTheDocument();
    expect(
      screen.getByText("This shared plan is available, but the owner has not added any semesters or courses yet.")
    ).toBeInTheDocument();
  });

  it("renders the non-planner CTA branch when planner actions are hidden", () => {
    renderWithChakra(
      <SharedPlanView
        plan={makeSharedPlanDetail()}
        showPlannerCta={false}
        ownPlans={[]}
        comparisonPlan={null}
      />
    );

    expect(screen.getByRole("link", { name: /view more shared plans/i })).toHaveAttribute(
      "href",
      "/shared/plans"
    );
    expect(screen.queryByText(/COMPARE PICKER/i)).not.toBeInTheDocument();
  });
});
