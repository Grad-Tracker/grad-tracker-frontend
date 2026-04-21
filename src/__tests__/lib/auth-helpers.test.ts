import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignOut = vi.hoisted(() => vi.fn());
const mockToasterCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: { signOut: mockSignOut },
  })),
}));

vi.mock("@/components/ui/toaster", () => ({
  toaster: { create: mockToasterCreate },
}));

import { signOutAndRedirect } from "@/lib/auth-helpers";

describe("signOutAndRedirect", () => {
  let push: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    push = vi.fn();
  });

  it("calls signOut, shows success toast, and redirects to /signin", async () => {
    mockSignOut.mockResolvedValue({ error: null });

    await signOutAndRedirect(push);

    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(mockToasterCreate).toHaveBeenCalledWith({
      title: "Signed out",
      description: "You've been signed out successfully.",
      type: "success",
    });
    expect(push).toHaveBeenCalledWith("/signin");
  });

  it("shows error toast and does NOT redirect when signOut fails", async () => {
    const error = { message: "Network error" };
    mockSignOut.mockResolvedValue({ error });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await signOutAndRedirect(push);

    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(consoleSpy).toHaveBeenCalledWith("Sign-out error:", error);
    expect(mockToasterCreate).toHaveBeenCalledWith({
      title: "Sign-out failed",
      description: "Network error",
      type: "error",
    });
    expect(push).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
