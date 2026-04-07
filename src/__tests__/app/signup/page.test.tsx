import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

const { mockPush, mockReplace, mockSignUp, mockSignOut, mockToaster } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockReplace: vi.fn(),
    mockSignUp: vi.fn(),
    mockSignOut: vi.fn(),
    mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
  }));

const mockFetch = vi.fn();
const mockSearchParamsGet = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: mockSearchParamsGet }),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: vi.fn(),
  }),
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

import SignupPage from "@/app/signup/page";

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
    fireEvent.change(
      screen.getByPlaceholderText("your.name@rangers.uwp.edu"),
      { target: { value: opts.email } }
    );
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
  const buttons = screen.getAllByText("Create Account");
  const btn = buttons.find((el) => el.closest("button") !== null);
  return fireEvent.click(btn!);
}

describe("SignupPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
    vi.stubGlobal("fetch", mockFetch);
    mockSearchParamsGet.mockReturnValue(null);
  });

  /* ===== Rendering ===== */

  it("renders create account heading", () => {
    renderWithChakra(<SignupPage />);
    expect(
      screen.getAllByText("Create Account").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders all form fields", () => {
    renderWithChakra(<SignupPage />);
    expect(screen.getAllByText("First Name").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Last Name").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Email").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Password").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Confirm Password").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders the campus image", () => {
    renderWithChakra(<SignupPage />);
    expect(screen.getByAltText("UW-Parkside Campus")).toBeInTheDocument();
  });

  it("uses the student email placeholder", () => {
    renderWithChakra(<SignupPage />);
    expect(
      screen.getByPlaceholderText("your.name@rangers.uwp.edu")
    ).toBeInTheDocument();
  });

  it("renders sign in link", () => {
    renderWithChakra(<SignupPage />);
    expect(screen.getAllByText("Sign in").length).toBeGreaterThanOrEqual(1);
  });

  /* ===== Password strength indicator ===== */

  it("does not show password strength when password field is empty", () => {
    renderWithChakra(<SignupPage />);
    expect(screen.queryByText("Weak")).not.toBeInTheDocument();
    expect(screen.queryByText("Strong")).not.toBeInTheDocument();
  });

  it("shows password strength indicator when password is typed", async () => {
    renderWithChakra(<SignupPage />);
    await act(async () => {
      fireEvent.change(screen.getByTestId("pw-create-a-password"), {
        target: { value: "abc" },
      });
    });
    expect(screen.getAllByText("Weak").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("6+ characters").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Lowercase letter").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows Strong for a fully complex password", async () => {
    renderWithChakra(<SignupPage />);
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
    renderWithChakra(<SignupPage />);
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
    renderWithChakra(<SignupPage />);
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

  it("does not show match feedback when confirm password is empty", () => {
    renderWithChakra(<SignupPage />);
    expect(screen.queryByText("Passwords match")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Passwords don\u2019t match")
    ).not.toBeInTheDocument();
  });

  /* ===== Advisor access panel expand/collapse ===== */

  it("renders the advisor access link", () => {
    renderWithChakra(<SignupPage />);
    expect(
      screen.getAllByText("Are you an advisor?").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("expands advisor access panel on button click", async () => {
    renderWithChakra(<SignupPage />);

    await act(async () => {
      const btn = screen.getAllByText(/Enter access code/).find(
        (el) => el.closest("button") !== null
      );
      fireEvent.click(btn!);
    });

    expect(
      screen.getAllByText("Advisor Access").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("Enter the access code provided by the department.")
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Access code")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel" })
    ).toBeInTheDocument();
  });

  it("collapses advisor access panel when Cancel is clicked", async () => {
    renderWithChakra(<SignupPage />);

    await act(async () => {
      const btn = screen.getAllByText(/Enter access code/).find(
        (el) => el.closest("button") !== null
      );
      fireEvent.click(btn!);
    });

    expect(
      screen.getByPlaceholderText("Access code")
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });

    expect(
      screen.queryByPlaceholderText("Access code")
    ).not.toBeInTheDocument();
  });

  /* ===== Advisor access code verification ===== */

  it("wrong code shows an error toast and does not navigate", async () => {
    mockFetch.mockResolvedValue({
      status: 401,
      json: vi
        .fn()
        .mockResolvedValue({ ok: false, message: "Invalid access code" }),
    });

    renderWithChakra(<SignupPage />);

    await act(async () => {
      const btn = screen.getAllByText(/Enter access code/).find(
        (el) => el.closest("button") !== null
      );
      fireEvent.click(btn!);
    });

    fireEvent.change(screen.getByPlaceholderText("Access code"), {
      target: { value: "wrong-code" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/advisor/verify-signup-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "wrong-code" }),
    });
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Invalid access code" })
    );
    expect(mockPush).not.toHaveBeenCalledWith("/admin/signup");
  });

  it("correct code navigates to advisor signup", async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });

    renderWithChakra(<SignupPage />);

    await act(async () => {
      const btn = screen.getAllByText(/Enter access code/).find(
        (el) => el.closest("button") !== null
      );
      fireEvent.click(btn!);
    });

    fireEvent.change(screen.getByPlaceholderText("Access code"), {
      target: { value: "advisor-secret" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    });

    expect(mockPush).toHaveBeenCalledWith("/admin/signup");
  });

  it("server 500 shows generic verification failure", async () => {
    mockFetch.mockResolvedValue({
      status: 500,
      json: vi
        .fn()
        .mockResolvedValue({
          ok: false,
          message: "Server misconfigured",
        }),
    });

    renderWithChakra(<SignupPage />);

    await act(async () => {
      const btn = screen.getAllByText(/Enter access code/).find(
        (el) => el.closest("button") !== null
      );
      fireEvent.click(btn!);
    });

    fireEvent.change(screen.getByPlaceholderText("Access code"), {
      target: { value: "some-code" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    });

    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Verification failed" })
    );
    expect(mockPush).not.toHaveBeenCalledWith("/admin/signup");
  });

  it("network failure shows generic verification failure", async () => {
    mockFetch.mockRejectedValue(new Error("network failed"));
    renderWithChakra(<SignupPage />);

    await act(async () => {
      const btn = screen.getAllByText(/Enter access code/).find(
        (el) => el.closest("button") !== null
      );
      fireEvent.click(btn!);
    });

    fireEvent.change(screen.getByPlaceholderText("Access code"), {
      target: { value: "code" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    });

    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Verification failed" })
    );
    expect(mockPush).not.toHaveBeenCalledWith("/admin/signup");
  });

  /* ===== Form validation ===== */

  it("shows error for empty fields", async () => {
    renderWithChakra(<SignupPage />);
    await act(async () => {
      clickCreateAccount();
    });
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Missing fields" })
    );
  });

  it("shows error when passwords do not match", async () => {
    renderWithChakra(<SignupPage />);
    fillForm({
      first: "John",
      last: "Doe",
      email: "j@rangers.uwp.edu",
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
    renderWithChakra(<SignupPage />);
    fillForm({
      first: "John",
      last: "Doe",
      email: "j@rangers.uwp.edu",
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

  it("blocks non-rangers emails before student signup", async () => {
    renderWithChakra(<SignupPage />);
    fillForm({
      first: "John",
      last: "Doe",
      email: "j@gmail.com",
      pw: "password123",
      confirm: "password123",
    });

    await act(async () => {
      clickCreateAccount();
    });

    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Invalid email domain",
        description:
          "Student sign up requires a @rangers.uwp.edu email address.",
      })
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  /* ===== Successful signup ===== */

  it("calls signUp with correct data and redirects to dashboard", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "1", identities: [{ id: "1" }] } },
      error: null,
    });
    renderWithChakra(<SignupPage />);
    fillForm({
      first: "John",
      last: "Doe",
      email: "j@rangers.uwp.edu",
      pw: "password123",
      confirm: "password123",
    });

    await act(async () => {
      clickCreateAccount();
    });

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "j@rangers.uwp.edu",
        password: "password123",
        options: { data: { first_name: "John", last_name: "Doe" } },
      });
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error for existing account (empty identities)", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "1", identities: [] } },
      error: null,
    });
    renderWithChakra(<SignupPage />);
    fillForm({
      first: "John",
      last: "Doe",
      email: "j@rangers.uwp.edu",
      pw: "password123",
      confirm: "password123",
    });
    await act(async () => {
      clickCreateAccount();
    });
    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Account already exists" })
      );
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it("shows error on signUp failure", async () => {
    mockSignUp.mockResolvedValue({
      data: {},
      error: { message: "Email taken" },
    });
    renderWithChakra(<SignupPage />);
    fillForm({
      first: "John",
      last: "Doe",
      email: "j@rangers.uwp.edu",
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
});
