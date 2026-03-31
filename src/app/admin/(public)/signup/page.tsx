import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdvisorSignupClient from "./AdvisorSignupClient";

export default async function AdminSignupPage() {
  const cookieStore = await cookies();

  if (cookieStore.get("advisor_signup_ok")?.value !== "1") {
    redirect("/signup");
  }

  return <AdvisorSignupClient />;
}
