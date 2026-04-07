import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

const { mockResetPasswordForEmail, mockToaster } = vi.hoisted(() => ({
  mockResetPasswordForEmail: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { resetPasswordForEmail: mockResetPasswordForEmail },
  }),
}));
vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));
vi.mock("@/components/ui/color-mode", () => ({ ColorModeButton: () => null }));
vi.mock("@/components/ui/field", () => ({
  Field: (p: any) => <div><label>{p.label}</label>{p.children}</div>,
}));

import ForgotPasswordPage from "@/app/forgot-password/page";

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders reset password heading", () => {
    renderWithChakra(<ForgotPasswordPage />);
    expect(screen.getAllByText("Reset Your Password").length).toBeGreaterThanOrEqual(1);
  });

  it("renders email field", () => {
    renderWithChakra(<ForgotPasswordPage />);
    expect(screen.getAllByText("Email").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText("your.name@uwp.edu")).toBeInTheDocument();
  });

  it("renders Send Reset Link button", () => {
    renderWithChakra(<ForgotPasswordPage />);
    expect(screen.getAllByText("Send Reset Link").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error for empty email", async () => {
    renderWithChakra(<ForgotPasswordPage />);
    const buttons = screen.getAllByText("Send Reset Link");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => { fireEvent.click(btn!); });
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Missing email" })
    );
  });

  it("calls resetPasswordForEmail with email", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    renderWithChakra(<ForgotPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText("your.name@uwp.edu"), {
      target: { value: "test@uwp.edu" },
    });

    const buttons = screen.getAllByText("Send Reset Link");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => { fireEvent.click(btn!); });

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "test@uwp.edu",
        expect.any(Object)
      );
    });
  });

  it("shows error on failure", async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: "Rate limit exceeded" },
    });
    renderWithChakra(<ForgotPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText("your.name@uwp.edu"), {
      target: { value: "test@uwp.edu" },
    });

    const buttons = screen.getAllByText("Send Reset Link");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => { fireEvent.click(btn!); });

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Something went wrong" })
      );
    });
  });

  it("shows success state after sending", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    renderWithChakra(<ForgotPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText("your.name@uwp.edu"), {
      target: { value: "test@uwp.edu" },
    });

    const buttons = screen.getAllByText("Send Reset Link");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => { fireEvent.click(btn!); });

    await waitFor(() => {
      expect(screen.getAllByText(/Didn.t get the email/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("try again button resets to form", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    renderWithChakra(<ForgotPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText("your.name@uwp.edu"), {
      target: { value: "test@uwp.edu" },
    });

    const buttons = screen.getAllByText("Send Reset Link");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => { fireEvent.click(btn!); });

    await waitFor(() => {
      expect(screen.getAllByText("Try again").length).toBeGreaterThanOrEqual(1);
    });

    const tryAgainButtons = screen.getAllByText("Try again");
    const tryBtn = tryAgainButtons.find((el) => el.closest("button") !== null);
    await act(async () => { fireEvent.click(tryBtn!); });

    await waitFor(() => {
      expect(screen.getAllByText("Send Reset Link").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders back to sign in link", () => {
    renderWithChakra(<ForgotPasswordPage />);
    expect(screen.getAllByText("Back to sign in").length).toBeGreaterThanOrEqual(1);
  });
});
