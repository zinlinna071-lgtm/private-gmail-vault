import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decryptVaultRecord,
  encryptVaultRecord,
  validateVaultRecordEnvelope
} from "@/lib/vault/record-envelope";

const vaultId = "11111111-1111-4111-8111-111111111111";
const recordId = "22222222-2222-4222-8222-222222222222";

async function createDataKey(): Promise<CryptoKey> {
  return webcrypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

describe("browser-side Vault record encryption", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", webcrypto);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips plaintext using a non-extractable AES-256-GCM key", async () => {
    const key = await createDataKey();
    const plaintext = JSON.stringify({ accountName: "Example", password: "secret" });
    const envelope = await encryptVaultRecord(plaintext, key, vaultId, recordId);

    expect(envelope.algorithm).toBe("AES-256-GCM");
    expect(envelope.iv).not.toBe("");
    expect(await decryptVaultRecord(envelope, key, vaultId, recordId)).toBe(plaintext);
  });

  it("uses a fresh nonce for each encryption", async () => {
    const key = await createDataKey();
    const first = await encryptVaultRecord("same", key, vaultId, recordId);
    const second = await encryptVaultRecord("same", key, vaultId, recordId);
    expect(second.iv).not.toBe(first.iv);
  });

  it("rejects tampered ciphertext and authentication tags", async () => {
    const key = await createDataKey();
    const envelope = await encryptVaultRecord("secret", key, vaultId, recordId);
    const changedCiphertext = { ...envelope, ciphertext: envelope.ciphertext.slice(0, -4) + "AAAA" };
    const changedTag = { ...envelope, authTag: envelope.authTag.slice(0, -4) + "AAAA" };

    await expect(decryptVaultRecord(changedCiphertext, key, vaultId, recordId)).rejects.toThrow();
    await expect(decryptVaultRecord(changedTag, key, vaultId, recordId)).rejects.toThrow();
  });

  it("rejects a different Vault ID or record ID through AAD binding", async () => {
    const key = await createDataKey();
    const envelope = await encryptVaultRecord("secret", key, vaultId, recordId);

    await expect(decryptVaultRecord(envelope, key, "33333333-3333-4333-8333-333333333333", recordId)).rejects.toThrow();
    await expect(decryptVaultRecord(envelope, key, vaultId, "44444444-4444-4444-8444-444444444444")).rejects.toThrow();
  });

  it("rejects wrong keys, malformed envelopes, and extra fields", async () => {
    const key = await createDataKey();
    const wrongKey = await createDataKey();
    const envelope = await encryptVaultRecord("secret", key, vaultId, recordId);

    await expect(decryptVaultRecord(envelope, wrongKey, vaultId, recordId)).rejects.toThrow();
    expect(() => validateVaultRecordEnvelope({ ...envelope, extra: true })).toThrow();
    expect(() => validateVaultRecordEnvelope({ ...envelope, version: 99 })).toThrow();
    expect(() => validateVaultRecordEnvelope({ ...envelope, iv: "not-base64" })).toThrow();
  });

  it("rejects empty and oversized plaintext", async () => {
    const key = await createDataKey();
    await expect(encryptVaultRecord("", key, vaultId, recordId)).rejects.toThrow();
    await expect(encryptVaultRecord("x".repeat(20_001), key, vaultId, recordId)).rejects.toThrow();
  });

  it("rejects invalid context and extractable keys", async () => {
    const key = await createDataKey();
    const extractableKey = await webcrypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    await expect(encryptVaultRecord("secret", key, "not-a-uuid", recordId)).rejects.toThrow();
    await expect(encryptVaultRecord("secret", extractableKey, vaultId, recordId)).rejects.toThrow();
  });
});
