import { NextResponse } from "next/server";

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
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false, message: "Invalid access code" },
    { status: 401 }
  );
}
