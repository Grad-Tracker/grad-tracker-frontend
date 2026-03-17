import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const {
  mockFrom,
  mockToaster,
  mockProgramsUpdateEq,
  mockBlocksInsert,
  mockBlocksUpdateEq,
  mockBlocksDeleteEq,
  mockMappingsDeleteFirstEq,
  mockMappingsDeleteSecondEq,
  mockMappingsInsert,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
  mockProgramsUpdateEq: vi.fn(),
  mockBlocksInsert: vi.fn(),
  mockBlocksUpdateEq: vi.fn(),
  mockBlocksDeleteEq: vi.fn(),
  mockMappingsDeleteFirstEq: vi.fn(),
  mockMappingsDeleteSecondEq: vi.fn(),
  mockMappingsInsert: vi.fn(),
}));

vi.mock("@chakra-ui/react", async () => {
  const actual = await vi.importActual<typeof import("@chakra-ui/react")>("@chakra-ui/react");
  return {
    ...actual,
    Dialog: {
      ...actual.Dialog,
      Root: ({
        open,
        children,
      }: {
        open?: boolean;
        children: React.ReactNode;
      }) => (open ? <>{children}</> : null),
      Backdrop: ({ children }: any) => <div>{children}</div>,
      Positioner: ({ children }: any) => <div>{children}</div>,
      Content: ({ children }: any) => <div>{children}</div>,
      Header: ({ children }: any) => <div>{children}</div>,
      Title: ({ children }: any) => <div>{children}</div>,
      Body: ({ children }: any) => <div>{children}</div>,
      Footer: ({ children }: any) => <div>{children}</div>,
    },
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("next/link", () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));
vi.mock("@/components/ui/color-mode", () => ({ ColorModeButton: () => null }));
vi.mock("@/components/ui/native-select", () => ({
  NativeSelectRoot: ({ children }: any) => <div>{children}</div>,
  NativeSelectField: ({ children, ...props }: any) => <select {...props}>{children}</select>,
}));

import ProgramAdminDetailClient from "@/app/admin/programs/[programId]/ProgramAdminDetailClient";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

const program = {
  id: 1,
  name: "Computer Science",
  catalog_year: 2024,
  program_type: "MAJOR",
};

const course = {
  id: 101,
  subject: "CS",
  number: "101",
  title: "Intro to CS",
  credits: 3,
};

const block = {
  id: 10,
  program_id: 1,
  name: "Core",
  rule: "ALL_OF",
  n_required: null,
  credits_required: null,
  display_order: 1,
  courses: [course],
};

function makeAwaitable(result: any) {
  return {
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  };
}

function createBlockSelectChain(data: any[] = [block]) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(),
  };
  let orderCount = 0;
  chain.order.mockImplementation(() => {
    orderCount += 1;
    return orderCount >= 2
      ? makeAwaitable({
          data: data.map((item) => ({
            ...item,
            program_requirement_courses: (item.courses ?? []).map((row: any) => ({
              course_id: row.id,
              courses: row,
            })),
          })),
          error: null,
        })
      : chain;
  });
  return chain;
}

function createCourseSearchChain(data = [course]) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error: null }),
  };
  return chain;
}

function createProgramUpdateChain() {
  return {
    update: vi.fn().mockReturnValue({
      eq: mockProgramsUpdateEq,
    }),
  };
}

function createBlockTable() {
  return {
    select: vi.fn().mockReturnValue(createBlockSelectChain()),
    insert: mockBlocksInsert,
    update: vi.fn().mockReturnValue({
      eq: mockBlocksUpdateEq,
    }),
    delete: vi.fn().mockReturnValue({
      eq: mockBlocksDeleteEq,
    }),
  };
}

function createProgramRequirementCoursesTable() {
  return {
    delete: vi.fn().mockReturnValue({
      eq: mockMappingsDeleteFirstEq,
    }),
    insert: mockMappingsInsert,
  };
}

