import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

/* ---------------- HOISTED MOCKS ---------------- */

// ✅ Corrected pattern: store vi.fn() in a variable first,
//    then reference it inside vi.mock — never cast createClient directly.
const mockCreateClient = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/components/ui/progress", () => ({
  ProgressRoot: ({ children }: any) => <div data-testid="progress-root">{children}</div>,
  ProgressBar: () => <div data-testid="progress-bar" />,
}));

import AIAdvisorPage from "@/app/dashboard/ai-advisor/page";

/* ---------------- HELPERS ---------------- */

function renderPage() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AIAdvisorPage />
    </ChakraProvider>
  );
}

/* ---------------- TESTS ---------------- */

describe("AIAdvisorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // ✅ mockReturnValue works because mockCreateClient IS a vi.fn()
    mockCreateClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    });
  });

  /* ---- Page structure ---- */

  it("renders without crashing", () => {
    renderPage();
  });

  it("shows the page heading and Beta badge", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /AI Academic Advisor/i })).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("shows the online status bar", () => {
    renderPage();
    expect(screen.getByText(/AI Advisor is online/i)).toBeInTheDocument();
  });

  it("shows the design mockup disclaimer", () => {
    renderPage();
    expect(screen.getByText(/design mockup/i)).toBeInTheDocument();
  });

  /* ---- Conversation messages ---- */

  it("shows the AI greeting message", () => {
    renderPage();
    expect(screen.getByText(/I'm your AI Academic Advisor/i)).toBeInTheDocument();
  });

  it("shows user question about next semester courses", () => {
    renderPage();
    expect(
      screen.getByText(/What courses should I take next semester\?/i)
    ).toBeInTheDocument();
  });

  it("shows AI course recommendations", () => {
    renderPage();
    expect(screen.getByText("CSCI 340")).toBeInTheDocument();
    expect(screen.getByText("CSCI 361")).toBeInTheDocument();
    expect(screen.getByText("MATH 280")).toBeInTheDocument();
  });

  it("shows user question about CSCI 340 prerequisite", () => {
    renderPage();
    expect(
      screen.getByText(/Can I take CSCI 340 without the prerequisite\?/i)
    ).toBeInTheDocument();
  });

  it("shows AI prereq warning mentioning CSCI 240", () => {
    renderPage();
    expect(screen.getByText(/CSCI 240/i)).toBeInTheDocument();
    expect(screen.getByText(/Most departments enforce this/i)).toBeInTheDocument();
  });

  it("shows the third user message about remaining credits", () => {
    renderPage();
    expect(
      screen.getByText(/How many more credits do I need to graduate\?/i)
    ).toBeInTheDocument();
  });

  it("renders the typing indicator with three dots", () => {
    renderPage();
    const dots = document.querySelectorAll(".typing-dot");
    expect(dots).toHaveLength(3);
  });

  it("renders AI Advisor label for each AI turn", () => {
    renderPage();
    // greeting + course rec + prereq explanation + typing = 4 AI turns
    expect(screen.getAllByText("AI Advisor").length).toBeGreaterThanOrEqual(4);
  });

  it("renders You label for each user turn", () => {
    renderPage();
    expect(screen.getAllByText("You")).toHaveLength(3);
  });

  /* ---- Prompt chips ---- */

  it("renders all four suggested prompt chips", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /What should I take next\?/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Am I on track to graduate\?/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Show my remaining requirements/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /What are my prerequisites\?/i })
    ).toBeInTheDocument();
  });

  /* ---- Input area ---- */

  it("renders the message input with the correct placeholder", () => {
    renderPage();
    expect(
      screen.getByPlaceholderText(/Ask about courses, requirements, or your degree plan/i)
    ).toBeInTheDocument();
  });

  it("renders the send button", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  /* ---- Context sidebar ---- */

  it("shows student name in the context panel", () => {
    renderPage();
    expect(screen.getByText("Alex Johnson")).toBeInTheDocument();
  });

  it("shows the program name", () => {
    renderPage();
    expect(screen.getByText("B.S. Computer Science")).toBeInTheDocument();
  });

  it("shows the expected graduation badge", () => {
    renderPage();
    expect(screen.getByText("May 2026")).toBeInTheDocument();
  });

  it("shows the credit progress heading and 78 / 120 badge", () => {
    renderPage();
    expect(screen.getByText(/Credit Progress/i)).toBeInTheDocument();
    expect(screen.getByText("78 / 120")).toBeInTheDocument();
  });

  it("shows all four credit category labels", () => {
    renderPage();
    expect(screen.getByText("Major Core")).toBeInTheDocument();
    expect(screen.getByText("Major Electives")).toBeInTheDocument();
    expect(screen.getByText("General Education")).toBeInTheDocument();
    expect(screen.getByText("Free Electives")).toBeInTheDocument();
  });

  it("shows this semester stats", () => {
    renderPage();
    expect(screen.getByText(/This Semester/i)).toBeInTheDocument();
    expect(screen.getByText("4 courses")).toBeInTheDocument();
    expect(screen.getByText("12 cr")).toBeInTheDocument();
    expect(screen.getByText("3 semesters")).toBeInTheDocument();
  });
});
