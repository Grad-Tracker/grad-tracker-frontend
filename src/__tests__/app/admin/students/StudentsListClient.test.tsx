import { describe, it, expect } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithChakra } from "../../../helpers/mocks";
import StudentsListClient from "@/app/admin/(protected)/students/StudentsListClient";
import type { AdvisorStudentRow } from "@/lib/supabase/queries/advisor-students";

const fixtures: AdvisorStudentRow[] = [
  {
    id: 1,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    primaryProgramId: 10,
    primaryProgramName: "Computer Science",
    primaryProgramType: "MAJOR",
    expectedGradSemester: "Spring",
    expectedGradYear: 2027,
    majorProgressPct: 65,
    genEdProgressPct: 40,
  },
  {
    id: 2,
    firstName: "Alan",
    lastName: "Turing",
    email: "alan@example.com",
    primaryProgramId: 10,
    primaryProgramName: "Computer Science",
    primaryProgramType: "MAJOR",
    expectedGradSemester: "Fall",
    expectedGradYear: 2028,
    majorProgressPct: 25,
    genEdProgressPct: 80,
  },
];

describe("StudentsListClient", () => {
  it("renders one card per student", () => {
    renderWithChakra(<StudentsListClient students={fixtures} />);
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Alan Turing").length).toBeGreaterThanOrEqual(1);
  });

  it("filters by name as the user types", () => {
    renderWithChakra(<StudentsListClient students={fixtures} />);
    const input = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "alan" } });
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(screen.getAllByText("Alan Turing").length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when no students", () => {
    renderWithChakra(<StudentsListClient students={[]} />);
    expect(
      screen.getAllByText(/no students enrolled/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders a dash when the student has no expected graduation semester or year", () => {
    renderWithChakra(
      <StudentsListClient
        students={[
          {
            ...fixtures[0],
            expectedGradSemester: null,
            expectedGradYear: null,
          },
        ]}
      />
    );
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("renders 'No students match your search' when the filter excludes every row", () => {
    renderWithChakra(<StudentsListClient students={fixtures} />);
    const input = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "no-such-student" } });
    expect(
      screen.getAllByText(/No students match your search/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("hides the primary program badge when program name is null", () => {
    renderWithChakra(
      <StudentsListClient
        students={[
          {
            ...fixtures[0],
            primaryProgramName: null,
            primaryProgramType: null,
          },
        ]}
      />
    );
    expect(screen.queryByText("Computer Science")).toBeNull();
  });
});
