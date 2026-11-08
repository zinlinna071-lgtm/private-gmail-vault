import type { WrappedVaultDataKey } from "./key-envelope";
import {
  validateVaultRecordEnvelope,
  type VaultRecordEnvelope
} from "./record-envelope";

export type VaultKdfProfileId = 1 | 2;
export type VaultWorkerErrorCode =
  | "BUSY"
  | "LOCKED"
  | "INVALID_REQUEST"
  | "UNLOCK_FAILED"
  | "CRYPTO_FAILED"
  | "INTERNAL";

export type VaultWorkerRequest =
  | {
      type: "INITIALIZE";
      requestId: string;
      unlockSecretBuffer: ArrayBuffer;
      saltBytes: ArrayBuffer;
      profileId: VaultKdfProfileId;
      vaultId: string;
    }
  | {
      type: "UNLOCK";
      requestId: string;
      unlockSecretBuffer: ArrayBuffer;
      saltBytes: ArrayBuffer;
      profileId: VaultKdfProfileId;
      wrappedKeyEnvelope: WrappedVaultDataKey;
      vaultId: string;
    }
  | {
      type: "ENCRYPT_RECORD";
      requestId: string;
      recordId: string;
      plaintext: string;
    }
  | {
      type: "DECRYPT_RECORD";
      requestId: string;
      recordId: string;
      envelope: VaultRecordEnvelope;
    }
  | { type: "LOCK"; requestId: string }
  | { type: "PING"; requestId: string };

export type VaultWorkerResponse =
  | { type: "READY"; requestId: string }
  | {
      type: "INITIALIZED";
      requestId: string;
      salt: string;
      profileId: VaultKdfProfileId;
      wrappedKeyEnvelope: WrappedVaultDataKey;
    }
  | { type: "UNLOCKED"; requestId: string }
  | { type: "ENCRYPTED_RECORD"; requestId: string; envelope: VaultRecordEnvelope }
  | { type: "DECRYPTED_RECORD"; requestId: string; plaintext: string }
  | { type: "LOCKED"; requestId: string }
  | { type: "ERROR"; requestId: string; code: VaultWorkerErrorCode };

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_UNLOCK_SECRET_BYTES = 4_096;
const MAX_RECORD_PLAINTEXT_BYTES = 20_000;
const MAX_ENCODED_SALT_LENGTH = 24;
const MAX_ENCODED_WRAPPED_KEY_LENGTH = 64;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function isCanonicalBase64(value: string, expectedLength: number): boolean {
  if (value.length !== expectedLength || !BASE64_PATTERN.test(value)) return false;
  try {
    const decoded = atob(value);
    return btoa(decoded) === value;
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === [...expected].sort()[index]);
}

function isRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

function isVaultId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isProfileId(value: unknown): value is VaultKdfProfileId {
  return value === 1 || value === 2;
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer;
}

function isWrappedKeyEnvelope(value: unknown): value is WrappedVaultDataKey {
  if (!isObject(value) || !hasExactKeys(value, ["version", "algorithm", "iv", "wrappedKey"])) {
    return false;
  }
  return value.version === 1 &&
    value.algorithm === "AES-256-GCM" &&
    typeof value.iv === "string" &&
    value.iv.length === 16 &&
    typeof value.wrappedKey === "string" &&
    value.wrappedKey.length > 0 &&
    value.wrappedKey.length <= MAX_ENCODED_WRAPPED_KEY_LENGTH;
}

/**
 * Strictly validates messages crossing the main-thread/Worker boundary.
 * Secret contents are deliberately not copied into error messages.
 */
