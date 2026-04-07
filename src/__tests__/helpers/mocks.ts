import { render } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { vi } from "vitest";
import React from "react";

/**
 * Render a component wrapped in ChakraProvider for tests.
 */
export function renderWithChakra(ui: React.ReactElement) {
  return render(
    React.createElement(ChakraProvider, {
      value: defaultSystem,
      children: ui,
    })
  );
}

/**
 * Create a Supabase query chain mock where every method returns `this`
 * so you can chain .select().eq().order() etc.
 * Pass overrides to customize terminal methods (e.g. `.single`, `.maybeSingle`, `.order`).
 */
export function createChainMock(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  // Make chain itself thenable so `await supabase.from(...).select(...)` works
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
    resolve({ data: [], error: null })
  );
  Object.assign(chain, overrides);
  return chain;
}

/**
 * Mock next/navigation router object.
 */
export function createMockRouter() {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  };
}

/**
 * Mock Supabase auth object with common methods.
 */
export function createMockAuth(overrides: Record<string, unknown> = {}) {
  return {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    ...overrides,
  };
}
