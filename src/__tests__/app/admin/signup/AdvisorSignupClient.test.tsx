import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

import { DB_TABLES } from "@/lib/supabase/queries/schema";

const {
  mockPush,
  mockSignUp,
  mockSignOut,
  mockFrom,
  mockInsert,
  mockToaster,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSignUp: vi.fn(),
  mockSignOut: vi.fn(),
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();

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
    auth: { signUp: mockSignUp, signOut: mockSignOut },
    from: mockFrom,
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
      data-testid={`pw-${(p.placeholder || "").replace(/\s+/g, "-").toLowerCase()}`}
    />
  ),
}));

import AdvisorSignupClient from "@/app/admin/(public)/signup/AdvisorSignupClient";

function fillForm(
  opts: {
    first?: string;
    last?: string;
    email?: string;
    pw?: string;
    confirm?: string;
  } = {}
) {
  if (opts.first) {
    fireEvent.change(screen.getByPlaceholderText("First name"), {
      target: { value: opts.first },
    });
  }
  if (opts.last) {
    fireEvent.change(screen.getByPlaceholderText("Last name"), {
      target: { value: opts.last },
    });
  }
  if (opts.email) {
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: opts.email },
    });
  }
  if (opts.pw) {
    fireEvent.change(screen.getByTestId("pw-create-a-password"), {
      target: { value: opts.pw },
    });
  }
  if (opts.confirm) {
    fireEvent.change(screen.getByTestId("pw-confirm-your-password"), {
      target: { value: opts.confirm },
    });
  }
}

function clickCreateAccount() {
  const buttons = screen.getAllByText("Create Advisor Account");
  const btn = buttons.find((el) => el.closest("button") !== null);
  return fireEvent.click(btn!);
}

