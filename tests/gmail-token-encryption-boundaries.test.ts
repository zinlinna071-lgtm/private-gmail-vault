import { afterEach, describe, expect, it } from "vitest";
import { decryptRefreshToken, encryptRefreshToken } from "@/lib/gmail/token-encryption";

const originalEnv = {
  legacyKey: process.env.VAULT_ENCRYPTION_KEY,
  keyV1: process.env.GMAIL_TOKEN_ENCRYPTION_KEY_V1,
  keyV2: process.env.GMAIL_TOKEN_ENCRYPTION_KEY_V2,
  activeKeyVersion: process.env.GMAIL_TOKEN_ENCRYPTION_ACTIVE_KEY_VERSION,
  activeFormatVersion: process.env.GMAIL_TOKEN_ENCRYPTION_ACTIVE_FORMAT_VERSION
};

function restore(name: keyof typeof originalEnv, envName: string) {
  const value = originalEnv[name];
  if (value === undefined) delete process.env[envName];
  else process.env[envName] = value;
}

afterEach(() => {
  restore("legacyKey", "VAULT_ENCRYPTION_KEY");
  restore("keyV1", "GMAIL_TOKEN_ENCRYPTION_KEY_V1");
  restore("keyV2", "GMAIL_TOKEN_ENCRYPTION_KEY_V2");
  restore("activeKeyVersion", "GMAIL_TOKEN_ENCRYPTION_ACTIVE_KEY_VERSION");
  restore("activeFormatVersion", "GMAIL_TOKEN_ENCRYPTION_ACTIVE_FORMAT_VERSION");
});

describe("Gmail refresh token encryption boundaries", () => {
  const context = { userId: "vault-user-1", googleSubject: "google-subject-1" };

  it("keeps legacy version 1 encryption compatible by default", () => {
    process.env.VAULT_ENCRYPTION_KEY = "a".repeat(64);
    delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY_V1;
    delete process.env.GMAIL_TOKEN_ENCRYPTION_ACTIVE_KEY_VERSION;
    delete process.env.GMAIL_TOKEN_ENCRYPTION_ACTIVE_FORMAT_VERSION;

    const encrypted = encryptRefreshToken("synthetic-refresh-token", context);
    expect(encrypted.keyVersion).toBe(1);
    expect(encrypted.formatVersion).toBe(1);
    expect(decryptRefreshToken(encrypted, context)).toBe("synthetic-refresh-token");
  });

  it("rejects empty and oversized refresh tokens", () => {
    process.env.VAULT_ENCRYPTION_KEY = "a".repeat(64);
    expect(() => encryptRefreshToken("", context)).toThrow("Invalid Google refresh token.");
    expect(() => encryptRefreshToken("x".repeat(16_385), context)).toThrow("Invalid Google refresh token.");
  });

  it("uses the explicitly configured key version for new encryption", () => {
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY_V2 = "b".repeat(64);
    process.env.GMAIL_TOKEN_ENCRYPTION_ACTIVE_KEY_VERSION = "2";
    process.env.GMAIL_TOKEN_ENCRYPTION_ACTIVE_FORMAT_VERSION = "1";
    const encrypted = encryptRefreshToken("version-two-token", context);
    expect(encrypted.keyVersion).toBe(2);
    expect(decryptRefreshToken(encrypted, context)).toBe("version-two-token");
  });

  it("fails closed for unknown, malformed, or unconfigured key versions", () => {
    process.env.VAULT_ENCRYPTION_KEY = "c".repeat(64);
    expect(() => decryptRefreshToken({
      ciphertext: "AA==", iv: Buffer.alloc(12).toString("base64"),
      authTag: Buffer.alloc(16).toString("base64"), keyVersion: 3, formatVersion: 1
    }, context)).toThrow(/key version 3 is not configured/);
    expect(() => decryptRefreshToken({
      ciphertext: "AA==", iv: Buffer.alloc(12).toString("base64"),
      authTag: Buffer.alloc(16).toString("base64"), keyVersion: 0, formatVersion: 1
    }, context)).toThrow(/Invalid Gmail token encryption key version/);
  });

  it("binds format 2 ciphertext to the Vault user and Google subject", () => {
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY_V1 = "d".repeat(64);
    process.env.GMAIL_TOKEN_ENCRYPTION_ACTIVE_FORMAT_VERSION = "2";
    const encrypted = encryptRefreshToken("aad-bound-token", context);
    expect(encrypted.formatVersion).toBe(2);
    expect(decryptRefreshToken(encrypted, context)).toBe("aad-bound-token");
    expect(() => decryptRefreshToken(encrypted, { ...context, userId: "other-user" })).toThrow();
    expect(() => decryptRefreshToken(encrypted, { ...context, googleSubject: "other-google-user" })).toThrow();
  });

  it("rejects unsupported format versions and tampered authenticated fields", () => {
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY_V1 = "e".repeat(64);
    process.env.GMAIL_TOKEN_ENCRYPTION_ACTIVE_FORMAT_VERSION = "2";
    const encrypted = encryptRefreshToken("tamper-check-token", context);
    expect(() => decryptRefreshToken({ ...encrypted, formatVersion: 3 }, context)).toThrow(/Unsupported Gmail token encryption format/);
    expect(() => decryptRefreshToken({ ...encrypted, authTag: Buffer.alloc(16).toString("base64") }, context)).toThrow();
  });

  it("rejects malformed IV and authentication tag lengths", () => {
    process.env.VAULT_ENCRYPTION_KEY = "f".repeat(64);
    const encrypted = encryptRefreshToken("synthetic-refresh-token", context);
    expect(() => decryptRefreshToken({ ...encrypted, iv: Buffer.alloc(8).toString("base64") }, context)).toThrow();
    expect(() => decryptRefreshToken({ ...encrypted, authTag: Buffer.alloc(8).toString("base64") }, context)).toThrow();
  });
});
