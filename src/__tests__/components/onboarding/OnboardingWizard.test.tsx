import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const {
  mockPush,
  mockToaster,
  mockFetchPrograms,
  mockFetchProgramRequirements,
  mockFetchCertificatesForMajor,
  mockGetOrCreateStudent,
  mockSaveOnboardingSelections,
  mockFetchCoursesByIds,
  mockGetUser,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
  mockFetchPrograms: vi.fn(),
  mockFetchProgramRequirements: vi.fn(),
  mockFetchCertificatesForMajor: vi.fn(),
  mockGetOrCreateStudent: vi.fn(),
  mockSaveOnboardingSelections: vi.fn(),
  mockFetchCoursesByIds: vi.fn(),
  mockGetUser: vi.fn(),
}));

// Router
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

// Supabase client (needed for handleComplete)
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
    },
  }),
}));

// Toaster
vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));

// Onboarding queries
vi.mock("@/lib/supabase/queries/onboarding", () => ({
  fetchPrograms: (...args: any[]) => mockFetchPrograms(...args),
  fetchProgramRequirements: (...args: any[]) => mockFetchProgramRequirements(...args),
  fetchCertificatesForMajor: (...args: any[]) => mockFetchCertificatesForMajor(...args),
  getOrCreateStudent: (...args: any[]) => mockGetOrCreateStudent(...args),
  saveOnboardingSelections: (...args: any[]) => mockSaveOnboardingSelections(...args),
  fetchCoursesByIds: (...args: any[]) => mockFetchCoursesByIds(...args),
}));

/**
 * IMPORTANT:
 * Mock Chakra Steps so we can actually switch steps in tests.
 * We keep ChakraProvider for the rest of the UI.
 */
vi.mock("@chakra-ui/react", async () => {
  const React = await import("react");
  const actual = await vi.importActual<any>("@chakra-ui/react");

  const RootCtx = React.createContext<{ step: number; onStepChange?: (d: any) => void } | null>(null);
  const ItemCtx = React.createContext<{ index: number } | null>(null);

  const Steps = {
    Root: ({ step, onStepChange, children }: any) => (
      <RootCtx.Provider value={{ step, onStepChange }}>
        <div data-testid="steps-root">{children}</div>
      </RootCtx.Provider>
    ),
    List: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Item: ({ index, children }: any) => (
      <ItemCtx.Provider value={{ index }}>
        <div data-testid={`step-item-${index}`}>{children}</div>
      </ItemCtx.Provider>
    ),
    Trigger: ({ children }: any) => {
      const root = React.useContext(RootCtx);
      const item = React.useContext(ItemCtx);
      return (
        <button
          type="button"
          data-testid={`step-trigger-${item?.index ?? "x"}`}
          onClick={() => root?.onStepChange?.({ step: item?.index ?? 0 })}
        >
          {children}
        </button>
      );
    },
    Content: ({ index, children }: any) => {
      const root = React.useContext(RootCtx);
      if (!root) return null;
      return root.step === index ? <div data-testid={`step-content-${index}`}>{children}</div> : null;
    },
    Indicator: ({ children }: any) => <span>{children}</span>,
    Status: ({ complete, incomplete, current }: any) => <span>{complete ?? incomplete ?? current}</span>,
    Number: () => <span>#</span>,
    Separator: () => <span>|</span>,
    Title: ({ children }: any) => <span>{children}</span>,
    Description: ({ children }: any) => <span>{children}</span>,
  };

  return { ...actual, Steps };
});

// Child step mocks — now they CALL the props callbacks so we can hit wizard logic
vi.mock("@/components/onboarding/ProgramSelectionStep", () => ({
  default: (props: any) => (
    <div data-testid="program-step">
      ProgramSelectionStep
      <button type="button" onClick={() => props.onMajorChange(1)}>
        SelectMajor
      </button>
      <button type="button" onClick={() => props.onMajorChange(null)}>
        ClearMajor
      </button>
      <button type="button" onClick={() => props.onGradChange("Fall", 2027)}>
        SetGrad
      </button>
    </div>
  ),
}));

