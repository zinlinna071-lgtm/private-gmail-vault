import { describe, expect, it } from "vitest";
import {
  createVaultKeyEnvelope,
  importVaultKeyEncryptionKey,
  unwrapVaultDataKey
} from "../lib/vault/key-envelope";
import { decryptVaultRecord, encryptVaultRecord } from "../lib/vault/client-encryption";

const vaultId = "11111111-1111-4111-8111-111111111111";
const otherVaultId = "33333333-3333-4333-8333-333333333333";

async function makeKek(seed = 7) {
  return importVaultKeyEncryptionKey(new Uint8Array(32).fill(seed));
}

describe("client-side Vault key envelope", () => {
  it("consumes derived key bytes and imports a non-extractable KEK", async () => {
    const derived = new Uint8Array(32).fill(9);
    const kek = await importVaultKeyEncryptionKey(derived);
    expect(derived.every(byte => byte === 0)).toBe(true);
    expect(kek.extractable).toBe(false);
    expect(kek.algorithm.name).toBe("AES-GCM");
    expect(kek.usages).toContain("encrypt");
    expect(kek.usages).toContain("decrypt");
  });

  it("rejects a derived key with an unexpected length", async () => {
    await expect(importVaultKeyEncryptionKey(new Uint8Array(31))).rejects.toThrow();
  });

  it("creates a non-extractable DEK and wraps it for the selected Vault", async () => {
    const kek = await makeKek();
    const { dataKey, envelope } = await createVaultKeyEnvelope(kek, vaultId);

    expect(dataKey.extractable).toBe(false);
    expect(dataKey.algorithm.name).toBe("AES-GCM");
    expect(envelope.version).toBe(1);

    const unlockedKey = await unwrapVaultDataKey(envelope, kek, vaultId);
    expect(unlockedKey.extractable).toBe(false);

    const encrypted = await encryptVaultRecord("private account data", dataKey, vaultId,
      "22222222-2222-4222-8222-222222222222");
    await expect(decryptVaultRecord(encrypted, unlockedKey, vaultId,
      "22222222-2222-4222-8222-222222222222")).resolves.toBe("private account data");
  });

  it("uses a fresh nonce when wrapping each new data key", async () => {
    const kek = await makeKek();
    const first = await createVaultKeyEnvelope(kek, vaultId);
    const second = await createVaultKeyEnvelope(kek, vaultId);

    expect(first.envelope.iv).not.toBe(second.envelope.iv);
    expect(first.envelope.wrappedKey).not.toBe(second.envelope.wrappedKey);
  });

  it("rejects a different Vault context, wrong KEK, and tampered envelope", async () => {
    const kek = await makeKek();
    const { envelope } = await createVaultKeyEnvelope(kek, vaultId);

    await expect(unwrapVaultDataKey(envelope, kek, otherVaultId)).rejects.toThrow();
    await expect(unwrapVaultDataKey(envelope, await makeKek(8), vaultId)).rejects.toThrow();
    await expect(unwrapVaultDataKey({
      ...envelope,
      wrappedKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    }, kek, vaultId)).rejects.toThrow();
  });

  it("rejects unsupported versions and malformed envelope fields", async () => {
    const kek = await makeKek();
    const { envelope } = await createVaultKeyEnvelope(kek, vaultId);

    await expect(unwrapVaultDataKey({ ...envelope, version: 2 }, kek, vaultId)).rejects.toThrow();
    await expect(unwrapVaultDataKey({ ...envelope, iv: "bad" }, kek, vaultId)).rejects.toThrow();
    await expect(unwrapVaultDataKey({ ...envelope, unexpected: true }, kek, vaultId)).rejects.toThrow();
    await expect(unwrapVaultDataKey([], kek, vaultId)).rejects.toThrow();
    await expect(unwrapVaultDataKey(null, kek, vaultId)).rejects.toThrow();
    await expect(createVaultKeyEnvelope(kek, "not-a-vault-id")).rejects.toThrow();
  });
});
