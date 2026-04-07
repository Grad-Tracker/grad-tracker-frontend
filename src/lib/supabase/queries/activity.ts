"use client";

import { createClient } from "@/lib/supabase/client";
import { DB_TABLES } from "./schema";

export type StudentActivityType =
  | "course_added"
  | "course_removed"
  | "plan_created"
  | "plan_updated"
  | "plan_deleted"
  | "major_changed"
  | "onboarding_completed";

export interface StudentActivityRow {
  id: number;
  student_id: number;
  activity_type: StudentActivityType;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function fetchRecentStudentActivity(
  studentId: number,
  limit = 5
): Promise<StudentActivityRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(DB_TABLES.studentActivityLog)
    .select("id, student_id, activity_type, message, metadata, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data as any[] | null | undefined) ?? []).map((row) => ({
    id: Number(row.id),
    student_id: Number(row.student_id),
    activity_type: row.activity_type as StudentActivityType,
    message: String(row.message ?? ""),
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at ?? ""),
  }));
}

export async function logStudentActivity(
  studentId: number,
  activityType: StudentActivityType,
  message: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from(DB_TABLES.studentActivityLog).insert({
    student_id: studentId,
    activity_type: activityType,
    message,
    metadata,
  });

  if (error) throw error;
}
