import {
  createVaultKeyEnvelope,
  importVaultKeyEncryptionKey,
  unwrapVaultDataKey,
  type WrappedVaultDataKey
} from "./key-envelope";
import {
  encryptVaultRecord,
  decryptVaultRecord,
  type VaultRecordEnvelope
} from "./record-envelope";
import {
  parseVaultWorkerRequest,
  type VaultWorkerRequest,
  type VaultWorkerResponse
} from "./worker-protocol";

type Argon2Module = {
  default: (input?: string | URL | Request | Response | BufferSource) => Promise<unknown>;
  derive_key: (password: Uint8Array, salt: Uint8Array, profileId: number) => Uint8Array;
};

type WorkerScope = {
  location: Location;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: VaultWorkerResponse): void;
};

const scope = self as unknown as WorkerScope;
const WASM_JS_PATH = "/crypto/argon2/vault_argon2_wasm_poc.js";
const WASM_BINARY_PATH = "/crypto/argon2/vault_argon2_wasm_poc_bg.wasm";
const MAX_UNLOCK_SECRET_BYTES = 4_096;

let wasmPromise: Promise<Argon2Module> | null = null;
let dataKey: CryptoKey | null = null;
let vaultContext: string | null = null;
let operationInProgress = false;

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function post(message: VaultWorkerResponse): void {
  scope.postMessage(message);
}

async function loadArgon2(): Promise<Argon2Module> {
  if (!wasmPromise) {
    wasmPromise = (async () => {
      const moduleUrl = new URL(WASM_JS_PATH, scope.location.origin).href;
      const wasmUrl = new URL(WASM_BINARY_PATH, scope.location.origin).href;
      // The generated wasm-bindgen glue is a build-verified public asset.
      // webpackIgnore keeps this absolute runtime import out of the app bundle.
      const module = await import(/* webpackIgnore: true */ moduleUrl) as Argon2Module;
      await module.default(wasmUrl);
      if (typeof module.derive_key !== "function") throw new Error("WASM_EXPORT_MISSING");
      return module;
    })().catch((error: unknown) => {
      wasmPromise = null;
      throw error;
    });
  }
  return wasmPromise;
}

function clearUnlockBuffers(request: Extract<VaultWorkerRequest, { type: "INITIALIZE" | "UNLOCK" }>): void {
  new Uint8Array(request.unlockSecretBuffer).fill(0);
  new Uint8Array(request.saltBytes).fill(0);
}

async function deriveKek(
  request: Extract<VaultWorkerRequest, { type: "INITIALIZE" | "UNLOCK" }>
): Promise<CryptoKey> {
  const password = new Uint8Array(request.unlockSecretBuffer);
  const salt = new Uint8Array(request.saltBytes);
  let derived: Uint8Array | null = null;
  try {
    if (password.byteLength < 1 || password.byteLength > MAX_UNLOCK_SECRET_BYTES || salt.byteLength !== 16) {
      throw new Error("INVALID_INPUT");
    }
    const wasm = await loadArgon2();
    derived = wasm.derive_key(password, salt, request.profileId);
    if (!(derived instanceof Uint8Array) || derived.byteLength !== 32) {
      throw new Error("INVALID_KDF_OUTPUT");
    }
    return await importVaultKeyEncryptionKey(derived);
  } finally {
    password.fill(0);
    salt.fill(0);
    if (derived) derived.fill(0);
    clearUnlockBuffers(request);
  }
}

function responseError(requestId: string, code: "BUSY" | "LOCKED" | "INVALID_REQUEST" | "UNLOCK_FAILED" | "CRYPTO_FAILED" | "INTERNAL") {
  post({ type: "ERROR", requestId, code });
}

async function handleRequest(request: VaultWorkerRequest): Promise<void> {
  if (operationInProgress && (request.type === "INITIALIZE" || request.type === "UNLOCK")) {
    if (request.type === "INITIALIZE" || request.type === "UNLOCK") clearUnlockBuffers(request);
    responseError(request.requestId, "BUSY");
    return;
  }

  switch (request.type) {
    case "PING":
      post({ type: "READY", requestId: request.requestId });
      return;
    case "LOCK":
      dataKey = null;
      vaultContext = null;
      post({ type: "LOCKED", requestId: request.requestId });
      return;
    case "INITIALIZE": {
      if (dataKey) {
        clearUnlockBuffers(request);
        responseError(request.requestId, "CRYPTO_FAILED");
        return;
      }
      operationInProgress = true;
      try {
        const kek = await deriveKek(request);
        const vaultKey = await createVaultKeyEnvelope(kek, request.vaultId);
        dataKey = vaultKey.dataKey;
        vaultContext = request.vaultId;
        post({
          type: "INITIALIZED",
          requestId: request.requestId,
          salt: encodeBase64(new Uint8Array(request.saltBytes)),
          profileId: request.profileId,
          wrappedKeyEnvelope: vaultKey.envelope
        });
      } catch {
        dataKey = null;
        vaultContext = null;
        responseError(request.requestId, "CRYPTO_FAILED");
      } finally {
        clearUnlockBuffers(request);
        operationInProgress = false;
      }
      return;
    }
    case "UNLOCK": {
      operationInProgress = true;
      try {
        const kek = await deriveKek(request);
        const unwrapped = await unwrapVaultDataKey(request.wrappedKeyEnvelope, kek, request.vaultId);
        dataKey = unwrapped;
        vaultContext = request.vaultId;
        post({ type: "UNLOCKED", requestId: request.requestId });
      } catch {
        dataKey = null;
        vaultContext = null;
        responseError(request.requestId, "UNLOCK_FAILED");
      } finally {
        clearUnlockBuffers(request);
        operationInProgress = false;
      }
      return;
    }
    case "ENCRYPT_RECORD": {
      if (!dataKey || !vaultContext) {
        responseError(request.requestId, "LOCKED");
        return;
      }
      try {
        const envelope: VaultRecordEnvelope = await encryptVaultRecord(
          request.plaintext, dataKey, vaultContext, request.recordId
        );
        post({ type: "ENCRYPTED_RECORD", requestId: request.requestId, envelope });
      } catch {
        responseError(request.requestId, "CRYPTO_FAILED");
      }
      return;
    }
    case "DECRYPT_RECORD": {
      if (!dataKey || !vaultContext) {
        responseError(request.requestId, "LOCKED");
        return;
      }
      try {
        const plaintext = await decryptVaultRecord(
          request.envelope, dataKey, vaultContext, request.recordId
        );
        post({ type: "DECRYPTED_RECORD", requestId: request.requestId, plaintext });
      } catch {
        responseError(request.requestId, "CRYPTO_FAILED");
      }
      return;
    }
  }
}

scope.onmessage = (event: MessageEvent<unknown>) => {
  let request: VaultWorkerRequest;
  try {
    request = parseVaultWorkerRequest(event.data);
  } catch {
    const candidate = event.data as { requestId?: unknown } | null;
    const requestId = typeof candidate?.requestId === "string" &&
      /^[A-Za-z0-9_-]{1,64}$/.test(candidate.requestId)
      ? candidate.requestId
      : "invalid";
    responseError(requestId, "INVALID_REQUEST");
    return;
  }
  void handleRequest(request).catch(() => {
    responseError(request.requestId, "INTERNAL");
  });
};
