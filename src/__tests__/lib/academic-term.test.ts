import { describe, it, expect, vi, afterEach } from "vitest";
import { getCurrentAcademicTerm } from "@/lib/academic-term";

describe("getCurrentAcademicTerm", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns Spring when the month is January (index 0)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15)); // January
    expect(getCurrentAcademicTerm()).toEqual({ season: "Spring", year: 2026 });
  });

  it("returns Spring when the month is April (index 3)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 1)); // April
    expect(getCurrentAcademicTerm()).toEqual({ season: "Spring", year: 2026 });
  });

  it("returns Spring at the boundary month index 4 (May)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 1)); // month index 4
    expect(getCurrentAcademicTerm()).toEqual({ season: "Spring", year: 2026 });
  });

  it("returns Summer when the month is June (index 5)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 10)); // June
    expect(getCurrentAcademicTerm()).toEqual({ season: "Summer", year: 2026 });
  });

  it("returns Summer at the boundary month index 7 (August)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 1)); // month index 7
    expect(getCurrentAcademicTerm()).toEqual({ season: "Summer", year: 2026 });
  });

  it("returns Fall when the month is September (index 8)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 8, 15)); // September
    expect(getCurrentAcademicTerm()).toEqual({ season: "Fall", year: 2025 });
  });

  it("returns Fall when the month is December (index 11)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 20)); // December
    expect(getCurrentAcademicTerm()).toEqual({ season: "Fall", year: 2025 });
  });
});
