import GenEdAdminClient, { type GenEdBucket } from "@/app/admin/(protected)/gen-ed/GenEdAdminClient";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchGenEdBucketsWithCourses } from "@/lib/supabase/queries/gen-ed";

export const metadata = {
  title: "Gen-Ed | Admin | GradTracker",
  description: "Manage general education buckets and course mappings in the GradTracker admin workspace.",
};

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

  const initialBuckets: GenEdBucket[] = await fetchGenEdBucketsWithCourses(supabase);
  return <GenEdAdminClient initialBuckets={initialBuckets} />;
}
