import { render } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { vi } from "vitest";
import React from "react";

/**
 * Render a component wrapped in ChakraProvider for tests.
 */
export function renderWithChakra(ui: React.ReactElement) {
  return render(
    React.createElement(ChakraProvider, { value: defaultSystem }, ui)
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

/**
 * Mock next/navigation module.
 */
export function createMockNavigation(overrides: Record<string, unknown> = {}) {
  return {
    useRouter: () => createMockRouter(),
    useSearchParams: () => ({ get: vi.fn().mockReturnValue(null) }),
    redirect: vi.fn(),
    usePathname: vi.fn().mockReturnValue("/"),
    ...overrides,
  };
}

/**
 * Mock Supabase client with optional auth and from.
 */
export function createMockSupabaseClient(overrides: Record<string, unknown> = {}) {
  return {
    createClient: () => ({
      auth: createMockAuth(),
      from: vi.fn().mockReturnValue(createChainMock()),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "" }, error: null }),
        }),
      },
      ...overrides,
    }),
  };
}

/** Mock toaster with create/success/error methods. */
export function createMockToaster() {
  return { toaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() } };
}

/** Mock next/link as a simple anchor tag. */
export function createMockNextLink() {
  return {
    __esModule: true,
    default: ({ href, children }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href }, children),
  };
}

/** Mock ColorModeButton as null. */
export function createMockColorMode() {
  return { ColorModeButton: () => null };
}

/** Mock Field component for form tests. */
export function createMockField() {
  return {
    Field: ({ label, children }: { label?: string; children?: React.ReactNode }) =>
      React.createElement("div", null, label ? React.createElement("label", null, label) : null, children),
  };
}

/** Mock PasswordInput as a simple password input. */
export function createMockPasswordInput() {
  return {
    PasswordInput: (props: Record<string, unknown>) =>
      React.createElement("input", { type: "password", ...props }),
  };
}
