import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ChatInterface } from "@/components/dashboard/ai-advisor/ChatInterface";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderChat() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <ChatInterface />
    </ChakraProvider>
  );
}

describe("ChatInterface", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the Atlas welcome message", () => {
    renderChat();
    const matches = screen.getAllByText(/Atlas/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("renders prompt chips", () => {
    renderChat();
    expect(screen.getAllByText("What should I take next semester?").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Am I on track to graduate?").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Show my remaining requirements").length).toBeGreaterThan(0);
  });

  it("shows the input field", () => {
    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i);
    expect(input).toBeDefined();
  });

  it("disables input while loading", async () => {
    // Mock a fetch that never resolves to keep loading state
    mockFetch.mockReturnValue(new Promise(() => {}));

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Test question" } });
    fireEvent.submit(input.closest("form")!);

    expect(input.disabled).toBe(true);
  });

  it("shows New Chat button", () => {
    renderChat();
    expect(screen.getAllByText("New Chat").length).toBeGreaterThan(0);
  });
});
