import { createHmac, timingSafeEqual } from "node:crypto";

const GATE_COOKIE_NAME = "advisor_signup_gate";
const GATE_MAX_AGE_SECONDS = 300;

function getSecret() {
  return process.env.ADVISOR_SIGNUP_CODE;
}

function signValue(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function getAdvisorSignupGateCookieName() {
  return GATE_COOKIE_NAME;
}

export function getAdvisorSignupGateMaxAgeSeconds() {
  return GATE_MAX_AGE_SECONDS;
}

export function createAdvisorSignupGateToken(now = Date.now()) {
  const secret = getSecret();

  if (!secret) {
    return null;
  }

  const expiresAt = String(now + GATE_MAX_AGE_SECONDS * 1000);
  const signature = signValue(expiresAt, secret);
  return `${expiresAt}.${signature}`;
}

export function verifyAdvisorSignupGateToken(token?: string | null, now = Date.now()) {
  const secret = getSecret();

  if (!secret || !token) {
    return false;
  }

  const [expiresAt, signature] = token.split(".");

  if (!expiresAt || !signature) {
    return false;
  }

  const expirationTime = Number(expiresAt);

  if (!Number.isFinite(expirationTime) || expirationTime <= now) {
    return false;
  }

  const expectedSignature = signValue(expiresAt, secret);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
