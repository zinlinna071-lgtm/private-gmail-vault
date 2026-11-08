/**
 * Compatibility facade for the canonical browser-side record envelope.
 *
 * Keep older callers and tests on one cryptographic format. All record AAD,
 * validation, nonce handling, and AES-GCM operations live in record-envelope.ts.
 * This module is browser-only and must never be imported by server routes.
 */
import {
  decryptVaultRecord as decryptEnvelope,
  encryptVaultRecord as encryptEnvelope,
  VAULT_RECORD_ALGORITHM as RECORD_ALGORITHM,
  VAULT_RECORD_VERSION,
  type VaultRecordEnvelope
} from "./record-envelope";

export const VAULT_RECORD_FORMAT_VERSION = VAULT_RECORD_VERSION;
export const VAULT_RECORD_ALGORITHM = RECORD_ALGORITHM;
export type EncryptedVaultRecord = VaultRecordEnvelope;

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
  return encryptEnvelope(plaintext, key, vaultId, recordId);
}

export async function decryptVaultRecord(
  envelope: unknown,
  key: CryptoKey,
  vaultId: string,
  recordId: string
): Promise<string> {
  return decryptEnvelope(envelope, key, vaultId, recordId);
}
