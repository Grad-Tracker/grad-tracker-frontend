import { createClient } from "@/lib/supabase/server";
import CoursesClient from "./CoursesClient";
import type { Course } from "@/types/course";
import { DB_TABLES } from "@/lib/supabase/queries/schema";

export default async function CoursesPage() {
  const supabase = await createClient();

  const { data: rawCourses, error } = await supabase
    .from(DB_TABLES.courses)
    .select("*, course_req_sets(set_type, note)")
    .order("subject", { ascending: true })
    .order("number", { ascending: true });

  if (error) {
    console.error("Error fetching courses:", error);
  }

  const courses: Course[] = (rawCourses || []).map((c: any) => ({
    id: c.id,
    subject: c.subject,
    number: c.number,
    title: c.title,
    credits: c.credits,
    description: c.description,
    prereq_text:
      (c.course_req_sets as Array<{ set_type: string; note: string | null }> | null)
        ?.find((s) => s.set_type === "PREREQ")?.note ?? null,
  }));

  // Extract unique subjects for filter
  const subjects = [...new Set(courses.map((c) => c.subject))].sort();

  return (
    <CoursesClient
      initialCourses={courses}
      subjects={subjects}
    />
  );
}
