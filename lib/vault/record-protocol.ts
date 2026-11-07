export const VAULT_RECORD_FORMAT_VERSION = 1 as const;
export const VAULT_RECORD_ALGORITHM = "AES-256-GCM" as const;

export type EncryptedVaultRecord = {
  version: typeof VAULT_RECORD_FORMAT_VERSION;
  algorithm: typeof VAULT_RECORD_ALGORITHM;
  iv: string;
  ciphertext: string;
  authTag: string;
};
