import { NextResponse } from "next/server";
import { getAdvisorSignupGateCookieName } from "@/lib/advisor-signup-gate";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getAdvisorSignupGateCookieName(), "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
