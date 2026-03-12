import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const {
  mockFrom,
  mockInsertBlock,
  mockDeleteMappings,
  mockDeleteBlock,
  mockToaster,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInsertBlock: vi.fn(),
  mockDeleteMappings: vi.fn(),
  mockDeleteBlock: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
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

const block = {
  id: 10,
  program_id: 1,
  name: "Core",
  rule: "ALL_OF",
  n_required: null,
  credits_required: null,
  display_order: 1,
  courses: [],
};

function makeAwaitable(result: any) {
  return {
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  };
}

function createSelectBlocksChain() {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(),
  };
  let orderCount = 0;
  chain.order.mockImplementation(() => {
    orderCount += 1;
    return orderCount >= 2 ? makeAwaitable({ data: [], error: null }) : chain;
  });
  return chain;
}

describe("ProgramAdminDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));

    mockInsertBlock.mockResolvedValue({ error: null });
    mockDeleteMappings.mockResolvedValue({ error: null });
    mockDeleteBlock.mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "program_requirement_blocks") {
        return {
          select: vi.fn().mockReturnValue(createSelectBlocksChain()),
          insert: mockInsertBlock,
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      if (table === "program_requirement_courses") {
        return {
          delete: vi.fn().mockReturnValue({
            eq: mockDeleteMappings,
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === "courses") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("adds a block by calling insert", async () => {
    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /add block/i }));
    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "Electives" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save block/i }));

    await waitFor(() => {
      expect(mockInsertBlock).toHaveBeenCalled();
    });
  });

  it("deletes a block by calling delete on mappings and blocks", async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "program_requirement_blocks") {
        return {
          select: vi.fn().mockReturnValue(createSelectBlocksChain()),
          insert: mockInsertBlock,
          delete: vi.fn().mockReturnValue({
            eq: deleteEq,
          }),
        };
      }

      if (table === "program_requirement_courses") {
        return {
          delete: vi.fn().mockReturnValue({
            eq: mockDeleteMappings,
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === "courses") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    renderWithChakra(
      <ProgramAdminDetailClient initialProgram={program} initialBlocks={[block]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /delete block/i }));

    await waitFor(() => {
      expect(mockDeleteMappings).toHaveBeenCalled();
      expect(deleteEq).toHaveBeenCalledWith("id", 10);
    });
  });
});
