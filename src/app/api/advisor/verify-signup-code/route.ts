import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const expectedCode = process.env.ADVISOR_SIGNUP_CODE;

  if (!expectedCode) {
    return NextResponse.json(
      { ok: false, message: "Server misconfigured" },
      { status: 500 }
    );
  }

  const body = (await request.json()) as { code?: string };

  if (body.code === expectedCode) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false, message: "Invalid access code" },
    { status: 401 }
  );
}
