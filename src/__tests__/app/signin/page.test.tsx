import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

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

import SigninPage from "@/app/signin/page";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("SigninPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: {} } },
      error: null,
    });
  });

  it("renders role selector with Student selected by default", () => {
    renderWithChakra(<SigninPage />);
    expect(screen.getAllByText("Student Sign In").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Student" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Advisor" })).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getAllByText("View your dashboard, requirements, and planner.").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders email and password fields", () => {
    renderWithChakra(<SigninPage />);
    expect(screen.getAllByText("Email").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Password").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText("your.name@rangers.uwp.edu")).toBeInTheDocument();
  });

  it("switching to Advisor updates the heading and helper text", async () => {
    renderWithChakra(<SigninPage />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Advisor" }));
    });

    expect(screen.getAllByText("Advisor Sign In").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Manage programs, Gen-Ed buckets, and course catalog.").length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Advisor" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByPlaceholderText("your.name@uwp.edu")).toBeInTheDocument();
  });

  it("student sign in blocks advisor-domain emails", async () => {
    renderWithChakra(<SigninPage />);

    fireEvent.change(screen.getByPlaceholderText("your.name@rangers.uwp.edu"), {
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

    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Invalid email domain",
        description: "Student sign in requires a @rangers.uwp.edu email address.",
      })
    );
  });

  it("advisor sign in blocks student-domain emails", async () => {
    renderWithChakra(<SigninPage />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Advisor" }));
    });

    fireEvent.change(screen.getByPlaceholderText("your.name@uwp.edu"), {
      target: { value: "student@rangers.uwp.edu" },
    });
    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "password123" },
    });

    const buttons = screen.getAllByText("Sign In");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(btn!);
    });

    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Invalid email domain",
        description: "Advisor sign in requires a @uwp.edu email address.",
      })
    );
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

    fireEvent.change(screen.getByPlaceholderText("your.name@rangers.uwp.edu"), {
      target: { value: "test@rangers.uwp.edu" },
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
        email: "test@rangers.uwp.edu",
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

    fireEvent.change(screen.getByPlaceholderText("your.name@rangers.uwp.edu"), {
      target: { value: "test@rangers.uwp.edu" },
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

  it("shows error and signs out when getUser cannot retrieve the session", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "fail" },
    });
    renderWithChakra(<SigninPage />);

    fireEvent.change(screen.getByPlaceholderText("your.name@rangers.uwp.edu"), {
      target: { value: "test@rangers.uwp.edu" },
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

  it("redirects to dashboard on student success", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    renderWithChakra(<SigninPage />);

    fireEvent.change(screen.getByPlaceholderText("your.name@rangers.uwp.edu"), {
      target: { value: "test@rangers.uwp.edu" },
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

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Advisor" }));
    });

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

  it("signs out and blocks student selection for advisor accounts", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: { role: "advisor" } } },
    });
    renderWithChakra(<SigninPage />);

    fireEvent.change(screen.getByPlaceholderText("your.name@rangers.uwp.edu"), {
      target: { value: "advisor@rangers.uwp.edu" },
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
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: {} } },
    });
    renderWithChakra(<SigninPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Advisor" }));
    });

    fireEvent.change(screen.getByPlaceholderText("your.name@uwp.edu"), {
      target: { value: "student@uwp.edu" },
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
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalledWith("/dashboard");
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "This is a student account. Use Student sign in.",
        })
      );
    });
  });

  it("renders forgot password link", () => {
    renderWithChakra(<SigninPage />);
    expect(screen.getAllByText("Forgot password?").length).toBeGreaterThanOrEqual(1);
  });

  it("keeps forgot password as the only inline action above the CTA", () => {
    renderWithChakra(<SigninPage />);

    expect(screen.getAllByText("Forgot password?").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: /Switch to/i })).not.toBeInTheDocument();
  });
});
