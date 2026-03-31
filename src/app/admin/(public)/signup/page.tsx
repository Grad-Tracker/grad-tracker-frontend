import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAdvisorSignupGateCookieName,
  verifyAdvisorSignupGateToken,
} from "@/lib/advisor-signup-gate";
import AdvisorSignupClient from "./AdvisorSignupClient";

export default async function AdminSignupPage() {
  const cookieStore = await cookies();

  const gateToken = cookieStore.get(getAdvisorSignupGateCookieName())?.value;

  if (!verifyAdvisorSignupGateToken(gateToken)) {
    redirect("/signup");
  }

  return <AdvisorSignupClient />;
}
