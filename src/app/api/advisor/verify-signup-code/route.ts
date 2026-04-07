import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createAdvisorSignupGateToken,
  getAdvisorSignupGateCookieName,
  getAdvisorSignupGateMaxAgeSeconds,
} from "@/lib/advisor-signup-gate";

/** Simple in-memory rate limiter: max attempts per IP within a sliding window. */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, message: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

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

  if (
    !body.code ||
    typeof body.code !== "string" ||
    body.code.length > 256
  ) {
    return NextResponse.json(
      { ok: false, message: "Invalid request" },
      { status: 400 }
    );
  }

  const provided = Buffer.from(body.code);
  const expected = Buffer.from(expectedCode);
  const codesMatch =
    provided.length === expected.length && timingSafeEqual(provided, expected);

  if (codesMatch) {
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
