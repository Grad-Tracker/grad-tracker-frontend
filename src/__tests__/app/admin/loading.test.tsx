import { describe, it, expect } from "vitest";
import { renderWithChakra } from "@/__tests__/helpers/mocks";
import AdminDashboardLoading from "@/app/admin/(protected)/loading";
import CoursesLoading from "@/app/admin/(protected)/courses/loading";
import ProgramsLoading from "@/app/admin/(protected)/programs/loading";
import GenEdLoading from "@/app/admin/(protected)/gen-ed/loading";

describe("Admin loading skeletons", () => {
  it("renders AdminDashboardLoading without crashing", () => {
    const { container } = renderWithChakra(<AdminDashboardLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders CoursesLoading without crashing", () => {
    const { container } = renderWithChakra(<CoursesLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders ProgramsLoading without crashing", () => {
    const { container } = renderWithChakra(<ProgramsLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders GenEdLoading without crashing", () => {
    const { container } = renderWithChakra(<GenEdLoading />);
    expect(container.firstChild).toBeTruthy();
  });
});
