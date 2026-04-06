import { render, cleanup } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import GenEdProgress from "@/components/planner/GenEdProgress";

afterEach(() => cleanup());

vi.mock("@/components/ui/progress", () => ({
  ProgressRoot: ({ children, ...props }: any) => (
    <div data-testid="progress-root" {...props}>
      {children}
    </div>
  ),
  ProgressBar: (props: any) => <div data-testid="progress-bar" {...props} />,
}));

function renderWithChakra(ui: React.ReactElement) {
  return render(
    <ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>
  );
}

const makeCourse = (id: number, subject: string, number: string, title: string, credits: number) => ({
  id,
  subject,
  number,
  title,
  credits,
});

describe("GenEdProgress", () => {
  it("returns null for empty buckets", () => {
    const { container } = renderWithChakra(
      <GenEdProgress
        buckets={[]}
        plannedCourses={[]}
        completedCourseIds={new Set()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders bucket names and credit ratios", () => {
    const humanitiesCourse = makeCourse(101, "HUM", "101", "Intro to Humanities", 3);
    const scienceCourse = makeCourse(201, "SCI", "101", "Intro to Science", 3);

    const buckets = [
      {
        id: 1,
        code: "HUM",
        name: "Humanities",
        credits_required: 6,
        courses: [humanitiesCourse],
      },
      {
        id: 2,
        code: "SCI",
        name: "Sciences",
        credits_required: 3,
        courses: [scienceCourse],
      },
    ];

    const plannedCourses = [
      {
        student_id: 1,
        term_id: 1,
        course_id: 201,
        status: "planned",
        plan_id: 1,
        course: scienceCourse,
      },
    ];

    const completedCourseIds = new Set([101]);

    const { getAllByText } = renderWithChakra(
      <GenEdProgress
        buckets={buckets}
        plannedCourses={plannedCourses}
        completedCourseIds={completedCourseIds}
      />
    );

    expect(getAllByText(/Humanities/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Sciences/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/3\/6 cr/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/3\/3 cr/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows "done" and "planned" labels', () => {
    const completedCourse = makeCourse(101, "HUM", "101", "Intro to Humanities", 3);
    const plannedCourse = makeCourse(102, "HUM", "201", "Advanced Humanities", 3);

    const buckets = [
      {
        id: 1,
        code: "HUM",
        name: "Humanities",
        credits_required: 6,
        courses: [completedCourse, plannedCourse],
      },
    ];

    const plannedCourses = [
      {
        student_id: 1,
        term_id: 1,
        course_id: 102,
        status: "planned",
        plan_id: 1,
        course: plannedCourse,
      },
    ];

    const completedCourseIds = new Set([101]);

    const { getAllByText } = renderWithChakra(
      <GenEdProgress
        buckets={buckets}
        plannedCourses={plannedCourses}
        completedCourseIds={completedCourseIds}
      />
    );

    expect(getAllByText(/3 done/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/3 planned/).length).toBeGreaterThanOrEqual(1);
  });

  it("calculates overall percentage correctly", () => {
    // Bucket 1: 6cr required, 1 completed course (3cr) + 1 planned course (3cr) = 6cr covered
    const course1 = makeCourse(101, "HUM", "101", "Intro to Humanities", 3);
    const course2 = makeCourse(102, "HUM", "201", "Advanced Humanities", 3);
    // Bucket 2: 3cr required, no completed or planned courses = 0cr covered
    const course3 = makeCourse(201, "SCI", "101", "Intro to Science", 3);

    const buckets = [
      {
        id: 1,
        code: "HUM",
        name: "Humanities",
        credits_required: 6,
        courses: [course1, course2],
      },
      {
        id: 2,
        code: "SCI",
        name: "Sciences",
        credits_required: 3,
        courses: [course3],
      },
    ];

    // Only course2 is planned; course3 is NOT planned or completed
    const plannedCourses = [
      {
        student_id: 1,
        term_id: 1,
        course_id: 102,
        status: "planned",
        plan_id: 1,
        course: course2,
      },
    ];

    // Only course1 is completed
    const completedCourseIds = new Set([101]);

    const { getAllByText } = renderWithChakra(
      <GenEdProgress
        buckets={buckets}
        plannedCourses={plannedCourses}
        completedCourseIds={completedCourseIds}
      />
    );

    // Total: 6cr covered (3 completed + 3 planned) out of 9cr required = 67%
    expect(getAllByText(/6\/9 cr/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/67%/).length).toBeGreaterThanOrEqual(1);
  });
});
