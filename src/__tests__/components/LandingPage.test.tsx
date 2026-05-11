import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

// Mock next/image as a simple img element
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    const { fill, priority, ...rest } = props as Record<string, unknown>;
    return React.createElement("img", rest);
  },
}));

// Mock next/link as a simple anchor
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href }, children),
}));

// Mock the LinkButton component as a simple anchor
vi.mock("@/components/ui/link-button", () => ({
  LinkButton: ({
    href,
    children,
    ...rest
  }: {
    href?: string;
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...rest }, children),
}));

// Mock IntersectionObserver for FadeIn component
const mockIntersectionObserver = vi.fn();

beforeEach(() => {
  mockIntersectionObserver.mockImplementation((callback: IntersectionObserverCallback) => {
    // Immediately trigger with isIntersecting: true so FadeIn content renders visibly
    setTimeout(() => {
      callback(
        [{ isIntersecting: true, target: document.createElement("div") }] as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver
      );
    }, 0);
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };
  });
  vi.stubGlobal("IntersectionObserver", mockIntersectionObserver);
});

import LandingPage from "@/components/LandingPage";

describe("LandingPage", { timeout: 15000 }, () => {
  afterEach(cleanup);

  // --- Header / Navbar ---

  it("renders GradTracker branding in the header", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("GradTracker").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Parkside text", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("Parkside").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Sign In link pointing to /signin", () => {
    renderWithChakra(<LandingPage />);
    const signInLinks = screen
      .getAllByText("Sign In")
      .map((el) => el.closest("a"))
      .filter(Boolean);
    expect(signInLinks.length).toBeGreaterThanOrEqual(1);
    expect(signInLinks[0]).toHaveAttribute("href", "/signin");
  });

  // --- Hero Section ---

  it("renders hero heading lines", () => {
    renderWithChakra(<LandingPage />);
    // The heading is a single h2 with <br> separators, so match within it
    const headings = screen.getAllByRole("heading", { level: 2 });
    const heroHeading = headings.find(
      (h) =>
        h.textContent?.includes("Your degree.") &&
        h.textContent?.includes("Your plan.") &&
        h.textContent?.includes("Your future.")
    );
    expect(heroHeading).toBeDefined();
  });

  it("renders hero subtitle", () => {
    renderWithChakra(<LandingPage />);
    expect(
      screen.getAllByText(/Track every requirement, plan every semester/).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders Start Tracking button linking to /signup", () => {
    renderWithChakra(<LandingPage />);
    const buttons = screen.getAllByText("Start Tracking");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    const link = buttons[0].closest("a");
    expect(link).toHaveAttribute("href", "/signup");
  });

  it("renders See How It Works button", () => {
    renderWithChakra(<LandingPage />);
    expect(
      screen.getAllByText("See How It Works").length
    ).toBeGreaterThanOrEqual(1);
  });

  // --- Stats ---

  it("renders inline stats: 40+, 2,200+, 135, Free", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("40+").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2,200+").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("135").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Free").length).toBeGreaterThanOrEqual(1);
  });

  it("renders stat labels", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("Programs").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Courses").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Catalogs").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("For Students").length).toBeGreaterThanOrEqual(1);
  });

  // --- Product Screenshot ---

  it("renders the dashboard screenshot image", () => {
    renderWithChakra(<LandingPage />);
    const images = screen.getAllByAltText("GradTracker Dashboard");
    expect(images.length).toBeGreaterThanOrEqual(1);
  });

  // --- How It Works Section ---

  it("renders How It Works section heading", () => {
    renderWithChakra(<LandingPage />);
    expect(
      screen.getAllByText(/How it works/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Three steps to graduation clarity").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders the three how-it-works steps", () => {
    renderWithChakra(<LandingPage />);
    expect(
      screen.getAllByText("Create your account").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Select your program").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Track your progress").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders step numbers", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("STEP 01").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("STEP 02").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("STEP 03").length).toBeGreaterThanOrEqual(1);
  });

  // --- Features Section ---

  it("renders Features section heading", () => {
    renderWithChakra(<LandingPage />);
    expect(screen.getAllByText("Features").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Everything you need to graduate on time").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders all four feature card titles", () => {
    renderWithChakra(<LandingPage />);
    expect(
      screen.getAllByText("Semester Planner").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Course Catalog").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Requirement Breakdown").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("AI Academic Advisor").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders feature descriptions", () => {
    renderWithChakra(<LandingPage />);
    expect(
      screen.getAllByText(/Build your path to graduation semester by semester/)
        .length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Browse 2,200\+ courses/).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Every gen-ed bucket and major block/).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Get instant, personalized guidance/).length
    ).toBeGreaterThanOrEqual(1);
  });

  // --- AI Advisor Chat Preview ---

  it("renders the AI advisor chat preview", () => {
    renderWithChakra(<LandingPage />);
    expect(
      screen.getAllByText(/What should I take next semester/).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/I'd recommend/).length
    ).toBeGreaterThanOrEqual(1);
  });

  // --- CTA Section ---

  it("renders the CTA heading", () => {
    renderWithChakra(<LandingPage />);
    expect(
      screen.getAllByText(/Your graduation roadmap/).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("starts here").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders Get Started Free button in CTA linking to /signup", () => {
    renderWithChakra(<LandingPage />);
    const buttons = screen.getAllByText("Get Started Free");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    const link = buttons[0].closest("a");
    expect(link).toHaveAttribute("href", "/signup");
  });

  it("renders CTA subtitle text", () => {
    renderWithChakra(<LandingPage />);
    expect(
      screen.getAllByText(/Free for all UW-Parkside students/).length
    ).toBeGreaterThanOrEqual(1);
  });

  // --- Footer ---

  it("renders footer with GradTracker Parkside branding", () => {
    renderWithChakra(<LandingPage />);
    // There should be at least 2 GradTracker texts (header + footer)
    expect(screen.getAllByText("GradTracker").length).toBeGreaterThanOrEqual(2);
  });

  it("renders footer navigation links", () => {
    renderWithChakra(<LandingPage />);
    expect(
      screen.getAllByText("Progress Tracking").length
    ).toBeGreaterThanOrEqual(1);
    // "Semester Planner" appears in features too, so check for at least 1
    expect(
      screen.getAllByText("AI Advisor").length
    ).toBeGreaterThanOrEqual(1);
    // "Course Catalog" appears in features too
    expect(
      screen.getAllByText("Course Catalog").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders copyright notice", () => {
    renderWithChakra(<LandingPage />);
    const year = new Date().getFullYear();
    expect(
      screen.getAllByText(new RegExp(`© ${year} GradTracker`)).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("FadeIn covers isVisible:true branches when IntersectionObserver fires", async () => {
    vi.useFakeTimers();
    try {
      renderWithChakra(<LandingPage />);
      await act(async () => {
        vi.runAllTimers();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("See How It Works click does not throw when section is absent", () => {
    renderWithChakra(<LandingPage />);
    const btn = screen.getAllByText("See How It Works")[0];
    expect(() => fireEvent.click(btn)).not.toThrow();
  });

  it("See How It Works click calls scrollIntoView when section exists", () => {
    const scrollIntoViewMock = vi.fn();
    const section = document.createElement("div");
    section.id = "how-it-works";
    section.scrollIntoView = scrollIntoViewMock;
    document.body.appendChild(section);
    renderWithChakra(<LandingPage />);
    const btn = screen.getAllByText("See How It Works")[0];
    fireEvent.click(btn);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
    document.body.removeChild(section);
  });

  // --- Images ---

  it("renders campus hero background image", () => {
    renderWithChakra(<LandingPage />);
    const images = screen.getAllByAltText("UW-Parkside Campus aerial view");
    expect(images.length).toBeGreaterThanOrEqual(1);
  });

  it("renders feature screenshot images", () => {
    renderWithChakra(<LandingPage />);
    expect(
      screen.getAllByAltText("Semester Planner").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByAltText("Course Catalog").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByAltText("Programs and Requirements").length
    ).toBeGreaterThanOrEqual(1);
  });
});
