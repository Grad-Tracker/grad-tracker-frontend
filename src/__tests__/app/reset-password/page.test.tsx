import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const { mockPush, mockUpdateUser, mockToaster } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { updateUser: mockUpdateUser },
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

import ResetPasswordPage from "@/app/reset-password/page";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders set new password heading", () => {
    renderWithChakra(<ResetPasswordPage />);
    expect(screen.getAllByText("Set New Password").length).toBeGreaterThanOrEqual(1);
  });

  it("renders password fields", () => {
    renderWithChakra(<ResetPasswordPage />);
    expect(screen.getAllByText("New Password").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Confirm New Password").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Update Password button", () => {
    renderWithChakra(<ResetPasswordPage />);
    expect(screen.getAllByText("Update Password").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error for empty fields", async () => {
    renderWithChakra(<ResetPasswordPage />);
    const buttons = screen.getAllByText("Update Password");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => { fireEvent.click(btn!); });
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Missing fields" })
    );
  });

  it("shows error when passwords don't match", async () => {
    renderWithChakra(<ResetPasswordPage />);
    fireEvent.change(screen.getByTestId("pw-enter-new-password"), {
      target: { value: "newpassword1" },
    });
    fireEvent.change(screen.getByTestId("pw-confirm-new-password"), {
      target: { value: "newpassword2" },
    });
    const buttons = screen.getAllByText("Update Password");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => { fireEvent.click(btn!); });
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Passwords don't match" })
    );
  });

  it("shows error for short password", async () => {
    renderWithChakra(<ResetPasswordPage />);
    fireEvent.change(screen.getByTestId("pw-enter-new-password"), {
      target: { value: "abc" },
    });
    fireEvent.change(screen.getByTestId("pw-confirm-new-password"), {
      target: { value: "abc" },
    });
    const buttons = screen.getAllByText("Update Password");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => { fireEvent.click(btn!); });
    expect(mockToaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Password too short" })
    );
  });

  it("calls updateUser with correct password", async () => {
    mockUpdateUser.mockResolvedValue({ data: {}, error: null });
    renderWithChakra(<ResetPasswordPage />);
    fireEvent.change(screen.getByTestId("pw-enter-new-password"), {
      target: { value: "newpassword123" },
    });
    fireEvent.change(screen.getByTestId("pw-confirm-new-password"), {
      target: { value: "newpassword123" },
    });
    const buttons = screen.getAllByText("Update Password");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => { fireEvent.click(btn!); });
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "newpassword123" });
    });
  });

  it("shows error on update failure", async () => {
    mockUpdateUser.mockResolvedValue({
      data: {},
      error: { message: "Token expired" },
    });
    renderWithChakra(<ResetPasswordPage />);
    fireEvent.change(screen.getByTestId("pw-enter-new-password"), {
      target: { value: "newpassword123" },
    });
    fireEvent.change(screen.getByTestId("pw-confirm-new-password"), {
      target: { value: "newpassword123" },
    });
    const buttons = screen.getAllByText("Update Password");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => { fireEvent.click(btn!); });
    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Update failed" })
      );
    });
  });

  it("redirects to dashboard on success", async () => {
    mockUpdateUser.mockResolvedValue({ data: {}, error: null });
    renderWithChakra(<ResetPasswordPage />);
    fireEvent.change(screen.getByTestId("pw-enter-new-password"), {
      target: { value: "newpassword123" },
    });
    fireEvent.change(screen.getByTestId("pw-confirm-new-password"), {
      target: { value: "newpassword123" },
    });
    const buttons = screen.getAllByText("Update Password");
    const btn = buttons.find((el) => el.closest("button") !== null);
    await act(async () => { fireEvent.click(btn!); });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("renders description text", () => {
    renderWithChakra(<ResetPasswordPage />);
    expect(screen.getAllByText(/Choose a strong password/).length).toBeGreaterThanOrEqual(1);
  });
});
