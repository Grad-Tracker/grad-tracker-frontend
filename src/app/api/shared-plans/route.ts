import { fetchPublicSharedPlans } from "@/lib/supabase/queries/shared-plans";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? "3");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 12) : 3;

  const plans = await fetchPublicSharedPlans(limit);

  return Response.json({ plans });
}
