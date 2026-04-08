import type { Term, PlannedCourseWithDetails } from "@/types/planner";
import { SEASON_ORDER } from "@/types/planner";

/**
 * Pure, synchronous validation helpers for the planner drag-and-drop UI.
 * No Supabase calls — operates entirely on in-memory data.
 */

/**
 * Returns a numeric sort key for a term.
 * Formula: year * 10 + seasonRank
 * Lower value = earlier in time.
 */
export function termSortKey(term: Pick<Term, "season" | "year">): number {
  return term.year * 10 + SEASON_ORDER[term.season];
}

/**
 * Builds a map from courseId → termSortKey for all planned courses.
 * Courses whose term_id is not found in the provided terms list are excluded.
 */
export function buildCourseTermIndex(
  plannedCourses: PlannedCourseWithDetails[],
  terms: Term[]
): Map<number, number> {
  const termById = new Map<number, Term>();
  for (const term of terms) {
    termById.set(term.id, term);
  }

  const index = new Map<number, number>();
  for (const pc of plannedCourses) {
    const term = termById.get(pc.term_id);
    if (term === undefined) continue; // term not in our list — skip
    index.set(pc.course_id, termSortKey(term));
  }

  return index;
}

/**
 * Checks whether all prerequisites for a course are satisfied given a target sort key.
 *
 * A prereq is satisfied if:
 * - It is in `completedIds`, OR
 * - It is in `courseTermIndex` with a sort key strictly less than `targetSortKey`.
 *
 * Returns `{ satisfied, missing }` where `missing` is the list of unsatisfied prereq IDs.
 */
export function arePrereqsSatisfied(
  courseId: number,
  targetSortKey: number,
  prereqEdges: Map<number, Set<number>>,
  courseTermIndex: Map<number, number>,
  completedIds: Set<number>
): { satisfied: boolean; missing: number[] } {
  const prereqs = prereqEdges.get(courseId);

  if (!prereqs || prereqs.size === 0) {
    return { satisfied: true, missing: [] };
  }

  const missing: number[] = [];

  for (const prereqId of prereqs) {
    if (completedIds.has(prereqId)) continue; // already completed — satisfied

    const prereqSortKey = courseTermIndex.get(prereqId);
    if (prereqSortKey === undefined || prereqSortKey >= targetSortKey) {
      // Not planned, or planned in same/later term — not satisfied
      missing.push(prereqId);
    }
  }

  return { satisfied: missing.length === 0, missing };
}

/**
 * Returns the IDs of courses that depend on `courseId` and whose prereq constraint
 * would be broken if `courseId` is moved to `newSortKey` (or removed when null).
 *
 * A dependent is "broken" when:
 * - `newSortKey` is null (removal), OR
 * - `newSortKey` >= the dependent's own sort key (now same or later term)
 *
 * Skips the check if `courseId` is in `completedIds` (completed courses can't be
 * removed from a plan in a meaningful sense).
 */
export function findBrokenDependents(
  courseId: number,
  newSortKey: number | null,
  prereqEdges: Map<number, Set<number>>,
  courseTermIndex: Map<number, number>,
  completedIds: Set<number>
): number[] {
  // If the course being moved/removed is already completed, nothing in the plan can break.
  if (completedIds.has(courseId)) return [];

  const broken: number[] = [];

  for (const [dependentId, prereqs] of prereqEdges) {
    if (!prereqs.has(courseId)) continue; // this dependent doesn't rely on courseId

    const dependentSortKey = courseTermIndex.get(dependentId);
    if (dependentSortKey === undefined) continue; // dependent not currently planned

    // Is the prereq still satisfied after the move?
    if (
      newSortKey === null || // removed
      newSortKey >= dependentSortKey // moved to same or later term
    ) {
      broken.push(dependentId);
    }
  }

  return broken;
}
