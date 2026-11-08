import { describe, expect, it } from "vitest";
import {
  vaultCiphertextCreateSchema,
  vaultCiphertextEnvelopeSchema,
  vaultCiphertextUpdateSchema
} from "@/lib/vault/server-envelope-schema";

const validEnvelope = {
  version: 1,
  algorithm: "AES-256-GCM",
  iv: Buffer.alloc(12, 1).toString("base64"),
  ciphertext: Buffer.from("encrypted bytes").toString("base64"),
  authTag: Buffer.alloc(16, 2).toString("base64")
};

describe("server ciphertext envelope validation", () => {
  it("accepts a canonical AES-256-GCM envelope without decrypting it", () => {
    expect(vaultCiphertextEnvelopeSchema.safeParse(validEnvelope).success).toBe(true);
  });

  it("requires exact envelope fields and protocol identifiers", () => {
    expect(vaultCiphertextEnvelopeSchema.safeParse({ ...validEnvelope, plaintext: "secret" }).success).toBe(false);
    expect(vaultCiphertextEnvelopeSchema.safeParse({ ...validEnvelope, version: 2 }).success).toBe(false);
    expect(vaultCiphertextEnvelopeSchema.safeParse({ ...validEnvelope, algorithm: "AES-128-GCM" }).success).toBe(false);
  });

  it("rejects invalid nonce, tag, and non-canonical Base64", () => {
    expect(vaultCiphertextEnvelopeSchema.safeParse({ ...validEnvelope, iv: "short" }).success).toBe(false);
    expect(vaultCiphertextEnvelopeSchema.safeParse({ ...validEnvelope, authTag: "A".repeat(24) }).success).toBe(false);
    expect(vaultCiphertextEnvelopeSchema.safeParse({ ...validEnvelope, ciphertext: "!!!!" }).success).toBe(false);
    expect(vaultCiphertextEnvelopeSchema.safeParse({ ...validEnvelope, ciphertext: "AAAA=" }).success).toBe(false);
  });

  it("rejects empty or oversized ciphertext", () => {
    expect(vaultCiphertextEnvelopeSchema.safeParse({ ...validEnvelope, ciphertext: "" }).success).toBe(false);
    expect(vaultCiphertextEnvelopeSchema.safeParse({
      ...validEnvelope,
      ciphertext: Buffer.alloc(20_001, 3).toString("base64")
    }).success).toBe(false);
  });

  it("requires a UUID record ID and rejects plaintext create/update contracts", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect(vaultCiphertextCreateSchema.safeParse({ id, envelope: validEnvelope }).success).toBe(true);
    expect(vaultCiphertextCreateSchema.safeParse({ id: "not-a-uuid", envelope: validEnvelope }).success).toBe(false);
    expect(vaultCiphertextCreateSchema.safeParse({
      id, envelope: validEnvelope, password: "plaintext"
    }).success).toBe(false);
    expect(vaultCiphertextUpdateSchema.safeParse({ envelope: validEnvelope }).success).toBe(true);
    expect(vaultCiphertextUpdateSchema.safeParse({ ...validEnvelope, password: "plaintext" }).success).toBe(false);
  });
});
