import { afterEach, describe, expect, it } from "vitest";
import { decryptRefreshToken, encryptRefreshToken } from "@/lib/gmail/token-encryption";

const originalKey = process.env.VAULT_ENCRYPTION_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.VAULT_ENCRYPTION_KEY;
  else process.env.VAULT_ENCRYPTION_KEY = originalKey;
});

describe("Gmail refresh token encryption boundaries", () => {
  it("rejects empty and oversized refresh tokens", () => {
    process.env.VAULT_ENCRYPTION_KEY = "a".repeat(64);
    expect(() => encryptRefreshToken("")).toThrow("Invalid Google refresh token.");
    expect(() => encryptRefreshToken("x".repeat(16_385))).toThrow("Invalid Google refresh token.");
  });

  it("rejects decryption with a different valid key", () => {
    process.env.VAULT_ENCRYPTION_KEY = "b".repeat(64);
    const encrypted = encryptRefreshToken("synthetic-refresh-token");
    process.env.VAULT_ENCRYPTION_KEY = "c".repeat(64);
    expect(() => decryptRefreshToken(encrypted)).toThrow();
  });

  it("rejects malformed IV and authentication tag lengths", () => {
    process.env.VAULT_ENCRYPTION_KEY = "d".repeat(64);
    const encrypted = encryptRefreshToken("synthetic-refresh-token");
    expect(() => decryptRefreshToken({ ...encrypted, iv: Buffer.alloc(8).toString("base64") })).toThrow();
    expect(() => decryptRefreshToken({ ...encrypted, authTag: Buffer.alloc(8).toString("base64") })).toThrow();
  });

  it("rejects malformed ciphertext input", () => {
    process.env.VAULT_ENCRYPTION_KEY = "e".repeat(64);
    const encrypted = encryptRefreshToken("synthetic-refresh-token");
    expect(() => decryptRefreshToken({ ...encrypted, ciphertext: "%%%" })).toThrow();
  });
});
