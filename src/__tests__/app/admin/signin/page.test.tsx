import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

const { mockPush, mockSignInWithPassword, mockGetUser, mockSignOut, mockToaster } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockGetUser: vi.fn(),
  mockSignOut: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
  }),
}));
vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));
vi.mock("@/components/ui/color-mode", () => ({ ColorModeButton: () => null }));
vi.mock("@/components/ui/field", () => ({
  Field: (p: any) => <div><label>{p.label}</label>{p.children}</div>,
}));
vi.mock("@/components/ui/password-input", () => ({
  PasswordInput: (p: any) => (
    <input type="password" placeholder={p.placeholder} value={p.value} onChange={p.onChange} data-testid="password-input" />
  ),
}));

import AdminSigninPage from "@/app/admin/signin/page";

describe("AdminSigninPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: { role: "advisor" } } },
    });
  });

  it("renders advisor copy by default", () => {
    renderWithChakra(<AdminSigninPage />);

    expect(screen.getAllByText("Sign In").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Manage programs, Gen-Ed buckets, and course catalog.").length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: "Advisor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Student" })).not.toBeInTheDocument();
  });

  it("keeps advisor redirect behavior unchanged", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    renderWithChakra(<AdminSigninPage />);

    fireEvent.change(screen.getByPlaceholderText("your.name@uwp.edu"), {
      target: { value: "advisor@uwp.edu" },
    });
    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "password123" },
    });

    const buttons = screen.getAllByText("Sign In");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(btn!);
    });

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });
  });
});
