import { createClient } from "@/lib/supabase/server";
import CoursesClient from "./CoursesClient";
import type { Course } from "@/types/course";
import { DB_VIEWS } from "@/lib/supabase/queries/schema";
import type { ViewCourseCatalogRow } from "@/lib/supabase/queries/view-types";

export default async function CoursesPage() {
  const supabase = await createClient();

  const { data: rawCourses, error } = await supabase
    .from(DB_VIEWS.courseCatalog)
    .select("course_id, subject, number, title, credits, description, prereq_text")
    .order("subject", { ascending: true })
    .order("number", { ascending: true });

  if (error) {
    console.error("Error fetching courses:", error);
  }

  const courses: Course[] = ((rawCourses as ViewCourseCatalogRow[] | null) ?? []).map((c) => ({
    id: Number(c.course_id),
    subject: c.subject,
    number: c.number,
    title: c.title,
    credits: Number(c.credits ?? 0),
    description: c.description,
    prereq_text: c.prereq_text,
  }));

  // Extract unique subjects for filter
  const subjects = [...new Set(courses.map((c) => c.subject))].sort((a, b) => a.localeCompare(b));

  return (
    <CoursesClient
      initialCourses={courses}
      subjects={subjects}
    />
  );
}
