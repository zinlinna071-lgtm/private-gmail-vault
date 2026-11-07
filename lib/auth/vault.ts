import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const LOGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{3,31}$/;

export function normalizeLoginId(value: string) {
  const loginId = value.trim().toLowerCase();
  if (!LOGIN_ID_PATTERN.test(loginId)) {
    throw new Error("Login ID must be 4–32 characters and use letters, numbers, dots, underscores, or hyphens.");
  }
  return loginId;
}

export function authEmailForLoginId(loginId: string) {
  // This is an internal Supabase Auth identifier, not a real mailbox.
  const digest = createHash("sha256").update(loginId).digest("hex").slice(0, 24);
  return `${digest}@vault-login.invalid`;
}

export function validatePassword(password: string) {
  if (password.length < 12 || password.length > 128) {
    throw new Error("Master Password must be 12–128 characters.");
  }
}

export function createRecoveryCode() {
  const raw = randomBytes(20).toString("hex").toUpperCase();
  return raw.match(/.{1,5}/g)!.join("-");
}

export function hashRecoveryCode(code: string, salt = randomBytes(16).toString("hex")) {
  const normalized = code.replace(/[^a-f0-9]/gi, "").toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(normalized)) throw new Error("Recovery Code is invalid.");
  const hash = scryptSync(normalized, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyRecoveryCode(code: string, expectedHash: string, salt: string) {
  try {
    const actual = Buffer.from(hashRecoveryCode(code, salt).hash, "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Validate browser-originated state-changing requests.
 * These Vault endpoints are browser-only and require an explicit same-origin Origin.
 */
export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) return false;
  } catch {
    return false;
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
}
