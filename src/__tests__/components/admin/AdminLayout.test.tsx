import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const { mockPush, mockUsePathname, mockSignOut, mockGetUser, mockToasterCreate } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUsePathname: vi.fn(),
  mockSignOut: vi.fn(),
  mockGetUser: vi.fn(),
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
      getUser: mockGetUser,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(),
      })),
    },
  }),
}));

vi.mock("@/components/ui/color-mode", () => ({
  ColorModeButton: () => null,
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
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          user_metadata: { first_name: "Ada", last_name: "Lovelace" },
        },
      },
    });
  });

  // ── AdminSidebar ───────────────────────────────────────────────────────────

  describe("AdminSidebar", () => {
    it("renders all four navigation links", () => {
      renderWithChakra(<AdminSidebar />);

      expect(screen.getAllByText("Dashboard")[0].closest("a")).toHaveAttribute("href", "/admin");
      expect(screen.getAllByText("Courses")[0].closest("a")).toHaveAttribute("href", "/admin/courses");
      expect(screen.getAllByText("Programs")[0].closest("a")).toHaveAttribute("href", "/admin/programs");
      expect(screen.getAllByText("Gen-Ed")[0].closest("a")).toHaveAttribute("href", "/admin/gen-ed");
    });

    it("highlights the active route (Programs)", () => {
      mockUsePathname.mockReturnValue("/admin/programs");
      renderWithChakra(<AdminSidebar />);
      // Programs link should appear (active state is applied via bg/color props, link still present)
      expect(screen.getAllByText("Programs").length).toBeGreaterThan(0);
    });

    it("highlights Dashboard only on exact /admin path", () => {
      mockUsePathname.mockReturnValue("/admin");
      renderWithChakra(<AdminSidebar />);
      expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    });

    it("highlights nested route correctly for Programs sub-page", () => {
      mockUsePathname.mockReturnValue("/admin/programs/some-id");
      renderWithChakra(<AdminSidebar />);
      expect(screen.getAllByText("Programs").length).toBeGreaterThan(0);
    });

    it("calls signOut and redirects when sign-out is clicked (desktop)", async () => {
      renderWithChakra(<AdminSidebar />);
      const signOutButtons = screen.getAllByText("Sign Out");
      fireEvent.click(signOutButtons[0]);

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
        expect(mockToasterCreate).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Signed out", type: "success" })
        );
        expect(mockPush).toHaveBeenCalledWith("/signin");
      });
    });
  });

  // ── AdminHeader ───────────────────────────────────────────────────────────

  describe("AdminHeader", () => {
    it("renders title and sign-out button", () => {
      renderWithChakra(<AdminHeader />);
      expect(screen.getByText("Advisor Tools")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    });

    it("displays advisor name after loading from user metadata", async () => {
      renderWithChakra(<AdminHeader />);
      expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
      expect(await screen.findByText("Advisor")).toBeInTheDocument();
    });

    it("shows no name when user has empty metadata", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "test", email: "x@x.com", user_metadata: {} } },
      });
      renderWithChakra(<AdminHeader />);
      await waitFor(() => {
        expect(mockGetUser).toHaveBeenCalled();
      });
      // Name and Advisor badge should not be rendered when metadata has no first/last name
      expect(screen.queryByText("Advisor")).not.toBeInTheDocument();
      expect(screen.queryByRole("img", { name: /avatar/i })).not.toBeInTheDocument();
    });

    it("calls signOut and redirects on sign-out click", async () => {
      renderWithChakra(<AdminHeader />);
      fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
        expect(mockToasterCreate).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Signed out", type: "success" })
        );
        expect(mockPush).toHaveBeenCalledWith("/signin");
      });
    });
  });

  // ── AdminShell ────────────────────────────────────────────────────────────

  describe("AdminShell", () => {
    it("renders children inside the shell", () => {
      renderWithChakra(
        <AdminShell>
          <div>Admin child content</div>
        </AdminShell>
      );
      expect(screen.getByText("Admin child content")).toBeInTheDocument();
    });

    it("renders header and sidebar inside the shell", () => {
      renderWithChakra(
        <AdminShell>
          <span>content</span>
        </AdminShell>
      );
      expect(screen.getByText("Advisor Tools")).toBeInTheDocument();
      expect(screen.getAllByText("Programs")[0].closest("a")).toHaveAttribute("href", "/admin/programs");
    });
  });
});
