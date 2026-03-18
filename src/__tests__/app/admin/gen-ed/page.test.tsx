import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

type BucketRow = {
  id: number;
  code: string | null;
  name: string;
  credits_required: number;
};

type MappingRow = {
  bucket_id: number;
  course_id: number;
};

type CourseRow = {
  id: number;
  subject: string | null;
  number: string | null;
  title: string | null;
  credits: number | null;
};

const {
  mockServerFrom,
  mockClientFrom,
  mockToaster,
  mockRouter,
  mockServerGetUser,
  mockRedirect,
} = vi.hoisted(() => ({
  mockServerFrom: vi.fn(),
  mockClientFrom: vi.fn(),
  mockToaster: { create: vi.fn() },
  mockRouter: {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  },
  mockServerGetUser: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@chakra-ui/react", async () => {
  const actual = await vi.importActual<typeof import("@chakra-ui/react")>("@chakra-ui/react");
  return {
    ...actual,
    Dialog: {
      ...actual.Dialog,
      Root: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
        open ? <>{children}</> : null,
      Backdrop: ({ children }: any) => <div>{children}</div>,
      Positioner: ({ children }: any) => <div>{children}</div>,
      Content: ({ children }: any) => <div>{children}</div>,
      Header: ({ children }: any) => <div>{children}</div>,
      Title: ({ children }: any) => <div>{children}</div>,
      Body: ({ children }: any) => <div>{children}</div>,
      Footer: ({ children }: any) => <div>{children}</div>,
    },
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  redirect: mockRedirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: mockServerGetUser,
    },
    from: mockServerFrom,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: mockClientFrom,
  }),
}));

vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children, content }: any) => (
    <div>
      {children}
      <div>{content}</div>
    </div>
  ),
}));

import AdminGenEdPage from "@/app/admin/(protected)/gen-ed/page";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

