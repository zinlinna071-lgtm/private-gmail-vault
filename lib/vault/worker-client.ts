/**
 * Browser-only client for the dedicated Vault crypto Worker.
 *
 * This module is an integration primitive, not an activation switch. The
 * current Vault CRUD routes remain legacy/server-readable until the complete
 * ciphertext-only API and user-mediated migration are released together.
 */
import {
  isVaultWorkerResponse,
  type VaultKdfProfileId,
  type VaultWorkerRequest,
  type VaultWorkerResponse
} from "./worker-protocol";
import type { WrappedVaultDataKey } from "./key-envelope";
import type { VaultRecordEnvelope } from "./record-envelope";

const REQUEST_TIMEOUT_MS = 120_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PendingRequest = {
  resolve: (value: VaultWorkerResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

function encodeSecret(secret: string): ArrayBuffer {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("A Vault Unlock Secret is required.");
  }
  const bytes = new TextEncoder().encode(secret);
  if (bytes.byteLength > 4_096) {
    bytes.fill(0);
    throw new Error("The Vault Unlock Secret is too long.");
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  bytes.fill(0);
  return copy.buffer;
}

function decodeSalt(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4}){5}[A-Za-z0-9+/]{2}==$/.test(value)) {
    throw new Error("Invalid public Vault KDF salt.");
  }
  const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0));
  if (bytes.byteLength !== 16 || btoa(String.fromCharCode(...bytes)) !== value) {
    bytes.fill(0);
    throw new Error("Invalid public Vault KDF salt.");
  }
  return bytes;
}

function errorForCode(code: string): Error {
  const messages: Record<string, string> = {
    BUSY: "A Vault key operation is already in progress.",
    LOCKED: "The Vault is locked.",
    INVALID_REQUEST: "The Vault crypto request was rejected.",
    UNLOCK_FAILED: "The Vault Unlock Secret could not unlock this Vault.",
    CRYPTO_FAILED: "The Vault cryptographic operation failed.",
    INTERNAL: "The Vault crypto Worker encountered an internal error."
  };
  return new Error(messages[code] ?? "The Vault crypto operation failed.");
}

export class VaultCryptoWorkerClient {
  private readonly worker: Worker;
  private readonly pending = new Map<string, PendingRequest>();
  private closed = false;

  constructor(workerFactory: () => Worker = () => new Worker(
    new URL("./crypto-worker.ts", import.meta.url),
    { type: "module", name: "private-vault-crypto" }
  )) {
    if (typeof Worker === "undefined") throw new Error("Web Workers are not supported in this browser.");
    this.worker = workerFactory();
    this.worker.addEventListener("message", this.onMessage);
    this.worker.addEventListener("error", this.onError);
    this.worker.addEventListener("messageerror", this.onMessageError);
  }

  private onMessage = (event: MessageEvent<unknown>) => {
    if (!isVaultWorkerResponse(event.data)) {
      this.failAll(new Error("The Vault crypto Worker returned an invalid response."));
      return;
    }
    const response = event.data;
    const pending = this.pending.get(response.requestId);
    if (!pending) return;
    this.pending.delete(response.requestId);
    clearTimeout(pending.timeout);
    if (response.type === "ERROR") pending.reject(errorForCode(response.code));
    else pending.resolve(response);
  };

  private onError = () => {
    this.failAll(new Error("The Vault crypto Worker stopped unexpectedly."));
  };

  private onMessageError = () => {
    this.failAll(new Error("The Vault crypto Worker response could not be read."));
  };

  private failAll(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
    this.terminate();
  }

