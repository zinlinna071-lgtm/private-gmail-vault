/**
 * Client-side Vault DEK envelope operations.
 *
 * Argon2id is intentionally not embedded here. A separately reviewed KDF
 * adapter must derive 32 bytes and pass them to importVaultKeyEncryptionKey.
 * The returned KEK is non-extractable and remains usable only in this client.
 */

export const VAULT_KEY_ENVELOPE_VERSION = 1 as const;
export const VAULT_KEY_ENVELOPE_ALGORITHM = "AES-256-GCM" as const;

const IV_BYTES = 12;
const KEY_BYTES = 32;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WrappedVaultDataKey = {
  version: typeof VAULT_KEY_ENVELOPE_VERSION;
  algorithm: typeof VAULT_KEY_ENVELOPE_ALGORITHM;
  iv: string;
  wrappedKey: string;
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

function decodeBase64(value: unknown, expectedBytes: number): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length !== Math.ceil(expectedBytes / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new Error("Invalid Vault key envelope.");
  }
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (bytes.length !== expectedBytes || encodeBase64(bytes) !== value) {
    bytes.fill(0);
    throw new Error("Invalid Vault key envelope.");
  }
  return bytes;
}

function assertVaultId(vaultId: string) {
  if (!UUID_PATTERN.test(vaultId)) throw new Error("Invalid Vault key context.");
}

function keyEnvelopeAad(vaultId: string): Uint8Array {
  return new TextEncoder().encode(JSON.stringify([
    "private-account-vault",
    VAULT_KEY_ENVELOPE_VERSION,
    vaultId,
    "vault-data-encryption-key"
  ]));
}

function assertKek(kek: CryptoKey) {
  const algorithm = kek.algorithm as AesKeyAlgorithm;
  if (
    kek.type !== "secret" ||
    algorithm.name !== "AES-GCM" ||
    algorithm.length !== 256 ||
    kek.extractable ||
    !kek.usages.includes("encrypt") ||
    !kek.usages.includes("decrypt")
  ) {
    throw new Error("Invalid Vault key-encryption key.");
  }
}

/**
 * Imports the 32-byte Argon2id output as a non-extractable AES-256-GCM KEK.
 * This function consumes and zeroes the caller-provided byte array.
 */
export async function importVaultKeyEncryptionKey(derivedKey: Uint8Array): Promise<CryptoKey> {
  if (!(derivedKey instanceof Uint8Array) || derivedKey.length !== KEY_BYTES) {
    throw new Error("Vault key derivation must produce exactly 32 bytes.");
  }

  const rawKeyBuffer = toArrayBuffer(derivedKey);
  try {
    return await globalThis.crypto.subtle.importKey(
      "raw",
      rawKeyBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  } finally {
    derivedKey.fill(0);
    new Uint8Array(rawKeyBuffer).fill(0);
  }
}

export async function createVaultKeyEnvelope(
  kek: CryptoKey,
  vaultId: string
): Promise<{ dataKey: CryptoKey; envelope: WrappedVaultDataKey }> {
  assertKek(kek);
  assertVaultId(vaultId);

  // Generate raw key bytes directly so no extractable CryptoKey is created.
  const rawDataKey = globalThis.crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const wrapBuffer = toArrayBuffer(rawDataKey);
  const ivBuffer = toArrayBuffer(iv);
  const aadBytes = keyEnvelopeAad(vaultId);
  const aadBuffer = toArrayBuffer(aadBytes);
  let wrappedBytes: ArrayBuffer | undefined;

  try {
    wrappedBytes = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: ivBuffer, additionalData: aadBuffer, tagLength: 128 },
      kek,
      wrapBuffer
    );

    const importBuffer = toArrayBuffer(rawDataKey);
    let dataKey: CryptoKey;
    try {
      dataKey = await globalThis.crypto.subtle.importKey(
        "raw",
        importBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );
    } finally {
      new Uint8Array(importBuffer).fill(0);
    }

    const wrappedKey = encodeBase64(new Uint8Array(wrappedBytes));
    return {
      dataKey,
      envelope: {
        version: VAULT_KEY_ENVELOPE_VERSION,
        algorithm: VAULT_KEY_ENVELOPE_ALGORITHM,
        iv: encodeBase64(iv),
        wrappedKey
      }
    };
  } finally {
    rawDataKey.fill(0);
    iv.fill(0);
    new Uint8Array(wrapBuffer).fill(0);
    new Uint8Array(ivBuffer).fill(0);
    aadBytes.fill(0);
    new Uint8Array(aadBuffer).fill(0);
    if (wrappedBytes) new Uint8Array(wrappedBytes).fill(0);
  }
}

export async function unwrapVaultDataKey(
  envelope: unknown,
  kek: CryptoKey,
  vaultId: string
): Promise<CryptoKey> {
  assertKek(kek);
  assertVaultId(vaultId);

  if (
    !envelope ||
    typeof envelope !== "object" ||
    (envelope as Record<string, unknown>).version !== VAULT_KEY_ENVELOPE_VERSION ||
    (envelope as Record<string, unknown>).algorithm !== VAULT_KEY_ENVELOPE_ALGORITHM
  ) {
    throw new Error("Unsupported Vault key envelope.");
  }

  const candidate = envelope as Record<string, unknown>;
  const iv = decodeBase64(candidate.iv, IV_BYTES);
  const wrappedKey = decodeBase64(candidate.wrappedKey, KEY_BYTES + 16);
  const wrappedKeyBuffer = toArrayBuffer(wrappedKey);
  const ivBuffer = toArrayBuffer(iv);
  const aadBytes = keyEnvelopeAad(vaultId);
  const aadBuffer = toArrayBuffer(aadBytes);
  let decryptedBuffer: ArrayBuffer;

  try {
    decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuffer, additionalData: aadBuffer, tagLength: 128 },
      kek,
      wrappedKeyBuffer
    );
  } finally {
    // Clear ciphertext and all temporary copies, including context buffers.
    new Uint8Array(wrappedKeyBuffer).fill(0);
    new Uint8Array(ivBuffer).fill(0);
    new Uint8Array(aadBuffer).fill(0);
    wrappedKey.fill(0);
    iv.fill(0);
    aadBytes.fill(0);
  }

  const rawDataKey = new Uint8Array(decryptedBuffer);

  try {
    if (rawDataKey.length !== KEY_BYTES) throw new Error("Invalid Vault data key.");
    const importBuffer = toArrayBuffer(rawDataKey);
    try {
      return await globalThis.crypto.subtle.importKey(
        "raw",
        importBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );
    } finally {
      new Uint8Array(importBuffer).fill(0);
    }
  } finally {
    rawDataKey.fill(0);
    new Uint8Array(decryptedBuffer).fill(0);
  }
}
