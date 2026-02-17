import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
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
  default: () => <div data-testid="program-step">ProgramSelectionStep</div>,
}));
vi.mock("@/components/onboarding/ClassSelectionStep", () => ({
  default: () => <div data-testid="class-step">ClassSelectionStep</div>,
}));
vi.mock("@/components/onboarding/ReviewStep", () => ({
  default: () => <div data-testid="review-step">ReviewStep</div>,
}));
vi.mock("@/components/onboarding/WizardNavigation", () => ({
  default: () => <div data-testid="wizard-nav">WizardNavigation</div>,
}));

import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

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
});
