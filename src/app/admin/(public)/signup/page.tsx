import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdvisorSignupGateToken } from "@/lib/advisor-signup-gate";
import AdvisorSignupClient from "./AdvisorSignupClient";

export default async function AdminSignupPage() {
  const cookieStore = await cookies();

  const gateToken = cookieStore.get("advisor_signup_ok")?.value;

  if (!verifyAdvisorSignupGateToken(gateToken)) {
    redirect("/signup");
  }

  return <AdvisorSignupClient />;
}
