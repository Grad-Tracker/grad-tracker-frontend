import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

import ProgramAdminDetailClient from "@/app/admin/(protected)/programs/[programId]/ProgramAdminDetailClient";

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

const discreteCourse = {
  id: 102,
  subject: "CSCI",
  number: "241",
  title: "Discrete Mathematics",
  credits: 3,
};

const biologyCourse = {
  id: 103,
  subject: "BIOL",
  number: "110",
  title: "Biology",
  credits: 4,
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

const scienceBlock = {
  id: 11,
  program_id: 1,
  name: "Science Foundations",
  rule: "ANY_OF",
  n_required: null,
  credits_required: null,
  display_order: 2,
  courses: [biologyCourse],
};

const algorithmsBlock = {
  id: 12,
  program_id: 1,
  name: "Algorithms",
  rule: "ALL_OF",
  n_required: null,
  credits_required: null,
  display_order: 3,
  courses: [course, discreteCourse],
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

function getVisibleBlockCards() {
  return screen.queryAllByTestId(/requirement-block-/);
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
  }, 15000);

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
  }, 15000);

  it("opens and closes add block dialog and resets when cancelled", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /add block/i }));
    expect(screen.getByLabelText("Block Name")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Block Name"), {
      target: { value: "Electives" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Block Name")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /add block/i }));
    expect(screen.getByLabelText("Block Name")).toHaveValue("");
  }, 15000);

  it("switches add-block rule fields for N_OF and CREDITS_OF", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /add block/i }));
    const ruleSelect = screen.getAllByRole("combobox").at(-1);
    fireEvent.change(ruleSelect!, { target: { value: "N_OF" } });
    expect(screen.getByText("N Required")).toBeInTheDocument();

    fireEvent.change(ruleSelect!, { target: { value: "CREDITS_OF" } });
    expect(screen.getByText("Credits Required")).toBeInTheDocument();
  });

  it("opens the edit block dialog, switches rules, and closes it", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[block]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(screen.getByLabelText("Block Name")).toHaveValue("Core");

    const ruleSelect = screen.getAllByRole("combobox").at(-1);
    fireEvent.change(ruleSelect!, { target: { value: "N_OF" } });
    expect(screen.getByText("N Required")).toBeInTheDocument();

    fireEvent.change(ruleSelect!, { target: { value: "CREDITS_OF" } });
    expect(screen.getByText("Credits Required")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByLabelText("Block Name")).not.toBeInTheDocument();
    });
  }, 15000);

  it("adds a block by calling insert", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /add block/i }));
    fireEvent.change(screen.getByLabelText("Block Name"), {
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

  it("renders both the search input and sort select controls", () => {
    renderWithChakra(
      <ProgramAdminDetailClient
        initialProgram={program}
        initialBlocks={[scienceBlock, block, algorithmsBlock]}
      />
    );

    expect(screen.getByPlaceholderText("Search blocks or courses")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort blocks")).toHaveValue("name-asc");
  });

  it("filters blocks by block text and shows an empty state when nothing matches", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient
        initialProgram={program}
        initialBlocks={[scienceBlock, block, algorithmsBlock]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Search blocks or courses"), {
      target: { value: "science" },
    });

    expect(screen.getByText("Science Foundations")).toBeInTheDocument();
    expect(screen.queryByText("Core")).not.toBeInTheDocument();
    expect(screen.queryByText("Algorithms")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search blocks or courses"), {
      target: { value: "nope" },
    });

    expect(screen.getByText("No blocks or courses match your search.")).toBeInTheDocument();
  });

  it("sorts blocks by name and course count", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient
        initialProgram={program}
        initialBlocks={[scienceBlock, block, algorithmsBlock]}
      />
    );

    const sortSelect = screen.getByLabelText("Sort blocks");
    fireEvent.change(sortSelect, { target: { value: "name-asc" } });

    let cards = getVisibleBlockCards();
    expect(cards[0].textContent).toContain("Algorithms");
    expect(cards[1].textContent).toContain("Core");
    expect(cards[2].textContent).toContain("Science Foundations");

    fireEvent.change(sortSelect, { target: { value: "courses-desc" } });

    cards = getVisibleBlockCards();
    expect(cards[0].textContent).toContain("Algorithms");
    expect(cards[1].textContent).toContain("Core");
    expect(cards[2].textContent).toContain("Science Foundations");
  });

  it("keeps a block visible and auto-expands it when the query matches a loaded course code", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient
        initialProgram={program}
        initialBlocks={[scienceBlock, block, algorithmsBlock]}
      />
    );

    const algorithmsCard = screen.getByTestId("requirement-block-12");
    fireEvent.click(within(algorithmsCard).getByRole("button", { name: /expand/i }));
    expect(screen.getByText("Discrete Mathematics")).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("requirement-block-12")).getByRole("button", { name: /collapse/i }));
    await waitFor(() => {
      expect(screen.queryByText("Discrete Mathematics")).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Search blocks or courses"), {
      target: { value: "CSCI 241" },
    });

    expect(screen.getByText("Algorithms")).toBeInTheDocument();
    expect(screen.getByText("Discrete Mathematics")).toBeInTheDocument();
    expect(screen.queryByText("Science Foundations")).not.toBeInTheDocument();
    expect(screen.queryByText("Core")).not.toBeInTheDocument();
  });

  it("keeps expanded content visible when the query matches a loaded course title", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient
        initialProgram={program}
        initialBlocks={[scienceBlock, block, algorithmsBlock]}
      />
    );

    const algorithmsCard = screen.getByTestId("requirement-block-12");
    fireEvent.click(within(algorithmsCard).getByRole("button", { name: /expand/i }));
    expect(screen.getByText("Discrete Mathematics")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search blocks or courses"), {
      target: { value: "Discrete" },
    });

    expect(screen.getByText("Algorithms")).toBeInTheDocument();
    expect(screen.getByText("Discrete Mathematics")).toBeInTheDocument();
  });

  it("preserves expanded state while searching and after clearing the search", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient
        initialProgram={program}
        initialBlocks={[scienceBlock, block, algorithmsBlock]}
      />
    );

    const coreCard = screen.getByTestId("requirement-block-10");
    fireEvent.click(within(coreCard).getByRole("button", { name: /expand/i }));
    expect(screen.getByText("Intro to CS")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search blocks or courses"), {
      target: { value: "core" },
    });
    expect(screen.getByText("Intro to CS")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search blocks or courses"), {
      target: { value: "" },
    });
    expect(screen.getByText("Intro to CS")).toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId("requirement-block-10")).getByRole("button", { name: /collapse/i }));
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
  }, 15000);

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
  }, 15000);
});
