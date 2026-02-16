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

  describe("Default graduation date (getAsapGraduation)", () => {
    // Helper function to mock Date and test graduation logic
    function testGraduationDate(
      dateStr: string,
      expectedSemester: string,
      expectedYear: number,
      description: string
    ) {
      const originalDate = Date;
      const mockDate = new originalDate(dateStr);
      vi.spyOn(global, "Date").mockImplementation((...args: any[]) => 
        args.length === 0 ? mockDate : new originalDate(...args)
      );

      const onGradChange = vi.fn();
      renderWithChakra(<ProgramSelectionStep {...defaultProps} onGradChange={onGradChange} />);

      const asapButton = screen.getByText("As soon as possible");
      fireEvent.click(asapButton);

      expect(onGradChange).toHaveBeenCalledWith(expectedSemester, expectedYear);

      vi.restoreAllMocks();
    }

    it("sets Spring of current year for January-April (months 0-3)", () => {
      testGraduationDate("2024-03-15", "Spring", 2024, "March");
    });

    it("sets Summer of current year for May-July (months 4-6)", () => {
      testGraduationDate("2024-06-15", "Summer", 2024, "June");
    });

    it("sets Fall of current year for August-November (months 7-10)", () => {
      testGraduationDate("2024-10-15", "Fall", 2024, "October");
    });

    it("sets Spring of next year for December (month 11)", () => {
      testGraduationDate("2024-12-15", "Spring", 2025, "December");
    });
  });
});
