import { createClient } from "@/app/utils/supabase/server";
import CoursesClient from "./CoursesClient";
import type { Course } from "@/types/course";

export default async function CoursesPage() {
  const supabase = await createClient();

  const { data: courses, error } = await supabase
    .from("courses")
    .select("*")
    .order("subject", { ascending: true })
    .order("number", { ascending: true });

  if (error) {
    console.error("Error fetching courses:", error);
  }

  // Extract unique subjects for filter
  const subjects = [
    ...new Set((courses || []).map((c: Course) => c.subject)),
  ].sort();

  return (
    <CoursesClient
      initialCourses={(courses as Course[]) || []}
      subjects={subjects}
    />
  );
}
