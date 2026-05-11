import { describe, expect, it, vi } from "vitest";
import { fetchGenEdBucketsWithCourses } from "@/lib/supabase/queries/gen-ed";

function chain(data: unknown, error: unknown = null) {
  const c: any = {};
  c.select = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.in = vi.fn().mockReturnValue(c);
  c.then = (resolve: any) => resolve({ data, error });
  return c;
}

describe("fetchGenEdBucketsWithCourses", () => {
  it("loads buckets and returns sorted bucket courses", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(
        chain([{ id: 1, code: "HUM", name: "Humanities", credits_required: 6 }])
      )
      .mockReturnValueOnce(chain([{ bucket_id: 1, course_id: 10 }, { bucket_id: 1, course_id: 11 }]))
      .mockReturnValueOnce(
        chain([
          { id: 10, subject: "ENGL", number: "101", title: "Writing", credits: 3 },
          { id: 11, subject: "HIST", number: "102", title: "World", credits: 3 },
        ])
      );

    const result = await fetchGenEdBucketsWithCourses({ from } as any);
    expect(result).toHaveLength(1);
    expect(result[0].credits_required).toBe(6);
    expect(result[0].courses).toHaveLength(2);
    expect(result[0].courses[0].id).toBe(10);
    expect(from).toHaveBeenCalledTimes(3);
  });

  it("skips bucket name ordering when orderByName is false", async () => {
    const bucketChain = chain([{ id: 1, code: "HUM", name: "Humanities", credits_required: null }]);
    const mappingChain = chain([]);
    const from = vi.fn().mockReturnValueOnce(bucketChain).mockReturnValueOnce(mappingChain);

    const result = await fetchGenEdBucketsWithCourses({ from } as any, { orderByName: false });

    expect(bucketChain.order).not.toHaveBeenCalled();
    expect(result[0].credits_required).toBe(12);
  });

  it("throws on bucket query error", async () => {
    const from = vi.fn().mockReturnValueOnce(chain(null, { message: "buckets failed" }));

    await expect(fetchGenEdBucketsWithCourses({ from } as any)).rejects.toThrow(
      "Failed to load Gen-Ed buckets: buckets failed"
    );
  });

  it("throws on mappings query error", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(chain([{ id: 1, code: "HUM", name: "Humanities", credits_required: 6 }]))
      .mockReturnValueOnce(chain(null, { message: "mappings failed" }));

    await expect(fetchGenEdBucketsWithCourses({ from } as any)).rejects.toThrow(
      "Failed to load Gen-Ed bucket courses: mappings failed"
    );
  });

  it("throws on courses query error when mappings contain course ids", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(chain([{ id: 1, code: "HUM", name: "Humanities", credits_required: 6 }]))
      .mockReturnValueOnce(chain([{ bucket_id: 1, course_id: 10 }]))
      .mockReturnValueOnce(chain(null, { message: "courses failed" }));

    await expect(fetchGenEdBucketsWithCourses({ from } as any)).rejects.toThrow(
      "Failed to load Gen-Ed courses: courses failed"
    );
  });
});
