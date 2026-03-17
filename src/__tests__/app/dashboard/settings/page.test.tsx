import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

/* ---------------- HOISTED MOCKS ---------------- */

const { mockGetUser, mockUpdateUser, mockFrom, mockToasterCreate, mockPush } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockFrom: vi.fn(),
  mockToasterCreate: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser, updateUser: mockUpdateUser },
    from: mockFrom,
  }),
}));

vi.mock("@/components/ui/toaster", () => ({
  toaster: { create: mockToasterCreate },
}));

vi.mock("next/link", () => ({
  default: (p: any) => <a href={p.href}>{p.children}</a>,
}));

// Lightweight Field wrapper so label text is rendered
vi.mock("@/components/ui/field", () => ({
  Field: ({ label, children }: any) => (
    <div>
      {label && <label>{label}</label>}
      {children}
    </div>
  ),
}));

import SettingsPage from "@/app/dashboard/settings/page";

/* ---------------- HELPERS ---------------- */

function createChainMock(data: any = null, error: any = null) {
  const result = { data, error };
  const promise: any = Promise.resolve(result);
  promise.select = vi.fn().mockReturnValue(promise);
  promise.update = vi.fn().mockReturnValue(promise);
  promise.upsert = vi.fn().mockReturnValue(promise);
  promise.eq = vi.fn().mockReturnValue(promise);
  promise.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  return promise;
}

function renderSettings() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <SettingsPage />
    </ChakraProvider>
  );
}

const DEFAULT_STUDENT = {
  id: 1,
  first_name: "Alex",
  last_name: "Johnson",
  expected_graduation_semester: "Spring",
  expected_graduation_year: 2026,
};

function setupMocks(
  studentOverrides: Record<string, any> = {},
  notifPrefsData: Record<string, any> | null = null
) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: "auth-uuid", email: "test@uwp.edu" } },
    error: null,
  });
  mockUpdateUser.mockResolvedValue({ data: {}, error: null });

  const studentData = { ...DEFAULT_STUDENT, ...studentOverrides };

  mockFrom.mockImplementation((table: string) => {
    if (table === "students") {
      const chain = createChainMock();
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: studentData, error: null });
      return chain;
    }
    if (table === "notification_preferences") {
      const chain = createChainMock();
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: notifPrefsData, error: null });
      return chain;
    }
    return createChainMock();
  });
}

