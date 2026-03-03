import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";
import type { Term } from "@/types/planner";
import RemoveSemesterDialog from "@/components/planner/RemoveSemesterDialog";

describe("RemoveSemesterDialog", () => {
  const defaultTerm: Term = { id: 1, season: "Fall", year: 2025 };
  let onOpenChange: ReturnType<typeof vi.fn>;
  let onConfirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onOpenChange = vi.fn();
    onConfirm = vi.fn().mockResolvedValue(undefined);
  });

  function renderDialog(overrides: Partial<{
    open: boolean;
    term: Term | null;
    courseCount: number;
  }> = {}) {
    const props = {
      open: true,
      onOpenChange,
      onConfirm,
      term: defaultTerm,
      courseCount: 3,
      ...overrides,
    };
    return renderWithChakra(<RemoveSemesterDialog {...props} />);
  }

  it("renders dialog with term season and year info when open", () => {
    renderDialog();
    const matches = screen.getAllByText(/Remove Fall 2025/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows course count in confirmation body", () => {
    renderDialog({ courseCount: 5 });
    const matches = screen.getAllByText(/5 courses/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onConfirm when remove button is clicked", async () => {
    renderDialog();
    const removeBtn = screen.getAllByText("Remove Semester")[0];
    await act(async () => {
      fireEvent.click(removeBtn);
    });
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it("shows loading state while confirm promise is pending", async () => {
    let resolveConfirm!: () => void;
    const pendingConfirm = vi.fn(
      () => new Promise<void>((resolve) => { resolveConfirm = resolve; })
    );
    onConfirm = pendingConfirm;

    renderDialog();
    const removeBtn = screen.getAllByText("Remove Semester")[0];

    // Click but do not resolve the promise yet
    await act(async () => {
      fireEvent.click(removeBtn);
    });

    // The button should now be in a loading state (Chakra sets aria-busy or disabled)
    await waitFor(() => {
      const btn = removeBtn.closest("button");
      expect(btn).toBeTruthy();
      // Chakra loading buttons get disabled and data-loading attribute
      expect(
        btn!.hasAttribute("disabled") ||
        btn!.hasAttribute("data-loading") ||
        btn!.getAttribute("aria-busy") === "true"
      ).toBe(true);
    });

    // Resolve and let the component finish
    await act(async () => {
      resolveConfirm();
    });
  });

  it("does not render content when open is false", () => {
    renderDialog({ open: false });
    const matches = screen.queryAllByText(/Remove Fall 2025/);
    expect(matches.length).toBe(0);
  });

  it("handles term with zero courses (singular/plural messaging)", () => {
    renderDialog({ courseCount: 0 });
    const matches = screen.getAllByText(/0 courses/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // Ensure "course" (singular) is not used for 0
    const singularMatches = screen.queryAllByText(/0 course[^s]/);
    expect(singularMatches.length).toBe(0);
  });
});
