import GenEdAdminClient, { type GenEdBucket } from "@/app/admin/(protected)/gen-ed/GenEdAdminClient";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DB_TABLES } from "@/lib/supabase/queries/schema";

async function fetchInitialBuckets(): Promise<GenEdBucket[]> {
  const supabase = await createClient();

  const { data: bucketRows, error: bucketsError } = await supabase
    .from(DB_TABLES.genEdBuckets)
    .select("id, code, name, credits_required")
    .order("name");

  if (bucketsError) {
    throw new Error(`Failed to load Gen-Ed buckets: ${bucketsError.message}`);
  }

  const { data: mappingRows, error: mappingsError } = await supabase
    .from(DB_TABLES.genEdBucketCourses)
    .select("bucket_id, course_id");

  if (mappingsError) {
    throw new Error(`Failed to load Gen-Ed bucket courses: ${mappingsError.message}`);
  }

  const courseIds = Array.from(
    new Set((mappingRows ?? []).map((row: any) => Number(row.course_id)).filter(Number.isFinite))
  );

  const coursesResult = courseIds.length
    ? await supabase
        .from(DB_TABLES.courses)
        .select("id, subject, number, title, credits")
        .in("id", courseIds)
    : { data: [], error: null };

  if (coursesResult.error) {
    throw new Error(`Failed to load Gen-Ed courses: ${coursesResult.error.message}`);
  }

  const coursesById = new Map<number, GenEdBucket["courses"][number]>();
  for (const course of coursesResult.data ?? []) {
    coursesById.set(Number((course as any).id), {
      id: Number((course as any).id),
      subject: (course as any).subject ?? null,
      number: (course as any).number ?? null,
      title: (course as any).title ?? null,
      credits: (course as any).credits == null ? null : Number((course as any).credits),
    });
  }

  const bucketToCourses = new Map<number, GenEdBucket["courses"]>();
  for (const row of mappingRows ?? []) {
    const bucketId = Number((row as any).bucket_id);
    const course = coursesById.get(Number((row as any).course_id));
    if (!course) continue;
    if (!bucketToCourses.has(bucketId)) bucketToCourses.set(bucketId, []);
    bucketToCourses.get(bucketId)!.push(course);
  }

  return (bucketRows ?? []).map((bucket: any) => ({
    id: Number(bucket.id),
    code: bucket.code ?? null,
    name: bucket.name,
    credits_required: Number(bucket.credits_required ?? 12),
    courses: (bucketToCourses.get(Number(bucket.id)) ?? []).sort((a, b) =>
      `${a.subject ?? ""} ${a.number ?? ""}`.localeCompare(`${b.subject ?? ""} ${b.number ?? ""}`)
    ),
  }));
}

export default async function AdminGenEdPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  if (user.user_metadata?.role !== "advisor") {
    redirect("/dashboard");
  }

  const initialBuckets = await fetchInitialBuckets();
  return <GenEdAdminClient initialBuckets={initialBuckets} />;
}
