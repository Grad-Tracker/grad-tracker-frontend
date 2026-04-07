import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { AdvisorSidebar } from "@/components/dashboard/ai-advisor/AdvisorSidebar";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderSidebar() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AdvisorSidebar />
    </ChakraProvider>
  );
}

describe("AdvisorSidebar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading state initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderSidebar();
    expect(screen.getAllByText("Loading context...").length).toBeGreaterThan(0);
  });

  it("renders student info after fetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        studentName: "Alex Johnson",
        primaryProgram: "B.S. Computer Science",
        catalogYear: "2022-2023",
        expectedGraduation: "May 2026",
        progress: {
          overall: { completedCredits: 78, inProgressCredits: 12, remainingCredits: 30, totalCreditsRequired: 120, percentage: 75 },
          blocks: [],
        },
      }),
    });

    renderSidebar();
    await waitFor(() => {
      expect(screen.getAllByText("Alex Johnson").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("B.S. Computer Science").length).toBeGreaterThan(0);
  });

  it("renders nothing on fetch error", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const { container } = renderSidebar();
    await waitFor(() => {
      // After error, component returns null — container should be empty
      const textContent = container.textContent || "";
      expect(textContent).not.toContain("Loading context...");
    });
  });

  it("renders credit progress blocks with correct names", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        studentName: "Test Student",
        primaryProgram: "B.S. CS",
        catalogYear: "2023",
        expectedGraduation: "May 2027",
        progress: {
          overall: { completedCredits: 30, inProgressCredits: 6, remainingCredits: 84, totalCreditsRequired: 120, percentage: 30 },
          blocks: [
            { blockId: 1, blockName: "Major Core", completedCredits: 18, inProgressCredits: 3, remainingCredits: 21, totalCreditsRequired: 42, percentage: 50 },
            { blockId: 2, blockName: "General Education", completedCredits: 12, inProgressCredits: 3, remainingCredits: 21, totalCreditsRequired: 36, percentage: 42 },
          ],
        },
      }),
    });

    renderSidebar();
    await waitFor(() => {
      expect(screen.getAllByText("Major Core").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("General Education").length).toBeGreaterThan(0);
  });
});
