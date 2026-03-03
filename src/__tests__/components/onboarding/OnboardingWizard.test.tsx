import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const {
  mockPush, mockToaster,
  mockFetchPrograms, mockFetchProgramRequirements, mockFetchCertificatesForMajor,
  mockGetOrCreateStudent, mockSaveOnboardingSelections, mockFetchCoursesByIds,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
  mockFetchPrograms: vi.fn(),
  mockFetchProgramRequirements: vi.fn(),
  mockFetchCertificatesForMajor: vi.fn(),
  mockGetOrCreateStudent: vi.fn(),
  mockSaveOnboardingSelections: vi.fn(),
  mockFetchCoursesByIds: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));
vi.mock("@/lib/supabase/queries/onboarding", () => ({
  fetchPrograms: (...args: any[]) => mockFetchPrograms(...args),
  fetchProgramRequirements: (...args: any[]) => mockFetchProgramRequirements(...args),
  fetchCertificatesForMajor: (...args: any[]) => mockFetchCertificatesForMajor(...args),
  getOrCreateStudent: (...args: any[]) => mockGetOrCreateStudent(...args),
  saveOnboardingSelections: (...args: any[]) => mockSaveOnboardingSelections(...args),
  fetchCoursesByIds: (...args: any[]) => mockFetchCoursesByIds(...args),
}));

vi.mock("@/components/onboarding/ProgramSelectionStep", () => ({
  default: ({ onMajorChange }: any) => (
    <div data-testid="program-step">
      <button data-testid="select-major-btn" onClick={() => onMajorChange(1)}>
        Select Major
      </button>
    </div>
  ),
}));
vi.mock("@/components/onboarding/ClassSelectionStep", () => ({
  default: () => <div data-testid="class-step">ClassSelectionStep</div>,
}));
vi.mock("@/components/onboarding/ReviewStep", () => ({
  default: () => <div data-testid="review-step">ReviewStep</div>,
}));
vi.mock("@/components/onboarding/WizardNavigation", () => ({
  default: ({ onComplete }: any) => (
    <div data-testid="wizard-nav">
      <button data-testid="complete-btn" onClick={onComplete}>
        Complete
      </button>
    </div>
  ),
}));

import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import { createClient } from "@/lib/supabase/client";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner while programs are being fetched", () => {
    mockFetchPrograms.mockReturnValue(new Promise(() => {}));
    renderWithChakra(<OnboardingWizard />);
    expect(screen.getAllByText("Loading programs...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders wizard header after programs load", async () => {
    mockFetchPrograms.mockResolvedValue([
      { id: 1, name: "Computer Science", catalog_year: "2025-2026", program_type: "MAJOR" },
    ]);

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Setup Wizard").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders Let's Get You Started heading", async () => {
    mockFetchPrograms.mockResolvedValue([]);

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Let's Get You Started").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders step labels", async () => {
    mockFetchPrograms.mockResolvedValue([]);

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Program").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Classes").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Review").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders ProgramSelectionStep on step 0", async () => {
    mockFetchPrograms.mockResolvedValue([]);

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("program-step")).toBeInTheDocument();
    });
  });

  it("renders WizardNavigation", async () => {
    mockFetchPrograms.mockResolvedValue([]);

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("wizard-nav")).toBeInTheDocument();
    });
  });

  it("shows error toast when fetchPrograms fails", async () => {
    mockFetchPrograms.mockRejectedValue(new Error("Network error"));

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => {
      expect(mockToaster.error).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to load programs" })
      );
    });
  });

  it("renders description text", async () => {
    mockFetchPrograms.mockResolvedValue([]);

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText(/Complete these steps to personalize/).length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("redirects to signin when handleComplete is called but user is not authenticated", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } });
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: { getUser: mockGetUser },
    });

    mockFetchPrograms.mockResolvedValue([
      { id: 1, name: "CS", catalog_year: "2025", program_type: "MAJOR" },
    ]);
    // Must be set up BEFORE clicking select-major-btn to avoid undefined certificates state
    mockFetchCertificatesForMajor.mockResolvedValue([]);
    mockFetchProgramRequirements.mockResolvedValue([]);

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    // Wait for wizard to load
    await waitFor(() => {
      expect(screen.getByTestId("program-step")).toBeInTheDocument();
    });

    // Select a major so handleComplete won't early return
    await act(async () => {
      fireEvent.click(screen.getByTestId("select-major-btn"));
    });

    // Click complete
    await act(async () => {
      fireEvent.click(screen.getByTestId("complete-btn"));
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/signin");
    });
  });

  it("shows error toast when fetchCertificatesForMajor fails after major selection", async () => {
    mockFetchPrograms.mockResolvedValue([
      { id: 1, name: "CS", catalog_year: "2025", program_type: "MAJOR" },
    ]);
    mockFetchCertificatesForMajor.mockRejectedValue(new Error("Cert load error"));
    mockFetchProgramRequirements.mockRejectedValue(new Error("Req load error"));

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("program-step")).toBeInTheDocument();
    });

    // Select a major to trigger the effect
    await act(async () => {
      fireEvent.click(screen.getByTestId("select-major-btn"));
    });

    await waitFor(() => {
      expect(mockToaster.error).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to load program data" })
      );
    });
  });

  it("shows success toast and navigates to dashboard after successful completion", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "test@test.com",
          user_metadata: { first_name: "John", last_name: "Doe" },
        },
      },
    });
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: { getUser: mockGetUser },
    });

    mockFetchPrograms.mockResolvedValue([
      { id: 1, name: "CS", catalog_year: "2025", program_type: "MAJOR" },
    ]);
    mockFetchCertificatesForMajor.mockResolvedValue([]);
    mockFetchProgramRequirements.mockResolvedValue([]);
    mockGetOrCreateStudent.mockResolvedValue({ id: 10 });
    mockSaveOnboardingSelections.mockResolvedValue(undefined);

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("program-step")).toBeInTheDocument();
    });

    // Select major
    await act(async () => {
      fireEvent.click(screen.getByTestId("select-major-btn"));
    });

    // Click complete
    await act(async () => {
      fireEvent.click(screen.getByTestId("complete-btn"));
    });

    await waitFor(() => {
      expect(mockToaster.success).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Setup complete!" })
      );
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error toast when saveOnboardingSelections fails", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "test@test.com",
          user_metadata: {},
        },
      },
    });
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: { getUser: mockGetUser },
    });

    mockFetchPrograms.mockResolvedValue([
      { id: 1, name: "CS", catalog_year: "2025", program_type: "MAJOR" },
    ]);
    mockFetchCertificatesForMajor.mockResolvedValue([]);
    mockFetchProgramRequirements.mockResolvedValue([]);
    mockGetOrCreateStudent.mockResolvedValue({ id: 10 });
    mockSaveOnboardingSelections.mockRejectedValue(new Error("Save failed"));

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("program-step")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("select-major-btn"));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("complete-btn"));
    });

    await waitFor(() => {
      expect(mockToaster.error).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to save selections" })
      );
    });
  });
});
