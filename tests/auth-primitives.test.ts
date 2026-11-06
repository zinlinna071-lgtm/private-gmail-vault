import { afterEach, describe, expect, it } from "vitest";
import {
  authEmailForLoginId,
  createRecoveryCode,
  hashRecoveryCode,
  isSameOriginRequest,
  normalizeLoginId,
  validatePassword,
  verifyRecoveryCode
} from "@/lib/auth/vault";
import {
  decryptPendingRecoveryCode,
  encryptPendingRecoveryCode
} from "@/lib/auth/recovery-encryption";

const originalEncryptionKey = process.env.VAULT_ENCRYPTION_KEY;

afterEach(() => {
  if (originalEncryptionKey === undefined) delete process.env.VAULT_ENCRYPTION_KEY;
  else process.env.VAULT_ENCRYPTION_KEY = originalEncryptionKey;
});

describe("Vault credentials", () => {
  it("normalizes valid Login IDs and rejects invalid ones", () => {
    expect(normalizeLoginId("  My.Vault_01 ")).toBe("my.vault_01");
    expect(() => normalizeLoginId("abc")).toThrow();
    expect(() => normalizeLoginId("bad id!")).toThrow();
  });

  it("enforces Master Password length boundaries", () => {
    expect(() => validatePassword("x".repeat(11))).toThrow();
    expect(() => validatePassword("x".repeat(12))).not.toThrow();
    expect(() => validatePassword("x".repeat(128))).not.toThrow();
    expect(() => validatePassword("x".repeat(129))).toThrow();
  });

  it("derives a stable non-mailbox Supabase identifier", () => {
    expect(authEmailForLoginId("myvault")).toBe(authEmailForLoginId("myvault"));
    expect(authEmailForLoginId("myvault")).toMatch(/^[a-f0-9]{24}@vault-login\.invalid$/);
    expect(authEmailForLoginId("myvault")).not.toBe(authEmailForLoginId("othervault"));
  });
});

describe("Recovery Code", () => {
  it("generates a 160-bit code in eight groups of five", () => {
    expect(createRecoveryCode()).toMatch(/^(?:[A-F0-9]{5}-){7}[A-F0-9]{5}$/);
  });

  it("hashes and verifies codes, including lowercase input", () => {
    const code = createRecoveryCode();
    const stored = hashRecoveryCode(code);
    expect(stored.hash).toMatch(/^[a-f0-9]{128}$/);
    expect(verifyRecoveryCode(code.toLowerCase(), stored.hash, stored.salt)).toBe(true);
    expect(verifyRecoveryCode(createRecoveryCode(), stored.hash, stored.salt)).toBe(false);
  });

  it("rejects malformed recovery codes", () => {
    expect(verifyRecoveryCode("not-a-code", "invalid", "salt")).toBe(false);
  });
});

describe("same-origin protection", () => {
  it("accepts a matching Origin", () => {
    const request = new Request("https://vault.example/api/auth/login", {
      method: "POST",
      headers: { Origin: "https://vault.example", "Sec-Fetch-Site": "same-origin" }
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("rejects missing, mismatched, and cross-site origins", () => {
    expect(isSameOriginRequest(new Request("https://vault.example/api/auth/login", { method: "POST" }))).toBe(false);
    expect(isSameOriginRequest(new Request("https://vault.example/api/auth/login", {
      method: "POST", headers: { Origin: "https://attacker.example" }
    }))).toBe(false);
    expect(isSameOriginRequest(new Request("https://vault.example/api/auth/login", {
      method: "POST", headers: { Origin: "https://vault.example", "Sec-Fetch-Site": "cross-site" }
    }))).toBe(false);
  });
});

describe("pending Recovery Code encryption", () => {
  it("round-trips with AES-256-GCM", () => {
    process.env.VAULT_ENCRYPTION_KEY = "a".repeat(64);
    const code = createRecoveryCode();
    const encrypted = encryptPendingRecoveryCode(code);
    expect(encrypted.ciphertext).not.toContain(code);
    expect(decryptPendingRecoveryCode(encrypted)).toBe(code);
  });

  it("rejects tampered ciphertext", () => {
    process.env.VAULT_ENCRYPTION_KEY = "b".repeat(64);
    const encrypted = encryptPendingRecoveryCode(createRecoveryCode());
    expect(() => decryptPendingRecoveryCode({
      ...encrypted,
      ciphertext: Buffer.from("tampered").toString("base64")
    })).toThrow();
  });

  it("rejects missing or malformed encryption keys", () => {
    delete process.env.VAULT_ENCRYPTION_KEY;
    expect(() => encryptPendingRecoveryCode(createRecoveryCode())).toThrow();
    process.env.VAULT_ENCRYPTION_KEY = "not-a-key";
    expect(() => encryptPendingRecoveryCode(createRecoveryCode())).toThrow();
  });
});
