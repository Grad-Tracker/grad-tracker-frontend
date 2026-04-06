import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// ── hoisted mocks ─────────────────────────────────────────────────────────────

const { mockGetUser, mockRedirect } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
  }),
}));

// Stub out AdminShell so we don't need full Supabase client mocks inside it
vi.mock("@/components/admin/AdminShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-shell">{children}</div>
  ),
}));

import AdminLayout from "@/app/admin/(protected)/layout";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /signin when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(
      AdminLayout({ children: <div>child</div> })
    ).rejects.toThrow("NEXT_REDIRECT:/signin");

    expect(mockRedirect).toHaveBeenCalledWith("/signin");
  });

  it("redirects to /dashboard when user role is not advisor", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: { role: "student" } } },
    });

    await expect(
      AdminLayout({ children: <div>child</div> })
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to /dashboard when user has no role metadata", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: {} } },
    });

    await expect(
      AdminLayout({ children: <div>child</div> })
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("renders children inside AdminShell for an advisor", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: { role: "advisor" } } },
    });

    const layout = await AdminLayout({ children: <div>protected content</div> });
    renderWithChakra(layout as React.ReactElement);

    expect(screen.getByTestId("admin-shell")).toBeInTheDocument();
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("does not call redirect for a valid advisor", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: { role: "advisor" } } },
    });

    await AdminLayout({ children: <div>ok</div> });

    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
