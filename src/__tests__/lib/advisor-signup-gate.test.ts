import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  getAdvisorSignupGateCookieName,
  getAdvisorSignupGateMaxAgeSeconds,
  createAdvisorSignupGateToken,
  verifyAdvisorSignupGateToken,
} from "@/lib/advisor-signup-gate";

describe("advisor-signup-gate", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    // Isolate process.env for each test
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  // ---------- Constants ----------

  describe("getAdvisorSignupGateCookieName", () => {
    it("returns the cookie name", () => {
      expect(getAdvisorSignupGateCookieName()).toBe("advisor_signup_gate");
    });
  });

  describe("getAdvisorSignupGateMaxAgeSeconds", () => {
    it("returns 300 seconds", () => {
      expect(getAdvisorSignupGateMaxAgeSeconds()).toBe(300);
    });
  });

  // ---------- createAdvisorSignupGateToken ----------

  describe("createAdvisorSignupGateToken", () => {
    it("returns null when ADVISOR_SIGNUP_CODE is not set", () => {
      delete process.env.ADVISOR_SIGNUP_CODE;
      expect(createAdvisorSignupGateToken()).toBeNull();
    });

    it("returns null when ADVISOR_SIGNUP_CODE is empty string", () => {
      process.env.ADVISOR_SIGNUP_CODE = "";
      expect(createAdvisorSignupGateToken()).toBeNull();
    });

    it("returns a token in the format expiresAt.signature when secret is set", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      const now = 1000000;
      const token = createAdvisorSignupGateToken(now);

      expect(token).not.toBeNull();
      expect(typeof token).toBe("string");

      const parts = token!.split(".");
      expect(parts).toHaveLength(2);

      // expiresAt should be now + 300 * 1000
      expect(parts[0]).toBe(String(now + 300 * 1000));

      // signature should be a non-empty base64url string
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it("produces deterministic output for the same now value and secret", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      const now = 5000000;
      const token1 = createAdvisorSignupGateToken(now);
      const token2 = createAdvisorSignupGateToken(now);
      expect(token1).toBe(token2);
    });

    it("produces different tokens for different now values", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      const token1 = createAdvisorSignupGateToken(1000);
      const token2 = createAdvisorSignupGateToken(2000);
      expect(token1).not.toBe(token2);
    });

    it("uses Date.now() as default when no argument is provided", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      const before = Date.now();
      const token = createAdvisorSignupGateToken();
      const after = Date.now();

      expect(token).not.toBeNull();
      const expiresAt = Number(token!.split(".")[0]);
      // expiresAt should be between before + 300s and after + 300s
      expect(expiresAt).toBeGreaterThanOrEqual(before + 300 * 1000);
      expect(expiresAt).toBeLessThanOrEqual(after + 300 * 1000);
    });
  });

  // ---------- verifyAdvisorSignupGateToken ----------

  describe("verifyAdvisorSignupGateToken", () => {
    // --- Missing secret / token ---

    it("returns false when ADVISOR_SIGNUP_CODE is not set", () => {
      delete process.env.ADVISOR_SIGNUP_CODE;
      expect(verifyAdvisorSignupGateToken("some.token")).toBe(false);
    });

    it("returns false when ADVISOR_SIGNUP_CODE is empty string", () => {
      process.env.ADVISOR_SIGNUP_CODE = "";
      expect(verifyAdvisorSignupGateToken("some.token")).toBe(false);
    });

    it("returns false when token is undefined", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      expect(verifyAdvisorSignupGateToken(undefined)).toBe(false);
    });

    it("returns false when token is null", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      expect(verifyAdvisorSignupGateToken(null)).toBe(false);
    });

    it("returns false when token is empty string", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      expect(verifyAdvisorSignupGateToken("")).toBe(false);
    });

    // --- Malformed tokens (missing parts) ---

    it("returns false when token has no dot separator", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      expect(verifyAdvisorSignupGateToken("nodot")).toBe(false);
    });

    it("returns false when token has empty expiresAt part", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      expect(verifyAdvisorSignupGateToken(".signature")).toBe(false);
    });

    it("returns false when token has empty signature part", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      expect(verifyAdvisorSignupGateToken("12345.")).toBe(false);
    });

    // --- Expired / invalid expiration ---

    it("returns false when expiresAt is not a valid number", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      expect(verifyAdvisorSignupGateToken("notanumber.sig", 1000)).toBe(false);
    });

    it("returns false when expiresAt is NaN (e.g. 'abc')", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      expect(verifyAdvisorSignupGateToken("abc.sig", 1000)).toBe(false);
    });

    it("returns false when expiresAt is Infinity", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      expect(verifyAdvisorSignupGateToken("Infinity.sig", 1000)).toBe(false);
    });

    it("returns false when token is expired (expiresAt <= now)", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      const now = 2000000;
      // Create a token that expired in the past
      const token = createAdvisorSignupGateToken(now - 400 * 1000);
      // Token's expiresAt = (now - 400000) + 300000 = now - 100000, which is < now
      expect(verifyAdvisorSignupGateToken(token!, now)).toBe(false);
    });

    it("returns false when expiresAt exactly equals now", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      // Manually construct a token where expiresAt == now
      const now = 5000000;
      const token = createAdvisorSignupGateToken(now - 300 * 1000);
      // expiresAt = (now - 300000) + 300000 = now, which is <= now
      expect(verifyAdvisorSignupGateToken(token!, now)).toBe(false);
    });

    // --- Signature length mismatch ---

    it("returns false when signature has wrong length", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      const now = 1000000;
      const expiresAt = String(now + 300 * 1000);
      // Use a short signature that won't match the expected length
      const badToken = `${expiresAt}.x`;
      expect(verifyAdvisorSignupGateToken(badToken, now)).toBe(false);
    });

    it("returns false when signature is too long", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      const now = 1000000;
      const expiresAt = String(now + 300 * 1000);
      // Create a very long signature
      const badToken = `${expiresAt}.${"a".repeat(200)}`;
      expect(verifyAdvisorSignupGateToken(badToken, now)).toBe(false);
    });

    // --- Tampered signature (correct length, wrong content) ---

    it("returns false when signature is tampered but has correct length", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      const now = 1000000;
      const token = createAdvisorSignupGateToken(now)!;
      const [expiresAt, sig] = token.split(".");

      // Flip a character in the signature to produce a same-length but different value
      const chars = sig.split("");
      chars[0] = chars[0] === "A" ? "B" : "A";
      const tamperedSig = chars.join("");
      const tamperedToken = `${expiresAt}.${tamperedSig}`;

      expect(verifyAdvisorSignupGateToken(tamperedToken, now)).toBe(false);
    });

    // --- Valid token (happy path) ---

    it("returns true for a valid, non-expired token", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      const now = 1000000;
      const token = createAdvisorSignupGateToken(now)!;
      expect(verifyAdvisorSignupGateToken(token, now)).toBe(true);
    });

    it("returns true when verified just before expiration", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      const now = 1000000;
      const token = createAdvisorSignupGateToken(now)!;
      // Verify 1ms before expiration
      const justBeforeExpiry = now + 300 * 1000 - 1;
      expect(verifyAdvisorSignupGateToken(token, justBeforeExpiry)).toBe(true);
    });

    it("returns true using default now parameter", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      // Create with explicit now, verify immediately (Date.now() should be close)
      const now = Date.now();
      const token = createAdvisorSignupGateToken(now)!;
      // The token expires 300s from now, so verifying immediately should succeed
      expect(verifyAdvisorSignupGateToken(token)).toBe(true);
    });

    // --- Different secrets ---

    it("returns false when verified with a different secret than creation", () => {
      process.env.ADVISOR_SIGNUP_CODE = "secret-one";
      const now = 1000000;
      const token = createAdvisorSignupGateToken(now)!;

      // Change the secret
      process.env.ADVISOR_SIGNUP_CODE = "secret-two";
      expect(verifyAdvisorSignupGateToken(token, now)).toBe(false);
    });

    // --- Edge: token with multiple dots ---

    it("handles token with extra dots (only splits on first dot)", () => {
      process.env.ADVISOR_SIGNUP_CODE = "test-secret";
      const now = 1000000;
      // split(".") with no limit returns all parts; token.split(".") gives [expiresAt, sig-part1, sig-part2]
      // The function destructures as [expiresAt, signature] where signature only gets the second element
      // So a token like "123.abc.def" would have signature = "abc", not "abc.def"
      // This means a valid token's signature should never contain a dot
      const expiresAt = String(now + 300 * 1000);
      const tokenWithExtraDots = `${expiresAt}.abc.def`;
      // The signature extracted will be "abc", which won't match the HMAC
      expect(verifyAdvisorSignupGateToken(tokenWithExtraDots, now)).toBe(false);
    });
  });
});
