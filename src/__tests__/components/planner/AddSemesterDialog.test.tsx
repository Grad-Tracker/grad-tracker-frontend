import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";
import type { Term, Season } from "@/types/planner";
import AddSemesterDialog from "@/components/planner/AddSemesterDialog";

function makeTerm(season: Season, year: number, id = 1): Term {
  return { id, season, year };
}

describe("AddSemesterDialog", () => {
  const currentYear = new Date().getFullYear();

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onAdd: vi.fn().mockResolvedValue(undefined),
    existingTerms: [] as Term[],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onAdd.mockResolvedValue(undefined);
  });

  it("renders 'Add Semester' title when open", () => {
    renderWithChakra(<AddSemesterDialog {...defaultProps} />);
    expect(
      screen.getAllByText("Add Semester").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders three season buttons: Fall, Spring, Summer", () => {
    renderWithChakra(<AddSemesterDialog {...defaultProps} />);
    expect(
      screen.getAllByText(/Fall/).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Spring/).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Summer/).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("clicking a season button selects it (changes variant to solid)", () => {
    renderWithChakra(<AddSemesterDialog {...defaultProps} />);

    // Default selection is Fall — the Add button text should reflect it
    const addButtons = screen.getAllByText(`Add Fall ${currentYear}`);
    expect(addButtons.length).toBeGreaterThanOrEqual(1);

    // Click "Spring" season button
    const springButtons = screen.getAllByText(/Spring/);
    fireEvent.click(springButtons[0]);

    // Now the add button text should say "Add Spring <year>"
    const springAddButtons = screen.getAllByText(`Add Spring ${currentYear}`);
    expect(springAddButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows duplicate warning when selected season+year matches an existing term", () => {
    const existingTerms = [makeTerm("Fall", currentYear)];
    renderWithChakra(
      <AddSemesterDialog {...defaultProps} existingTerms={existingTerms} />
    );

    // Default season is Fall, which matches the existing term
    expect(
      screen.getAllByText(`Fall ${currentYear} already exists in your plan.`).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("disables the add button when duplicate is detected", () => {
    const existingTerms = [makeTerm("Fall", currentYear)];
    renderWithChakra(
      <AddSemesterDialog {...defaultProps} existingTerms={existingTerms} />
    );

    // Find the "Add Fall <year>" button
    const addBtnElements = screen.getAllByText(`Add Fall ${currentYear}`);
    const addButton = addBtnElements[0].closest("button");
    expect(addButton).toBeTruthy();
    expect(addButton!.disabled).toBe(true);
  });

  it("calls onAdd(season, year) on successful submission", async () => {
    renderWithChakra(<AddSemesterDialog {...defaultProps} />);

    // Default is Fall + currentYear, click the Add button
    const addBtnElements = screen.getAllByText(`Add Fall ${currentYear}`);
    const addButton = addBtnElements[0].closest("button")!;

    await act(async () => {
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      expect(defaultProps.onAdd).toHaveBeenCalledTimes(1);
      expect(defaultProps.onAdd).toHaveBeenCalledWith("Fall", currentYear);
    });
  });

  it("does not render content when open={false}", () => {
    renderWithChakra(
      <AddSemesterDialog {...defaultProps} open={false} />
    );
    // With lazyMount and open=false, dialog content should not be in the DOM
    expect(screen.queryAllByText("Add Semester").length).toBe(0);
    expect(screen.queryAllByText(/Fall/).length).toBe(0);
  });

  it("updates add button label when year input changes", () => {
    renderWithChakra(<AddSemesterDialog {...defaultProps} />);

    const yearInput = screen.getByRole("spinbutton");
    fireEvent.change(yearInput, { target: { value: "2028" } });

    expect(
      screen.getAllByText("Add Fall 2028").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows loading state on add button while onAdd is pending", async () => {
    let resolveAdd!: () => void;
    const pendingAdd = vi.fn(
      () => new Promise<void>((resolve) => { resolveAdd = resolve; })
    );

    renderWithChakra(<AddSemesterDialog {...defaultProps} onAdd={pendingAdd} />);

    const addBtnElement = screen.getAllByText(`Add Fall ${currentYear}`)[0];
    const addButton = addBtnElement.closest("button")!;

    await act(async () => {
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      expect(
        addButton.hasAttribute("disabled") ||
        addButton.hasAttribute("data-loading") ||
        addButton.getAttribute("aria-busy") === "true"
      ).toBe(true);
    });

    await act(async () => {
      resolveAdd();
    });
  });
});
