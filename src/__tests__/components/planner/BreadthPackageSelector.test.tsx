import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";
import BreadthPackageSelector from "@/components/planner/BreadthPackageSelector";
import { BREADTH_PACKAGES } from "@/types/planner";
import type { Course } from "@/types/course";

// ── Mock courses matching BREADTH_PACKAGES course keys ──────────────

const mockCourses: Course[] = [
  // Mathematics package
  { id: 1, subject: "MATH", number: "222", title: "Calculus II", credits: 4 },
  { id: 2, subject: "MATH", number: "301", title: "Linear Algebra", credits: 3 },
  // Math & Physics package
  { id: 3, subject: "PHYS", number: "202", title: "General Physics II", credits: 4 },
  // Chemistry package
  { id: 4, subject: "CHEM", number: "102", title: "General Chemistry II", credits: 3 },
  { id: 5, subject: "CHEM", number: "104", title: "Gen Chemistry II Lab", credits: 1 },
  { id: 6, subject: "CHEM", number: "206", title: "Organic Chemistry I", credits: 3 },
  { id: 7, subject: "CHEM", number: "215", title: "Analytical Chemistry", credits: 3 },
  // Project Management package
  { id: 8, subject: "PMGT", number: "341", title: "Basics of Project Management", credits: 3 },
  { id: 9, subject: "PMGT", number: "342", title: "Advanced Project Management", credits: 3 },
  { id: 10, subject: "PMGT", number: "441", title: "Project Leadership", credits: 3 },
  { id: 11, subject: "PMGT", number: "442", title: "Project Portfolio", credits: 3 },
  // Business package
  { id: 12, subject: "ACCT", number: "201", title: "Intro to Accounting", credits: 3 },
  { id: 13, subject: "BUS", number: "272", title: "Legal Environment", credits: 3 },
  { id: 14, subject: "FIN", number: "330", title: "Corp Finance", credits: 3 },
  { id: 15, subject: "MGT", number: "349", title: "Management", credits: 3 },
  { id: 16, subject: "MKT", number: "350", title: "Marketing", credits: 3 },
  // Economics package
  { id: 17, subject: "ECON", number: "320", title: "Intermediate Micro", credits: 3 },
  { id: 18, subject: "ECON", number: "321", title: "Intermediate Macro", credits: 3 },
  // Geography / GIS package
  { id: 19, subject: "GEOG", number: "350", title: "Cartography", credits: 3 },
  { id: 20, subject: "GEOG", number: "460", title: "Intro GIS Analysis", credits: 3 },
  { id: 21, subject: "GEOG", number: "465", title: "Advanced GIS", credits: 3 },
  // Criminal Justice & Law package
  { id: 22, subject: "CRMJ", number: "316", title: "Criminal Procedure", credits: 3 },
  { id: 23, subject: "CRMJ", number: "380", title: "Criminal Law", credits: 3 },
  // Art & Interactive Design package
  { id: 24, subject: "ART", number: "105", title: "Intro to Graphic Design", credits: 3 },
  { id: 25, subject: "ART", number: "377", title: "Interactive Design I", credits: 3 },
  { id: 26, subject: "ART", number: "477", title: "Interactive Design II", credits: 3 },
];

// ── Default props ───────────────────────────────────────────────────

function defaultProps(overrides: Partial<React.ComponentProps<typeof BreadthPackageSelector>> = {}) {
  return {
    selectedPackageId: null,
    onSelect: vi.fn(),
    completedCourseIds: new Set<number>(),
    plannedCourseIds: new Set<number>(),
    allBreadthCourses: mockCourses,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("BreadthPackageSelector", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders all 9 breadth package names", () => {
    renderWithChakra(<BreadthPackageSelector {...defaultProps()} />);

    for (const pkg of BREADTH_PACKAGES) {
      expect(screen.getAllByText(pkg.name).length).toBeGreaterThanOrEqual(1);
    }
    // Verify exactly 9 packages exist
    expect(BREADTH_PACKAGES).toHaveLength(9);
  });

  it("shows description for each package", () => {
    renderWithChakra(<BreadthPackageSelector {...defaultProps()} />);

    for (const pkg of BREADTH_PACKAGES) {
      expect(screen.getAllByText(pkg.description).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("calls onSelect with the package id when a package is clicked", () => {
    const onSelect = vi.fn();
    renderWithChakra(
      <BreadthPackageSelector {...defaultProps({ onSelect })} />
    );

    // Click the first package button — find by its name text then
    // click the closest ancestor button element
    const nameElements = screen.getAllByText(BREADTH_PACKAGES[0].name);
    const button = nameElements[0].closest("[role='button'], button") as HTMLElement;
    fireEvent.click(button);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(BREADTH_PACKAGES[0].id);
  });

  it("shows selected visual state for the active package", () => {
    const selectedPkg = BREADTH_PACKAGES[2]; // Chemistry
    renderWithChakra(
      <BreadthPackageSelector
        {...defaultProps({ selectedPackageId: selectedPkg.id })}
      />
    );

    // When a package is selected, the prompt "Choose a breadth package" should NOT appear
    expect(screen.queryAllByText("Choose a breadth package").length).toBe(0);

    // The selected package name should still be rendered
    expect(screen.getAllByText(selectedPkg.name).length).toBeGreaterThanOrEqual(1);
  });

  it("shows completed course badge when completedCourseIds match package courses", () => {
    // Mark MATH 222 (id: 1) as completed — matches the Mathematics package
    renderWithChakra(
      <BreadthPackageSelector
        {...defaultProps({
          completedCourseIds: new Set([1]),
        })}
      />
    );

    // Should show "1 done" badge
    expect(screen.getAllByText("1 done").length).toBeGreaterThanOrEqual(1);
  });

  it("shows planned course badge when plannedCourseIds match package courses", () => {
    // Mark MATH 301 (id: 2) as planned (NOT completed) — matches Mathematics package
    renderWithChakra(
      <BreadthPackageSelector
        {...defaultProps({
          plannedCourseIds: new Set([2]),
        })}
      />
    );

    // Should show "1 planned" badge
    expect(screen.getAllByText("1 planned").length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Choose a breadth package" prompt text when nothing is selected', () => {
    renderWithChakra(
      <BreadthPackageSelector {...defaultProps({ selectedPackageId: null })} />
    );

    expect(
      screen.getAllByText("Choose a breadth package").length
    ).toBeGreaterThanOrEqual(1);

    // Also check the sub-prompt text
    expect(
      screen.getAllByText(
        "You must complete one pre-approved package of 9+ credits."
      ).length
    ).toBeGreaterThanOrEqual(1);
  });
});