export function parseVaultWorkerRequest(input: unknown): VaultWorkerRequest {
  if (!isObject(input) || !isRequestId(input.requestId) || typeof input.type !== "string") {
    throw new Error("INVALID_REQUEST");
  }

  switch (input.type) {
    case "INITIALIZE": {
      if (
        !hasExactKeys(input, ["type", "requestId", "unlockSecretBuffer", "saltBytes", "profileId", "vaultId"]) ||
        !isArrayBuffer(input.unlockSecretBuffer) ||
        input.unlockSecretBuffer.byteLength < 1 ||
        input.unlockSecretBuffer.byteLength > MAX_UNLOCK_SECRET_BYTES ||
        !isArrayBuffer(input.saltBytes) ||
        input.saltBytes.byteLength !== 16 ||
        !isProfileId(input.profileId) ||
        !isVaultId(input.vaultId)
      ) throw new Error("INVALID_REQUEST");
      return input as unknown as VaultWorkerRequest;
    }
    case "UNLOCK": {
      if (
        !hasExactKeys(input, ["type", "requestId", "unlockSecretBuffer", "saltBytes", "profileId", "wrappedKeyEnvelope", "vaultId"]) ||
        !isArrayBuffer(input.unlockSecretBuffer) ||
        input.unlockSecretBuffer.byteLength < 1 ||
        input.unlockSecretBuffer.byteLength > MAX_UNLOCK_SECRET_BYTES ||
        !isArrayBuffer(input.saltBytes) ||
        input.saltBytes.byteLength !== 16 ||
        !isProfileId(input.profileId) ||
        !isWrappedKeyEnvelope(input.wrappedKeyEnvelope) ||
        !isVaultId(input.vaultId)
      ) throw new Error("INVALID_REQUEST");
      return input as unknown as VaultWorkerRequest;
    }
    case "ENCRYPT_RECORD": {
      if (
        !hasExactKeys(input, ["type", "requestId", "recordId", "plaintext"]) ||
        !isVaultId(input.recordId) ||
        typeof input.plaintext !== "string" ||
        new TextEncoder().encode(input.plaintext).byteLength < 1 ||
        new TextEncoder().encode(input.plaintext).byteLength > MAX_RECORD_PLAINTEXT_BYTES
      ) throw new Error("INVALID_REQUEST");
      return input as unknown as VaultWorkerRequest;
    }
    case "DECRYPT_RECORD": {
      if (
        !hasExactKeys(input, ["type", "requestId", "recordId", "envelope"]) ||
        !isVaultId(input.recordId)
      ) throw new Error("INVALID_REQUEST");
      try {
        validateVaultRecordEnvelope(input.envelope);
      } catch {
        throw new Error("INVALID_REQUEST");
      }
      return input as unknown as VaultWorkerRequest;
    }
    case "LOCK":
    case "PING": {
      if (!hasExactKeys(input, ["type", "requestId"])) throw new Error("INVALID_REQUEST");
      return input as unknown as VaultWorkerRequest;
    }
    default:
      throw new Error("INVALID_REQUEST");
  }
}

export function isVaultWorkerResponse(input: unknown): input is VaultWorkerResponse {
  if (!isObject(input) || !isRequestId(input.requestId) || typeof input.type !== "string") {
    return false;
  }

  switch (input.type) {
    case "READY":
    case "UNLOCKED":
    case "LOCKED":
      return hasExactKeys(input, ["type", "requestId"]);
    case "INITIALIZED":
      return hasExactKeys(input, ["type", "requestId", "salt", "profileId", "wrappedKeyEnvelope"]) &&
        typeof input.salt === "string" &&
        input.salt.length === MAX_ENCODED_SALT_LENGTH &&
        isProfileId(input.profileId) &&
        isWrappedKeyEnvelope(input.wrappedKeyEnvelope);
    case "ENCRYPTED_RECORD":
      if (!hasExactKeys(input, ["type", "requestId", "envelope"])) return false;
      try {
        validateVaultRecordEnvelope(input.envelope);
        return true;
      } catch {
        return false;
      }
    case "DECRYPTED_RECORD":
      return hasExactKeys(input, ["type", "requestId", "plaintext"]) &&
        typeof input.plaintext === "string" &&
        new TextEncoder().encode(input.plaintext).byteLength <= MAX_RECORD_PLAINTEXT_BYTES;
    case "ERROR":
      return hasExactKeys(input, ["type", "requestId", "code"]) &&
        ["BUSY", "LOCKED", "INVALID_REQUEST", "UNLOCK_FAILED", "CRYPTO_FAILED", "INTERNAL"]
          .includes(String(input.code));
    default:
      return false;
  }
}
