import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import ReviewStep from "@/components/onboarding/ReviewStep";
import { renderWithChakra } from "@/__tests__/helpers/mocks";
import type { Program, CourseRow } from "@/types/onboarding";

const mockMajor: Program = {
  id: 534,
  name: "Computer Science Major (BS)",
  catalog_year: "2025-2026",
  program_type: "MAJOR",
};

const mockCerts: Program[] = [
  { id: 10, name: "Data Science Certificate", catalog_year: "2025-2026", program_type: "CERTIFICATE" },
];

const mockClasses: CourseRow[] = [
  { id: 100, subject: "CS", number: "101", title: "Intro to CS", credits: 3 },
  { id: 101, subject: "CS", number: "201", title: "Data Structures", credits: 3 },
];

const defaultProps = {
  major: mockMajor as Program | null,
  certificates: [] as Program[],
  classes: [] as CourseRow[],
  expectedGradSemester: null as string | null,
  expectedGradYear: null as number | null,
  onEditStep: vi.fn(),
};

describe("ReviewStep", () => {
  it("renders selected major", () => {
    renderWithChakra(<ReviewStep {...defaultProps} />);

    expect(screen.getAllByText("Computer Science Major (BS)").length).toBeGreaterThan(0);
  });

  it("renders no major selected state", () => {
    renderWithChakra(<ReviewStep {...defaultProps} major={null} />);

    expect(screen.getAllByText("No major selected").length).toBeGreaterThan(0);
  });

  it("renders selected certificates", () => {
    renderWithChakra(
      <ReviewStep {...defaultProps} certificates={mockCerts} />
    );

    expect(screen.getAllByText("Data Science Certificate").length).toBeGreaterThan(0);
  });

  it("renders no certificates selected state", () => {
    renderWithChakra(<ReviewStep {...defaultProps} />);

    expect(screen.getAllByText("No certificates selected").length).toBeGreaterThan(0);
  });

  it("renders selected classes with course codes", () => {
    renderWithChakra(
      <ReviewStep {...defaultProps} classes={mockClasses} />
    );

    expect(screen.getAllByText("CS 101").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CS 201").length).toBeGreaterThan(0);
  });

  it("renders summary statistics labels", () => {
    renderWithChakra(
      <ReviewStep
        {...defaultProps}
        certificates={mockCerts}
        classes={mockClasses}
      />
    );

    expect(screen.getAllByText("Programs Selected").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Courses Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Completed Credits").length).toBeGreaterThan(0);
  });

  it("renders expected graduation when provided", () => {
    renderWithChakra(
      <ReviewStep
        {...defaultProps}
        expectedGradSemester="Fall"
        expectedGradYear={2027}
      />
    );

    expect(screen.getAllByText("Fall 2027").length).toBeGreaterThan(0);
    expect(screen.getAllByText("EXPECTED GRADUATION").length).toBeGreaterThan(0);
  });

  it("renders not specified when no graduation date", () => {
    renderWithChakra(<ReviewStep {...defaultProps} />);

    expect(screen.getAllByText("Not specified").length).toBeGreaterThan(0);
  });

  it("calls onEditStep(0) when Major Edit button is clicked", () => {
    const onEditStep = vi.fn();
    renderWithChakra(<ReviewStep {...defaultProps} onEditStep={onEditStep} />);
    const editButtons = screen.getAllByText("Edit");
    // First Edit button is in the Major section
    fireEvent.click(editButtons[0]);
    expect(onEditStep).toHaveBeenCalledWith(0);
  });

  it("calls onEditStep(0) when Certificates Edit button is clicked", () => {
    const onEditStep = vi.fn();
    renderWithChakra(<ReviewStep {...defaultProps} onEditStep={onEditStep} />);
    const editButtons = screen.getAllByText("Edit");
    // Second Edit button is in the Certificates section
    fireEvent.click(editButtons[1]);
    expect(onEditStep).toHaveBeenCalledWith(0);
  });

  it("calls onEditStep(1) when Classes Edit button is clicked", () => {
    const onEditStep = vi.fn();
    renderWithChakra(<ReviewStep {...defaultProps} onEditStep={onEditStep} />);
    const editButtons = screen.getAllByText("Edit");
    // Third Edit button is in the Classes section
    fireEvent.click(editButtons[2]);
    expect(onEditStep).toHaveBeenCalledWith(1);
  });

  it("calls onEditStep(0) when Graduation Edit button is clicked", () => {
    const onEditStep = vi.fn();
    renderWithChakra(<ReviewStep {...defaultProps} onEditStep={onEditStep} />);
    const editButtons = screen.getAllByText("Edit");
    // Fourth Edit button is in the Graduation section
    fireEvent.click(editButtons[3]);
    expect(onEditStep).toHaveBeenCalledWith(0);
  });

  it("renders singular 'course' in badge when exactly 1 class selected", () => {
    const oneClass: CourseRow[] = [
      { id: 100, subject: "CS", number: "101", title: "Intro to CS", credits: 3 },
    ];
    renderWithChakra(<ReviewStep {...defaultProps} classes={oneClass} />);
    // Badge should show "1 course •" (no 's')
    expect(screen.getAllByText(/1 course •/).length).toBeGreaterThan(0);
  });

  it("renders plural 'courses' in badge when multiple classes selected", () => {
    renderWithChakra(<ReviewStep {...defaultProps} classes={mockClasses} />);
    // Badge should show "2 courses •"
    expect(screen.getAllByText(/2 courses •/).length).toBeGreaterThan(0);
  });

  it("shows correct total credit count in badge", () => {
    renderWithChakra(<ReviewStep {...defaultProps} classes={mockClasses} />);
    // 3 + 3 = 6 credits
    expect(screen.getAllByText(/6 credits/).length).toBeGreaterThan(0);
  });
});