describe("ProgramAdminDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockProgramsUpdateEq.mockResolvedValue({ error: null });
    mockBlocksInsert.mockResolvedValue({ error: null });
    mockBlocksUpdateEq.mockResolvedValue({ error: null });
    mockBlocksDeleteEq.mockResolvedValue({ error: null });
    mockMappingsDeleteSecondEq.mockResolvedValue({ error: null });
    mockMappingsDeleteFirstEq.mockImplementation((column: string, value: number) => {
      if (column === "block_id" && value === 10) {
        return { eq: mockMappingsDeleteSecondEq };
      }
      return Promise.resolve({ error: null });
    });
    mockMappingsInsert.mockResolvedValue({ error: null });
    vi.stubGlobal("confirm", vi.fn(() => true));

    mockFrom.mockImplementation((table: string) => {
      if (table === "programs") {
        return createProgramUpdateChain();
      }

      if (table === "program_requirement_blocks") {
        return createBlockTable();
      }

      if (table === "program_requirement_courses") {
        return createProgramRequirementCoursesTable();
      }

      if (table === "courses") {
        return createCourseSearchChain();
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("opens and closes the edit program dialog", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[block]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /edit program/i }));
    expect(screen.getByLabelText("Program Name")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Program Name")).not.toBeInTheDocument();
    });
  });

  it("saves program edits by calling update", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[block]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /edit program/i }));
    fireEvent.change(screen.getByDisplayValue("Computer Science"), {
      target: { value: "Software Engineering" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mockProgramsUpdateEq).toHaveBeenCalledWith("id", 1);
    });
    await waitFor(() => {
      expect(screen.queryByLabelText("Program Name")).not.toBeInTheDocument();
    });
  });

  it("opens and closes add block dialog and resets when cancelled", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /add block/i }));
    expect(screen.getByLabelText("Block Name")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Electives" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Block Name")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /add block/i }));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("switches add-block rule fields for N_OF and CREDITS_OF", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /add block/i }));
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "N_OF" } });
    expect(screen.getByText("N Required")).toBeInTheDocument();

    fireEvent.change(selects[0], { target: { value: "CREDITS_OF" } });
    expect(screen.getByText("Credits Required")).toBeInTheDocument();
  });

  it("opens the edit block dialog, switches rules, and closes it", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[block]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(screen.getByLabelText("Block Name")).toHaveValue("Core");

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "N_OF" } });
    expect(screen.getByText("N Required")).toBeInTheDocument();

    fireEvent.change(selects[0], { target: { value: "CREDITS_OF" } });
    expect(screen.getByText("Credits Required")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByLabelText("Block Name")).not.toBeInTheDocument();
    });
  });

  it("adds a block by calling insert", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /add block/i }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Electives" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save block/i }));

    await waitFor(() => {
      expect(mockBlocksInsert).toHaveBeenCalled();
    });
  });

  it("expands and collapses a block to show the course list", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[block]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand/i }));
    expect(screen.getByText("Intro to CS")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /collapse/i }));
    await waitFor(() => {
      expect(screen.queryByText("Intro to CS")).not.toBeInTheDocument();
    });
  });

  it("cancels block deletion when confirm returns false", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));

    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[block]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /delete block/i }));

    await waitFor(() => {
      expect(mockBlocksDeleteEq).not.toHaveBeenCalled();
      expect(mockMappingsDeleteFirstEq).not.toHaveBeenCalled();
    });
  });

  it("deletes a block by calling delete on mappings and blocks", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[block]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /delete block/i }));

    await waitFor(() => {
      expect(mockMappingsDeleteFirstEq).toHaveBeenCalledWith("block_id", 10);
      expect(mockBlocksDeleteEq).toHaveBeenCalledWith("id", 10);
    });
  });

  it("removes a course from an expanded block", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[block]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /expand/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));

    await waitFor(() => {
      expect(mockMappingsDeleteFirstEq).toHaveBeenCalledWith("block_id", 10);
      expect(mockMappingsDeleteSecondEq).toHaveBeenCalledWith("course_id", 101);
    });
  });

  it("opens add courses dialog, selects a course, and inserts mappings", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[{ ...block, courses: [] }]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /add courses/i }));
    expect(screen.getByPlaceholderText("Search by subject, number, or title")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("courses");
    });
    await screen.findByText("CS 101 - Intro to CS");
    fireEvent.click(screen.getByRole("button", { name: /cs 101 - intro to cs/i }));
    fireEvent.click(screen.getByRole("button", { name: /add selected/i }));

    await waitFor(() => {
      expect(mockMappingsInsert).toHaveBeenCalledWith([{ block_id: 10, course_id: 101 }]);
    });
  });

  it("shows an error when add courses is submitted without a selection", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[{ ...block, courses: [] }]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /add courses/i }));
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("courses");
    });

    fireEvent.click(screen.getByRole("button", { name: /add selected/i }));

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "No courses selected", type: "error" })
      );
    });
    expect(mockMappingsInsert).not.toHaveBeenCalled();
  });

  it("skips insert when every selected course is already on the block", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[block]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /add courses/i }));
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("courses");
    });

    await screen.findByText("CS 101 - Intro to CS");
    fireEvent.click(screen.getByRole("button", { name: /cs 101 - intro to cs/i }));
    fireEvent.click(screen.getByRole("button", { name: /add selected/i }));

    await waitFor(() => {
      expect(mockMappingsInsert).not.toHaveBeenCalled();
      expect(screen.queryByPlaceholderText("Search by subject, number, or title")).not.toBeInTheDocument();
    });
  });
});
