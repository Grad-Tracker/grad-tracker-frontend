import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

const {
  mockCreateClient,
  mockFrom,
  mockInsert,
  mockDelete,
  mockEqFirst,
  mockEqSecond,
  mockToaster,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
  mockDelete: vi.fn(),
  mockEqFirst: vi.fn(),
  mockEqSecond: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/components/ui/toaster", () => ({
  toaster: mockToaster,
}));

import AssignmentsClient from "@/app/admin/(protected)/assignments/AssignmentsClient";

const programs = [
  { id: 1, name: "Computer Science", program_type: "MAJOR", catalog_year: 2024 },
  { id: 2, name: "Mathematics", program_type: "MAJOR", catalog_year: 2024 },
];

describe("AssignmentsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockInsert.mockResolvedValue({ error: null });
    mockEqSecond.mockResolvedValue({ error: null });
    mockEqFirst.mockReturnValue({ eq: mockEqSecond });
    mockDelete.mockReturnValue({ eq: mockEqFirst });

    mockFrom.mockReturnValue({
      insert: mockInsert,
      delete: mockDelete,
    });
    mockCreateClient.mockReturnValue({
      from: mockFrom,
    });
  });

  it("renders assigned program chips and available list", () => {
    renderWithChakra(
      <AssignmentsClient programs={programs} initialAssignedIds={[1]} advisorId={10} />
    );

    expect(screen.getByText("Computer Science")).toBeInTheDocument();
    expect(screen.getByText("Mathematics")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search programs...")).toBeInTheDocument();
  });

  it("filters available programs by search query", () => {
    renderWithChakra(
      <AssignmentsClient programs={programs} initialAssignedIds={[]} advisorId={10} />
    );

    fireEvent.change(screen.getByPlaceholderText("Search programs..."), {
      target: { value: "Math" },
    });

    expect(screen.getByText("Mathematics")).toBeInTheDocument();
    expect(screen.queryByText("Computer Science")).not.toBeInTheDocument();
  });

  it("adds a program and shows success toast", async () => {
    renderWithChakra(
      <AssignmentsClient programs={programs} initialAssignedIds={[]} advisorId={10} />
    );

    fireEvent.click(screen.getByLabelText("Add Computer Science"));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("program_advisors");
      expect(mockInsert).toHaveBeenCalledWith({
        staff_id: 10,
        program_id: 1,
      });
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Program added", type: "success" })
      );
    });
  });

  it("removes a program and shows info toast", async () => {
    renderWithChakra(
      <AssignmentsClient programs={programs} initialAssignedIds={[1]} advisorId={10} />
    );

    fireEvent.click(screen.getByLabelText("Remove Computer Science"));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEqFirst).toHaveBeenCalledWith("staff_id", 10);
      expect(mockEqSecond).toHaveBeenCalledWith("program_id", 1);
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Program removed", type: "info" })
      );
    });
  });

  it("shows an error toast when add fails", async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: "insert failed" } });

    renderWithChakra(
      <AssignmentsClient programs={programs} initialAssignedIds={[]} advisorId={10} />
    );

    fireEvent.click(screen.getByLabelText("Add Computer Science"));

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to add program",
          type: "error",
        })
      );
    });
  });
});

