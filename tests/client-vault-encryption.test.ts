import { beforeAll, describe, expect, it } from "vitest";
import {
  decryptVaultRecord,
  encryptVaultRecord,
  generateVaultDataKey
} from "../lib/vault/client-encryption";

const vaultId = "11111111-1111-4111-8111-111111111111";
const recordId = "22222222-2222-4222-8222-222222222222";
const otherVaultId = "33333333-3333-4333-8333-333333333333";
const otherRecordId = "44444444-4444-4444-8444-444444444444";

describe("browser-side Vault record encryption", () => {
  let key: CryptoKey;

  beforeAll(async () => {
    key = await generateVaultDataKey();
  });

  it("generates an AES-256-GCM data key", () => {
    expect(key.type).toBe("secret");
    expect(key.algorithm.name).toBe("AES-GCM");
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
    expect(key.usages).toContain("encrypt");
    expect(key.usages).toContain("decrypt");
  });

  it("round-trips a complete account record", async () => {
    const plaintext = JSON.stringify({
      accountName: "Example",
      username: "owner@example.test",
      password: "not-a-real-password",
      backupCodes: "not-a-real-code"
    });
    const encrypted = await encryptVaultRecord(plaintext, key, vaultId, recordId);

    expect(encrypted.ciphertext).not.toContain("not-a-real-password");
    expect(encrypted.version).toBe(1);
    expect(encrypted.algorithm).toBe("AES-256-GCM");
    await expect(decryptVaultRecord(encrypted, key, vaultId, recordId)).resolves.toBe(plaintext);
  });

  it("uses a fresh nonce for each encryption", async () => {
    const first = await encryptVaultRecord("same payload", key, vaultId, recordId);
    const second = await encryptVaultRecord("same payload", key, vaultId, recordId);
    expect(first.iv).not.toBe(second.iv);
  });

  it("rejects ciphertext bound to another Vault or record", async () => {
    const encrypted = await encryptVaultRecord("secret", key, vaultId, recordId);
    await expect(decryptVaultRecord(encrypted, key, otherVaultId, recordId)).rejects.toThrow();
    await expect(decryptVaultRecord(encrypted, key, vaultId, otherRecordId)).rejects.toThrow();
  });

  it("rejects tampering and the wrong data key", async () => {
    const encrypted = await encryptVaultRecord("secret", key, vaultId, recordId);
    const tampered = { ...encrypted, authTag: "AAAAAAAAAAAAAAAAAAAAAA==" };
    const wrongKey = await generateVaultDataKey();

    await expect(decryptVaultRecord(tampered, key, vaultId, recordId)).rejects.toThrow();
    await expect(decryptVaultRecord(encrypted, wrongKey, vaultId, recordId)).rejects.toThrow();
  });

  it("rejects unsupported or malformed envelopes", async () => {
    const encrypted = await encryptVaultRecord("secret", key, vaultId, recordId);
    await expect(decryptVaultRecord({ ...encrypted, version: 2 }, key, vaultId, recordId)).rejects.toThrow();
    await expect(decryptVaultRecord({ ...encrypted, iv: "bad" }, key, vaultId, recordId)).rejects.toThrow();
    await expect(decryptVaultRecord(null, key, vaultId, recordId)).rejects.toThrow();
  });

  it("rejects empty, oversized, and invalid-context inputs", async () => {
    await expect(encryptVaultRecord("", key, vaultId, recordId)).rejects.toThrow();
    await expect(encryptVaultRecord("x".repeat(20_001), key, vaultId, recordId)).rejects.toThrow();
    await expect(encryptVaultRecord("secret", key, "not-a-uuid", recordId)).rejects.toThrow();
  });
});
