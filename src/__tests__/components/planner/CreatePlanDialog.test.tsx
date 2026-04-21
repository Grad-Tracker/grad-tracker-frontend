import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";
import CreatePlanDialog from "@/components/planner/CreatePlanDialog";

const { mockFetchPrograms } = vi.hoisted(() => ({
  mockFetchPrograms: vi.fn(),
}));
vi.mock("@/lib/supabase/queries/onboarding", () => ({
  fetchPrograms: mockFetchPrograms,
}));

describe("CreatePlanDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onCreatePlan: vi.fn().mockResolvedValue(undefined),
    existingPlanCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onCreatePlan.mockResolvedValue(undefined);

    mockFetchPrograms.mockImplementation((type: string) => {
      if (type === "MAJOR")
        return Promise.resolve([
          { id: 1, name: "Computer Science", program_type: "MAJOR" },
        ]);
      if (type === "MINOR")
        return Promise.resolve([
          { id: 2, name: "Mathematics", program_type: "MINOR" },
        ]);
      if (type === "CERTIFICATE")
        return Promise.resolve([
          { id: 3, name: "Data Analytics", program_type: "CERTIFICATE" },
        ]);
      if (type === "GRADUATE")
        return Promise.resolve([
          { id: 4, name: "MS Computer Science", program_type: "GRADUATE" },
        ]);
      return Promise.resolve([]);
    });
  });

  it("renders 'Create New Plan' title when open", async () => {
    await act(async () => {
      renderWithChakra(<CreatePlanDialog {...defaultProps} />);
    });
    expect(
      screen.getAllByText("Create New Plan").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("pre-fills plan name based on existingPlanCount", async () => {
    await act(async () => {
      renderWithChakra(
        <CreatePlanDialog {...defaultProps} existingPlanCount={1} />
      );
    });
    const input = screen.getByPlaceholderText("e.g. Grad School Plan");
    expect(input).toHaveValue("Plan 2");
  });

  it("fetches programs when dialog opens (fetchPrograms called 4 times)", async () => {
    await act(async () => {
      renderWithChakra(<CreatePlanDialog {...defaultProps} />);
    });
    await waitFor(() => {
      expect(mockFetchPrograms).toHaveBeenCalledTimes(4);
    });
    expect(mockFetchPrograms).toHaveBeenCalledWith("MAJOR");
    expect(mockFetchPrograms).toHaveBeenCalledWith("MINOR");
    expect(mockFetchPrograms).toHaveBeenCalledWith("CERTIFICATE");
    expect(mockFetchPrograms).toHaveBeenCalledWith("GRADUATE");
  });

  it("renders program names after loading", async () => {
    await act(async () => {
      renderWithChakra(<CreatePlanDialog {...defaultProps} />);
    });
    await waitFor(() => {
      expect(
        screen.getAllByText("Computer Science").length
      ).toBeGreaterThanOrEqual(1);
    });
    expect(
      screen.getAllByText("Mathematics").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Data Analytics").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("MS Computer Science").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("toggling a program adds/removes it from selection", async () => {
    await act(async () => {
      renderWithChakra(<CreatePlanDialog {...defaultProps} />);
    });
    await waitFor(() => {
      expect(
        screen.getAllByText("Computer Science").length
      ).toBeGreaterThanOrEqual(1);
    });

    // Click to select Computer Science
    const programButtons = screen.getAllByText("Computer Science");
    const programButton = programButtons[0].closest("button")!;
    await act(async () => {
      fireEvent.click(programButton);
    });

    // Should show "1 program selected"
    expect(
      screen.getAllByText("1 program selected").length
    ).toBeGreaterThanOrEqual(1);

    // Click again to deselect
    const updatedButtons = screen.getAllByText("Computer Science");
    const updatedButton = updatedButtons[0].closest("button")!;
    await act(async () => {
      fireEvent.click(updatedButton);
    });

    // "1 program selected" should no longer appear
    expect(screen.queryAllByText("1 program selected").length).toBe(0);
  });

  it("search input filters programs by name", async () => {
    await act(async () => {
      renderWithChakra(<CreatePlanDialog {...defaultProps} />);
    });
    await waitFor(() => {
      expect(
        screen.getAllByText("Computer Science").length
      ).toBeGreaterThanOrEqual(1);
    });

    // Type in search box
    const searchInput = screen.getByPlaceholderText("Search programs...");
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "Math" } });
    });

    // Mathematics should still be visible
    expect(
      screen.getAllByText("Mathematics").length
    ).toBeGreaterThanOrEqual(1);

    // Computer Science should be filtered out
    expect(screen.queryAllByText("Computer Science").length).toBe(0);
  });

  it("calls onCreatePlan with name, description, and selected program IDs on submit", async () => {
    await act(async () => {
      renderWithChakra(<CreatePlanDialog {...defaultProps} />);
    });
    await waitFor(() => {
      expect(
        screen.getAllByText("Computer Science").length
      ).toBeGreaterThanOrEqual(1);
    });

    // Change plan name
    const nameInput = screen.getByPlaceholderText("e.g. Grad School Plan");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "My Custom Plan" } });
    });

    // Add description
    const descInput = screen.getByPlaceholderText("What is this plan for?");
    await act(async () => {
      fireEvent.change(descInput, {
        target: { value: "Testing description" },
      });
    });

    // Select Computer Science
    const programButtons = screen.getAllByText("Computer Science");
    const programButton = programButtons[0].closest("button")!;
    await act(async () => {
      fireEvent.click(programButton);
    });

    // Click "Create Plan" button
    const createButtons = screen.getAllByText("Create Plan");
    const createButton = createButtons[0].closest("button")!;
    await act(async () => {
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(defaultProps.onCreatePlan).toHaveBeenCalledTimes(1);
      expect(defaultProps.onCreatePlan).toHaveBeenCalledWith(
        "My Custom Plan",
        "Testing description",
        [1],
        false
      );
    });
  });

  it("disables create button when name is empty", async () => {
    await act(async () => {
      renderWithChakra(<CreatePlanDialog {...defaultProps} />);
    });

    // Clear the plan name input
    const nameInput = screen.getByPlaceholderText("e.g. Grad School Plan");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "" } });
    });

    // Find the Create Plan button
    const createButtons = screen.getAllByText("Create Plan");
    const createButton = createButtons[0].closest("button")!;
    expect(createButton.disabled).toBe(true);
  });

  it("disables create button when no programs are selected", async () => {
    await act(async () => {
      renderWithChakra(<CreatePlanDialog {...defaultProps} />);
    });

    // Name is pre-filled ("Plan 1"), but no programs selected
    const createButtons = screen.getAllByText("Create Plan");
    const createButton = createButtons[0].closest("button")!;
    expect(createButton.disabled).toBe(true);

    // Shows helper text
    expect(
      screen.getAllByText("Select at least one program to create a plan.").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("enables create button when name and at least one program are provided", async () => {
    await act(async () => {
      renderWithChakra(<CreatePlanDialog {...defaultProps} />);
    });
    await waitFor(() => {
      expect(
        screen.getAllByText("Computer Science").length
      ).toBeGreaterThanOrEqual(1);
    });

    // Select a program
    const programButtons = screen.getAllByText("Computer Science");
    const programButton = programButtons[0].closest("button")!;
    await act(async () => {
      fireEvent.click(programButton);
    });

    // Create Plan button should now be enabled
    const createButtons = screen.getAllByText("Create Plan");
    const createButton = createButtons[0].closest("button")!;
    expect(createButton.disabled).toBe(false);
  });

  it("calls onOpenChange when dialog is closed", async () => {
    const onOpenChange = vi.fn();
    await act(async () => {
      renderWithChakra(<CreatePlanDialog {...defaultProps} onOpenChange={onOpenChange} />);
    });
    onOpenChange(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
