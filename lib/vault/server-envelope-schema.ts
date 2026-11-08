import { z } from "zod";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const MAX_CIPHERTEXT_BYTES = 20_000;

function isCanonicalBase64(value: string, expectedBytes?: number, maxBytes?: number): boolean {
  if (!BASE64_PATTERN.test(value)) return false;
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) return false;
  if (expectedBytes !== undefined && decoded.length !== expectedBytes) return false;
  if (maxBytes !== undefined && (decoded.length < 1 || decoded.length > maxBytes)) return false;
  return true;
}

export const vaultRecordIdSchema = z.string().regex(UUID_PATTERN);

export const vaultCiphertextEnvelopeSchema = z.object({
  version: z.literal(1),
  algorithm: z.literal("AES-256-GCM"),
  iv: z.string().length(16).refine(value => isCanonicalBase64(value, 12)),
  ciphertext: z.string().min(4).max(26_668).refine(value =>
    isCanonicalBase64(value, undefined, MAX_CIPHERTEXT_BYTES)
  ),
  authTag: z.string().length(24).refine(value => isCanonicalBase64(value, 16))
}).strict();

export const vaultCiphertextCreateSchema = z.object({
  id: vaultRecordIdSchema,
  envelope: vaultCiphertextEnvelopeSchema
}).strict();

export const vaultCiphertextUpdateSchema = z.object({
  envelope: vaultCiphertextEnvelopeSchema
}).strict();

export type VaultCiphertextEnvelope = z.infer<typeof vaultCiphertextEnvelopeSchema>;
