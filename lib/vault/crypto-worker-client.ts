"use client";

import {
  isVaultWorkerResponse,
  type VaultKdfProfileId,
  type VaultWorkerRequest,
  type VaultWorkerResponse
} from "./worker-protocol";
import type { WrappedVaultDataKey } from "./key-envelope";
import type { VaultRecordEnvelope } from "./record-envelope";

type RequestWithoutId = VaultWorkerRequest extends infer Request
  ? Request extends { requestId: string }
    ? Omit<Request, "requestId">
    : never
  : never;

type PendingRequest = {
  resolve: (response: VaultWorkerResponse) => void;
  reject: (error: Error) => void;
};

function decodeSalt(value: string): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length !== 24 ||
    !/^[A-Za-z0-9+/]{22}==$/.test(value)
  ) {
    throw new Error("Invalid Vault KDF salt.");
  }
  const decoded = Uint8Array.from(atob(value), character => character.charCodeAt(0));
  if (decoded.byteLength !== 16 || btoa(String.fromCharCode(...decoded)) !== value) {
    decoded.fill(0);
    throw new Error("Invalid Vault KDF salt.");
  }
  return decoded;
}

function toTransferableBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export class VaultCryptoWorkerClient {
  private worker: Worker | null;
  private readonly pending = new Map<string, PendingRequest>();

  constructor(worker: Worker = createVaultCryptoWorker()) {
    this.worker = worker;
    worker.addEventListener("message", this.onMessage);
    worker.addEventListener("error", this.onError);
    worker.addEventListener("messageerror", this.onMessageError);
  }

  private readonly onMessage = (event: MessageEvent<unknown>) => {
    if (!isVaultWorkerResponse(event.data)) {
      this.failAll(new Error("Vault crypto Worker returned an invalid response."));
      this.terminateWorker();
      return;
    }
    const pending = this.pending.get(event.data.requestId);
    if (!pending) return;
    this.pending.delete(event.data.requestId);
    pending.resolve(event.data);
  };

  private readonly onError = () => {
    this.failAll(new Error("Vault crypto Worker stopped unexpectedly."));
    this.terminateWorker();
  };

  private readonly onMessageError = () => {
    this.failAll(new Error("Vault crypto Worker message could not be read."));
    this.terminateWorker();
  };

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  private terminateWorker(): void {
    const worker = this.worker;
    this.worker = null;
    if (!worker) return;
    worker.removeEventListener("message", this.onMessage);
    worker.removeEventListener("error", this.onError);
    worker.removeEventListener("messageerror", this.onMessageError);
    worker.terminate();
  }

  private send(request: RequestWithoutId, transfer: Transferable[] = []): Promise<VaultWorkerResponse> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("Vault crypto Worker is locked or unavailable."));

    const requestId = "req_" + crypto.randomUUID().replaceAll("-", "");
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      try {
        worker.postMessage({ ...request, requestId }, transfer);
      } catch {
        this.pending.delete(requestId);
        reject(new Error("Could not send a request to the Vault crypto Worker."));
      }
    });
  }

  async initialize(
    unlockSecret: Uint8Array,
    vaultId: string,
    profileId: VaultKdfProfileId = 1
  ): Promise<{ salt: string; profileId: VaultKdfProfileId; wrappedKeyEnvelope: WrappedVaultDataKey }> {
    if (!(unlockSecret instanceof Uint8Array) || unlockSecret.byteLength < 1 || unlockSecret.byteLength > 4_096) {
      throw new Error("Vault Unlock Secret length is invalid.");
    }
    const secretCopy = new Uint8Array(unlockSecret);
    unlockSecret.fill(0);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const secretBuffer = toTransferableBuffer(secretCopy);
    const saltBuffer = toTransferableBuffer(salt);
    secretCopy.fill(0);
    salt.fill(0);

    try {
      const response = await this.send({
        type: "INITIALIZE",
        unlockSecretBuffer: secretBuffer,
        saltBytes: saltBuffer,
        profileId,
        vaultId
      }, [secretBuffer, saltBuffer]);
      if (response.type === "ERROR") throw new Error(response.code);
      if (response.type !== "INITIALIZED") throw new Error("Unexpected Vault Worker response.");
      return {
        salt: response.salt,
        profileId: response.profileId,
        wrappedKeyEnvelope: response.wrappedKeyEnvelope
      };
    } finally {
      if (secretBuffer.byteLength) new Uint8Array(secretBuffer).fill(0);
      if (saltBuffer.byteLength) new Uint8Array(saltBuffer).fill(0);
    }
  }

  async unlock(
    unlockSecret: Uint8Array,
    vaultId: string,
    saltBase64: string,
    profileId: VaultKdfProfileId,
    wrappedKeyEnvelope: WrappedVaultDataKey
  ): Promise<void> {
    if (!(unlockSecret instanceof Uint8Array) || unlockSecret.byteLength < 1 || unlockSecret.byteLength > 4_096) {
      throw new Error("Vault Unlock Secret length is invalid.");
    }
    const secretCopy = new Uint8Array(unlockSecret);
    unlockSecret.fill(0);
    const salt = decodeSalt(saltBase64);
    const secretBuffer = toTransferableBuffer(secretCopy);
    const saltBuffer = toTransferableBuffer(salt);
    secretCopy.fill(0);
    salt.fill(0);

    try {
      const response = await this.send({
        type: "UNLOCK",
        unlockSecretBuffer: secretBuffer,
        saltBytes: saltBuffer,
        profileId,
        wrappedKeyEnvelope,
        vaultId
      }, [secretBuffer, saltBuffer]);
      if (response.type === "ERROR") throw new Error(response.code);
      if (response.type !== "UNLOCKED") throw new Error("Unexpected Vault Worker response.");
    } finally {
      if (secretBuffer.byteLength) new Uint8Array(secretBuffer).fill(0);
      if (saltBuffer.byteLength) new Uint8Array(saltBuffer).fill(0);
    }
  }

  async encryptRecord(recordId: string, plaintext: string): Promise<VaultRecordEnvelope> {
    const response = await this.send({ type: "ENCRYPT_RECORD", recordId, plaintext });
    if (response.type === "ERROR") throw new Error(response.code);
    if (response.type !== "ENCRYPTED_RECORD") throw new Error("Unexpected Vault Worker response.");
    return response.envelope;
  }

  async decryptRecord(recordId: string, envelope: VaultRecordEnvelope): Promise<string> {
    const response = await this.send({ type: "DECRYPT_RECORD", recordId, envelope });
    if (response.type === "ERROR") throw new Error(response.code);
    if (response.type !== "DECRYPTED_RECORD") throw new Error("Unexpected Vault Worker response.");
    return response.plaintext;
  }

  /**
   * Immediate lock is Worker termination, not a queued LOCK message.
   * Termination also cancels an in-flight synchronous Argon2id operation.
   * Create a new client instance for the next unlock session.
   */
  lock(): void {
    this.failAll(new Error("Vault crypto Worker was locked."));
    this.terminateWorker();
  }

  dispose(): void {
    this.lock();
  }
}

/**
 * Creates the isolated crypto Worker. This factory is intentionally not wired
 * into Vault UI or CRUD until the complete ciphertext-only API migration and
 * browser integration tests are approved.
 */
export function createVaultCryptoWorker(): Worker {
  if (typeof Worker === "undefined") {
    throw new Error("Vault crypto Worker is unavailable in this browser.");
  }

  return new Worker(new URL("./crypto-worker.ts", import.meta.url), {
    type: "module",
    name: "private-vault-crypto"
  });
}
