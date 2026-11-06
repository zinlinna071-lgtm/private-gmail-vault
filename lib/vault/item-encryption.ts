import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const value = process.env.VAULT_DATA_ENCRYPTION_KEY;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error("Vault data encryption key is not configured.");
  }
  return Buffer.from(value, "hex");
}

function getAad(userId: string, itemId: string): Buffer {
  return Buffer.from(JSON.stringify({
    purpose: "private-account-vault-item",
    version: 1,
    userId,
    itemId
  }), "utf8");
}

export function encryptVaultItem(plaintext: string, userId: string, itemId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  cipher.setAAD(getAad(userId, itemId));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64")
  };
}

export function decryptVaultItem(input: {
  ciphertext: string;
  iv: string;
  authTag: string;
}, userId: string, itemId: string): string {
  const iv = Buffer.from(input.iv, "base64");
  const authTag = Buffer.from(input.authTag, "base64");
  const ciphertext = Buffer.from(input.ciphertext, "base64");
  if (iv.length !== 12 || authTag.length !== 16 || ciphertext.length === 0) {
    throw new Error("Stored Vault entry is invalid.");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAAD(getAad(userId, itemId));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
