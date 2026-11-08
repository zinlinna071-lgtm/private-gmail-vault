import init, { derive_key } from "../pkg-web/vault_argon2_wasm_poc.js";

let wasmReady = false;
let deriving = false;
let kek = null;

self.onmessage = async (event) => {
  const message = event.data;
  if (!message || typeof message !== "object" || typeof message.type !== "string") {
    self.postMessage({ type: "ERROR", code: "INVALID_REQUEST" });
    return;
  }

  if (message.type === "INIT") {
    try {
      await init(new URL("../pkg-web/vault_argon2_wasm_poc_bg.wasm", import.meta.url));
      wasmReady = true;
      self.postMessage({ type: "READY" });
    } catch {
      self.postMessage({ type: "ERROR", code: "WASM_INIT_FAILED" });
    }
    return;
  }

  if (message.type !== "DERIVE_AND_SELF_TEST") {
    self.postMessage({ type: "ERROR", code: "INVALID_REQUEST" });
    return;
  }
  if (!wasmReady) {
    self.postMessage({ type: "ERROR", code: "NOT_READY" });
    return;
  }
  if (deriving) {
    self.postMessage({ type: "ERROR", code: "BUSY" });
    return;
  }

  const { passwordBuffer, saltBuffer, profileId } = message;
  if (
    !(passwordBuffer instanceof ArrayBuffer) ||
    passwordBuffer.byteLength < 1 ||
    passwordBuffer.byteLength > 4096 ||
    !(saltBuffer instanceof ArrayBuffer) ||
    saltBuffer.byteLength !== 16 ||
    (profileId !== 1 && profileId !== 2)
  ) {
    if (passwordBuffer instanceof ArrayBuffer) new Uint8Array(passwordBuffer).fill(0);
    if (saltBuffer instanceof ArrayBuffer) new Uint8Array(saltBuffer).fill(0);
    self.postMessage({ type: "ERROR", code: "INVALID_INPUT" });
    return;
  }

  deriving = true;
  let derived = null;
  try {
    const password = new Uint8Array(passwordBuffer);
    const salt = new Uint8Array(saltBuffer);
    try {
      derived = derive_key(password, salt, profileId);
    } finally {
      password.fill(0);
      salt.fill(0);
    }

    // The derived bytes are imported as a non-extractable key and never leave
    // this Worker. This is an isolated KDF boundary test, not Vault integration.
    kek = await crypto.subtle.importKey(
      "raw",
      derived,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
    derived.fill(0);
    derived = null;

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const challenge = new TextEncoder().encode("worker-local-kdf-check");
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      kek,
      challenge
    );
    const recovered = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      kek,
      encrypted
    );
    const passed = new TextDecoder().decode(recovered) === "worker-local-kdf-check";
    new Uint8Array(encrypted).fill(0);
    new Uint8Array(recovered).fill(0);
    iv.fill(0);
    challenge.fill(0);

    if (!passed) throw new Error("local key self-test failed");
    self.postMessage({ type: "DERIVED_AND_VERIFIED" });
  } catch {
    kek = null;
    self.postMessage({ type: "ERROR", code: "DERIVATION_FAILED" });
  } finally {
    if (derived) derived.fill(0);
    new Uint8Array(passwordBuffer).fill(0);
    new Uint8Array(saltBuffer).fill(0);
    deriving = false;
  }
};

self.postMessage({ type: "WORKER_STARTED" });
