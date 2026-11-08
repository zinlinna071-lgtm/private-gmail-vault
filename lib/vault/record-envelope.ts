/**
 * Browser-only AES-256-GCM record envelope.
 *
 * This module deliberately has no Node.js imports and must only be imported
 * from client-side code. The server receives the returned opaque envelope.
 */
export const VAULT_RECORD_VERSION = 1 as const;
export const VAULT_RECORD_ALGORITHM = "AES-256-GCM" as const;
export const VAULT_RECORD_TYPE = "credential" as const;
export const VAULT_RECORD_MAX_PLAINTEXT_BYTES = 20_000;

const IV_BYTES = 12;
const TAG_BYTES = 16;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export type VaultRecordEnvelope = {
  version: typeof VAULT_RECORD_VERSION;
  algorithm: typeof VAULT_RECORD_ALGORITHM;
  iv: string;
  ciphertext: string;
  authTag: string;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value: unknown, minBytes: number, maxBytes: number): Uint8Array {
  if (typeof value !== "string" || value.length === 0 || !BASE64_PATTERN.test(value)) {
    throw new Error("Invalid Vault record envelope.");
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0));
  } catch {
    throw new Error("Invalid Vault record envelope.");
  }
  if (bytes.length < minBytes || bytes.length > maxBytes || encodeBase64(bytes) !== value) {
    throw new Error("Invalid Vault record envelope.");
  }
  return bytes;
}

function assertContext(vaultId: string, recordId: string): void {
  if (!UUID_PATTERN.test(vaultId) || !UUID_PATTERN.test(recordId)) {
    throw new Error("Invalid Vault record context.");
  }
}

function assertDataKey(dataKey: CryptoKey): void {
  const algorithm = dataKey.algorithm as AesKeyAlgorithm;
  if (
    dataKey.type !== "secret" ||
    algorithm.name !== "AES-GCM" ||
    algorithm.length !== 256 ||
    dataKey.extractable ||
    !dataKey.usages.includes("encrypt") ||
    !dataKey.usages.includes("decrypt")
  ) {
    throw new Error("Invalid Vault data-encryption key.");
  }
}

function recordAad(vaultId: string, recordId: string): Uint8Array {
  return new TextEncoder().encode(JSON.stringify([
    "private-account-vault-record",
    VAULT_RECORD_VERSION,
    vaultId,
    recordId,
    VAULT_RECORD_TYPE
  ]));
}

export function validateVaultRecordEnvelope(value: unknown): VaultRecordEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Vault record envelope.");
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  if (
    keys.join(",") !== "algorithm,authTag,ciphertext,iv,version" ||
    candidate.version !== VAULT_RECORD_VERSION ||
    candidate.algorithm !== VAULT_RECORD_ALGORITHM
  ) {
    throw new Error("Unsupported Vault record envelope.");
  }
  const iv = decodeBase64(candidate.iv, IV_BYTES, IV_BYTES);
  const tag = decodeBase64(candidate.authTag, TAG_BYTES, TAG_BYTES);
  const ciphertext = decodeBase64(candidate.ciphertext, 1, VAULT_RECORD_MAX_PLAINTEXT_BYTES);
  iv.fill(0);
  tag.fill(0);
  ciphertext.fill(0);
  return candidate as VaultRecordEnvelope;
}

export async function encryptVaultRecord(
  plaintext: string,
  dataKey: CryptoKey,
  vaultId: string,
  recordId: string
): Promise<VaultRecordEnvelope> {
  assertDataKey(dataKey);
  assertContext(vaultId, recordId);
  if (typeof plaintext !== "string") throw new Error("Vault record must be text.");
  const plainBytes = new TextEncoder().encode(plaintext);
  if (plainBytes.length === 0 || plainBytes.length > VAULT_RECORD_MAX_PLAINTEXT_BYTES) {
    plainBytes.fill(0);
    throw new Error("Vault record size is invalid.");
  }

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  try {
    const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv), additionalData: toArrayBuffer(recordAad(vaultId, recordId)), tagLength: 128 },
      dataKey,
      toArrayBuffer(plainBytes)
    ));
    try {
      return {
        version: VAULT_RECORD_VERSION,
        algorithm: VAULT_RECORD_ALGORITHM,
        iv: encodeBase64(iv),
        ciphertext: encodeBase64(encrypted.subarray(0, encrypted.length - TAG_BYTES)),
        authTag: encodeBase64(encrypted.subarray(encrypted.length - TAG_BYTES))
      };
    } finally {
      encrypted.fill(0);
    }
  } finally {
    plainBytes.fill(0);
    iv.fill(0);
  }
}

export async function decryptVaultRecord(
  envelopeInput: unknown,
  dataKey: CryptoKey,
  vaultId: string,
  recordId: string
): Promise<string> {
  assertDataKey(dataKey);
  assertContext(vaultId, recordId);
  const envelope = validateVaultRecordEnvelope(envelopeInput);
  const iv = decodeBase64(envelope.iv, IV_BYTES, IV_BYTES);
  const ciphertext = decodeBase64(envelope.ciphertext, 1, VAULT_RECORD_MAX_PLAINTEXT_BYTES);
  const tag = decodeBase64(envelope.authTag, TAG_BYTES, TAG_BYTES);
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);
  try {
    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv), additionalData: toArrayBuffer(recordAad(vaultId, recordId)), tagLength: 128 },
      dataKey,
      toArrayBuffer(combined)
    );
    if (plaintext.byteLength > VAULT_RECORD_MAX_PLAINTEXT_BYTES) {
      new Uint8Array(plaintext).fill(0);
      throw new Error("Vault record size is invalid.");
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
    } finally {
      new Uint8Array(plaintext).fill(0);
    }
  } finally {
    iv.fill(0);
    ciphertext.fill(0);
    tag.fill(0);
    combined.fill(0);
  }
}
