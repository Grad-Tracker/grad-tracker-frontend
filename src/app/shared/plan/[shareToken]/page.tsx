import type { Metadata } from "next";
import { SharedPlanUnavailable, SharedPlanView } from "@/app/dashboard/planner/shared";
import {
  fetchOwnedPlanForUser,
  fetchSharedPlanByToken,
  fetchStudentPlanSummariesForUser,
} from "@/lib/supabase/queries/shared-plans";
import { createClient } from "@/lib/supabase/server";

type SharedPlanPageProps = {
  params: Promise<{
    shareToken: string;
  }>;
  searchParams?: Promise<{
    myPlan?: string;
  }>;
};

export async function generateMetadata({
  params,
}: SharedPlanPageProps): Promise<Metadata> {
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

  const programText =
    plan.programNames.length > 0 ? plan.programNames.join(" / ") : "Degree plan";
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
}: SharedPlanPageProps) {
  const { shareToken } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const plan = await fetchSharedPlanByToken(shareToken);

  if (!plan) {
    return <SharedPlanUnavailable />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ownPlans = user ? await fetchStudentPlanSummariesForUser(supabase, user.id) : [];
  const selectedPlanId = resolvedSearchParams.myPlan ? Number(resolvedSearchParams.myPlan) : null;
  const comparisonPlan =
    user && selectedPlanId && !Number.isNaN(selectedPlanId)
      ? await fetchOwnedPlanForUser(supabase, user.id, selectedPlanId)
      : null;

  return (
    <SharedPlanView
      plan={plan}
      showPlannerCta={Boolean(user)}
      ownPlans={ownPlans}
      comparisonPlan={comparisonPlan}
    />
  );
}
