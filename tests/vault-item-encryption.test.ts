import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptVaultItem, encryptVaultItem } from "../lib/vault/item-encryption";

const key = "a".repeat(64);
const userId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";

describe("Vault item encryption", () => {
  const previousKey = process.env.VAULT_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.VAULT_ENCRYPTION_KEY = key;
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.VAULT_ENCRYPTION_KEY;
    else process.env.VAULT_ENCRYPTION_KEY = previousKey;
  });

  it("encrypts and decrypts an account entry", () => {
    const plaintext = JSON.stringify({
      accountName: "Example",
      username: "user@example.com",
      password: "correct horse battery staple",
      backupCodes: "code-one\\ncode-two",
      notes: "private note"
    });
    const encrypted = encryptVaultItem(plaintext, userId, itemId);

    expect(encrypted.ciphertext).not.toContain("correct horse battery staple");
    expect(decryptVaultItem(encrypted, userId, itemId)).toBe(plaintext);
    expect(encrypted.iv).not.toBe("");
    expect(encrypted.authTag).not.toBe("");
  });

  it("binds ciphertext to its Vault user and record", () => {
    const encrypted = encryptVaultItem("secret", userId, itemId);
    expect(() => decryptVaultItem(encrypted, "33333333-3333-4333-8333-333333333333", itemId)).toThrow();
    expect(() => decryptVaultItem(encrypted, userId, "44444444-4444-4444-8444-444444444444")).toThrow();
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptVaultItem("secret", userId, itemId);
    const tampered = { ...encrypted, ciphertext: Buffer.from("tampered").toString("base64") };
    expect(() => decryptVaultItem(tampered, userId, itemId)).toThrow();
  });

  it("fails closed when the encryption key is missing or malformed", () => {
    delete process.env.VAULT_ENCRYPTION_KEY;
    expect(() => encryptVaultItem("secret", userId, itemId)).toThrow(/not configured/i);
    process.env.VAULT_ENCRYPTION_KEY = "not-a-key";
    expect(() => encryptVaultItem("secret", userId, itemId)).toThrow(/not configured/i);
  });
});
