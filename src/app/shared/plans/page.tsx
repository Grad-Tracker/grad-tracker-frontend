import type { Metadata } from "next";
import { SharedPlansIndex } from "@/app/dashboard/planner/shared";
import { createClient } from "@/lib/supabase/server";
import {
  fetchPublicSharedPlans,
  fetchStudentPlanSummariesForUser,
} from "@/lib/supabase/queries/shared-plans";

export const metadata: Metadata = {
  title: "Shared Degree Plans | Grad Tracker",
  description: "Browse public, read-only degree plans shared from Grad Tracker.",
  openGraph: {
    title: "Shared Degree Plans | Grad Tracker",
    description: "Browse public, read-only degree plans shared from Grad Tracker.",
  },
};

export default async function SharedPlansPage() {
  const plans = await fetchPublicSharedPlans();
  let ownPlans = [] as Awaited<ReturnType<typeof fetchStudentPlanSummariesForUser>>;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      ownPlans = await fetchStudentPlanSummariesForUser(supabase, user.id);
    }
  } catch {
    ownPlans = [];
  }

  return <SharedPlansIndex plans={plans} ownPlans={ownPlans} />;
}