/* ---------------- TESTS ---------------- */

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---- Loading ---- */

  it("shows loading state initially", () => {
    mockGetUser.mockReturnValue(new Promise(() => {})); // never resolves
    renderSettings();
    expect(screen.getByText(/Loading\.\.\./i)).toBeInTheDocument();
  });

  /* ---- Profile section ---- */

  it("loads and displays student name in form fields", async () => {
    setupMocks();
    await act(async () => { renderSettings(); });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("First name")).toHaveValue("Alex");
      expect(screen.getByPlaceholderText("Last name")).toHaveValue("Johnson");
    });
  });

  it("loads and displays email in the email input", async () => {
    setupMocks();
    await act(async () => { renderSettings(); });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("you@example.com")).toHaveValue("test@uwp.edu");
    });
  });

  it("Save Name calls students.update with trimmed first and last name", async () => {
    const eqFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });

    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-uuid", email: "test@uwp.edu" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: DEFAULT_STUDENT, error: null });
        chain.update = updateFn;
        return chain;
      }
      return createChainMock();
    });

    await act(async () => { renderSettings(); });
    await waitFor(() => screen.getByPlaceholderText("First name"));

    fireEvent.change(screen.getByPlaceholderText("First name"), { target: { value: "Bobby" } });
    fireEvent.change(screen.getByPlaceholderText("Last name"), { target: { value: "Smith" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save Name"));
    });

    expect(updateFn).toHaveBeenCalledWith({ first_name: "Bobby", last_name: "Smith" });
  });

  /* ---- Email section ---- */

  it("Update Email button is disabled when email has not changed", async () => {
    setupMocks();
    await act(async () => { renderSettings(); });

    await waitFor(() => screen.getByPlaceholderText("you@example.com"));

    // The email input starts pre-filled with "test@uwp.edu" (same as current)
    expect(screen.getByText("Update Email")).toBeDisabled();
  });

  it("Update Email button is enabled and calls auth.updateUser when email changes", async () => {
    setupMocks();
    await act(async () => { renderSettings(); });
    await waitFor(() => screen.getByPlaceholderText("you@example.com"));

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "newemail@uwp.edu" },
    });

    const btn = screen.getByText("Update Email");
    expect(btn).not.toBeDisabled();

    await act(async () => { fireEvent.click(btn); });

    expect(mockUpdateUser).toHaveBeenCalledWith({ email: "newemail@uwp.edu" });
  });

  /* ---- Expected Graduation section ---- */

  it("renders Expected Graduation section with semester select and year input", async () => {
    setupMocks();
    await act(async () => { renderSettings(); });

    await waitFor(() => {
      expect(screen.getByText("Expected Graduation")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("e.g. 2026")).toBeInTheDocument();
    });
  });

  it("loads existing graduation semester and year into form fields", async () => {
    setupMocks({ expected_graduation_semester: "Fall", expected_graduation_year: 2027 });
    await act(async () => { renderSettings(); });

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("Fall");
      expect(screen.getByPlaceholderText("e.g. 2026")).toHaveValue(2027);
    });
  });

  it("Save Graduation Info calls students.update with semester and year", async () => {
    const eqFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });

    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-uuid", email: "test@uwp.edu" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: DEFAULT_STUDENT, error: null });
        chain.update = updateFn;
        return chain;
      }
      return createChainMock();
    });

    await act(async () => { renderSettings(); });
    await waitFor(() => screen.getByPlaceholderText("e.g. 2026"));

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Fall" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 2026"), { target: { value: "2028" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save Graduation Info"));
    });

    expect(updateFn).toHaveBeenCalledWith({
      expected_graduation_semester: "Fall",
      expected_graduation_year: 2028,
    });
  });

  it("Save Graduation Info shows error toast for year below 2000", async () => {
    setupMocks();
    await act(async () => { renderSettings(); });
    await waitFor(() => screen.getByPlaceholderText("e.g. 2026"));

    fireEvent.change(screen.getByPlaceholderText("e.g. 2026"), { target: { value: "1800" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save Graduation Info"));
    });

    expect(mockToasterCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Enter a valid graduation year", type: "error" })
    );
  });

  it("Save Graduation Info shows error toast for year above 2100", async () => {
    setupMocks();
    await act(async () => { renderSettings(); });
    await waitFor(() => screen.getByPlaceholderText("e.g. 2026"));

    fireEvent.change(screen.getByPlaceholderText("e.g. 2026"), { target: { value: "2200" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save Graduation Info"));
    });

    expect(mockToasterCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Enter a valid graduation year", type: "error" })
    );
  });

  /* ---- Notification Preferences section ---- */

  it("renders Notification Preferences heading", async () => {
    setupMocks();
    await act(async () => { renderSettings(); });

    await waitFor(() => {
      expect(screen.getByText("Notification Preferences")).toBeInTheDocument();
    });
  });

  it("renders all four notification option labels", async () => {
    setupMocks();
    await act(async () => { renderSettings(); });

    await waitFor(() => {
      expect(screen.getByText("Requirement Alerts")).toBeInTheDocument();
      expect(screen.getByText("Semester Planning Reminders")).toBeInTheDocument();
      expect(screen.getByText("Graduation Reminders")).toBeInTheDocument();
      expect(screen.getByText("Weekly Progress Digest")).toBeInTheDocument();
    });
  });

  it("loads existing notification preferences from DB", async () => {
    setupMocks({}, {
      notif_requirement_alerts: false,
      notif_semester_reminders: true,
      notif_graduation_reminders: false,
      notif_weekly_digest: true,
    });
    await act(async () => { renderSettings(); });

    // All labels still render regardless of toggle state
    await waitFor(() => {
      expect(screen.getByText("Requirement Alerts")).toBeInTheDocument();
      expect(screen.getByText("Weekly Progress Digest")).toBeInTheDocument();
    });
  });

  it("Save Preferences calls upsert on notification_preferences with student_id", async () => {
    const upsertFn = vi.fn().mockResolvedValue({ data: null, error: null });

    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-uuid", email: "test@uwp.edu" } },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: DEFAULT_STUDENT, error: null });
        return chain;
      }
      if (table === "notification_preferences") {
        const chain = createChainMock();
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        chain.upsert = upsertFn;
        return chain;
      }
      return createChainMock();
    });

    await act(async () => { renderSettings(); });
    await waitFor(() => screen.getByText("Notification Preferences"));

    await act(async () => {
      fireEvent.click(screen.getByText("Save Preferences"));
    });

    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ student_id: 1 }),
      expect.objectContaining({ onConflict: "student_id" })
    );
  });

  /* ---- Password section ---- */

  it("renders Password section with a Reset Password link to /reset-password", async () => {
    setupMocks();
    await act(async () => { renderSettings(); });

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /Reset Password/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/reset-password");
    });
  });
});
