import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type EncryptionContext = {
  userId: string;
  googleSubject: string;
};

type EncryptedRefreshToken = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  formatVersion: number;
};

function positiveVersion(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error(`${name} must be a positive integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function encryptionKey(version: number): Buffer {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error("Invalid Gmail token encryption key version.");
  }

  const configured = process.env[`GMAIL_TOKEN_ENCRYPTION_KEY_V${version}`];
  // Compatibility only: version 1 is the existing deployed key. Never use it
  // as a fallback for an unknown/newer version.
  const value = configured || (version === 1 ? process.env.VAULT_ENCRYPTION_KEY : undefined) || "";
  if (!/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`Gmail token encryption key version ${version} is not configured correctly.`);
  }
  return Buffer.from(value, "hex");
}

function validateContext(context: EncryptionContext): void {
  if (!context || typeof context.userId !== "string" || !context.userId ||
      typeof context.googleSubject !== "string" || !context.googleSubject) {
    throw new Error("Gmail token encryption context is invalid.");
  }
}

function aad(context: EncryptionContext, formatVersion: number): Buffer {
  validateContext(context);
  // Fixed property order and fixed purpose make the authenticated context
  // deterministic and independent of mutable Google profile fields.
  return Buffer.from(JSON.stringify({
    formatVersion,
    googleSubject: context.googleSubject,
    purpose: "gmail-refresh-token",
    userId: context.userId
  }), "utf8");
}

function activeVersions() {
  const keyVersion = positiveVersion(
    process.env.GMAIL_TOKEN_ENCRYPTION_ACTIVE_KEY_VERSION,
    "GMAIL_TOKEN_ENCRYPTION_ACTIVE_KEY_VERSION",
    1
  );
  const formatVersion = positiveVersion(
    process.env.GMAIL_TOKEN_ENCRYPTION_ACTIVE_FORMAT_VERSION,
    "GMAIL_TOKEN_ENCRYPTION_ACTIVE_FORMAT_VERSION",
    1
  );
  if (formatVersion !== 1 && formatVersion !== 2) {
    throw new Error("Unsupported Gmail token encryption format version.");
  }
  return { keyVersion, formatVersion };
}

/** Encrypt a Google OAuth refresh token before it is written to Supabase. */
export function encryptRefreshToken(token: string, context: EncryptionContext): EncryptedRefreshToken {
  if (!token || token.length > 16_384) throw new Error("Invalid Google refresh token.");
  const { keyVersion, formatVersion } = activeVersions();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(keyVersion), iv);
  if (formatVersion === 2) cipher.setAAD(aad(context, formatVersion));
  else validateContext(context);

  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion,
    formatVersion
  };
}

/** Decrypt only inside trusted server-side Gmail API handlers. */
export function decryptRefreshToken(input: {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  formatVersion: number;
}, context: EncryptionContext): string {
  if (!Number.isSafeInteger(input.keyVersion) || input.keyVersion < 1) {
    throw new Error("Invalid Gmail token encryption key version.");
  }
  if (input.formatVersion !== 1 && input.formatVersion !== 2) {
    throw new Error("Unsupported Gmail token encryption format version.");
  }
  validateContext(context);

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(input.keyVersion),
    Buffer.from(input.iv, "base64")
  );
  if (input.formatVersion === 2) decipher.setAAD(aad(context, input.formatVersion));
  decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
}
