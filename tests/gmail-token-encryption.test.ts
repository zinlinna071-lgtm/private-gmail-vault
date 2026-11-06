import { afterEach, describe, expect, it } from "vitest";
import { decryptRefreshToken, encryptRefreshToken } from "@/lib/gmail/token-encryption";

const originalKey = process.env.VAULT_ENCRYPTION_KEY;
const context = { userId: "vault-user-test", googleSubject: "google-subject-test" };

afterEach(() => {
  if (originalKey === undefined) delete process.env.VAULT_ENCRYPTION_KEY;
  else process.env.VAULT_ENCRYPTION_KEY = originalKey;
});

describe("Gmail refresh token encryption", () => {
  it("encrypts and decrypts a refresh token with AES-256-GCM", () => {
    process.env.VAULT_ENCRYPTION_KEY = "c".repeat(64);
    const token = "google-refresh-token-test-value";
    const encrypted = encryptRefreshToken(token, context);

    expect(encrypted.ciphertext).not.toContain(token);
    expect(encrypted.keyVersion).toBe(1);
    expect(decryptRefreshToken(encrypted, context)).toBe(token);
  });

  it("uses a fresh IV for each encryption", () => {
    process.env.VAULT_ENCRYPTION_KEY = "d".repeat(64);
    const first = encryptRefreshToken("same-token", context);
    const second = encryptRefreshToken("same-token", context);

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("rejects tampered ciphertext and authentication tags", () => {
    process.env.VAULT_ENCRYPTION_KEY = "e".repeat(64);
    const encrypted = encryptRefreshToken("secret-token", context);

    expect(() => decryptRefreshToken({
      ...encrypted,
      ciphertext: Buffer.from("tampered").toString("base64")
    }, context)).toThrow();
    expect(() => decryptRefreshToken({
      ...encrypted,
      authTag: Buffer.alloc(16).toString("base64")
    }, context)).toThrow();
  });

  it("rejects missing or malformed encryption keys", () => {
    delete process.env.VAULT_ENCRYPTION_KEY;
    expect(() => encryptRefreshToken("secret-token", context)).toThrow();
    process.env.VAULT_ENCRYPTION_KEY = "not-a-key";
    expect(() => encryptRefreshToken("secret-token", context)).toThrow();
  });
});
