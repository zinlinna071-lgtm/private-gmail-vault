import { VaultCryptoWorkerClient } from "./worker-client";
import type { VaultKdfProfileId } from "./worker-protocol";
import type { WrappedVaultDataKey } from "./key-envelope";

type FetchLike = typeof fetch;

type PublicKeyMetadata = {
  version: 1;
  kdfAlgorithm: "argon2id-v1.3";
  profileId: VaultKdfProfileId;
  salt: string;
  wrappedKeyEnvelope: WrappedVaultDataKey;
};

type WorkerFactory = () => Worker;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePublicMetadata(value: unknown): PublicKeyMetadata {
  if (!isRecord(value) || value.version !== 1 || value.kdfAlgorithm !== "argon2id-v1.3") {
    throw new Error("The Vault key metadata is missing or unsupported.");
  }
  if (value.profileId !== 1 && value.profileId !== 2) {
    throw new Error("The Vault KDF profile is unsupported.");
  }
  if (typeof value.salt !== "string" || !/^(?:[A-Za-z0-9+/]{4}){5}[A-Za-z0-9+/]{2}==$/.test(value.salt)) {
    throw new Error("The Vault KDF salt is invalid.");
  }
  if (!isRecord(value.wrappedKeyEnvelope)) {
    throw new Error("The wrapped Vault key is invalid.");
  }
  const envelope = value.wrappedKeyEnvelope;
  if (
    envelope.version !== 1 ||
    envelope.algorithm !== "AES-256-GCM" ||
    typeof envelope.iv !== "string" ||
    !/^[A-Za-z0-9+/]{16}$/.test(envelope.iv) ||
    typeof envelope.wrappedKey !== "string" ||
    !/^[A-Za-z0-9+/]{64}$/.test(envelope.wrappedKey)
  ) {
    throw new Error("The wrapped Vault key is invalid.");
  }
  return {
    version: 1,
    kdfAlgorithm: "argon2id-v1.3",
    profileId: value.profileId,
    salt: value.salt,
    wrappedKeyEnvelope: envelope as unknown as WrappedVaultDataKey
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error("The Vault security service returned an invalid response.");
  }
  if (!isRecord(value)) throw new Error("The Vault security service returned an invalid response.");
  if (!response.ok) {
    const message = typeof value.error === "string" ? value.error : "The Vault security request failed.";
    throw new Error(message);
  }
  return value;
}

function createWorker(factory?: WorkerFactory) {
  return new VaultCryptoWorkerClient(factory);
}

/**
 * Explicit first-time setup. The unlock secret is transferred directly to the
 * crypto Worker; only salt, profile ID, and the wrapped DEK are sent to the API.
 * Call this only from a deliberate user-initiated setup flow after confirming
 * the user has safely stored their recovery material.
 */
export async function initializeClientVault(
  vaultId: string,
  unlockSecret: string,
  profileId: VaultKdfProfileId,
  options: { fetcher?: FetchLike; workerFactory?: WorkerFactory } = {}
): Promise<VaultCryptoWorkerClient> {
  const client = createWorker(options.workerFactory);
  try {
    const initialized = await client.initialize(vaultId, unlockSecret, profileId);
    const fetcher = options.fetcher ?? fetch;
    const response = await fetcher("/api/vault/key-metadata", {
      method: "PUT",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: initialized.profileId,
        salt: initialized.salt,
        wrappedKeyEnvelope: initialized.wrappedKeyEnvelope
      })
    });
    await readJson(response);
    return client;
  } catch (error) {
    client.close();
    throw error;
  }
}

/**
 * Unlock an already initialized client-encrypted Vault. This deliberately
 * does not initialize missing metadata or migrate legacy plaintext records.
 */
export async function unlockClientVault(
  vaultId: string,
  unlockSecret: string,
  options: { fetcher?: FetchLike; workerFactory?: WorkerFactory } = {}
): Promise<VaultCryptoWorkerClient> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher("/api/vault/key-metadata", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store"
  });
  const body = await readJson(response);
  const metadata = parsePublicMetadata(body.metadata);
  const client = createWorker(options.workerFactory);
  try {
    await client.unlock(
      vaultId,
      unlockSecret,
      metadata.salt,
      metadata.profileId,
      metadata.wrappedKeyEnvelope
    );
    return client;
  } catch (error) {
    client.close();
    throw error;
  }
}
