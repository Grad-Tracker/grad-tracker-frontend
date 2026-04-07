import type { ViewProgramBlockCourseItem, ViewGenEdBucketCourseItem } from "./view-types";
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
