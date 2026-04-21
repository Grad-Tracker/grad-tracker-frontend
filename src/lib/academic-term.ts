import type { Season } from "@/types/planner";

/**
 * Returns the current academic term based on the calendar month.
 * Jan–May (0–4) → Spring, Jun–Aug (5–7) → Summer, Sep–Dec (8–11) → Fall.
 */
export function getCurrentAcademicTerm(): { season: Season; year: number } {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month <= 4) return { season: "Spring", year };
  if (month <= 7) return { season: "Summer", year };
  return { season: "Fall", year };
}

/**
 * Returns the next upcoming semester to start planning from.
 * Before August → Fall this year; August or later → Spring next year.
 */
export function getNextSemester(): { season: Season; year: number } {
  const now = new Date();
  const month = now.getMonth();
  if (month < 8) return { season: "Fall", year: now.getFullYear() };
  return { season: "Spring", year: now.getFullYear() + 1 };
}