function makeAwaitable(result: unknown) {
  return {
    then: (resolve: (value: unknown) => void, reject?: (reason: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };
}

describe("/admin/gen-ed page", () => {
  let bucketsState: BucketRow[];
  let mappingsState: MappingRow[];
  let coursesState: CourseRow[];
  let insertBucketSpy: ReturnType<typeof vi.fn>;
  let updateBucketSpy: ReturnType<typeof vi.fn>;
  let updateBucketEqSpy: ReturnType<typeof vi.fn>;
  let deleteBucketEqSpy: ReturnType<typeof vi.fn>;
  let deleteMappingBucketEqSpy: ReturnType<typeof vi.fn>;
  let deleteMappingCourseEqSpy: ReturnType<typeof vi.fn>;
  let insertMappingsSpy: ReturnType<typeof vi.fn>;
  let nextBucketId: number;

  function getBucketCard(name: string) {
    const title = screen.getByText(name);
    let node: HTMLElement | null = title.parentElement;

    while (node) {
      if (within(node).queryByRole("button", { name: /^edit$/i })) {
        return node;
      }
      node = node.parentElement;
    }

    throw new Error(`Could not find bucket card for ${name}`);
  }

  function getCourseRow(label: RegExp | string) {
    const courseText = screen.getByText(label);
    let node: HTMLElement | null = courseText.parentElement;

    while (node) {
      if (within(node).queryByRole("button", { name: /remove/i })) {
        return node;
      }
      node = node.parentElement;
    }

    throw new Error(`Could not find course row for ${String(label)}`);
  }

  function installSupabaseMocks() {
    mockServerFrom.mockImplementation((table: string) => {
      if (table === "gen_ed_buckets") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [...bucketsState].sort((a, b) => a.name.localeCompare(b.name)),
              error: null,
            }),
          }),
        };
      }

      if (table === "gen_ed_bucket_courses") {
        return {
          select: vi.fn().mockResolvedValue({
            data: mappingsState.map((mapping) => ({ ...mapping })),
            error: null,
          }),
        };
      }

      if (table === "courses") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn((column: string, ids: number[]) =>
              Promise.resolve({
                data: coursesState
                  .filter((course) => column === "id" && ids.includes(course.id))
                  .map((course) => ({ ...course })),
                error: null,
              })
            ),
          }),
        };
      }

      throw new Error(`Unexpected server table ${table}`);
    });

    insertBucketSpy = vi.fn(async (payload: { code: string | null; name: string; credits_required: number }) => {
      bucketsState.push({
        id: nextBucketId++,
        code: payload.code,
        name: payload.name,
        credits_required: payload.credits_required,
      });
      return { error: null };
    });

    updateBucketEqSpy = vi.fn(async (column: string, value: number) => {
      if (column === "id") {
        bucketsState = bucketsState.map((bucket) =>
          bucket.id === value
            ? {
                ...bucket,
                name: updateBucketSpy.mock.calls.at(-1)?.[0]?.name ?? bucket.name,
                code: updateBucketSpy.mock.calls.at(-1)?.[0]?.code ?? bucket.code,
                credits_required: Number(
                  updateBucketSpy.mock.calls.at(-1)?.[0]?.credits_required ?? bucket.credits_required
                ),
              }
            : bucket
        );
      }
      return { error: null };
    });

    deleteBucketEqSpy = vi.fn(async (column: string, value: number) => {
      if (column === "id") {
        bucketsState = bucketsState.filter((bucket) => bucket.id !== value);
      }
      return { error: null };
    });

    deleteMappingCourseEqSpy = vi.fn(async (column: string, value: number) => {
      if (column === "course_id") {
        const bucketId = (deleteMappingBucketEqSpy.mock.calls.at(-1)?.[1] ?? 0) as number;
        mappingsState = mappingsState.filter(
          (mapping) => !(mapping.bucket_id === bucketId && mapping.course_id === value)
        );
      }
      return { error: null };
    });

    deleteMappingBucketEqSpy = vi.fn((column: string, value: number) => {
      if (column !== "bucket_id") {
        return Promise.resolve({ error: null });
      }

      const removeOneChain = {
        eq: deleteMappingCourseEqSpy,
      };

      const removeAllPromise = Promise.resolve().then(() => {
        mappingsState = mappingsState.filter((mapping) => mapping.bucket_id !== value);
        return { error: null };
      });

      return Object.assign(removeOneChain, makeAwaitable(removeAllPromise));
    });

    insertMappingsSpy = vi.fn(async (rows: Array<{ bucket_id: number; course_id: number }>) => {
      mappingsState.push(...rows);
      return { error: null };
    });

    mockClientFrom.mockImplementation((table: string) => {
      if (table === "gen_ed_buckets") {
        updateBucketSpy = vi.fn((_payload: any) => ({
          eq: updateBucketEqSpy,
        }));

        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(
              makeAwaitable({
                data: [...bucketsState].sort((a, b) => a.name.localeCompare(b.name)),
                error: null,
              })
            ),
          }),
          insert: insertBucketSpy,
          update: updateBucketSpy,
          delete: vi.fn().mockReturnValue({
            eq: deleteBucketEqSpy,
          }),
        };
      }

      if (table === "gen_ed_bucket_courses") {
        return {
          select: vi.fn().mockReturnValue(
            makeAwaitable({
              data: mappingsState.map((mapping) => ({ ...mapping })),
              error: null,
            })
          ),
          insert: insertMappingsSpy,
          delete: vi.fn().mockReturnValue({
            eq: deleteMappingBucketEqSpy,
          }),
        };
      }

      if (table === "courses") {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn((column: string, ids: number[]) =>
            Promise.resolve({
              data: coursesState
                .filter((course) => column === "id" && ids.includes(course.id))
                .map((course) => ({ ...course })),
              error: null,
            })
          ),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: coursesState.map((course) => ({ ...course })),
            error: null,
          }),
        };
        return chain;
      }

      throw new Error(`Unexpected client table ${table}`);
    });
  }

  async function renderPage() {
    const el = await AdminGenEdPage();
    return renderWithChakra(el as React.ReactElement);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockServerGetUser.mockResolvedValue({
      data: { user: { id: "advisor-auth-1", user_metadata: { role: "advisor" } } },
      error: null,
    });
    mockRedirect.mockImplementation((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    });

    bucketsState = [
      { id: 1, code: "HUM_ART", name: "Humanities and Arts", credits_required: 12 },
      { id: 2, code: "SOC_BEH", name: "Social and Behavioral Sciences", credits_required: 12 },
      { id: 3, code: "NAT_SCI", name: "Natural Sciences", credits_required: 12 },
      { id: 4, code: "ELEC", name: "Elective Studies", credits_required: 6 },
    ];

    mappingsState = [
      { bucket_id: 1, course_id: 101 },
      { bucket_id: 1, course_id: 102 },
      { bucket_id: 2, course_id: 103 },
      { bucket_id: 3, course_id: 104 },
      { bucket_id: 4, course_id: 105 },
    ];

    coursesState = [
      { id: 101, subject: "ENGL", number: "101", title: "Composition", credits: 3 },
      { id: 102, subject: "ART", number: "120", title: "Art History", credits: 3 },
      { id: 103, subject: "PSYC", number: "101", title: "Intro Psychology", credits: 3 },
      { id: 104, subject: "BIOL", number: "110", title: "Biology", credits: 4 },
      { id: 105, subject: "COMM", number: "105", title: "Public Speaking", credits: 3 },
      { id: 106, subject: "MATH", number: "111", title: "College Algebra", credits: 3 },
    ];

    nextBucketId = 5;
    installSupabaseMocks();
  });

  it("renders the heading, core buckets, and course counts from mocked Supabase data", async () => {
    await renderPage();

    expect(screen.getByText("Gen-Ed Buckets")).toBeInTheDocument();
    expect(screen.getByText("HUM_ART")).toBeInTheDocument();
    expect(screen.getByText("SOC_BEH")).toBeInTheDocument();
    expect(screen.getByText("NAT_SCI")).toBeInTheDocument();
    expect(screen.getByText("Humanities and Arts")).toBeInTheDocument();
    expect(screen.getAllByText(/2 courses/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 course/i).length).toBeGreaterThan(0);
  });

  it("redirects unauthenticated users to /signin", async () => {
    mockServerGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(AdminGenEdPage()).rejects.toThrow("NEXT_REDIRECT:/signin");
    expect(mockRedirect).toHaveBeenCalledWith("/signin");
  });

  it("redirects non-advisor users to /dashboard", async () => {
    mockServerGetUser.mockResolvedValueOnce({
      data: { user: { id: "student-auth-1", user_metadata: { role: "student" } } },
      error: null,
    });

    await expect(AdminGenEdPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("skips the courses query when there are no bucket-course mappings", async () => {
    mappingsState = [];
    installSupabaseMocks();

    await renderPage();

    expect(mockServerFrom).toHaveBeenCalledWith("gen_ed_buckets");
    expect(mockServerFrom).toHaveBeenCalledWith("gen_ed_bucket_courses");
    expect(mockServerFrom).not.toHaveBeenCalledWith("courses");
    expect(screen.getAllByText(/0 courses/i).length).toBeGreaterThan(0);
  });

  it("skips missing mapped courses and uses default bucket fallbacks", async () => {
    bucketsState = [
      { id: 9, code: null, name: "Fallback Bucket", credits_required: null as unknown as number },
    ];
    mappingsState = [{ bucket_id: 9, course_id: 999 }];
    installSupabaseMocks();

    await renderPage();

    expect(screen.getByText("Fallback Bucket")).toBeInTheDocument();
    expect(screen.getByText(/12 credits/i)).toBeInTheDocument();
    expect(screen.getByText(/0 courses/i)).toBeInTheDocument();
    expect(screen.queryByText("HUM_ART")).not.toBeInTheDocument();
  });

  it("expands and collapses a bucket course list", async () => {
    await renderPage();

    fireEvent.click(within(getBucketCard("Humanities and Arts")).getByRole("button", { name: /expand/i }));
    expect(screen.getByText(/ENGL 101 - Composition/i)).toBeInTheDocument();
    expect(screen.getByText(/ART 120 - Art History/i)).toBeInTheDocument();

    fireEvent.click(within(getBucketCard("Humanities and Arts")).getByRole("button", { name: /collapse/i }));
    await waitFor(() => {
      expect(screen.queryByText(/ENGL 101 - Composition/i)).not.toBeInTheDocument();
    });
  });

  it("adds a bucket and refreshes the UI", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /add bucket/i }));
    fireEvent.change(screen.getByLabelText("Bucket Name"), {
      target: { value: "Quantitative Literacy" },
    });
    fireEvent.change(screen.getByLabelText("Code"), {
      target: { value: "QUANT" },
    });
    fireEvent.change(screen.getByLabelText("Credits Required"), {
      target: { value: "9" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save bucket/i }));

    await waitFor(() => {
      expect(insertBucketSpy).toHaveBeenCalledWith({
        code: "QUANT",
        name: "Quantitative Literacy",
        credits_required: 9,
      });
    });

    expect(await screen.findByText("Quantitative Literacy")).toBeInTheDocument();
  });

  it("edits a bucket with prefilled values and submits update", async () => {
    await renderPage();

    fireEvent.click(within(getBucketCard("Elective Studies")).getByRole("button", { name: /^edit$/i }));

    expect(screen.getByLabelText("Bucket Name")).toHaveValue("Elective Studies");
    expect(screen.getByLabelText("Code")).toHaveValue("ELEC");
    expect(screen.getByLabelText("Credits Required")).toHaveValue("6");

    fireEvent.change(screen.getByLabelText("Bucket Name"), {
      target: { value: "Flexible Electives" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateBucketEqSpy).toHaveBeenCalledWith("id", 4);
    });
    expect(await screen.findByText("Flexible Electives")).toBeInTheDocument();
  });

  it("deletes a non-core bucket and its mappings after confirmation", async () => {
    await renderPage();

    fireEvent.click(within(getBucketCard("Elective Studies")).getByRole("button", { name: /^delete$/i }));
    expect(
      screen.getByText(/Deleting this bucket will also remove all course mappings in/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /delete bucket/i }));

    await waitFor(() => {
      expect(deleteMappingBucketEqSpy).toHaveBeenCalledWith("bucket_id", 4);
      expect(deleteBucketEqSpy).toHaveBeenCalledWith("id", 4);
    });

    await waitFor(() => {
      expect(screen.queryByText("Elective Studies")).not.toBeInTheDocument();
    });
  });

  it("adds selected courses to a bucket", async () => {
    await renderPage();

    fireEvent.click(within(getBucketCard("Elective Studies")).getByRole("button", { name: /add courses/i }));
    expect(await screen.findByText(/MATH 111 - College Algebra/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /math 111 - college algebra/i }));
    fireEvent.click(screen.getByRole("button", { name: /add selected/i }));

    await waitFor(() => {
      expect(insertMappingsSpy).toHaveBeenCalledWith([{ bucket_id: 4, course_id: 106 }]);
    });
  });

  it("removes a course from an expanded bucket", async () => {
    await renderPage();

    const humanitiesCard = getBucketCard("Humanities and Arts");
    fireEvent.click(within(humanitiesCard).getByRole("button", { name: /expand/i }));
    expect(screen.getByText(/ENGL 101 - Composition/i)).toBeInTheDocument();

    fireEvent.click(within(getCourseRow(/ENGL 101 - Composition/i)).getByRole("button", { name: /remove/i }));

    await waitFor(() => {
      expect(deleteMappingBucketEqSpy).toHaveBeenCalledWith("bucket_id", 1);
      expect(deleteMappingCourseEqSpy).toHaveBeenCalledWith("course_id", 101);
    });

    await waitFor(() => {
      expect(screen.queryByText(/ENGL 101 - Composition/i)).not.toBeInTheDocument();
    });
  });

  it("throws when the buckets query fails", async () => {
    mockServerFrom.mockImplementation((table: string) => {
      if (table === "gen_ed_buckets") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "bucket fail" },
            }),
          }),
        };
      }
      throw new Error(`Unexpected server table ${table}`);
    });

    await expect(AdminGenEdPage()).rejects.toThrow("Failed to load Gen-Ed buckets: bucket fail");
  });

  it("throws when the bucket mappings query fails", async () => {
    mockServerFrom.mockImplementation((table: string) => {
      if (table === "gen_ed_buckets") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [...bucketsState],
              error: null,
            }),
          }),
        };
      }

      if (table === "gen_ed_bucket_courses") {
        return {
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "mapping fail" },
          }),
        };
      }

      throw new Error(`Unexpected server table ${table}`);
    });

    await expect(AdminGenEdPage()).rejects.toThrow(
      "Failed to load Gen-Ed bucket courses: mapping fail"
    );
  });

  it("throws when the courses query fails", async () => {
    mockServerFrom.mockImplementation((table: string) => {
      if (table === "gen_ed_buckets") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [...bucketsState],
              error: null,
            }),
          }),
        };
      }

      if (table === "gen_ed_bucket_courses") {
        return {
          select: vi.fn().mockResolvedValue({
            data: [...mappingsState],
            error: null,
          }),
        };
      }

      if (table === "courses") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "course fail" },
            }),
          }),
        };
      }

      throw new Error(`Unexpected server table ${table}`);
    });

    await expect(AdminGenEdPage()).rejects.toThrow("Failed to load Gen-Ed courses: course fail");
  });
});