vi.mock("@/components/onboarding/ClassSelectionStep", () => ({
  default: (props: any) => (
    <div data-testid="class-step">
      ClassSelectionStep
      <button type="button" onClick={() => props.onClassesChange([101, 102])}>
        SelectClasses
      </button>
    </div>
  ),
}));

vi.mock("@/components/onboarding/ReviewStep", () => ({
  default: (props: any) => (
    <div data-testid="review-step">
      ReviewStep
      <div data-testid="review-classes-count">{props.classes?.length ?? 0}</div>
      <button type="button" onClick={() => props.onEditStep(0)}>
        EditProgram
      </button>
    </div>
  ),
}));

vi.mock("@/components/onboarding/WizardNavigation", () => ({
  default: (props: any) => (
    <div data-testid="wizard-nav">
      WizardNavigation
      <button type="button" onClick={props.onComplete} disabled={!props.canProceed}>
        Complete
      </button>
    </div>
  ),
}));

import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // defaults: keep wizard happy
    mockFetchPrograms.mockResolvedValue([
      { id: 1, name: "Computer Science", catalog_year: "2025-2026", program_type: "MAJOR" },
    ]);

    mockFetchCertificatesForMajor.mockResolvedValue([
      { id: 20, name: "Data Science", catalog_year: "2025-2026", program_type: "CERTIFICATE" },
    ]);

    mockFetchProgramRequirements.mockResolvedValue([
      {
        id: 10,
        program_id: 1,
        name: "Core",
        rule: "ALL_OF",
        n_required: null,
        credits_required: null,
        courses: [
          { id: 101, subject: "CS", number: "101", title: "Intro", credits: 3 },
          { id: 102, subject: "CS", number: "201", title: "DSA", credits: 3 },
        ],
      },
    ]);

    mockFetchCoursesByIds.mockResolvedValue([
      { id: 101, subject: "CS", number: "101", title: "Intro", credits: 3 },
      { id: 102, subject: "CS", number: "201", title: "DSA", credits: 3 },
    ]);

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "auth-1",
          email: "a@test.com",
          user_metadata: { first_name: "A", last_name: "B" },
        },
      },
    });

    mockGetOrCreateStudent.mockResolvedValue({ id: 99 });
    mockSaveOnboardingSelections.mockResolvedValue(undefined);
  });

  it("shows loading spinner while programs are being fetched", () => {
    mockFetchPrograms.mockReturnValue(new Promise(() => {}));
    renderWithChakra(<OnboardingWizard />);
    expect(screen.getAllByText("Loading programs...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders wizard header after programs load", async () => {
    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Setup Wizard").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows error toast when fetchPrograms fails", async () => {
    mockFetchPrograms.mockRejectedValueOnce(new Error("Network error"));

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => {
      expect(mockToaster.error).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to load programs" })
      );
    });
  });

  it("blocks moving forward to Classes when no major selected (handleStepChange branch)", async () => {
    // majors load, but no major selected yet
    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => expect(screen.getByTestId("program-step")).toBeInTheDocument());

    // Try step 1 without selecting major
    fireEvent.click(screen.getByTestId("step-trigger-1"));

    // Still on step 0 content
    expect(screen.getByTestId("step-content-0")).toBeInTheDocument();
    expect(screen.queryByTestId("class-step")).not.toBeInTheDocument();
  });

  it("selecting a major triggers cert + requirements fetch and allows moving to Classes", async () => {
    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => expect(screen.getByTestId("program-step")).toBeInTheDocument());

    // Select major (calls onMajorChange)
    fireEvent.click(screen.getByText("SelectMajor"));

    await waitFor(() => {
      expect(mockFetchCertificatesForMajor).toHaveBeenCalledWith(1);
      expect(mockFetchProgramRequirements).toHaveBeenCalledWith(1);
    });

    // go to step 1
    fireEvent.click(screen.getByTestId("step-trigger-1"));
    expect(await screen.findByTestId("class-step")).toBeInTheDocument();

    // go back (covers backwards navigation)
    fireEvent.click(screen.getByTestId("step-trigger-0"));
    expect(await screen.findByTestId("program-step")).toBeInTheDocument();
  });

  it("shows error toast when major data fetch fails", async () => {
    mockFetchProgramRequirements.mockRejectedValueOnce(new Error("fail blocks"));

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => expect(screen.getByTestId("program-step")).toBeInTheDocument());

    fireEvent.click(screen.getByText("SelectMajor"));

    await waitFor(() => {
      expect(mockToaster.error).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to load program data" })
      );
    });
  });

  it("review step loads classes via fetchCoursesByIds (success path)", async () => {
    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => expect(screen.getByTestId("program-step")).toBeInTheDocument());

    fireEvent.click(screen.getByText("SelectMajor"));
    await waitFor(() => expect(mockFetchProgramRequirements).toHaveBeenCalled());

    // step 1
    fireEvent.click(screen.getByTestId("step-trigger-1"));
    fireEvent.click(await screen.findByText("SelectClasses"));

    // step 2
    fireEvent.click(screen.getByTestId("step-trigger-2"));
    expect(await screen.findByTestId("review-step")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetchCoursesByIds).toHaveBeenCalledWith([101, 102]);
    });

    // review step should show 2
    expect(screen.getByTestId("review-classes-count").textContent).toBe("2");
  });

  it("review step falls back to requirementBlocks when fetchCoursesByIds fails", async () => {
    mockFetchCoursesByIds.mockRejectedValueOnce(new Error("nope"));

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => expect(screen.getByTestId("program-step")).toBeInTheDocument());

    fireEvent.click(screen.getByText("SelectMajor"));
    await waitFor(() => expect(mockFetchProgramRequirements).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId("step-trigger-1"));
    fireEvent.click(await screen.findByText("SelectClasses"));

    fireEvent.click(screen.getByTestId("step-trigger-2"));
    expect(await screen.findByTestId("review-step")).toBeInTheDocument();

    // fallback uses requirementBlocks (2 courses in default setup)
    expect(screen.getByTestId("review-classes-count").textContent).toBe("2");
  });

  it("handleComplete: unauthenticated user shows toaster error and redirects to /signin", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => expect(screen.getByTestId("program-step")).toBeInTheDocument());

    fireEvent.click(screen.getByText("SelectMajor"));
    await waitFor(() => expect(mockFetchProgramRequirements).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Complete"));

    await waitFor(() => {
      expect(mockToaster.error).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Not authenticated" })
      );
      expect(mockPush).toHaveBeenCalledWith("/signin");
    });
  });

  it("handleComplete: success saves selections and redirects to /dashboard", async () => {
    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => expect(screen.getByTestId("program-step")).toBeInTheDocument());

    fireEvent.click(screen.getByText("SelectMajor"));
    fireEvent.click(screen.getByText("SetGrad"));

    // choose classes so selectedClasses isn't empty
    fireEvent.click(screen.getByTestId("step-trigger-1"));
    fireEvent.click(await screen.findByText("SelectClasses"));

    fireEvent.click(screen.getByText("Complete"));

    await waitFor(() => {
      expect(mockGetOrCreateStudent).toHaveBeenCalled();
      expect(mockSaveOnboardingSelections).toHaveBeenCalled();
      expect(mockToaster.success).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Setup complete!" })
      );
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("handleComplete: failure shows toaster error and logs", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSaveOnboardingSelections.mockRejectedValueOnce(new Error("save failed"));

    await act(async () => {
      renderWithChakra(<OnboardingWizard />);
    });

    await waitFor(() => expect(screen.getByTestId("program-step")).toBeInTheDocument());

    fireEvent.click(screen.getByText("SelectMajor"));
    fireEvent.click(screen.getByText("Complete"));

    await waitFor(() => {
      expect(mockToaster.error).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to save selections" })
      );
      expect(errSpy).toHaveBeenCalled();
    });

    errSpy.mockRestore();
  });
});