import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProgramSelectionStep from "@/components/onboarding/ProgramSelectionStep";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Program } from "@/types/onboarding";

const mockMajors: Program[] = [
  { id: 1, name: "Computer Science Major (BS)", catalog_year: "2025-2026", program_type: "MAJOR" },
  { id: 2, name: "Biology Major (BS)", catalog_year: "2025-2026", program_type: "MAJOR" },
  { id: 3, name: "Business Management Major (BS)", catalog_year: "2025-2026", program_type: "MAJOR" },
];

const mockCertificates: Program[] = [
  { id: 10, name: "Data Science Certificate", catalog_year: "2025-2026", program_type: "CERTIFICATE" },
];

const defaultProps = {
  majors: mockMajors,
  certificates: mockCertificates,
  selectedMajor: null as number | null,
  selectedCertificates: [] as number[],
  onMajorChange: vi.fn(),
  onCertificatesChange: vi.fn(),
  expectedGradSemester: null as string | null,
  expectedGradYear: null as number | null,
  onGradChange: vi.fn(),
};

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("ProgramSelectionStep", () => {
  it("renders major names", () => {
    renderWithChakra(<ProgramSelectionStep {...defaultProps} />);

    expect(screen.getAllByText("Computer Science Major (BS)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Biology Major (BS)").length).toBeGreaterThan(0);
  });

  it("renders catalog year for programs", () => {
    renderWithChakra(<ProgramSelectionStep {...defaultProps} />);

    expect(screen.getAllByText("2025-2026").length).toBeGreaterThan(0);
  });

  it("renders section headers", () => {
    renderWithChakra(
      <ProgramSelectionStep {...defaultProps} selectedMajor={1} />
    );

    expect(screen.getAllByText("Select Your Major").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Add Certificates").length).toBeGreaterThan(0);
  });

  it("renders search input", () => {
    renderWithChakra(<ProgramSelectionStep {...defaultProps} />);

    expect(screen.getByPlaceholderText("Search majors...")).toBeInTheDocument();
  });

  it("filters majors by search query", () => {
    renderWithChakra(<ProgramSelectionStep {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText("Search majors...");
    fireEvent.change(searchInput, { target: { value: "Computer" } });

    expect(screen.getAllByText("Computer Science Major (BS)").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Biology Major (BS)").length).toBe(0);
  });

  it("shows result count", () => {
    renderWithChakra(<ProgramSelectionStep {...defaultProps} />);

    expect(screen.getAllByText("3 of 3 majors").length).toBeGreaterThan(0);
  });

  it("shows no results message when search finds nothing", () => {
    renderWithChakra(<ProgramSelectionStep {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText("Search majors...");
    fireEvent.change(searchInput, { target: { value: "xyznotfound" } });

    expect(screen.getAllByText(/No majors match/).length).toBeGreaterThan(0);
  });

  it("hides certificates when no major selected", () => {
    const { container } = renderWithChakra(<ProgramSelectionStep {...defaultProps} />);

    // Collapsible content should be hidden (has hidden attribute or data-state=closed)
    const collapsible = container.querySelector("[data-state='closed']");
    expect(collapsible).not.toBeNull();
  });

  it("shows certificates when major is selected", () => {
    renderWithChakra(
      <ProgramSelectionStep {...defaultProps} selectedMajor={1} />
    );

    expect(screen.getAllByText("Data Science Certificate").length).toBeGreaterThan(0);
  });

  it("renders graduation date section", () => {
    renderWithChakra(<ProgramSelectionStep {...defaultProps} />);

    expect(screen.getAllByText("Expected Graduation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("As soon as possible").length).toBeGreaterThan(0);
  });

  it("renders empty state when no programs provided", () => {
    const { container } = renderWithChakra(
      <ProgramSelectionStep
        {...defaultProps}
        majors={[]}
        certificates={[]}
      />
    );

    // Headers still render
    expect(screen.getAllByText("Select Your Major").length).toBeGreaterThan(0);
    // But no radio card items rendered when majors is empty
    const radioCards = container.querySelectorAll("[data-part='item']");
    expect(radioCards.length).toBe(0);
  });

  // ── NEW: Coverage boosters ───────────────────────────────────────────────

  it("clicking 'As soon as possible' calls onGradChange with computed semester/year", () => {
    vi.useFakeTimers();
    // March 3, 2026 => month=2 (<4) => Spring 2026
    vi.setSystemTime(new Date("2026-03-03T12:00:00Z"));

    const onGradChange = vi.fn();

    renderWithChakra(
      <ProgramSelectionStep
        {...defaultProps}
        onGradChange={onGradChange}
      />
    );

    fireEvent.click(screen.getByText("As soon as possible"));

    expect(onGradChange).toHaveBeenCalledWith("Spring", 2026);

    vi.useRealTimers();
  });

  it("changing semester select calls onGradChange with new semester and existing year", () => {
    const onGradChange = vi.fn();

    const { container } = renderWithChakra(
      <ProgramSelectionStep
        {...defaultProps}
        onGradChange={onGradChange}
        expectedGradSemester={null}
        expectedGradYear={null}
      />
    );

    const selects = container.querySelectorAll("select");
    expect(selects.length).toBeGreaterThanOrEqual(2);

    const semesterSelect = selects[0];
    fireEvent.change(semesterSelect, { target: { value: "Fall" } });

    expect(onGradChange).toHaveBeenCalledWith("Fall", null);
  });

  it("changing year select calls onGradChange with existing semester and new year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T12:00:00Z")); // so year options include 2026+

    const onGradChange = vi.fn();

    const { container } = renderWithChakra(
      <ProgramSelectionStep
        {...defaultProps}
        onGradChange={onGradChange}
        expectedGradSemester="Fall"
        expectedGradYear={null}
      />
    );

    const selects = container.querySelectorAll("select");
    expect(selects.length).toBeGreaterThanOrEqual(2);

    const yearSelect = selects[1];
    fireEvent.change(yearSelect, { target: { value: "2027" } });

    expect(onGradChange).toHaveBeenCalledWith("Fall", 2027);

    vi.useRealTimers();
  });

  it("shows Target text when expectedGradSemester and expectedGradYear are provided", () => {
    renderWithChakra(
      <ProgramSelectionStep
        {...defaultProps}
        expectedGradSemester="Fall"
        expectedGradYear={2027}
      />
    );

    expect(screen.getAllByText("Target: Fall 2027").length).toBeGreaterThan(0);
  });

  it("shows 'no certificates available' message when major selected but certificates list is empty", () => {
    renderWithChakra(
      <ProgramSelectionStep
        {...defaultProps}
        selectedMajor={1}
        certificates={[]}
      />
    );

    expect(
      screen.getAllByText("No certificates available for this major yet.").length
    ).toBeGreaterThan(0);
  });
});
