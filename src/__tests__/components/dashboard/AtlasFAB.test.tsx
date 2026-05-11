import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithChakra } from "@/__tests__/helpers/mocks";
import AtlasFAB from "@/components/dashboard/AtlasFAB";

const { mockUseAtlasPanel } = vi.hoisted(() => ({
  mockUseAtlasPanel: vi.fn(),
}));

vi.mock("@/contexts/AtlasPanelContext", () => ({
  useAtlasPanel: mockUseAtlasPanel,
  AtlasPanelProvider: ({ children }: any) => children,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAtlasPanel.mockReturnValue({ isOpen: false, open: vi.fn(), close: vi.fn(), toggle: vi.fn() });
});

describe("AtlasFAB", () => {
  it("renders when panel is closed (isOpen: false)", () => {
    const { container } = renderWithChakra(<AtlasFAB />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders when panel is open (isOpen: true) — covers the truthy display branch", () => {
    mockUseAtlasPanel.mockReturnValue({ isOpen: true, open: vi.fn(), close: vi.fn(), toggle: vi.fn() });
    const { container } = renderWithChakra(<AtlasFAB />);
    expect(container.firstChild).toBeTruthy();
  });
});
