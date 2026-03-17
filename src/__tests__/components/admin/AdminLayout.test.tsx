import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const { mockPush, mockUsePathname, mockSignOut, mockToasterCreate } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUsePathname: vi.fn(),
  mockSignOut: vi.fn(),
  mockToasterCreate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockUsePathname(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}));

vi.mock("@/components/ui/toaster", () => ({
  toaster: {
    create: mockToasterCreate,
  },
}));

import AdminHeader from "@/components/admin/AdminHeader";
import AdminShell from "@/components/admin/AdminShell";
import AdminSidebar from "@/components/admin/AdminSidebar";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("Admin layout components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/admin/programs");
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("renders sidebar navigation links", () => {
    renderWithChakra(<AdminSidebar />);

    const dashboardLink = screen.getByText("Dashboard").closest("a");
    const programsLink = screen.getByText("Programs").closest("a");
    const genEdLink = screen.getByText("Gen-Ed").closest("a");

    expect(dashboardLink).toHaveAttribute("href", "/admin");
    expect(programsLink).toHaveAttribute("href", "/admin/programs");
    expect(genEdLink).toHaveAttribute("href", "/admin/gen-ed");
  });

  it("renders the header and signs out", async () => {
    renderWithChakra(<AdminHeader />);

    expect(screen.getByText("Advisor Tools")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockToasterCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Signed out",
          type: "success",
        })
      );
      expect(mockPush).toHaveBeenCalledWith("/signin");
    });
  });

  it("renders AdminShell children", () => {
    renderWithChakra(
      <AdminShell>
        <div>Admin child content</div>
      </AdminShell>
    );

    expect(screen.getByText("Admin child content")).toBeInTheDocument();
    expect(screen.getByText("Advisor Tools")).toBeInTheDocument();
    expect(screen.getByText("Programs").closest("a")).toHaveAttribute("href", "/admin/programs");
  });
});
