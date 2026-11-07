import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const CURRENT_KEY_VERSION = 1;

function getEncryptionKey(): Buffer {
  const encoded = process.env.VAULT_ENCRYPTION_KEY;
  if (!encoded) throw new Error("VAULT_ENCRYPTION_KEY is not configured.");

  const key = Buffer.from(encoded, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error("VAULT_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

/** Encrypts a refresh token for storage. Server-side use only. */
export function encryptRefreshToken(plaintext: string): EncryptedSecret {
  if (!plaintext || plaintext.length > 16_384) {
    throw new Error("Refresh token is empty or exceeds the allowed size.");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: CURRENT_KEY_VERSION
  };
}

/** Decrypts a stored token on the server after its owner has been verified. */
export function decryptRefreshToken(secret: EncryptedSecret): string {
  if (secret.keyVersion !== CURRENT_KEY_VERSION) {
    throw new Error("Unsupported encryption key version; rotate keys before decrypting.");
  }

  const iv = Buffer.from(secret.iv, "base64");
  const authTag = Buffer.from(secret.authTag, "base64");
  const ciphertext = Buffer.from(secret.ciphertext, "base64");
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH || ciphertext.length === 0) {
    throw new Error("Stored encrypted token has an invalid format.");
  }

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