  private terminate(reason = new Error("The Vault crypto Worker is closed.")) {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(reason);
    }
    this.pending.clear();
    this.worker.removeEventListener("message", this.onMessage);
    this.worker.removeEventListener("error", this.onError);
    this.worker.removeEventListener("messageerror", this.onMessageError);
    this.worker.terminate();
  }

  private request<K extends VaultWorkerRequest["type"], R extends VaultWorkerResponse["type"]>(
    payload: Omit<Extract<VaultWorkerRequest, { type: K }>, "requestId">,
    expectedType: R,
    transfer: Transferable[] = []
  ): Promise<Extract<VaultWorkerResponse, { type: R }>> {
    if (this.closed) return Promise.reject(new Error("The Vault crypto Worker is closed."));
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        this.terminate(new Error("The Vault crypto operation timed out. Lock the Vault and try again."));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(requestId, {
        resolve: (response) => {
          if (response.type !== expectedType) {
            reject(new Error("The Vault crypto Worker returned an unexpected response."));
            return;
          }
          resolve(response as Extract<VaultWorkerResponse, { type: R }>);
        },
        reject,
        timeout
      });
      try {
        this.worker.postMessage({ ...payload, requestId }, transfer);
      } catch {
        this.pending.delete(requestId);
        clearTimeout(timeout);
        reject(new Error("The Vault crypto request could not be sent."));
        this.terminate();
      }
    });
  }

  async initialize(vaultId: string, unlockSecret: string, profileId: VaultKdfProfileId) {
    if (!UUID_PATTERN.test(vaultId)) throw new Error("Invalid Vault ID.");
    const secretBuffer = encodeSecret(unlockSecret);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltBuffer = salt.buffer.slice(0);
    salt.fill(0);
    try {
      const result = await this.request<"INITIALIZE", "INITIALIZED">(
        { type: "INITIALIZE", vaultId, profileId, unlockSecretBuffer: secretBuffer, saltBytes: saltBuffer },
        "INITIALIZED",
        [secretBuffer, saltBuffer]
      );
      return {
        salt: result.salt,
        profileId: result.profileId,
        wrappedKeyEnvelope: result.wrappedKeyEnvelope
      };
    } catch (error) {
      // Transferred ArrayBuffers are detached on this thread; the Worker owns and clears them.
      try { new Uint8Array(secretBuffer).fill(0); } catch { /* already transferred */ }
      try { new Uint8Array(saltBuffer).fill(0); } catch { /* already transferred */ }
      throw error;
    }
  }

  async unlock(
    vaultId: string,
    unlockSecret: string,
    saltBase64: string,
    profileId: VaultKdfProfileId,
    wrappedKeyEnvelope: WrappedVaultDataKey
  ): Promise<void> {
    if (!UUID_PATTERN.test(vaultId)) throw new Error("Invalid Vault ID.");
    const secretBuffer = encodeSecret(unlockSecret);
    const salt = decodeSalt(saltBase64);
    const saltBuffer = salt.buffer.slice(0);
    salt.fill(0);
    try {
      await this.request<"UNLOCK", "UNLOCKED">(
        { type: "UNLOCK", vaultId, profileId, unlockSecretBuffer: secretBuffer, saltBytes: saltBuffer, wrappedKeyEnvelope },
        "UNLOCKED",
        [secretBuffer, saltBuffer]
      );
    } catch (error) {
      new Uint8Array(secretBuffer).fill(0);
      new Uint8Array(saltBuffer).fill(0);
      throw error;
    }
  }

  async encryptRecord(recordId: string, plaintext: string): Promise<VaultRecordEnvelope> {
    if (!UUID_PATTERN.test(recordId)) throw new Error("Invalid Vault record ID.");
    const result = await this.request<"ENCRYPT_RECORD", "ENCRYPTED_RECORD">({ type: "ENCRYPT_RECORD", recordId, plaintext }, "ENCRYPTED_RECORD");
    return result.envelope;
  }

  async decryptRecord(recordId: string, envelope: VaultRecordEnvelope): Promise<string> {
    if (!UUID_PATTERN.test(recordId)) throw new Error("Invalid Vault record ID.");
    const result = await this.request<"DECRYPT_RECORD", "DECRYPTED_RECORD">({ type: "DECRYPT_RECORD", recordId, envelope }, "DECRYPTED_RECORD");
    return result.plaintext;
  }

  async lock(): Promise<void> {
    if (this.closed) return;
    try {
      await this.request<"LOCK", "LOCKED">({ type: "LOCK" }, "LOCKED");
    } finally {
      this.terminate(new Error("The Vault is locked."));
    }
  }

  close(): void {
    this.terminate();
  }
}
