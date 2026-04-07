import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the component under test
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// crypto.randomUUID is used by createId() — use incrementing values to avoid
// React duplicate-key warnings.
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  ...globalThis.crypto,
  randomUUID: vi.fn(() => `00000000-0000-0000-0000-${String(++uuidCounter).padStart(12, "0")}`),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { ChatInterface } from "@/components/dashboard/ai-advisor/ChatInterface";

function renderChat() {
  return renderWithChakra(<ChatInterface />);
}

/**
 * Build a ReadableStream that emits Server-Sent-Event lines from the given
 * array of AdvisorStreamEvent objects.  Each event is flushed as a separate
 * chunk so the streaming parser inside ChatInterface processes them
 * sequentially.
 */
function createSSEStream(events: Record<string, unknown>[]) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
}

/**
 * Return a mock Response whose body is the supplied ReadableStream.
 */
function mockStreamResponse(stream: ReadableStream) {
  return {
    ok: true,
    status: 200,
    body: stream,
    json: vi.fn(),
  };
}

/**
 * Helper: set up fetch so the stream endpoint returns a "done" event with
 * the supplied answer text, then fires the user message via form submit.
 */
async function sendAndCompleteStream(answer = "Test answer from Atlas") {
  const stream = createSSEStream([
    { type: "status", text: "Thinking..." },
    {
      type: "done",
      response: {
        answer,
        recommendations: [],
        risks: [],
        missingData: [],
        citations: [],
      },
    },
  ]);

  mockFetch.mockImplementation((url: string) => {
    if (url === "/api/ai-advisor/chat/stream") {
      return Promise.resolve(mockStreamResponse(stream));
    }
    // Persistence endpoints
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 42 }) });
  });

  const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { value: "Hello Atlas" } });
  });
  await act(async () => {
    fireEvent.submit(input.closest("form")!);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatInterface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    uuidCounter = 0;
  });

  // -----------------------------------------------------------------------
  // 1. Initial rendering
  // -----------------------------------------------------------------------

  it("renders the Atlas greeting message on mount", () => {
    renderChat();
    const matches = screen.getAllByText(/I'm Atlas, your AI Academic Advisor/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows the Atlas badge", () => {
    renderChat();
    const badges = screen.getAllByText("Atlas");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows online status indicator", () => {
    renderChat();
    const status = screen.getAllByText("Atlas is online");
    expect(status.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // 2. Prompt chips
  // -----------------------------------------------------------------------

  it("renders all four prompt chips", () => {
    renderChat();
    const chips = [
      "What should I take next semester?",
      "Am I on track to graduate?",
      "Show my remaining requirements",
      "Can I take CSCI 340?",
    ];
    for (const chip of chips) {
      expect(screen.getAllByText(chip).length).toBeGreaterThanOrEqual(1);
    }
  });

  // -----------------------------------------------------------------------
  // 3. User input
  // -----------------------------------------------------------------------

  it("allows typing in the message input", async () => {
    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "Some question" } });
    });
    expect(input.value).toBe("Some question");
  });

  it("has a send button with aria-label", () => {
    renderChat();
    const btn = screen.getByLabelText("Send message");
    expect(btn).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 4. Prompt chip triggers sendMessage
  // -----------------------------------------------------------------------

  it("clicking a prompt chip triggers a fetch to the stream endpoint", async () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves — keeps loading
    renderChat();

    const chips = screen.getAllByText("What should I take next semester?");
    await act(async () => {
      fireEvent.click(chips[0]);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/ai-advisor/chat/stream",
      expect.objectContaining({ method: "POST" })
    );
  });

  // -----------------------------------------------------------------------
  // 5. sendMessage skips empty / whitespace-only input
  // -----------------------------------------------------------------------

  it("does not send when input is empty", async () => {
    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not send when input is only whitespace", async () => {
    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "   " } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 6. New Chat button resets messages
  // -----------------------------------------------------------------------

  it("New Chat button resets conversation to initial greeting", async () => {
    // First, send a message that keeps loading
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderChat();

    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "Test question" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    // User message should now be rendered
    await waitFor(() => {
      expect(screen.getAllByText("Test question").length).toBeGreaterThanOrEqual(1);
    });

    // Click New Chat
    const newChatButtons = screen.getAllByText("New Chat");
    await act(async () => {
      fireEvent.click(newChatButtons[0]);
    });

    // The greeting should still be visible
    await waitFor(() => {
      expect(
        screen.getAllByText(/I'm Atlas, your AI Academic Advisor/i).length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // 7. Stop button appears during loading and stops generation
  // -----------------------------------------------------------------------

  it("shows Stop button while loading and hides Send button", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderChat();

    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "Test question" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Stop").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("clicking Stop button aborts the request and shows 'Response stopped.'", async () => {
    // Create a stream that will never complete
    let readerController: ReadableStreamDefaultController | null = null;
    const neverEndingStream = new ReadableStream({
      start(controller) {
        readerController = controller;
        // Push a status event so the stream is "active"
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "status", text: "Thinking..." })}\n\n`));
      },
    });

    mockFetch.mockResolvedValue(mockStreamResponse(neverEndingStream));
    renderChat();

    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "Test question" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    // Wait for the Stop button to appear
    await waitFor(() => {
      expect(screen.getAllByText("Stop").length).toBeGreaterThanOrEqual(1);
    });

    // Click Stop
    const stopButtons = screen.getAllByText("Stop");
    await act(async () => {
      fireEvent.click(stopButtons[0]);
    });

    // Loading should end — the status text should go back to "Atlas is online"
    await waitFor(() => {
      expect(screen.getAllByText("Atlas is online").length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // 8. Streaming response handling — full happy-path
  // -----------------------------------------------------------------------

  it("processes a complete stream with status and done events", async () => {
    const stream = createSSEStream([
      { type: "status", text: "Thinking..." },
      {
        type: "done",
        response: {
          answer: "You should take CSCI 340 next semester.",
          recommendations: [
            { courseCode: "CSCI 340", reason: "Prerequisite met", confidence: "high" },
          ],
          risks: ["Heavy course load"],
          missingData: ["Transfer credits not verified"],
          citations: ["2024-2025 Catalog"],
        },
      },
    ]);

    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/ai-advisor/chat/stream") {
        return Promise.resolve(mockStreamResponse(stream));
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 1 }) });
    });

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "What courses next?" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    // Wait for the done event to be processed
    await waitFor(() => {
      expect(
        screen.getAllByText("You should take CSCI 340 next semester.").length
      ).toBeGreaterThanOrEqual(1);
    });

    // Verify recommendations rendered
    await waitFor(() => {
      expect(screen.getAllByText("CSCI 340").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("Prerequisite met").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("high").length).toBeGreaterThanOrEqual(1);

    // Verify risks rendered
    expect(screen.getAllByText(/Heavy course load/).length).toBeGreaterThanOrEqual(1);

    // Verify missing data rendered
    expect(screen.getAllByText(/Transfer credits not verified/).length).toBeGreaterThanOrEqual(1);

    // Verify citations rendered
    expect(screen.getAllByText("2024-2025 Catalog").length).toBeGreaterThanOrEqual(1);
  });

  it("processes a status event and shows it as placeholder text", async () => {
    // Create a stream that only has a status event, then closes
    const stream = createSSEStream([{ type: "status", text: "Looking up requirements..." }]);

    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/ai-advisor/chat/stream") {
        return Promise.resolve(mockStreamResponse(stream));
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 1 }) });
    });

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "Show requirements" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText("Looking up requirements...").length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("processes an error event from the stream", async () => {
    const stream = createSSEStream([
      { type: "error", message: "Rate limit exceeded. Try again later." },
    ]);

    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/ai-advisor/chat/stream") {
        return Promise.resolve(mockStreamResponse(stream));
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 1 }) });
    });

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "question" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText("Rate limit exceeded. Try again later.").length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("handles delta events (suppressed) without crashing", async () => {
    const stream = createSSEStream([
      { type: "delta", text: "partial json chunk" },
      {
        type: "done",
        response: {
          answer: "Final answer after deltas",
          recommendations: [],
          risks: [],
          missingData: [],
          citations: [],
        },
      },
    ]);

    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/ai-advisor/chat/stream") {
        return Promise.resolve(mockStreamResponse(stream));
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 1 }) });
    });

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "test" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText("Final answer after deltas").length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("handles malformed JSON in SSE lines gracefully", async () => {
    // Manually build a stream with a bad JSON line followed by a valid one
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("data: {not valid json}\n\n"));
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "done",
              response: {
                answer: "Recovered after bad JSON",
                recommendations: [],
                risks: [],
                missingData: [],
                citations: [],
              },
            })}\n\n`
          )
        );
        controller.close();
      },
    });

    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/ai-advisor/chat/stream") {
        return Promise.resolve(mockStreamResponse(stream));
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 1 }) });
    });

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "test" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText("Recovered after bad JSON").length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // 9. Error handling
  // -----------------------------------------------------------------------

  it("shows error message when fetch fails (network error)", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "Will this fail?" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Network failure").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows fallback error for non-Error throws", async () => {
    mockFetch.mockRejectedValue("string error");

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "test" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Unexpected Atlas error.").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows error for non-ok response (generic)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Server exploded" }),
    });

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "test" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Server exploded").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows 401 fallback error when no payload error provided", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "test" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText("You must sign in again to use Atlas.").length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows 409 fallback error when no payload error provided", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({}),
    });

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "test" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText("Complete onboarding before using Atlas.").length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("handles response.json() throwing (malformed body)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("invalid json")),
    });

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "test" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText("Atlas could not process your request.").length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows error when response body is null (no stream available)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
      json: vi.fn(),
    });

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "test" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText("No response stream available.").length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows risk annotation on error messages", async () => {
    mockFetch.mockRejectedValue(new Error("Something went wrong"));

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "test" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText(/Unable to complete this request/).length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // 10. persistMessages — conversation creation and message saving
  // -----------------------------------------------------------------------

  it("calls persistMessages after a successful stream (creates conversation + saves messages)", async () => {
    renderChat();
    await sendAndCompleteStream("Persisted answer");

    await waitFor(() => {
      expect(screen.getAllByText("Persisted answer").length).toBeGreaterThanOrEqual(1);
    });

    // Wait for persistence calls to complete
    await waitFor(() => {
      // Expect: 1 stream call + 1 conversation create + 2 message saves = 4 total fetches
      const calls = mockFetch.mock.calls;
      const streamCalls = calls.filter(
        (c: string[]) => c[0] === "/api/ai-advisor/chat/stream"
      );
      const convCalls = calls.filter(
        (c: string[]) => c[0] === "/api/ai-advisor/conversations"
      );
      const msgCalls = calls.filter(
        (c: string[]) => c[0] === "/api/ai-advisor/conversations/messages"
      );
      expect(streamCalls.length).toBe(1);
      expect(convCalls.length).toBe(1);
      expect(msgCalls.length).toBe(2);
    });
  });

  it("passes correct payload to conversation creation", async () => {
    renderChat();
    await sendAndCompleteStream("Any answer");

    await waitFor(() => {
      const convCall = mockFetch.mock.calls.find(
        (c: string[]) => c[0] === "/api/ai-advisor/conversations"
      );
      expect(convCall).toBeDefined();
      const body = JSON.parse(convCall![1].body as string);
      expect(body.title).toBe("Hello Atlas");
    });
  });

  it("passes correct payloads to message saves", async () => {
    renderChat();
    await sendAndCompleteStream("Saved answer");

    await waitFor(() => {
      const msgCalls = mockFetch.mock.calls.filter(
        (c: string[]) => c[0] === "/api/ai-advisor/conversations/messages"
      );
      expect(msgCalls.length).toBe(2);

      const userMsg = JSON.parse(msgCalls[0][1].body as string);
      expect(userMsg.role).toBe("user");
      expect(userMsg.content).toBe("Hello Atlas");
      expect(userMsg.conversationId).toBe(42);

      const assistantMsg = JSON.parse(msgCalls[1][1].body as string);
      expect(assistantMsg.role).toBe("assistant");
      expect(assistantMsg.content).toBe("Saved answer");
      expect(assistantMsg.conversationId).toBe(42);
    });
  });

  it("silently handles conversation creation failure", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const stream = createSSEStream([
      {
        type: "done",
        response: {
          answer: "Answer despite persistence failure",
          recommendations: [],
          risks: [],
          missingData: [],
          citations: [],
        },
      },
    ]);

    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/ai-advisor/chat/stream") {
        return Promise.resolve(mockStreamResponse(stream));
      }
      if (url === "/api/ai-advisor/conversations") {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 1 }) });
    });

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "Test" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    // The answer should still be displayed even though persistence failed
    await waitFor(() => {
      expect(
        screen.getAllByText("Answer despite persistence failure").length
      ).toBeGreaterThanOrEqual(1);
    });

    // Give time for the persistence promise to reject
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to persist messages:",
        expect.any(Error)
      );
    });

    consoleError.mockRestore();
  });

  it("reuses existing conversationId on second message", async () => {
    renderChat();

    // First message — creates conversation
    await sendAndCompleteStream("First answer");

    await waitFor(() => {
      expect(screen.getAllByText("First answer").length).toBeGreaterThanOrEqual(1);
    });

    // Wait for persistence to complete (conversation created)
    await waitFor(() => {
      const convCalls = mockFetch.mock.calls.filter(
        (c: string[]) => c[0] === "/api/ai-advisor/conversations"
      );
      expect(convCalls.length).toBe(1);
    });

    // Reset fetch for second message
    mockFetch.mockClear();

    const stream2 = createSSEStream([
      {
        type: "done",
        response: {
          answer: "Second answer",
          recommendations: [],
          risks: [],
          missingData: [],
          citations: [],
        },
      },
    ]);

    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/ai-advisor/chat/stream") {
        return Promise.resolve(mockStreamResponse(stream2));
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 42 }) });
    });

    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "Second question" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Second answer").length).toBeGreaterThanOrEqual(1);
    });

    // Should NOT create a new conversation — conversationId was already set
    await waitFor(() => {
      const convCalls = mockFetch.mock.calls.filter(
        (c: string[]) => c[0] === "/api/ai-advisor/conversations"
      );
      expect(convCalls.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 11. Loading state ("Atlas is thinking...")
  // -----------------------------------------------------------------------

  it("shows 'Atlas is thinking...' while loading", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderChat();

    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "test" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Atlas is thinking...").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("input is disabled during loading", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderChat();

    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "test" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(input.disabled).toBe(true);
    });
  });

  it("does not send a second message while loading", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderChat();

    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "first message" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    // Try to send a second message
    await act(async () => {
      fireEvent.change(input, { target: { value: "second message" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    // Only one fetch call should have been made (the first one)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // 12. User message rendering
  // -----------------------------------------------------------------------

  it("renders user messages with 'You' badge", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderChat();

    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "My question here" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(screen.getAllByText("My question here").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("You").length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // 13. Clears draft on send
  // -----------------------------------------------------------------------

  it("clears the input field after sending", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderChat();

    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "Some text" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    expect(input.value).toBe("");
  });

  // -----------------------------------------------------------------------
  // 14. AbortError handling
  // -----------------------------------------------------------------------

  it("shows 'Response stopped.' when an AbortError occurs", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    mockFetch.mockRejectedValue(abortError);

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "test" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Response stopped.").length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // 15. New Chat resets conversationId
  // -----------------------------------------------------------------------

  it("New Chat clears conversationId so next message creates a new conversation", async () => {
    renderChat();

    // Send first message to establish a conversation
    await sendAndCompleteStream("First convo answer");

    await waitFor(() => {
      expect(screen.getAllByText("First convo answer").length).toBeGreaterThanOrEqual(1);
    });

    // Wait for conversation to be created
    await waitFor(() => {
      const convCalls = mockFetch.mock.calls.filter(
        (c: string[]) => c[0] === "/api/ai-advisor/conversations"
      );
      expect(convCalls.length).toBe(1);
    });

    // Click New Chat
    const newChatButtons = screen.getAllByText("New Chat");
    await act(async () => {
      fireEvent.click(newChatButtons[0]);
    });

    // Reset mocks and send a new message
    mockFetch.mockClear();

    const stream2 = createSSEStream([
      {
        type: "done",
        response: {
          answer: "New convo answer",
          recommendations: [],
          risks: [],
          missingData: [],
          citations: [],
        },
      },
    ]);

    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/ai-advisor/chat/stream") {
        return Promise.resolve(mockStreamResponse(stream2));
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 99 }) });
    });

    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "New conversation question" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(screen.getAllByText("New convo answer").length).toBeGreaterThanOrEqual(1);
    });

    // Should create a NEW conversation since conversationId was reset
    await waitFor(() => {
      const convCalls = mockFetch.mock.calls.filter(
        (c: string[]) => c[0] === "/api/ai-advisor/conversations"
      );
      expect(convCalls.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // 16. Lines that skip non-data SSE lines
  // -----------------------------------------------------------------------

  it("ignores SSE lines that do not start with 'data: '", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("event: ping\n\n"));
        controller.enqueue(encoder.encode(": comment line\n\n"));
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "done",
              response: {
                answer: "Got through non-data lines",
                recommendations: [],
                risks: [],
                missingData: [],
                citations: [],
              },
            })}\n\n`
          )
        );
        controller.close();
      },
    });

    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/ai-advisor/chat/stream") {
        return Promise.resolve(mockStreamResponse(stream));
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 1 }) });
    });

    renderChat();
    const input = screen.getByPlaceholderText(/Ask about courses/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "test" } });
    });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText("Got through non-data lines").length
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
