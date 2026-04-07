import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChainMock } from "../helpers/mocks";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";
import {
  fetchRecentStudentActivity,
  logStudentActivity,
} from "@/lib/supabase/queries/activity";

describe("activity queries", () => {
  let mockFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom = vi.fn();
    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);
  });

  it("fetchRecentStudentActivity returns mapped activity rows", async () => {
    mockFrom.mockReturnValueOnce(
      createChainMock({
        then: (resolve: (v: unknown) => void) =>
          resolve({
            data: [
              {
                id: "1",
                student_id: "7",
                activity_type: "course_added",
                message: "Added CSCI 101 to a semester plan",
                metadata: { course_id: 101 },
                created_at: "2026-04-06T12:00:00.000Z",
              },
            ],
            error: null,
          }),
      })
    );

    const result = await fetchRecentStudentActivity(7, 3);

    expect(mockFrom).toHaveBeenCalledWith("student_activity_log");
    expect(result).toEqual([
      {
        id: 1,
        student_id: 7,
        activity_type: "course_added",
        message: "Added CSCI 101 to a semester plan",
        metadata: { course_id: 101 },
        created_at: "2026-04-06T12:00:00.000Z",
      },
    ]);
  });

  it("fetchRecentStudentActivity normalizes missing and invalid metadata fields", async () => {
    mockFrom.mockReturnValueOnce(
      createChainMock({
        then: (resolve: (v: unknown) => void) =>
          resolve({
            data: [
              {
                id: "2",
                student_id: "7",
                activity_type: "course_removed",
                message: null,
                metadata: ["not-an-object"],
                created_at: null,
              },
            ],
            error: null,
          }),
      })
    );

    const result = await fetchRecentStudentActivity(7);

    expect(result).toEqual([
      {
        id: 2,
        student_id: 7,
        activity_type: "course_removed",
        message: "",
        metadata: {},
        created_at: "",
      },
    ]);
  });

  it("fetchRecentStudentActivity returns an empty array when the database returns null rows", async () => {
    mockFrom.mockReturnValueOnce(
      createChainMock({
        then: (resolve: (v: unknown) => void) =>
          resolve({
            data: null,
            error: null,
          }),
      })
    );

    const result = await fetchRecentStudentActivity(7);

    expect(result).toEqual([]);
  });

  it("fetchRecentStudentActivity throws when the query fails", async () => {
    mockFrom.mockReturnValueOnce(
      createChainMock({
        then: (resolve: (v: unknown) => void) =>
          resolve({
            data: null,
            error: { message: "activity failed" },
          }),
      })
    );

    await expect(fetchRecentStudentActivity(7)).rejects.toEqual({
      message: "activity failed",
    });
  });

  it("logStudentActivity inserts the expected payload", async () => {
    const chain = createChainMock({
      then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce(chain);

    await logStudentActivity(7, "plan_created", "Created plan My Plan", { plan_id: 9 });

    expect(mockFrom).toHaveBeenCalledWith("student_activity_log");
    expect(chain.insert).toHaveBeenCalledWith({
      student_id: 7,
      activity_type: "plan_created",
      message: "Created plan My Plan",
      metadata: { plan_id: 9 },
    });
  });

  it("logStudentActivity uses an empty metadata object by default", async () => {
    const chain = createChainMock({
      then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce(chain);

    await logStudentActivity(4, "major_changed", "Changed major");

    expect(chain.insert).toHaveBeenCalledWith({
      student_id: 4,
      activity_type: "major_changed",
      message: "Changed major",
      metadata: {},
    });
  });

  it("logStudentActivity throws when insert fails", async () => {
    const chain = createChainMock({
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: null, error: { message: "insert failed" } }),
    });
    mockFrom.mockReturnValueOnce(chain);

    await expect(
      logStudentActivity(7, "plan_deleted", "Deleted plan Test Plan", { plan_id: 1 })
    ).rejects.toEqual({ message: "insert failed" });
  });
});
