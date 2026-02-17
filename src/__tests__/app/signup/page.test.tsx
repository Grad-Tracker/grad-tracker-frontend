import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const { mockPush, mockSignUp, mockSignOut, mockToaster } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSignUp: vi.fn(),
  mockSignOut: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signUp: mockSignUp, signOut: mockSignOut },
  }),
}));
vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));
vi.mock("@/components/ui/color-mode", () => ({ ColorModeButton: () => null }));
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

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

function fillForm(opts: { first?: string; last?: string; email?: string; pw?: string; confirm?: string } = {}) {
  if (opts.first) {
    fireEvent.change(screen.getByPlaceholderText("First name"), { target: { value: opts.first } });
  }
  if (opts.last) {
    fireEvent.change(screen.getByPlaceholderText("Last name"), { target: { value: opts.last } });
  }
  if (opts.email) {
    fireEvent.change(screen.getByPlaceholderText("your.name@uwp.edu"), { target: { value: opts.email } });
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
  });

  it("renders create account heading", () => {
    renderWithChakra(<SignupPage />);
    expect(screen.getAllByText("Create Your Account").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all form fields", () => {
    renderWithChakra(<SignupPage />);
    expect(screen.getAllByText("First Name").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Last Name").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Email").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Password").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Confirm Password").length).toBeGreaterThanOrEqual(1);
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
    fillForm({ first: "John", last: "Doe", email: "j@uwp.edu", pw: "password1", confirm: "password2" });
    await act(async () => { clickCreateAccount(); });
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Passwords don't match" })
    );
  });

  it("shows error for short password", async () => {
    renderWithChakra(<SignupPage />);
    fillForm({ first: "John", last: "Doe", email: "j@uwp.edu", pw: "abc", confirm: "abc" });
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
    fillForm({ first: "John", last: "Doe", email: "j@uwp.edu", pw: "password123", confirm: "password123" });
    await act(async () => { clickCreateAccount(); });
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "j@uwp.edu",
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
    fillForm({ first: "John", last: "Doe", email: "j@uwp.edu", pw: "password123", confirm: "password123" });
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
    fillForm({ first: "John", last: "Doe", email: "j@uwp.edu", pw: "password123", confirm: "password123" });
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
    fillForm({ first: "John", last: "Doe", email: "j@uwp.edu", pw: "password123", confirm: "password123" });
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
