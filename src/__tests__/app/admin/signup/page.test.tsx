import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
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

import AdminSignupPage from "@/app/admin/signup/page";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

function fillForm(opts: {
  first?: string;
  last?: string;
  email?: string;
  pw?: string;
  confirm?: string;
} = {}) {
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
    fireEvent.change(screen.getByPlaceholderText("your.name@uwp.edu"), {
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

describe("AdminSignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it("renders all fields and the advisor button label", () => {
    renderWithChakra(<AdminSignupPage />);

    expect(screen.getAllByText("Advisor Sign Up").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("First Name").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Last Name").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Email").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Password").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Confirm Password").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Create Advisor Account").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error toast when passwords do not match", async () => {
    renderWithChakra(<AdminSignupPage />);
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

  it("signs out and shows account exists toast for duplicate emails", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "advisor-1", identities: [] } },
      error: null,
    });

    renderWithChakra(<AdminSignupPage />);
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

  it("inserts a staff row and redirects to /admin on success", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "advisor-1", identities: [{ id: "identity-1" }] } },
      error: null,
    });

    renderWithChakra(<AdminSignupPage />);
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
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });
  });
});
