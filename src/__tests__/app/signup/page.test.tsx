import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

const { mockPush, mockSignUp, mockSignOut, mockToaster } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSignUp: vi.fn(),
  mockSignOut: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
const mockSearchParamsGet = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: mockSearchParamsGet }),
  useRouter: () => ({ push: mockPush, replace: mockReplace, refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signUp: mockSignUp, signOut: mockSignOut },
  }),
}));
vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));
vi.mock("@/components/ui/color-mode", () => ({ ColorModeButton: () => null }));
vi.mock("@/components/ui/dialog", () => ({
  DialogBody: (p: any) => <div>{p.children}</div>,
  DialogContent: (p: any) => <div role="dialog">{p.children}</div>,
  DialogFooter: (p: any) => <div>{p.children}</div>,
  DialogHeader: (p: any) => <div>{p.children}</div>,
  DialogRoot: (p: any) => (p.open ? <div>{p.children}</div> : null),
  DialogTitle: (p: any) => <div>{p.children}</div>,
}));
vi.mock("@/components/ui/field", () => ({
  Field: (p: any) => <div><label>{p.label}</label>{p.children}</div>,
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

function fillForm(opts: { first?: string; last?: string; email?: string; pw?: string; confirm?: string } = {}) {
  if (opts.first) {
    fireEvent.change(screen.getByPlaceholderText("First name"), { target: { value: opts.first } });
  }
  if (opts.last) {
    fireEvent.change(screen.getByPlaceholderText("Last name"), { target: { value: opts.last } });
  }
  if (opts.email) {
    fireEvent.change(screen.getByPlaceholderText("your.name@rangers.uwp.edu"), { target: { value: opts.email } });
  }
  if (opts.pw) {
    fireEvent.change(screen.getByTestId("pw-create-a-password"), { target: { value: opts.pw } });
  }
  if (opts.confirm) {
    fireEvent.change(screen.getByTestId("pw-confirm-your-password"), { target: { value: opts.confirm } });
  }
}

function clickCreateAccount() {
  const buttons = screen.getAllByText("Create Account");
  const btn = buttons.find((el) => el.closest("button") !== null);
  return fireEvent.click(btn!);
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
    vi.stubGlobal("fetch", mockFetch);
    mockSearchParamsGet.mockReturnValue(null);
  });

  it("renders create account heading", () => {
    renderWithChakra(<SignupPage />);
    expect(screen.getAllByText("Create Student Account").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all form fields", () => {
    renderWithChakra(<SignupPage />);
    expect(screen.getAllByText("First Name").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Last Name").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Email").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Password").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Confirm Password").length).toBeGreaterThanOrEqual(1);
  });

  it("does not render an advisor signup card or section", () => {
    renderWithChakra(<SignupPage />);
    expect(screen.queryByText("Manage programs and Gen-Ed buckets.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Go to Advisor Sign Up" })).not.toBeInTheDocument();
  });

  it("renders the advisor access link", () => {
    renderWithChakra(<SignupPage />);
    expect(screen.getAllByText("Are you an advisor?").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("button", { name: "Access code required →" })
    ).toBeInTheDocument();
  });

  it("uses the student email placeholder", () => {
    renderWithChakra(<SignupPage />);
    expect(screen.getByPlaceholderText("your.name@rangers.uwp.edu")).toBeInTheDocument();
  });

  it("clicking the advisor link opens the modal with code input and actions", async () => {
    renderWithChakra(<SignupPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Access code required →" }));
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText("Advisor Access").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("Enter the access code provided by the department.")
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Advisor Access Code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("auto-opens the advisor access modal when advisor=1 is present", async () => {
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "advisor" ? "1" : null
    );

    renderWithChakra(<SignupPage />);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText("Advisor Access").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText("Advisor Access Code")).toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith("/signup");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it("wrong code shows an error toast and does not navigate to advisor signup", async () => {
    mockFetch.mockResolvedValue({
      status: 401,
      json: vi.fn().mockResolvedValue({ ok: false, message: "Invalid access code" }),
    });

    renderWithChakra(<SignupPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Access code required →" }));
    });

    fireEvent.change(screen.getByPlaceholderText("Advisor Access Code"), {
      target: { value: "wrong-code" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
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
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("correct code navigates to advisor signup", async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });

    renderWithChakra(<SignupPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Access code required →" }));
    });

    fireEvent.change(screen.getByPlaceholderText("Advisor Access Code"), {
      target: { value: "advisor-secret" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    });

    expect(mockPush).toHaveBeenCalledWith("/admin/signup");
  });

  it("server verification failure shows a generic error and does not navigate", async () => {
    mockFetch.mockResolvedValue({
      status: 500,
      json: vi.fn().mockResolvedValue({ ok: false, message: "Server misconfigured" }),
    });

    renderWithChakra(<SignupPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Access code required →" }));
    });

    fireEvent.change(screen.getByPlaceholderText("Advisor Access Code"), {
      target: { value: "advisor-secret" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    });

    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Verification failed" })
    );
    expect(mockPush).not.toHaveBeenCalledWith("/admin/signup");
  });

  it("network failures show a generic error and do not navigate", async () => {
    mockFetch.mockRejectedValue(new Error("network failed"));
    renderWithChakra(<SignupPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Access code required →" }));
    });

    fireEvent.change(screen.getByPlaceholderText("Advisor Access Code"), {
      target: { value: "advisor-secret" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    });

    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Verification failed" })
    );
    expect(mockPush).not.toHaveBeenCalledWith("/admin/signup");
  });

  it("shows error for empty fields", async () => {
    renderWithChakra(<SignupPage />);
    await act(async () => { clickCreateAccount(); });
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Missing fields" })
    );
  });

  it("shows error when passwords don't match", async () => {
    renderWithChakra(<SignupPage />);
    fillForm({ first: "John", last: "Doe", email: "j@rangers.uwp.edu", pw: "password1", confirm: "password2" });
    await act(async () => { clickCreateAccount(); });
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Passwords don't match" })
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
        description: "Student sign up requires a @rangers.uwp.edu email address.",
      })
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("shows error for short password", async () => {
    renderWithChakra(<SignupPage />);
    fillForm({ first: "John", last: "Doe", email: "j@rangers.uwp.edu", pw: "abc", confirm: "abc" });
    await act(async () => { clickCreateAccount(); });
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Password too short" })
    );
  });

  it("calls signUp with correct data", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "1", identities: [{ id: "1" }] } },
      error: null,
    });
    renderWithChakra(<SignupPage />);
    fillForm({ first: "John", last: "Doe", email: "j@rangers.uwp.edu", pw: "password123", confirm: "password123" });
    await act(async () => { clickCreateAccount(); });
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "j@rangers.uwp.edu",
        password: "password123",
        options: { data: { first_name: "John", last_name: "Doe" } },
      });
    });
  });

  it("shows error for existing account (empty identities)", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "1", identities: [] } },
      error: null,
    });
    renderWithChakra(<SignupPage />);
    fillForm({ first: "John", last: "Doe", email: "j@rangers.uwp.edu", pw: "password123", confirm: "password123" });
    await act(async () => { clickCreateAccount(); });
    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Account already exists" })
      );
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it("redirects to dashboard on success", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "1", identities: [{ id: "1" }] } },
      error: null,
    });
    renderWithChakra(<SignupPage />);
    fillForm({ first: "John", last: "Doe", email: "j@rangers.uwp.edu", pw: "password123", confirm: "password123" });
    await act(async () => { clickCreateAccount(); });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error on signUp failure", async () => {
    mockSignUp.mockResolvedValue({
      data: {},
      error: { message: "Email taken" },
    });
    renderWithChakra(<SignupPage />);
    fillForm({ first: "John", last: "Doe", email: "j@rangers.uwp.edu", pw: "password123", confirm: "password123" });
    await act(async () => { clickCreateAccount(); });
    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Sign up failed" })
      );
    });
  });

  it("renders sign in link", () => {
    renderWithChakra(<SignupPage />);
    expect(screen.getAllByText("Sign in").length).toBeGreaterThanOrEqual(1);
  });
});
