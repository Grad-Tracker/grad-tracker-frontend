import type { Season } from "@/types/planner";

/**
 * Returns the current academic term based on the calendar month.
 * Jan–Apr → Spring, May–Jul → Summer, Aug–Dec → Fall.
 */
export function getCurrentAcademicTerm(): { season: Season; year: number } {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month <= 4) return { season: "Spring", year };
  if (month <= 7) return { season: "Summer", year };
  return { season: "Fall", year };
}
