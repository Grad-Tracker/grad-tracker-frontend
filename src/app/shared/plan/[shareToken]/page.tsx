import type { Metadata } from "next";
import { SharedPlanUnavailable, SharedPlanView } from "@/app/dashboard/planner/shared";
import {
  fetchSharedPlanByToken,
  fetchStudentPlanSummariesForUser,
  fetchOwnedPlanForUser,
} from "@/lib/supabase/queries/shared-plans";
import { createClient } from "@/lib/supabase/server";

type Params = { shareToken: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { shareToken } = await params;
  const plan = await fetchSharedPlanByToken(shareToken);

  if (!plan) {
    return {
      title: "Shared Plan Not Available | Grad Tracker",
      description: "This shared degree plan link is invalid, expired, or no longer active.",
      openGraph: {
        title: "Shared Plan Not Available | Grad Tracker",
        description: "This shared degree plan link is invalid, expired, or no longer active.",
      },
    };
  }

  const programText = plan.programNames.length > 0 ? plan.programNames.join(" / ") : "Degree plan";
  const description = `${plan.studentFirstName}'s shared plan for ${programText}. Review semesters, courses, and progress in read-only mode.`;

  return {
    title: `${plan.planName} | Shared Plan | Grad Tracker`,
    description,
    openGraph: {
      title: `${plan.planName} | Shared Plan | Grad Tracker`,
      description,
    },
  };
}

export default async function SharedPlanPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<{ myPlan?: string }>;
}) {
  const { shareToken } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};

  const plan = await fetchSharedPlanByToken(shareToken);
  if (!plan) return <SharedPlanUnavailable />;

  // Attempt to resolve user/session to show CTA and comparison options; continue gracefully if not available
  let ownPlans = [] as any[];
  let comparisonPlan = null as any | null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      ownPlans = await fetchStudentPlanSummariesForUser(supabase, user.id);
      const selectedPlanId = resolvedSearchParams.myPlan ? Number(resolvedSearchParams.myPlan) : null;
      if (selectedPlanId && !Number.isNaN(selectedPlanId)) {
        comparisonPlan = await fetchOwnedPlanForUser(supabase, user.id, selectedPlanId);
      }
    }
  } catch (err) {
    // non-fatal — proceed without user-specific data
    console.error("Failed to load user-specific plan data:", err);
    ownPlans = [];
    comparisonPlan = null;
  }

  return (
    <SharedPlanView
      plan={plan}
      showPlannerCta={ownPlans.length > 0}
      ownPlans={ownPlans}
      comparisonPlan={comparisonPlan}
    />
  );
}
