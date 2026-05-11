import { createClient } from "@/lib/supabase/server";
import { DB_TABLES } from "@/lib/supabase/queries/schema";
import type { CourseDetail } from "@/types/course";
import CoursesAdminClient from "./CoursesAdminClient";

export const metadata = {
  title: "Courses | Admin | GradTracker",
  description: "Manage course catalog data in the GradTracker admin workspace.",
};

export default async function AdminCoursesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from(DB_TABLES.courses)
    .select("id,subject,number,title,credits,description,prereq_text,is_active")
    .order("subject", { ascending: true })
    .order("number", { ascending: true });

  if (error) console.error("Error fetching courses:", error);

  const courses: CourseDetail[] = (data ?? []) as CourseDetail[];
  const subjects = [...new Set(courses.map((c) => c.subject))].sort((a, b) => a.localeCompare(b));

  return <CoursesAdminClient initialCourses={courses} subjects={subjects} />;
}
