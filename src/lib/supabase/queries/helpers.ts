import type { ViewProgramBlockCourseItem, ViewProgramBlockCoursesRow, ViewGenEdBucketCourseItem } from "./view-types";
import { logStudentActivity } from "./activity";

/** Convert a view course item to a plain course object. */
export function viewItemToCourse(item: ViewProgramBlockCourseItem | ViewGenEdBucketCourseItem) {
  return {
    id: Number(item.course_id),
    subject: String(item.subject ?? ""),
    number: String(item.number ?? ""),
    title: String(item.title ?? ""),
    credits: Number(item.credits ?? 0),
  };
}

/** Map a program-block view row to a typed block object with nested courses. */
export function mapViewBlockToCourseBlock(block: ViewProgramBlockCoursesRow) {
  return {
    id: Number(block.block_id),
    program_id: Number(block.program_id),
    name: block.block_name,
    rule: block.rule,
    n_required: block.n_required,
    credits_required: block.credits_required,
    courses: (block.courses ?? []).map(viewItemToCourse),
  };
}

/** Log a student activity, silently swallowing errors. */
export async function safeLogActivity(
  studentId: number,
  activityType: Parameters<typeof logStudentActivity>[1],
  message: string,
  metadata: Record<string, unknown>
) {
  try {
    await logStudentActivity(studentId, activityType, message, metadata);
  } catch (error) {
    console.error("Failed to log student activity:", error);
  }
}

/** Normalize a course label for activity messages. */
export function formatActivityCourseLabel(courseLabel?: string): string {
  const normalized = courseLabel?.trim();
  return normalized && normalized.length > 0 ? normalized : "a course";
}
