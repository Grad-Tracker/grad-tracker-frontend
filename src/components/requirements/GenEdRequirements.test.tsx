import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "@/components/ui/provider";
import GenEdRequirements from "./GenEdRequirements";

/* ---------------- MOCK SUPABASE ---------------- */

vi.mock("@/app/utils/supabase/client", () => {
  return {
    createClient: () => ({
      from: (table: string) => {
        const chain: any = {};

        // gen_ed_bucket_courses ends after select()
        chain.select = (..._args: any[]) => {
          if (table === "gen_ed_bucket_courses") {
            return Promise.resolve({
              data: [{ bucket_id: 1, course_id: 206 }],
              error: null,
            });
          }
          return chain; // allow chaining for other tables
        };

        // gen_ed_buckets ends after order()
        chain.order = (..._args: any[]) => {
          if (table === "gen_ed_buckets") {
            return Promise.resolve({
              data: [
                {
                  id: 1,
                  code: "HUM_ART",
                  name: "Humanities and the Arts",
                  credits_required: 12,
                },
              ],
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        };

        // student_course_history ends after eq()
        chain.eq = (..._args: any[]) => {
          if (table === "student_course_history") {
            return Promise.resolve({
              data: [{ course_id: 206, grade: "A", completed: true }],
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        };

        // courses ends after in()
        chain.in = (..._args: any[]) => {
          if (table === "courses") {
            return Promise.resolve({
              data: [
                {
                  id: 206,
                  subject: "ART",
                  number: "100",
                  title: "Foundations of Art",
                  credits: 3,
                },
              ],
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        };

        return chain;
      },
    }),
  };
});

vi.mock("@/lib/prereq", () => {
  return {
    evaluatePrereqsForCourses: vi.fn(async () => new Map()),
  };
});

/* ---------------- TEST ---------------- */

describe("GenEdRequirements", () => {
  it("renders bucket and calculates completed credits", async () => {
    render(
      <Provider>
        <GenEdRequirements studentId={1} />
      </Provider>
    );

    // Loading state
    expect(screen.getByText(/Loading Gen Ed requirements/i)).toBeInTheDocument();

    // Wait for async load
    await waitFor(() => {
      expect(screen.getByText(/Humanities and the Arts/i)).toBeInTheDocument();
    });

    // Match ONLY the <p> summary line to avoid "multiple elements found"
    const summary = screen.getByText((_, el) => {
      if (!el) return false;
      if (el.tagName.toLowerCase() !== "p") return false;

      const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      return t.includes("Completed 3 / 12 credits · Remaining 9");
    });
    expect(summary).toBeInTheDocument();

    // Completed indicator
    expect(screen.getByText("✅")).toBeInTheDocument();

    // Course title (easy stable assertion)
    expect(screen.getByText(/Foundations of Art/i)).toBeInTheDocument();

    // Course code line is split in DOM, so match by textContent again
    const courseLine = screen.getByText((_, el) => {
      if (!el) return false;
      if (el.tagName.toLowerCase() !== "p") return false;

      const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      return t.includes("ART 100") && t.includes("3 cr");
    });
    expect(courseLine).toBeInTheDocument();
  });
});
