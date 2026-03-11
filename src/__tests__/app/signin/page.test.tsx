import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const { mockPush, mockSignInWithPassword, mockGetUser, mockToaster } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockGetUser: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword: mockSignInWithPassword, getUser: mockGetUser },
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

import SigninPage from "@/app/signin/page";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("SigninPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: {} } },
    });
  });

  it("renders sign in page heading", () => {
    renderWithChakra(<SigninPage />);
    expect(screen.getAllByText("Welcome Back, Ranger").length).toBeGreaterThanOrEqual(1);
  });

  it("renders email and password fields", () => {
    renderWithChakra(<SigninPage />);
    expect(screen.getAllByText("Email").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Password").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText("your.name@uwp.edu")).toBeInTheDocument();
  });

  it("renders Sign In button", () => {
    renderWithChakra(<SigninPage />);
    expect(screen.getAllByText("Sign In").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error toast for empty fields", async () => {
    renderWithChakra(<SigninPage />);
    const buttons = screen.getAllByText("Sign In");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(btn!);
    });
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Missing fields" })
    );
  });

  it("calls signInWithPassword with correct credentials", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    renderWithChakra(<SigninPage />);

    fireEvent.change(screen.getByPlaceholderText("your.name@uwp.edu"), {
      target: { value: "test@uwp.edu" },
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
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@uwp.edu",
        password: "password123",
      });
    });
  });

  it("shows error toast on sign in failure", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {},
      error: { message: "Invalid login" },
    });
    renderWithChakra(<SigninPage />);

    fireEvent.change(screen.getByPlaceholderText("your.name@uwp.edu"), {
      target: { value: "test@uwp.edu" },
    });
    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "wrong" },
    });

    const buttons = screen.getAllByText("Sign In");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(btn!);
    });

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Sign in failed" })
      );
    });
  });

  it("redirects to dashboard on student success", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    renderWithChakra(<SigninPage />);

    fireEvent.change(screen.getByPlaceholderText("your.name@uwp.edu"), {
      target: { value: "test@uwp.edu" },
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
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Redirecting..." })
      );
    });
  });

  it("redirects to admin for advisor accounts", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: { role: "advisor" } } },
    });
    renderWithChakra(<SigninPage />);

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

  it("renders forgot password link", () => {
    renderWithChakra(<SigninPage />);
    expect(screen.getAllByText("Forgot password?").length).toBeGreaterThanOrEqual(1);
  });

  it("renders advisor signup link to /admin/signup", () => {
    renderWithChakra(<SigninPage />);
    const advisorLink = screen.getByRole("link", { name: "Sign up here" });
    expect(advisorLink).toBeInTheDocument();
    expect(advisorLink).toHaveAttribute("href", "/admin/signup");
  });
});
