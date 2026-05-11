import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useUserProfile } from "@/lib/hooks/useUserProfile";

const { mockMaybeSingle, mockCreateSignedUrl, mockGetUser } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: mockMaybeSingle,
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);

  return {
    createClient: vi.fn(() => ({
      auth: { getUser: mockGetUser },
      from: vi.fn().mockReturnValue(chain),
      storage: { from: vi.fn().mockReturnValue({ createSignedUrl: mockCreateSignedUrl }) },
    })),
  };
});

const fakeUser = {
  id: "user-1",
  user_metadata: { first_name: "Jane", last_name: "Doe" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: fakeUser } });
  mockMaybeSingle.mockResolvedValue({ data: null });
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: "https://example.com/avatar.jpg" }, error: null });
});

describe("useUserProfile", () => {
  it("handles no user — sets loading false and empty names", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { result } = renderHook(() => useUserProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userName).toBe("");
    expect(result.current.avatarUrl).toBe("");
  });

  it("loads student name and avatar URL when student has avatar_path", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { first_name: "Alice", last_name: "Smith", avatar_path: "alice.jpg" },
    });
    const { result } = renderHook(() => useUserProfile({ includeAvatar: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userName).toBe("Alice Smith");
    expect(result.current.avatarUrl).toBe("https://example.com/avatar.jpg");
  });

  it("sets avatarUrl to empty when createSignedUrl throws for student", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { first_name: "Bob", last_name: "Jones", avatar_path: "bob.jpg" },
    });
    mockCreateSignedUrl.mockRejectedValueOnce(new Error("Storage error"));
    const { result } = renderHook(() => useUserProfile({ includeAvatar: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.avatarUrl).toBe("");
    expect(result.current.userName).toBe("Bob Jones");
  });

  it("falls back to staff table when no student found", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { first_name: "Carol", last_name: "Brown", avatar_path: null } });
    const { result } = renderHook(() => useUserProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userName).toBe("Carol Brown");
  });

  it("loads staff avatar URL when staff has avatar_path and includeAvatar is true", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { first_name: "Dave", last_name: "Lee", avatar_path: "dave.jpg" } });
    const { result } = renderHook(() => useUserProfile({ includeAvatar: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.avatarUrl).toBe("https://example.com/avatar.jpg");
  });

  it("sets avatarUrl to empty when createSignedUrl throws for staff", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { first_name: "Eve", last_name: "Fox", avatar_path: "eve.jpg" } });
    mockCreateSignedUrl.mockRejectedValueOnce(new Error("Storage error"));
    const { result } = renderHook(() => useUserProfile({ includeAvatar: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.avatarUrl).toBe("");
    expect(result.current.userName).toBe("Eve Fox");
  });

  it("throws when createSignedUrl returns an error object (line 34 branch)", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { first_name: "Frank", last_name: "Green", avatar_path: "frank.jpg" },
    });
    mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: new Error("signed url error") });
    const { result } = renderHook(() => useUserProfile({ includeAvatar: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.avatarUrl).toBe("");
  });

  it("handles null user_metadata gracefully (line 49 ?? branch)", async () => {
    const userNoMeta = { id: "user-2", user_metadata: null };
    mockGetUser.mockResolvedValue({ data: { user: userNoMeta } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { first_name: "Grace", last_name: "Hill", avatar_path: null },
    });
    const { result } = renderHook(() => useUserProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userName).toBe("Grace Hill");
  });

  it("falls back to user_metadata name when student has empty names (line 68 || branch)", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { first_name: null, last_name: null, avatar_path: null },
    });
    const { result } = renderHook(() => useUserProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userName).toBe("Jane Doe");
  });

  it("falls back to user_metadata name when staff has empty names (line 93 || branch)", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { first_name: null, last_name: null, avatar_path: null } });
    const { result } = renderHook(() => useUserProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userName).toBe("Jane Doe");
  });
});
