import { createClient } from "@/lib/supabase/client";
import type {
  CourseListItem,
  CourseDetail,
  CoursePage,
  CourseInput,
} from "@/types/course";
import { DB_TABLES } from "./schema";
import { COURSES_QUERY_PAGE_SIZE } from "@/lib/constants";

// ── List + Search + Filter + Pagination ──────────────────

export async function listCourses({
  search = "",
  subjectFilter = null,
  page = 1,
  pageSize = COURSES_QUERY_PAGE_SIZE,
}: {
  search?: string;
  subjectFilter?: string | null;
  page?: number;
  pageSize?: number;
} = {}): Promise<CoursePage> {
  const supabase = createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from(DB_TABLES.courses)
    .select("id,subject,number,title,credits,is_active", { count: "exact" })
    .order("subject", { ascending: true })
    .order("number", { ascending: true })
    .range(from, to);

  if (search.trim()) {
    // Escape backslashes and double quotes, then wrap in PostgREST double-quotes
    // to prevent comma/dot injection in the .or() filter string.
    const escaped = search.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const pattern = `%${escaped}%`;
    query = query.or(
      `title.ilike."${pattern}",subject.ilike."${pattern}",number.ilike."${pattern}"`
    );
  }

  if (subjectFilter) {
    query = query.eq("subject", subjectFilter);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  return { data: (data ?? []) as CourseListItem[], total: count ?? 0 };
}

// ── Subject Dropdown ──────────────────────────────────────

export async function fetchSubjects(): Promise<string[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from(DB_TABLES.courses)
    .select("subject")
    .order("subject", { ascending: true });

  if (error) throw error;

  // dedupe client-side (mirrors `select distinct subject` in SQL)
  const seen = new Set<string>();
  for (const row of data ?? []) {
    seen.add((row as { subject: string }).subject);
  }
  return Array.from(seen);
}

// ── Course Detail ─────────────────────────────────────────

export async function fetchCourseById(
  id: number
): Promise<CourseDetail | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from(DB_TABLES.courses)
    .select("id,subject,number,title,credits,description,prereq_text,is_active")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // row not found
    throw error;
  }

  return data as CourseDetail;
}

// ── Add Course ────────────────────────────────────────────

export async function addCourse(input: CourseInput): Promise<{ id: number }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from(DB_TABLES.courses)
    .insert({
      subject: input.subject.trim().toUpperCase(),
      number: input.number.trim(),
      title: input.title.trim(),
      credits: input.credits,
      description: input.description ?? null,
      prereq_text: input.prereq_text ?? null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: (data as { id: number }).id };
}

// ── Edit Course ───────────────────────────────────────────

export async function updateCourse(
  id: number,
  input: CourseInput
): Promise<{ id: number }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from(DB_TABLES.courses)
    .update({
      subject: input.subject.trim().toUpperCase(),
      number: input.number.trim(),
      title: input.title.trim(),
      credits: input.credits,
      description: input.description ?? null,
      prereq_text: input.prereq_text ?? null,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) throw error;
  return { id: (data as { id: number }).id };
}

// ── Soft Delete / Reactivate ──────────────────────────────

export async function deactivateCourse(id: number): Promise<{ id: number }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from(DB_TABLES.courses)
    .update({ is_active: false })
    .eq("id", id)
    .select("id")
    .single();

  if (error) throw error;
  return { id: (data as { id: number }).id };
}

export async function reactivateCourse(id: number): Promise<{ id: number }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from(DB_TABLES.courses)
    .update({ is_active: true })
    .eq("id", id)
    .select("id")
    .single();

  if (error) throw error;
  return { id: (data as { id: number }).id };
}
