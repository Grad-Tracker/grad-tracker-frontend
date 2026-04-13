import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithChakra } from "../../../helpers/mocks";
import StudentOverviewClient from "@/app/admin/(protected)/students/[studentId]/StudentOverviewClient";
import type { StudentOverview } from "@/lib/supabase/queries/advisor-students";

const overview: StudentOverview = {
  profile: {
    id: 1,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    expectedGradSemester: "Spring",
    expectedGradYear: 2027,
    breadthPackageId: "PKG_A",
  },
  programs: [
    { id: 10, name: "Computer Science", programType: "MAJOR", progressPct: 60, completedReqs: 6, totalReqs: 10 },
  ],
  genEdProgress: { progressPct: 30, completed: 3, total: 10 },
  plans: [
    {
      id: 50,
      name: "Plan A",
      description: "primary plan",
      createdAt: "2026-04-01",
      updatedAt: "2026-04-10",
      totalCredits: 0,
      termCount: 4,
    },
  ],
};

describe("StudentOverviewClient", () => {
  it("renders the student name and email", () => {
    renderWithChakra(<StudentOverviewClient overview={overview} />);
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("ada@example.com").length).toBeGreaterThanOrEqual(1);
  });

  it("renders one progress card per program plus gen-ed", () => {
    renderWithChakra(<StudentOverviewClient overview={overview} />);
    expect(screen.getAllByText("Computer Science").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/gen-?ed/i).length).toBeGreaterThanOrEqual(1);
  });

  it("links each plan card to the read-only planner route", () => {
    renderWithChakra(<StudentOverviewClient overview={overview} />);
    const link = screen.getAllByRole("link", { name: /plan a/i })[0];
    expect(link).toHaveAttribute("href", "/admin/students/1/planner?planId=50");
  });

  it("renders empty plans state when student has no plans", () => {
    renderWithChakra(
      <StudentOverviewClient overview={{ ...overview, plans: [] }} />
    );
    expect(
      screen.getAllByText(/Ada hasn't created a plan/i).length
    ).toBeGreaterThanOrEqual(1);
  });
});
