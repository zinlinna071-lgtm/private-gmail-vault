import "server-only";
import { createHash, randomBytes } from "node:crypto";

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export const CURATOR_SESSION_COOKIE = "vault_curator_session";
export const CURATOR_CHALLENGE_COOKIE = "vault_curator_challenge";
export const CURATOR_CLAIM_COOKIE = "vault_curator_claim";
export const CURATOR_CLAIM_TTL_SECONDS = 10 * 60;
export const CURATOR_CHALLENGE_TTL_SECONDS = 10 * 60;
