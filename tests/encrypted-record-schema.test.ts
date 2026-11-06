import { describe, expect, it } from "vitest";
import { parseEncryptedVaultRecord } from "../lib/vault/encrypted-record-schema";

function base64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function validRecord() {
  return {
    version: 1,
    algorithm: "AES-256-GCM",
    iv: base64(new Uint8Array(12).fill(1)),
    ciphertext: base64(new Uint8Array([1, 2, 3, 4])),
    authTag: base64(new Uint8Array(16).fill(2))
  };
}

describe("encrypted Vault record schema", () => {
  it("accepts a valid opaque AES-256-GCM envelope", () => {
    expect(parseEncryptedVaultRecord(validRecord())).toEqual(validRecord());
  });

  it("rejects null, arrays, and primitives", () => {
    for (const value of [null, [], "record", 1]) {
      expect(() => parseEncryptedVaultRecord(value)).toThrow();
    }
  });

  it("rejects unsupported versions and algorithms", () => {
    expect(() => parseEncryptedVaultRecord({ ...validRecord(), version: 2 })).toThrow();
    expect(() => parseEncryptedVaultRecord({ ...validRecord(), algorithm: "AES-128-GCM" })).toThrow();
  });

  it("rejects unknown and missing fields", () => {
    expect(() => parseEncryptedVaultRecord({ ...validRecord(), userId: "attacker" })).toThrow();
    const { authTag: _authTag, ...missingTag } = validRecord();
    expect(() => parseEncryptedVaultRecord(missingTag)).toThrow();
  });

  it("requires canonical Base64", () => {
    expect(() => parseEncryptedVaultRecord({ ...validRecord(), iv: "!!!!" })).toThrow();
    expect(() => parseEncryptedVaultRecord({ ...validRecord(), ciphertext: "AQI=" })).not.toThrow();
    expect(() => parseEncryptedVaultRecord({ ...validRecord(), ciphertext: "AQI_" })).toThrow();
  });

  it("requires a 12-byte IV and 16-byte authentication tag", () => {
    expect(() => parseEncryptedVaultRecord({ ...validRecord(), iv: base64(new Uint8Array(11)) })).toThrow();
    expect(() => parseEncryptedVaultRecord({ ...validRecord(), authTag: base64(new Uint8Array(15)) })).toThrow();
  });

  it("rejects empty ciphertext", () => {
    expect(() => parseEncryptedVaultRecord({ ...validRecord(), ciphertext: "" })).toThrow();
  });

  it("rejects ciphertext above the 20 KB limit", () => {
    const oversized = base64(new Uint8Array(20_001).fill(7));
    expect(() => parseEncryptedVaultRecord({ ...validRecord(), ciphertext: oversized })).toThrow();
  });
});
