import { describe, expect, it } from "vitest";
import {
  isVaultWorkerResponse,
  parseVaultWorkerRequest
} from "../lib/vault/worker-protocol";
import { encryptVaultRecord } from "../lib/vault/record-envelope";

const vaultId = "11111111-1111-4111-8111-111111111111";
const recordId = "22222222-2222-4222-8222-222222222222";

function initializeRequest() {
  return {
    type: "INITIALIZE",
    requestId: "req_123",
    unlockSecretBuffer: new TextEncoder().encode("local test secret").buffer,
    saltBytes: new Uint8Array(16).buffer,
    profileId: 1,
    vaultId
  };
}

describe("Vault crypto Worker protocol", () => {
  it("accepts a valid initialization request with bounded transferable buffers", () => {
    const request = parseVaultWorkerRequest(initializeRequest());
    expect(request.type).toBe("INITIALIZE");
    expect(request.unlockSecretBuffer.byteLength).toBeGreaterThan(0);
    expect(request.saltBytes.byteLength).toBe(16);
  });

  it("rejects unexpected fields, invalid IDs, and unsupported KDF profiles", () => {
    expect(() => parseVaultWorkerRequest({ ...initializeRequest(), role: "owner" })).toThrow("INVALID_REQUEST");
    expect(() => parseVaultWorkerRequest({ ...initializeRequest(), requestId: "bad id" })).toThrow("INVALID_REQUEST");
    expect(() => parseVaultWorkerRequest({ ...initializeRequest(), profileId: 3 })).toThrow("INVALID_REQUEST");
    expect(() => parseVaultWorkerRequest({ ...initializeRequest(), vaultId: "not-a-uuid" })).toThrow("INVALID_REQUEST");
  });

  it("rejects empty, oversized, and incorrectly sized secret/salt buffers", () => {
    expect(() => parseVaultWorkerRequest({
      ...initializeRequest(),
      unlockSecretBuffer: new ArrayBuffer(0)
    })).toThrow("INVALID_REQUEST");
    expect(() => parseVaultWorkerRequest({
      ...initializeRequest(),
      unlockSecretBuffer: new ArrayBuffer(4_097)
    })).toThrow("INVALID_REQUEST");
    expect(() => parseVaultWorkerRequest({
      ...initializeRequest(),
      saltBytes: new ArrayBuffer(15)
    })).toThrow("INVALID_REQUEST");
  });

  it("accepts valid lock and ping messages but rejects extra properties", () => {
    expect(parseVaultWorkerRequest({ type: "LOCK", requestId: "lock_1" }).type).toBe("LOCK");
    expect(parseVaultWorkerRequest({ type: "PING", requestId: "ping_1" }).type).toBe("PING");
    expect(() => parseVaultWorkerRequest({ type: "LOCK", requestId: "lock_1", key: "secret" })).toThrow();
  });

  it("validates record requests and rejects malformed ciphertext envelopes", async () => {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    const envelope = await encryptVaultRecord("{}", key, vaultId, recordId);
    expect(parseVaultWorkerRequest({
      type: "DECRYPT_RECORD",
      requestId: "dec_1",
      recordId,
      envelope
    }).type).toBe("DECRYPT_RECORD");

    expect(() => parseVaultWorkerRequest({
      type: "DECRYPT_RECORD",
      requestId: "dec_2",
      recordId,
      envelope: { ...envelope, extra: true }
    })).toThrow("INVALID_REQUEST");
    expect(() => parseVaultWorkerRequest({
      type: "ENCRYPT_RECORD",
      requestId: "enc_1",
      recordId,
      plaintext: ""
    })).toThrow("INVALID_REQUEST");
  });

  it("accepts only well-formed non-secret response messages", () => {
    expect(isVaultWorkerResponse({ type: "READY", requestId: "ready_1" })).toBe(true);
    expect(isVaultWorkerResponse({ type: "UNLOCKED", requestId: "unlock_1" })).toBe(true);
    expect(isVaultWorkerResponse({ type: "ERROR", requestId: "err_1", code: "UNLOCK_FAILED" })).toBe(true);
    expect(isVaultWorkerResponse({
      type: "ERROR",
      requestId: "err_2",
      code: "UNLOCK_FAILED",
      message: "wrong password"
    })).toBe(false);
    expect(isVaultWorkerResponse({
      type: "UNLOCKED",
      requestId: "unlock_2",
      dataKey: "not allowed"
    })).toBe(false);
    expect(isVaultWorkerResponse({ type: "UNKNOWN", requestId: "x" })).toBe(false);
  });
});
