import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChainMock } from "../../../helpers/mocks";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mockFrom }),
}));

import { fetchRecentStudentActivity, logStudentActivity } from "@/lib/supabase/queries/activity";

function makeChain(data: unknown, error: unknown = null) {
  const chain = createChainMock();
  chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) => r({ data, error }));
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// fetchRecentStudentActivity
// ---------------------------------------------------------------------------

describe("fetchRecentStudentActivity", () => {
  it("returns mapped activity rows", async () => {
    const rows = [
      {
        id: 1,
        student_id: 5,
        activity_type: "course_added",
        message: "Added CSCI 101",
        metadata: { course_id: 101 },
        created_at: "2025-01-01T00:00:00Z",
      },
    ];
    mockFrom.mockReturnValue(makeChain(rows));

    const result = await fetchRecentStudentActivity(5);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 1,
      student_id: 5,
      activity_type: "course_added",
      message: "Added CSCI 101",
      metadata: { course_id: 101 },
      created_at: "2025-01-01T00:00:00Z",
    });
  });

  it("returns empty array when no rows", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    const result = await fetchRecentStudentActivity(5);
    expect(result).toEqual([]);
  });

  it("defaults metadata to {} for non-objects", async () => {
    const rows = [
      {
        id: 2,
        student_id: 5,
        activity_type: "plan_created",
        message: "Created plan",
        metadata: "not-an-object",
        created_at: "2025-02-01",
      },
    ];
    mockFrom.mockReturnValue(makeChain(rows));
    const result = await fetchRecentStudentActivity(5);
    expect(result[0].metadata).toEqual({});
  });

  it("defaults metadata to {} for arrays", async () => {
    const rows = [
      {
        id: 3,
        student_id: 5,
        activity_type: "plan_deleted",
        message: "Deleted plan",
        metadata: [1, 2, 3],
        created_at: "2025-03-01",
      },
    ];
    mockFrom.mockReturnValue(makeChain(rows));
    const result = await fetchRecentStudentActivity(5);
    expect(result[0].metadata).toEqual({});
  });

  it("throws when query errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("db error") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(fetchRecentStudentActivity(5)).rejects.toThrow("db error");
  });

  it("uses default limit of 5", async () => {
    mockFrom.mockReturnValue(makeChain([]));
    await fetchRecentStudentActivity(5);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it("respects custom limit", async () => {
    mockFrom.mockReturnValue(makeChain([]));
    await fetchRecentStudentActivity(5, 10);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.limit).toHaveBeenCalledWith(10);
  });
});

// ---------------------------------------------------------------------------
// logStudentActivity
// ---------------------------------------------------------------------------

describe("logStudentActivity", () => {
  it("inserts activity row successfully", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await expect(logStudentActivity(5, "course_added", "Added CSCI 101", { course_id: 101 })).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith("student_activity_log");
  });

  it("defaults metadata to empty object", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    await expect(logStudentActivity(5, "plan_created", "Created plan")).resolves.toBeUndefined();
  });

  it("throws when insert errors", async () => {
    const chain = createChainMock();
    chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
      r({ data: null, error: new Error("insert fail") })
    );
    mockFrom.mockReturnValue(chain);
    await expect(logStudentActivity(5, "course_removed", "Removed course")).rejects.toThrow("insert fail");
  });
});
