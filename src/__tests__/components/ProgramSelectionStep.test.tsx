import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import ProgramSelectionStep from "@/components/onboarding/ProgramSelectionStep";
import { renderWithChakra } from "@/__tests__/helpers/mocks";
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

  it("shows target graduation text when both semester and year are set", () => {
    renderWithChakra(
      <ProgramSelectionStep
        {...defaultProps}
        expectedGradSemester="Fall"
        expectedGradYear={2027}
      />
    );
    expect(screen.getAllByText("Target: Fall 2027").length).toBeGreaterThan(0);
  });

  it("does not show target graduation text when only semester is set", () => {
    renderWithChakra(
      <ProgramSelectionStep
        {...defaultProps}
        expectedGradSemester="Spring"
        expectedGradYear={null}
      />
    );
    expect(screen.queryAllByText(/Target:/).length).toBe(0);
  });

  it("calls onGradChange with year when year dropdown changes", () => {
    const onGradChange = vi.fn();
    renderWithChakra(
      <ProgramSelectionStep
        {...defaultProps}
        onGradChange={onGradChange}
        expectedGradSemester="Spring"
        expectedGradYear={null}
      />
    );

    // Find all comboboxes — year is the second NativeSelect
    const selects = screen.getAllByRole("combobox");
    // The year select is the second one (semester, then year)
    const yearSelect = selects[1];
    const currentYear = new Date().getFullYear();
    fireEvent.change(yearSelect, { target: { value: String(currentYear + 1) } });

    expect(onGradChange).toHaveBeenCalledWith("Spring", currentYear + 1);
  });

  it("calls onGradChange with null year when year dropdown is cleared", () => {
    const onGradChange = vi.fn();
    const currentYear = new Date().getFullYear();
    renderWithChakra(
      <ProgramSelectionStep
        {...defaultProps}
        onGradChange={onGradChange}
        expectedGradSemester="Fall"
        expectedGradYear={currentYear}
      />
    );

    const selects = screen.getAllByRole("combobox");
    const yearSelect = selects[1];
    fireEvent.change(yearSelect, { target: { value: "" } });

    expect(onGradChange).toHaveBeenCalledWith("Fall", null);
  });

  it("calls onGradChange when semester dropdown changes", () => {
    const onGradChange = vi.fn();
    renderWithChakra(
      <ProgramSelectionStep
        {...defaultProps}
        onGradChange={onGradChange}
        expectedGradSemester={null}
        expectedGradYear={2026}
      />
    );

    const selects = screen.getAllByRole("combobox");
    const semesterSelect = selects[0];
    fireEvent.change(semesterSelect, { target: { value: "Summer" } });

    expect(onGradChange).toHaveBeenCalledWith("Summer", 2026);
  });

  it("calls onGradChange with current semester/year when As soon as possible is clicked", () => {
    const onGradChange = vi.fn();
    renderWithChakra(
      <ProgramSelectionStep
        {...defaultProps}
        onGradChange={onGradChange}
      />
    );

    const asapButton = screen.getAllByText("As soon as possible")[0];
    fireEvent.click(asapButton);

    expect(onGradChange).toHaveBeenCalledTimes(1);
    const [semester, year] = onGradChange.mock.calls[0];
    expect(["Spring", "Summer", "Fall"]).toContain(semester);
    expect(typeof year).toBe("number");
  });

  it("shows no certificates message when certificates list is empty and major is selected", () => {
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
