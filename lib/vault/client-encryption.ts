/**
 * Browser-side AES-256-GCM record encryption.
 *
 * This module intentionally has no Node.js crypto imports and no server secret.
 * Import it only from client-side code. Key derivation and DEK wrapping are
 * separate protocol steps and are not implemented in this module yet.
 */

import { VAULT_RECORD_ALGORITHM, VAULT_RECORD_FORMAT_VERSION, type EncryptedVaultRecord } from "./record-protocol";
export { VAULT_RECORD_ALGORITHM, VAULT_RECORD_FORMAT_VERSION };
export type { EncryptedVaultRecord };

const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const MAX_RECORD_BYTES = 20_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertContext(vaultId: string, recordId: string) {
  if (!UUID_PATTERN.test(vaultId) || !UUID_PATTERN.test(recordId)) {
    throw new Error("Invalid Vault encryption context.");
  }
}

function assertDataKey(key: CryptoKey) {
  const algorithm = key.algorithm as AesKeyAlgorithm;
  if (
    key.type !== "secret" ||
    key.extractable ||
    algorithm.name !== "AES-GCM" ||
    algorithm.length !== 256 ||
    !key.usages.includes("encrypt") ||
    !key.usages.includes("decrypt")
  ) {
    throw new Error("Invalid Vault data-encryption key.");
  }
}

function additionalData(vaultId: string, recordId: string): Uint8Array {
  return new TextEncoder().encode(JSON.stringify([
    "private-account-vault",
    VAULT_RECORD_FORMAT_VERSION,
    vaultId,
    recordId,
    "account"
  ]));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: unknown, maxEncodedLength: number): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxEncodedLength ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new Error("Invalid encrypted Vault record.");
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  if (toBase64(bytes) !== value) {
    throw new Error("Invalid encrypted Vault record.");
  }
  return bytes;
}

export async function generateVaultDataKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptVaultRecord(
  plaintext: string,
  key: CryptoKey,
  vaultId: string,
  recordId: string
): Promise<EncryptedVaultRecord> {
  assertDataKey(key);
  assertContext(vaultId, recordId);

  const plaintextBytes = new TextEncoder().encode(plaintext);
  if (plaintextBytes.length === 0 || plaintextBytes.length > MAX_RECORD_BYTES) {
    throw new Error("Vault record size is invalid.");
  }

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintextBuffer = toArrayBuffer(plaintextBytes);
  let encryptedBytes: ArrayBuffer;
  try {
    encryptedBytes = await globalThis.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(additionalData(vaultId, recordId)),
        tagLength: 128
      },
      key,
      plaintextBuffer
    );
  } finally {
    plaintextBytes.fill(0);
    new Uint8Array(plaintextBuffer).fill(0);
  }
  const encrypted = new Uint8Array(encryptedBytes);

  const splitAt = encrypted.length - AUTH_TAG_BYTES;
  if (splitAt <= 0) throw new Error("Vault encryption failed.");

  return {
    version: VAULT_RECORD_FORMAT_VERSION,
    algorithm: VAULT_RECORD_ALGORITHM,
    iv: toBase64(iv),
    ciphertext: toBase64(encrypted.subarray(0, splitAt)),
    authTag: toBase64(encrypted.subarray(splitAt))
  };
}

export async function decryptVaultRecord(
  envelope: unknown,
  key: CryptoKey,
  vaultId: string,
  recordId: string
): Promise<string> {
  assertDataKey(key);
  assertContext(vaultId, recordId);

  if (
    !envelope ||
    typeof envelope !== "object" ||
    (envelope as Record<string, unknown>).version !== VAULT_RECORD_FORMAT_VERSION ||
    (envelope as Record<string, unknown>).algorithm !== VAULT_RECORD_ALGORITHM
  ) {
    throw new Error("Unsupported encrypted Vault record.");
  }

  const record = envelope as Record<string, unknown>;
  const iv = fromBase64(record.iv, 24);
  const ciphertext = fromBase64(record.ciphertext, 27_000);
  const authTag = fromBase64(record.authTag, 24);
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES || ciphertext.length === 0 ||
      ciphertext.length + AUTH_TAG_BYTES > MAX_RECORD_BYTES + AUTH_TAG_BYTES) {
    throw new Error("Invalid encrypted Vault record.");
  }

  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);

  const plaintext = await globalThis.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(additionalData(vaultId, recordId)),
      tagLength: 128
    },
    key,
    combined
  );

  const plaintextBytes = new Uint8Array(plaintext);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(plaintextBytes);
  } finally {
    plaintextBytes.fill(0);
  }
}