describe("AdvisorSignupClient", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  /* ===== Rendering ===== */

  it("renders the advisor signup heading", () => {
    renderWithChakra(<AdvisorSignupClient />);
    expect(
      screen.getAllByText("Create Advisor Account").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders the helper description", () => {
    renderWithChakra(<AdvisorSignupClient />);
    expect(
      screen.getAllByText(
        "Set up your advisor account for program management tools."
      ).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders the verified badge", () => {
    renderWithChakra(<AdvisorSignupClient />);
    expect(
      screen.getAllByText("Access code verified").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders all form fields", () => {
    renderWithChakra(<AdvisorSignupClient />);
    expect(screen.getAllByText("First Name").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Last Name").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Email").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Password").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Confirm Password").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders the email placeholder", () => {
    renderWithChakra(<AdvisorSignupClient />);
    expect(
      screen.getByPlaceholderText("you@example.com")
    ).toBeInTheDocument();
  });

  it("renders the campus image", () => {
    renderWithChakra(<AdvisorSignupClient />);
    expect(screen.getByAltText("UW-Parkside Campus")).toBeInTheDocument();
  });

  it("renders sign in link", () => {
    renderWithChakra(<AdvisorSignupClient />);
    expect(screen.getAllByText("Sign in").length).toBeGreaterThanOrEqual(1);
  });

  /* ===== Password strength indicator ===== */

  it("does not show strength indicator when password is empty", () => {
    renderWithChakra(<AdvisorSignupClient />);
    expect(screen.queryByText("Weak")).not.toBeInTheDocument();
    expect(screen.queryByText("Strong")).not.toBeInTheDocument();
  });

  it("shows Weak for a simple lowercase password", async () => {
    renderWithChakra(<AdvisorSignupClient />);
    await act(async () => {
      fireEvent.change(screen.getByTestId("pw-create-a-password"), {
        target: { value: "abc" },
      });
    });
    expect(screen.getAllByText("Weak").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Strong for a fully complex password", async () => {
    renderWithChakra(<AdvisorSignupClient />);
    await act(async () => {
      fireEvent.change(screen.getByTestId("pw-create-a-password"), {
        target: { value: "Abcdef1!" },
      });
    });
    expect(screen.getAllByText("Strong").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("5/5").length).toBeGreaterThanOrEqual(1);
  });

  /* ===== Confirm password match/mismatch ===== */

  it("shows mismatch feedback when passwords differ", async () => {
    renderWithChakra(<AdvisorSignupClient />);
    await act(async () => {
      fireEvent.change(screen.getByTestId("pw-create-a-password"), {
        target: { value: "password1" },
      });
      fireEvent.change(screen.getByTestId("pw-confirm-your-password"), {
        target: { value: "password2" },
      });
    });
    expect(
      screen.getAllByText("Passwords don\u2019t match").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows match feedback when passwords are identical", async () => {
    renderWithChakra(<AdvisorSignupClient />);
    await act(async () => {
      fireEvent.change(screen.getByTestId("pw-create-a-password"), {
        target: { value: "password1" },
      });
      fireEvent.change(screen.getByTestId("pw-confirm-your-password"), {
        target: { value: "password1" },
      });
    });
    expect(
      screen.getAllByText("Passwords match").length
    ).toBeGreaterThanOrEqual(1);
  });

  /* ===== Form validation ===== */

  it("shows error for empty fields", async () => {
    renderWithChakra(<AdvisorSignupClient />);
    await act(async () => {
      clickCreateAccount();
    });
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Missing fields" })
    );
  });

  it("shows error when passwords do not match", async () => {
    renderWithChakra(<AdvisorSignupClient />);
    fillForm({
      first: "Ada",
      last: "Lovelace",
      email: "ada@uwp.edu",
      pw: "password1",
      confirm: "password2",
    });

    await act(async () => {
      clickCreateAccount();
    });

    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Passwords don't match" })
    );
  });

  it("shows error for short password", async () => {
    renderWithChakra(<AdvisorSignupClient />);
    fillForm({
      first: "Ada",
      last: "Lovelace",
      email: "ada@uwp.edu",
      pw: "abc",
      confirm: "abc",
    });

    await act(async () => {
      clickCreateAccount();
    });

    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Password too short" })
    );
  });

  /* ===== Successful signup ===== */

  it("inserts a staff row and redirects to /admin on success", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "advisor-1", identities: [{ id: "identity-1" }] },
      },
      error: null,
    });

    renderWithChakra(<AdvisorSignupClient />);
    fillForm({
      first: "Ada",
      last: "Lovelace",
      email: "ada@uwp.edu",
      pw: "password123",
      confirm: "password123",
    });

    await act(async () => {
      clickCreateAccount();
    });

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "ada@uwp.edu",
        password: "password123",
        options: {
          data: {
            role: "advisor",
            first_name: "Ada",
            last_name: "Lovelace",
          },
          emailRedirectTo: "http://localhost:3000/auth/callback",
        },
      });
      expect(mockFrom).toHaveBeenCalledWith(DB_TABLES.staff);
      expect(mockInsert).toHaveBeenCalledWith({
        auth_user_id: "advisor-1",
        email: "ada@uwp.edu",
        first_name: "Ada",
        last_name: "Lovelace",
        role: "advisor",
        is_admin: false,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/advisor/consume-signup-gate",
        { method: "POST" }
      );
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });
  });

  it("shows success toast on account creation", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "advisor-1", identities: [{ id: "identity-1" }] },
      },
      error: null,
    });

    renderWithChakra(<AdvisorSignupClient />);
    fillForm({
      first: "Ada",
      last: "Lovelace",
      email: "ada@uwp.edu",
      pw: "password123",
      confirm: "password123",
    });

    await act(async () => {
      clickCreateAccount();
    });

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Account created!",
          description: "Welcome to GradTracker, Advisor.",
          type: "success",
        })
      );
    });
  });

  /* ===== Signup failures ===== */

  it("shows error on signUp failure", async () => {
    mockSignUp.mockResolvedValue({
      data: {},
      error: { message: "Email taken" },
    });

    renderWithChakra(<AdvisorSignupClient />);
    fillForm({
      first: "Ada",
      last: "Lovelace",
      email: "ada@uwp.edu",
      pw: "password123",
      confirm: "password123",
    });

    await act(async () => {
      clickCreateAccount();
    });

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Sign up failed" })
      );
    });
  });

  it("shows error when user is null after signup", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    renderWithChakra(<AdvisorSignupClient />);
    fillForm({
      first: "Ada",
      last: "Lovelace",
      email: "ada@uwp.edu",
      pw: "password123",
      confirm: "password123",
    });

    await act(async () => {
      clickCreateAccount();
    });

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Sign up failed",
          description: "Unable to create account. Please try again.",
        })
      );
    });
  });

  it("signs out and shows account exists toast for duplicate emails", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "advisor-1", identities: [] } },
      error: null,
    });

    renderWithChakra(<AdvisorSignupClient />);
    fillForm({
      first: "Ada",
      last: "Lovelace",
      email: "ada@uwp.edu",
      pw: "password123",
      confirm: "password123",
    });

    await act(async () => {
      clickCreateAccount();
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Account already exists" })
      );
    });
  });

  it("signs out and shows error when staff insert fails", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "advisor-1", identities: [{ id: "identity-1" }] },
      },
      error: null,
    });
    mockInsert.mockResolvedValue({
      error: { message: "Insert failed" },
    });

    renderWithChakra(<AdvisorSignupClient />);
    fillForm({
      first: "Ada",
      last: "Lovelace",
      email: "ada@uwp.edu",
      pw: "password123",
      confirm: "password123",
    });

    await act(async () => {
      clickCreateAccount();
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Advisor record failed",
          description: "Insert failed",
        })
      );
      expect(mockPush).not.toHaveBeenCalledWith("/admin");
    });
  });
});
