import {
  VAULT_RECORD_ALGORITHM,
  VAULT_RECORD_FORMAT_VERSION,
  type EncryptedVaultRecord
} from "./client-encryption";

const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const MAX_CIPHERTEXT_BYTES = 20_000;
const MAX_BASE64_LENGTH = Math.ceil(MAX_CIPHERTEXT_BYTES / 3) * 4;

function decodeCanonicalBase64(value: unknown, maxLength: number): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new Error("Invalid encrypted Vault record.");
  }

  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new Error("Invalid encrypted Vault record.");
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  let canonical = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    canonical += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  if (btoa(canonical) !== value) {
    bytes.fill(0);
    throw new Error("Invalid encrypted Vault record.");
  }
  return bytes;
}

/**
 * Validate the opaque record envelope at the API boundary.
 * This function checks only public protocol metadata and never decrypts data.
 */
export function parseEncryptedVaultRecord(value: unknown): EncryptedVaultRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid encrypted Vault record.");
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expectedKeys = ["algorithm", "authTag", "ciphertext", "iv", "version"];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    record.version !== VAULT_RECORD_FORMAT_VERSION ||
    record.algorithm !== VAULT_RECORD_ALGORITHM
  ) {
    throw new Error("Unsupported encrypted Vault record.");
  }

  const iv = decodeCanonicalBase64(record.iv, 16);
  const ciphertext = decodeCanonicalBase64(record.ciphertext, MAX_BASE64_LENGTH);
  const authTag = decodeCanonicalBase64(record.authTag, 24);

  try {
    if (
      iv.length !== IV_BYTES ||
      authTag.length !== AUTH_TAG_BYTES ||
      ciphertext.length === 0 ||
      ciphertext.length > MAX_CIPHERTEXT_BYTES
    ) {
      throw new Error("Invalid encrypted Vault record.");
    }
  } finally {
    iv.fill(0);
    ciphertext.fill(0);
    authTag.fill(0);
  }

  return {
    version: VAULT_RECORD_FORMAT_VERSION,
    algorithm: VAULT_RECORD_ALGORITHM,
    iv: record.iv as string,
    ciphertext: record.ciphertext as string,
    authTag: record.authTag as string
  };
}
