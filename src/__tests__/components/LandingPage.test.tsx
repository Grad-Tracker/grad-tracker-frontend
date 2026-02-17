import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const { mockPush, mockSignInWithPassword, mockToaster } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword: mockSignInWithPassword },
  }),
}));

vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));
vi.mock("@/components/ui/color-mode", () => ({ ColorModeButton: () => null }));
vi.mock("@/components/ui/dialog", () => ({
  DialogBody: (p: any) => <div>{p.children}</div>,
  DialogCloseTrigger: () => null,
  DialogContent: (p: any) => <div>{p.children}</div>,
  DialogHeader: (p: any) => <div>{p.children}</div>,
  DialogRoot: (p: any) => <div>{p.children}</div>,
  DialogTitle: (p: any) => <div>{p.children}</div>,
  DialogTrigger: (p: any) => <div>{p.children}</div>,
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
      data-testid="password-input"
    />
  ),
}));
vi.mock("@/components/ui/progress", () => ({
  ProgressBar: () => null,
  ProgressLabel: (p: any) => <span>{p.children}</span>,
  ProgressRoot: (p: any) => <div>{p.children}</div>,
  ProgressValueText: () => null,
}));
vi.mock("@/components/ui/progress-circle", () => ({
  ProgressCircleRing: () => null,
  ProgressCircleRoot: (p: any) => <div>{p.children}</div>,
  ProgressCircleValueText: () => <span>72%</span>,
}));
vi.mock("@/components/ui/stat", () => ({
  StatLabel: (p: any) => <span>{p.children}</span>,
  StatRoot: (p: any) => <div>{p.children}</div>,
  StatValueText: (p: any) => <span>{p.children}</span>,
}));
vi.mock("@/components/ui/timeline", () => ({
  TimelineConnector: (p: any) => <div>{p.children}</div>,
  TimelineContent: (p: any) => <div>{p.children}</div>,
  TimelineItem: (p: any) => <div>{p.children}</div>,
  TimelineRoot: (p: any) => <div>{p.children}</div>,
  TimelineTitle: (p: any) => <div>{p.children}</div>,
}));

import LandingPage from "@/components/LandingPage";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("LandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders GradTracker logo", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("GradTracker").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Parkside badge", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("Parkside").length).toBeGreaterThanOrEqual(1);
  });

  it("renders hero heading with Graduation text", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText(/Graduation/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders Get Started Free buttons", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("Get Started Free").length).toBeGreaterThanOrEqual(1);
  });

  it("renders See How It Works button", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("See How It Works").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all feature card titles", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("Credit Tracking").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Parkside Requirements").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Progress Visualization").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Advisor Ready").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Semester Planning").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Requirement Alerts").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Built for Parkside Rangers heading", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("Built for Parkside Rangers").length).toBeGreaterThanOrEqual(1);
  });

  it("renders stats section", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("40+").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("120").length).toBeGreaterThanOrEqual(1);
  });

  it("renders how it works timeline", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText(/Sign In with Your Parkside Account/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Select Your Degree Program/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders progress demo section", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("Your Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Overall Completion").length).toBeGreaterThanOrEqual(1);
  });

  it("renders CTA section", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText(/Ready to Graduate/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders footer", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText(/Built with care/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders sign in dialog form fields", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("Welcome Back, Ranger").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Email").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Password").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error toast when signing in with empty fields", async () => {
    renderWithChakra(<LandingPage />);
    // Find the Sign In submit button (last button, not the trigger)
    const signInButtons = screen.getAllByText("Sign In")
      .filter((el) => el.closest("button") !== null);
    const submitButton = signInButtons[signInButtons.length - 1];
    await act(async () => {
      fireEvent.click(submitButton!);
    });
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Missing fields" })
    );
  });

  it("calls signInWithPassword on valid submit", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    renderWithChakra(<LandingPage />);

    const emailInput = screen.getByPlaceholderText("your.name@uwp.edu");
    const passwordInput = screen.getByTestId("password-input");
    fireEvent.change(emailInput, { target: { value: "test@uwp.edu" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    const signInButtons = screen.getAllByText("Sign In")
      .filter((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(signInButtons[signInButtons.length - 1]!);
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
      error: { message: "Invalid credentials" },
    });
    renderWithChakra(<LandingPage />);

    const emailInput = screen.getByPlaceholderText("your.name@uwp.edu");
    const passwordInput = screen.getByTestId("password-input");
    fireEvent.change(emailInput, { target: { value: "test@uwp.edu" } });
    fireEvent.change(passwordInput, { target: { value: "wrong" } });

    const signInButtons = screen.getAllByText("Sign In")
      .filter((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(signInButtons[signInButtons.length - 1]!);
    });

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Sign in failed" })
      );
    });
  });

  it("redirects to dashboard on successful sign in", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    renderWithChakra(<LandingPage />);

    const emailInput = screen.getByPlaceholderText("your.name@uwp.edu");
    const passwordInput = screen.getByTestId("password-input");
    fireEvent.change(emailInput, { target: { value: "test@uwp.edu" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    const signInButtons = screen.getAllByText("Sign In")
      .filter((el) => el.closest("button") !== null);
    await act(async () => {
      fireEvent.click(signInButtons[signInButtons.length - 1]!);
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("renders create account link", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("Create one").length).toBeGreaterThanOrEqual(1);
  });

  it("renders security and free badges", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("Secure & Private").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Always Free").length).toBeGreaterThanOrEqual(1);
  });
});
