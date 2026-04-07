import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";

const { mockFrom, mockToaster } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockToaster: { create: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("@chakra-ui/react", async () => {
  const actual = await vi.importActual<typeof import("@chakra-ui/react")>("@chakra-ui/react");
  return {
    ...actual,
    Dialog: {
      ...actual.Dialog,
      Root: ({
        open,
        children,
      }: {
        open?: boolean;
        children: React.ReactNode;
      }) => (open ? <>{children}</> : null),
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

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children, content }: any) => (
    <div data-testid="tooltip-wrapper">
      {children}
      <div>{content}</div>
    </div>
  ),
}));

import GenEdAdminClient from "@/app/admin/(protected)/gen-ed/GenEdAdminClient";

function makeAwaitable(result: any) {
  return {
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  };
}

function getVisibleBucketNames() {
  return screen
    .getAllByTestId(/^bucket-card-/)
    .map((card) => within(card).getByRole("heading").textContent);
}

const courseCatalog = [
  { id: 101, subject: "ENGL", number: "101", title: "Composition", credits: 3 },
  { id: 102, subject: "MATH", number: "111", title: "College Algebra", credits: 3 },
  { id: 103, subject: "COMM", number: "105", title: "Public Speaking", credits: 3 },
];

describe("GenEdAdminClient", () => {
  let bucketsState: Array<{ id: number; code: string | null; name: string; credits_required: number }>;
  let mappingsState: Array<{ bucket_id: number; course_id: number }>;
  let bucketIdCounter: number;
  let bucketInsertSpy: ReturnType<typeof vi.fn>;
  let bucketUpdateSpy: ReturnType<typeof vi.fn>;
  let bucketDeleteSpy: ReturnType<typeof vi.fn>;
  let mappingDeleteSpy: ReturnType<typeof vi.fn>;
  let mappingInsertSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    bucketsState = [
      { id: 1, code: "HUM_ART", name: "Humanities", credits_required: 12 },
      { id: 2, code: "ELEC", name: "Natural Sciences", credits_required: 10 },
    ];
    mappingsState = [
      { bucket_id: 1, course_id: 101 },
      { bucket_id: 1, course_id: 102 },
      { bucket_id: 2, course_id: 103 },
    ];
    bucketIdCounter = 3;

    bucketInsertSpy = vi.fn(async (payload: any) => {
      const row = Array.isArray(payload) ? payload[0] : payload;
      bucketsState.push({
        id: bucketIdCounter++,
        code: row.code ?? null,
        name: row.name,
        credits_required: Number(row.credits_required ?? 12),
      });
      return { error: null };
    });

    bucketUpdateSpy = vi.fn((column: string, value: number) => {
      return Promise.resolve({
        error: null,
        data: bucketsState.map((bucket) => {
          if (column === "id" && bucket.id === value) {
            bucket.name = (bucketUpdateSpy.mock.calls.at(-1)?.[0]?.name ?? bucket.name) as string;
          }
          return bucket;
        }),
      });
    });

    bucketDeleteSpy = vi.fn(async (column: string, value: number) => {
      if (column === "id") {
        bucketsState = bucketsState.filter((bucket) => bucket.id !== value);
      }
      return { error: null };
    });

    mappingDeleteSpy = vi.fn((column: string, value: number) => {
      if (column === "bucket_id") {
        return {
          eq: vi.fn(async (nestedColumn: string, nestedValue: number) => {
            if (nestedColumn === "course_id") {
              mappingsState = mappingsState.filter(
                (row) => !(row.bucket_id === value && row.course_id === nestedValue)
              );
            }
            return { error: null };
          }),
        };
      }

      mappingsState = mappingsState.filter((row) => row.bucket_id !== value);
      return Promise.resolve({ error: null });
    });

    mappingInsertSpy = vi.fn(async (rows: Array<{ bucket_id: number; course_id: number }>) => {
      mappingsState.push(...rows);
      return { error: null };
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "gen_ed_buckets") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(
              makeAwaitable({
                data: bucketsState.map((bucket) => ({ ...bucket })),
                error: null,
              })
            ),
          }),
          insert: bucketInsertSpy,
          update: vi.fn((payload: any) => {
            const chain = {
              eq: vi.fn(async (column: string, value: number) => {
                bucketsState = bucketsState.map((bucket) =>
                  column === "id" && bucket.id === value
                    ? {
                        ...bucket,
                        name: payload.name,
                        code: payload.code ?? null,
                        credits_required: Number(payload.credits_required),
                      }
                    : bucket
                );
                return { error: null };
              }),
            };
            return chain;
          }),
          delete: vi.fn().mockReturnValue({
            eq: bucketDeleteSpy,
          }),
        };
      }

      if (table === "gen_ed_bucket_courses") {
        return {
          select: vi.fn().mockReturnValue(
            makeAwaitable({
              data: mappingsState.map((row) => ({ ...row })),
              error: null,
            })
          ),
          delete: vi.fn().mockReturnValue({
            eq: mappingDeleteSpy,
          }),
          insert: mappingInsertSpy,
        };
      }

      if (table === "courses") {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnValue(
            makeAwaitable({
              data: courseCatalog
                .filter((course) => mappingsState.some((row) => row.course_id === course.id))
                .map((course) => ({ ...course })),
              error: null,
            })
          ),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: courseCatalog.map((course) => ({ ...course })),
            error: null,
          }),
        };
        return chain;
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  const initialBuckets = [
    {
      id: 1,
      code: "HUM_ART",
      name: "Humanities",
      credits_required: 12,
      courses: [courseCatalog[0], courseCatalog[1]],
    },
    {
      id: 2,
      code: "ELEC",
      name: "Natural Sciences",
      credits_required: 10,
      courses: [courseCatalog[2]],
    },
  ];

  it("renders the buckets list", () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    expect(screen.getByText("Gen-Ed Buckets")).toBeInTheDocument();
    expect(screen.getByTestId("gened-controls")).toBeInTheDocument();
    expect(
      screen.getByText("Manage Gen-Ed buckets and their course mappings.")
    ).toBeInTheDocument();
    expect(screen.getByText("Humanities")).toBeInTheDocument();
    expect(screen.getByText("Natural Sciences")).toBeInTheDocument();
    expect(screen.getByText("HUM_ART")).toBeInTheDocument();
    expect(screen.queryByLabelText("Search buckets")).not.toBeInTheDocument();
  });

  it("sorts buckets by name and by course count", () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    const sortSelect = screen.getByLabelText("Sort buckets");

    fireEvent.change(sortSelect, { target: { value: "name-asc" } });
    expect(getVisibleBucketNames()).toEqual(["Humanities", "Natural Sciences"]);

    fireEvent.change(sortSelect, { target: { value: "courses-least" } });
    expect(getVisibleBucketNames()).toEqual(["Natural Sciences", "Humanities"]);
  });

  it("expand button toggles and shows course rows", async () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    fireEvent.click(screen.getAllByRole("button", { name: /expand/i })[0]);

    expect(screen.getByText("ENGL 101 - Composition")).toBeInTheDocument();
    expect(screen.getByText("MATH 111 - College Algebra")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /collapse/i }));
    await waitFor(() => {
      expect(screen.queryByText("ENGL 101 - Composition")).not.toBeInTheDocument();
    });
  });

  it("keeps expanded content visible after sorting", async () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    const humanitiesCard = screen.getByTestId("bucket-card-1");
    fireEvent.click(within(humanitiesCard).getByRole("button", { name: /expand/i }));
    expect(await screen.findByText("ENGL 101 - Composition")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Sort buckets"), {
      target: { value: "courses-least" },
    });
    await waitFor(() => {
      expect(screen.getByText("ENGL 101 - Composition")).toBeInTheDocument();
      expect(
        within(screen.getByTestId("bucket-card-1")).getByRole("button", { name: /collapse/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      within(screen.getByTestId("bucket-card-1")).getByRole("button", { name: /collapse/i })
    );
    await waitFor(() => {
      expect(screen.queryByText("ENGL 101 - Composition")).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId("bucket-card-1")).getByRole("button", { name: /expand/i })
      ).toBeInTheDocument();
    });
  });

  it("adds a bucket by calling insert", async () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    fireEvent.click(screen.getByRole("button", { name: /add bucket/i }));
    fireEvent.change(screen.getByLabelText("Bucket Name"), {
      target: { value: "Social Sciences" },
    });
    fireEvent.change(screen.getByLabelText("Code"), {
      target: { value: "SOC" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save bucket/i }));

    await waitFor(() => {
      expect(bucketInsertSpy).toHaveBeenCalledWith({
        code: "SOC",
        name: "Social Sciences",
        credits_required: 12,
      });
    });
    expect(await screen.findByText("Social Sciences")).toBeInTheDocument();
  });

  it("shows validation error when saving a bucket with an empty name", async () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    fireEvent.click(screen.getByRole("button", { name: /add bucket/i }));
    fireEvent.change(screen.getByLabelText("Bucket Name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: /save bucket/i }));

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Missing bucket name",
          type: "error",
        })
      );
    });
    expect(bucketInsertSpy).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Bucket Name")).toBeInTheDocument();
  });

  it("renames a bucket by calling update", async () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    fireEvent.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    fireEvent.change(screen.getByLabelText("Bucket Name"), {
      target: { value: "Arts and Humanities" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText("Arts and Humanities")).toBeInTheDocument();
    });
  });

  it("resets the bucket dialog state when cancel is clicked", async () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    fireEvent.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    expect(screen.getByDisplayValue("Humanities")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByLabelText("Bucket Name")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /add bucket/i }));
    expect(screen.getByRole("button", { name: /save bucket/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Bucket Name")).toHaveValue("");
    expect(screen.getByLabelText("Code")).toHaveValue("");
    expect(screen.getByLabelText("Credits Required")).toHaveValue("12");
  });

  it("disables delete for core bucket codes", () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    const deleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    expect(deleteButtons[0]).toBeDisabled();
    expect(screen.getByText("Core bucket cannot be deleted")).toBeInTheDocument();
  });

  it("shows explicit delete confirmation text for non-core buckets and deletes after confirm", async () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    fireEvent.click(screen.getAllByRole("button", { name: /^delete$/i })[1]);

    expect(
      screen.getByText(/Deleting this bucket will also remove all course mappings/i)
    ).toBeInTheDocument();
    expect(screen.getByText("gen_ed_bucket_courses")).toBeInTheDocument();
    expect(screen.getByText(/This cannot be undone\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /delete bucket/i }));

    await waitFor(() => {
      expect(mappingDeleteSpy).toHaveBeenCalledWith("bucket_id", 2);
      expect(bucketDeleteSpy).toHaveBeenCalledWith("id", 2);
    });
  });

  it("adds courses to a bucket and skips duplicates", async () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    fireEvent.click(screen.getAllByRole("button", { name: /add courses/i })[0]);
    await screen.findByText("ENGL 101 - Composition");

    fireEvent.click(screen.getByRole("button", { name: /engl 101 - composition/i }));
    fireEvent.click(screen.getByRole("button", { name: /comm 105 - public speaking/i }));
    fireEvent.click(screen.getByRole("button", { name: /add selected/i }));

    await waitFor(() => {
      expect(mappingInsertSpy).toHaveBeenCalledWith([{ bucket_id: 1, course_id: 103 }]);
    });
  }, 15000);

  it("shows an error toast when adding courses with no selection", async () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    fireEvent.click(screen.getAllByRole("button", { name: /add courses/i })[0]);
    await screen.findByText("ENGL 101 - Composition");

    fireEvent.click(screen.getByRole("button", { name: /add selected/i }));

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "No courses selected",
          type: "error",
        })
      );
    });
    expect(mappingInsertSpy).not.toHaveBeenCalled();
  });

  it("removes a selected course when it is clicked a second time", async () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    fireEvent.click(screen.getAllByRole("button", { name: /add courses/i })[0]);
    await screen.findByText("ENGL 101 - Composition");
    const searchInput = await screen.findByLabelText("Search Courses");
    fireEvent.change(searchInput, { target: { value: "engl" } });

    const courseLabel = await screen.findByText(/ENGL 101 - Composition/i);
    const selectableCourse =
      courseLabel.closest("button") ??
      courseLabel.closest("label") ??
      courseLabel.parentElement;

    expect(selectableCourse).not.toBeNull();

    fireEvent.click(selectableCourse!);
    fireEvent.click(selectableCourse!);
    fireEvent.click(screen.getByRole("button", { name: /add selected/i }));

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "No courses selected",
          type: "error",
        })
      );
    });
    expect(mappingInsertSpy).not.toHaveBeenCalled();
  });

  it("closes the Add Courses dialog without inserting when only duplicates are selected", async () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    fireEvent.click(screen.getAllByRole("button", { name: /add courses/i })[0]);
    await screen.findByText("ENGL 101 - Composition");

    fireEvent.click(screen.getByRole("button", { name: /engl 101 - composition/i }));
    fireEvent.click(screen.getByRole("button", { name: /add selected/i }));

    await waitFor(() => {
      expect(mappingInsertSpy).not.toHaveBeenCalled();
    });
    expect(screen.queryByLabelText("Search Courses")).not.toBeInTheDocument();
  });

  it("shows an error toast when adding courses fails", async () => {
    mappingInsertSpy.mockResolvedValueOnce({ error: { message: "fail" } });

    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    fireEvent.click(screen.getAllByRole("button", { name: /add courses/i })[1]);
    await screen.findByText("ENGL 101 - Composition");

    fireEvent.click(screen.getByRole("button", { name: /engl 101 - composition/i }));
    fireEvent.click(screen.getByRole("button", { name: /add selected/i }));

    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to add courses",
          description: "fail",
          type: "error",
        })
      );
    });
    expect(screen.getByLabelText("Search Courses")).toBeInTheDocument();
  });

  it("closes the add courses and delete dialogs when cancel is clicked", async () => {
    renderWithChakra(<GenEdAdminClient initialBuckets={initialBuckets} />);

    fireEvent.click(screen.getAllByRole("button", { name: /add courses/i })[0]);
    await screen.findByLabelText("Search Courses");
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByLabelText("Search Courses")).not.toBeInTheDocument();
    });
    expect(mappingInsertSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: /^delete$/i })[1]);
    expect(screen.getByText(/Delete Natural Sciences\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Delete Natural Sciences\?/i)).not.toBeInTheDocument();
    });
    expect(bucketDeleteSpy).not.toHaveBeenCalled();
  });
});
