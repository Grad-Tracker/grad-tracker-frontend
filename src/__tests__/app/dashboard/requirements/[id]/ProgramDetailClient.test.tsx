import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithChakra } from "../../../../helpers/mocks";
import ProgramDetailClient from "@/app/dashboard/requirements/[id]/ProgramDetailClient";
import type { Course } from "@/types/course";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/ui/color-mode", () => ({
  ColorModeButton: () => null,
}));
vi.mock("@/types/planner", () => ({
  BREADTH_PACKAGES: [
    {
      id: "math",
      name: "Mathematics",
      description: "Math requirement",
      totalCreditsRequired: 3,
      options: [{ subject: "MATH", number: "221" }],
    },
  ],
  getPackageCourseKeys: (pkg: any) =>
    new Set(pkg.options.map((o: any) => `${o.subject} ${o.number}`)),
  courseKey: (c: any) => `${c.subject} ${c.number}`,
}));

const mockProgram = {
  id: "42",
  name: "Computer Science",
  catalog_year: 2024,
  program_type: "MAJOR",
};

const cs101: Course = {
  id: 1,
  subject: "CS",
  number: "101",
  title: "Intro to CS",
  credits: 3,
  description: "Introductory course.",
  prereq_text: null,
};

const cs201: Course = {
  id: 2,
  subject: "CS",
  number: "201",
  title: "Data Structures",
  credits: 3,
  description: "Learn data structures.",
  prereq_text: "CS 101",
};

const math221: Course = {
  id: 3,
  subject: "MATH",
  number: "221",
  title: "Calculus I",
  credits: 4,
  description: null,
  prereq_text: null,
};

const flatBlock = {
  id: "b1",
  name: "Core Courses",
  rule: "ALL_OF",
  n_required: null,
  credits_required: null,
  courses: [cs101, cs201],
  options: null,
  crossPairs: [],
};

const optionBlock = {
  id: "b2",
  name: "Science Requirement",
  rule: "N_OF",
  n_required: 1,
  credits_required: null,
  courses: [cs101, cs201],
  options: [[cs101], [cs201]],
  crossPairs: [],
};

const breadthBlock = {
  id: "b3",
  name: "Breadth Requirements",
  rule: "CREDITS_OF",
  n_required: null,
  credits_required: 9,
  courses: [math221],
  options: null,
  crossPairs: [],
};

const emptyBlock = {
  id: "b4",
  name: "Empty Block",
  rule: "ALL_OF",
  n_required: null,
  credits_required: null,
  courses: [],
  options: null,
  crossPairs: [],
};

describe("ProgramDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the program name as heading", () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[]} />
    );
    expect(screen.getAllByText("Computer Science").length).toBeGreaterThanOrEqual(1);
  });

  it("renders program type badge", () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[]} />
    );
    expect(screen.getAllByText("Major").length).toBeGreaterThanOrEqual(1);
  });

  it("renders catalog year badge when present", () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[]} />
    );
    expect(screen.getAllByText("2024").length).toBeGreaterThanOrEqual(1);
  });

  it("does not render catalog year badge when null", () => {
    renderWithChakra(
      <ProgramDetailClient
        program={{ ...mockProgram, catalog_year: null }}
        blocks={[]}
      />
    );
    expect(screen.queryAllByText("2024")).toHaveLength(0);
  });

  it("renders 'Description coming soon.' placeholder", () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[]} />
    );
    expect(screen.getAllByText("Description coming soon.").length).toBeGreaterThanOrEqual(1);
  });

  it("renders breadcrumb link to /dashboard/requirements", () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[]} />
    );
    const link = screen.getAllByRole("link", { name: /^requirements$/i })[0];
    expect(link).toHaveAttribute("href", "/dashboard/requirements");
  });

  it("renders 'No requirement blocks found' when blocks is empty", () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[]} />
    );
    expect(
      screen.getAllByText("No requirement blocks found for this program.").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders block name and ALL_OF rule label", () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[flatBlock]} />
    );
    expect(screen.getAllByText("Core Courses").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Complete all of the following").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders CREDITS_OF rule label", () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[breadthBlock]} />
    );
    expect(
      screen.getAllByText("Complete 9 credits from the following").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders N_OF rule label", () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[optionBlock]} />
    );
    expect(
      screen.getAllByText("Complete 1 of the following").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders course rows in flat CourseTable", () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[flatBlock]} />
    );
    expect(screen.getAllByText(/CS/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Intro to CS").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Data Structures").length).toBeGreaterThanOrEqual(1);
  });

  it("renders OptionGroupView with 'Option A' and 'Option B' labels when options exist", () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[optionBlock]} />
    );
    expect(screen.getAllByText("Option A").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Option B").length).toBeGreaterThanOrEqual(1);
  });

  it("renders OR divider badge between options", () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[optionBlock]} />
    );
    expect(screen.getAllByText("OR").length).toBeGreaterThanOrEqual(1);
  });

  it("renders BreadthPackageView with package name for breadth blocks", () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[breadthBlock]} />
    );
    expect(screen.getAllByText("Mathematics").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("MATH 221").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'No courses listed' for empty blocks", () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[emptyBlock]} />
    );
    expect(
      screen.getAllByText("No courses listed for this requirement.").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders cross-listed courses in a single row with 'or' connector", () => {
    const csci231: Course = {
      id: 10,
      subject: "CSCI",
      number: "231",
      title: "Discrete Math",
      credits: 3,
      description: null,
      prereq_text: null,
    };
    const math231: Course = {
      id: 11,
      subject: "MATH",
      number: "231",
      title: "Discrete Math",
      credits: 3,
      description: null,
      prereq_text: null,
    };
    const crossBlock = {
      id: "b5",
      name: "Required Courses",
      rule: "ALL_OF",
      n_required: null,
      credits_required: null,
      courses: [csci231, math231],
      options: null,
      crossPairs: [[10, 11]],
    };
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[crossBlock]} />
    );
    expect(screen.getAllByText("CSCI 231").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("MATH 231").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("or").length).toBeGreaterThanOrEqual(1);
  });

  it("opens course drawer with title and credits when a row is clicked", async () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[flatBlock]} />
    );
    const row = screen.getAllByText("Intro to CS")[0].closest("tr");
    fireEvent.click(row!);
    await waitFor(() => {
      expect(screen.getAllByText("Course Title").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Credits").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows prerequisites in drawer when prereq_text is present", async () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[flatBlock]} />
    );
    const row = screen.getAllByText("Data Structures")[0].closest("tr");
    fireEvent.click(row!);
    await waitFor(() => {
      expect(screen.getAllByText("Prerequisites").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("CS 101").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows 'No description available.' in drawer when description is null", async () => {
    renderWithChakra(
      <ProgramDetailClient program={mockProgram} blocks={[breadthBlock]} />
    );
    const row = screen.getAllByText("Calculus I")[0].closest("tr");
    fireEvent.click(row!);
    await waitFor(() => {
      expect(
        screen.getAllByText("No description available.").length
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
