import { NextResponse } from "next/server";
import {
  createAdvisorSignupGateToken,
  getAdvisorSignupGateCookieName,
  getAdvisorSignupGateMaxAgeSeconds,
} from "@/lib/advisor-signup-gate";

export async function POST(request: Request) {
  const expectedCode = process.env.ADVISOR_SIGNUP_CODE;

  if (!expectedCode) {
    return NextResponse.json(
      { ok: false, message: "Server misconfigured" },
      { status: 500 }
    );
  }

  let body: { code?: string };

  try {
    body = (await request.json()) as { code?: string };
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request" },
      { status: 400 }
    );
  }

  if (!body.code) {
    return NextResponse.json(
      { ok: false, message: "Invalid request" },
      { status: 400 }
    );
  }

  if (body.code === expectedCode) {
    const token = createAdvisorSignupGateToken();

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Server misconfigured" },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(getAdvisorSignupGateCookieName(), token, {
      path: "/",
      maxAge: getAdvisorSignupGateMaxAgeSeconds(),
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  }

  return NextResponse.json(
    { ok: false, message: "Invalid access code" },
    { status: 401 }
  );
}
