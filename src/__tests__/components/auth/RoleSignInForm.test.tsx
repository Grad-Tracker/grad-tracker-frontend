import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

const {
  mockPush,
  mockSignInWithPassword,
  mockGetUser,
  mockSignOut,
  mockToaster,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockGetUser: vi.fn(),
  mockSignOut: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, priority, ...rest } = props as Record<string, unknown>;
    return React.createElement("img", rest);
  },
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href }, children),
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
  Field: (p: any) => (
    <div>
      <label>{p.label}</label>
      {p.children}
    </div>
  ),
}));

vi.mock("@/components/ui/password-input", () => ({
  PasswordInput: (p: any) => (
    <input
      type="password"
      placeholder={p.placeholder}
      value={p.value}
      onChange={p.onChange}
      data-testid="password-input"
    />
  ),
}));

import RoleSignInForm from "@/components/auth/RoleSignInForm";

describe("RoleSignInForm", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: {} } },
      error: null,
    });
  });

  it("renders the sign-in title and student helper text by default", () => {
    renderWithChakra(<RoleSignInForm defaultRole="student" />);
    expect(screen.getAllByText("Sign In").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("View your dashboard, requirements, and planner.").length).toBeGreaterThanOrEqual(1);
  });

  it("renders role selector buttons with Student active", () => {
    renderWithChakra(<RoleSignInForm defaultRole="student" />);
    expect(screen.getByRole("button", { name: "Student" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Advisor" })).toHaveAttribute("aria-pressed", "false");
  });

  it("renders student email placeholder", () => {
    renderWithChakra(<RoleSignInForm defaultRole="student" />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("renders email and password field labels", () => {
    renderWithChakra(<RoleSignInForm defaultRole="student" />);
    expect(screen.getAllByText("Email").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Password").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the campus image", () => {
    renderWithChakra(<RoleSignInForm defaultRole="student" />);
    expect(screen.getByAltText("UW-Parkside Campus")).toBeInTheDocument();
  });

  it("renders forgot password link", () => {
    renderWithChakra(<RoleSignInForm defaultRole="student" />);
    expect(screen.getAllByText("Forgot password?").length).toBeGreaterThanOrEqual(1);
  });

  it("renders student signup link", () => {
    renderWithChakra(<RoleSignInForm defaultRole="student" />);
    expect(screen.getAllByText("Create student account").length).toBeGreaterThanOrEqual(1);
  });

  it("renders post-sign-in hint for students", () => {
    renderWithChakra(<RoleSignInForm defaultRole="student" />);
    expect(screen.getAllByText("You'll be taken to your student dashboard.").length).toBeGreaterThanOrEqual(1);
  });

  it("renders advisor helper text when defaultRole is advisor", () => {
    renderWithChakra(<RoleSignInForm defaultRole="advisor" />);
    expect(screen.getAllByText("Manage programs, Gen-Ed buckets, and course catalog.").length).toBeGreaterThanOrEqual(1);
  });

  it("renders advisor email placeholder when defaultRole is advisor", () => {
    renderWithChakra(<RoleSignInForm defaultRole="advisor" />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("renders advisor signup link when defaultRole is advisor", () => {
    renderWithChakra(<RoleSignInForm defaultRole="advisor" />);
    expect(screen.getAllByText("Create advisor account").length).toBeGreaterThanOrEqual(1);
  });

  it("hides role selector when hideRoleSelector is true", () => {
    renderWithChakra(<RoleSignInForm defaultRole="advisor" hideRoleSelector />);
    expect(screen.queryByRole("button", { name: "Student" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Advisor" })).not.toBeInTheDocument();
  });

  it("switching to Advisor updates helper text and email placeholder", async () => {
    renderWithChakra(<RoleSignInForm defaultRole="student" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Advisor" }));
    });

    expect(screen.getAllByText("Manage programs, Gen-Ed buckets, and course catalog.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Advisor" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("switching back to Student restores student content", async () => {
    renderWithChakra(<RoleSignInForm defaultRole="student" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Advisor" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Student" }));
    });

    expect(screen.getAllByText("View your dashboard, requirements, and planner.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("shows error toast for empty fields", async () => {
    renderWithChakra(<RoleSignInForm defaultRole="student" />);

    const buttons = screen.getAllByText("Sign In");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(btn!);
    });

    expect(mockToaster.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Missing fields" }));
  });

  it("student sign-in blocks advisor-domain emails", async () => {
    renderWithChakra(<RoleSignInForm defaultRole="student" />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "advisor@uwp.edu" } });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "password123" } });

    const buttons = screen.getAllByText("Sign In");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(btn!);
    });

    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockToaster.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid email domain" }));
  });

  it("advisor sign-in blocks student-domain emails", async () => {
    renderWithChakra(<RoleSignInForm defaultRole="advisor" />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "student@rangers.uwp.edu" },
    });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "password123" } });

    const buttons = screen.getAllByText("Sign In");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(btn!);
    });

    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockToaster.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid email domain" }));
  });

  it("calls signInWithPassword with correct credentials", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    renderWithChakra(<RoleSignInForm defaultRole="student" />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "test@rangers.uwp.edu" } });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "password123" } });

    const buttons = screen.getAllByText("Sign In");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(btn!);
    });

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@rangers.uwp.edu",
        password: "password123",
      });
    });
  });

  it("redirects to /dashboard on student sign-in success", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    renderWithChakra(<RoleSignInForm defaultRole="student" />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "test@rangers.uwp.edu" } });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "password123" } });

    const buttons = screen.getAllByText("Sign In");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(btn!);
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("redirects to /admin on advisor sign-in success", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: { role: "advisor" } } },
      error: null,
    });

    renderWithChakra(<RoleSignInForm defaultRole="advisor" />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "advisor@uwp.edu" } });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "password123" } });

    const buttons = screen.getAllByText("Sign In");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(btn!);
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });
  });

  it("shows error toast on sign-in failure", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login" } });
    renderWithChakra(<RoleSignInForm defaultRole="student" />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "test@rangers.uwp.edu" } });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "wrong" } });

    const buttons = screen.getAllByText("Sign In");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(btn!);
    });

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Sign in failed" }));
    });
  });

  it("shows error and signs out when getUser fails", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "fail" } });

    renderWithChakra(<RoleSignInForm defaultRole="student" />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "test@rangers.uwp.edu" } });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "password123" } });

    const buttons = screen.getAllByText("Sign In");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(btn!);
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Sign in failed",
          description: "Unable to retrieve user session. Please try again.",
        })
      );
    });
  });

  it("signs out and blocks student selection for advisor accounts", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { role: "advisor" } } }, error: null });

    renderWithChakra(<RoleSignInForm defaultRole="student" />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "advisor@rangers.uwp.edu" } });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "password123" } });

    const buttons = screen.getAllByText("Sign In");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(btn!);
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalledWith("/admin");
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "This is an advisor account. Use Advisor sign in.",
        })
      );
    });
  });

  it("signs out and blocks advisor selection for student accounts", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: {} } }, error: null });

    renderWithChakra(<RoleSignInForm defaultRole="student" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Advisor" }));
    });

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "student@uwp.edu" } });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "password123" } });

    const buttons = screen.getAllByText("Sign In");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(btn!);
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalledWith("/dashboard");
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "This is a student account. Use Student sign in.",
        })
      );
    });
  });
});