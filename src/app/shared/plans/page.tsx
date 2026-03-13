import type { Metadata } from "next";
import { SharedPlansIndex } from "@/app/dashboard/planner/shared";
import { fetchPublicSharedPlans } from "@/lib/supabase/queries/shared-plans";

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

  return <SharedPlansIndex plans={plans} />;
}
