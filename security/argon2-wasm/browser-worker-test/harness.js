const result = document.querySelector("#result");
const worker = new Worker("/security/argon2-wasm/browser-worker-test/worker.js", { type: "module" });

function waitFor(type, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.removeEventListener("message", onMessage);
      reject(new Error("Timed out waiting for " + type));
    }, timeoutMs);
    function onMessage(event) {
      if (event.data?.type === "ERROR") {
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        reject(new Error(event.data.code));
      }
      if (event.data?.type === type) {
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        resolve(event.data);
      }
    }
    worker.addEventListener("message", onMessage);
  });
}

function appRequest(appWorker, type, fields = {}, transfer = []) {
  const requestId = "app_" + crypto.randomUUID().replaceAll("-", "");
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      appWorker.removeEventListener("message", onMessage);
      reject(new Error("Timed out waiting for application Worker " + type));
    }, 120000);
    function onMessage(event) {
      if (event.data?.requestId !== requestId) return;
      clearTimeout(timeout);
      appWorker.removeEventListener("message", onMessage);
      resolve(event.data);
    }
    appWorker.addEventListener("message", onMessage);
    try {
      appWorker.postMessage({ type, requestId, ...fields }, transfer);
    } catch (error) {
      clearTimeout(timeout);
      appWorker.removeEventListener("message", onMessage);
      reject(error);
    }
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function testApplicationWorker() {
  const appWorker = new Worker(
    "/security/argon2-wasm/browser-worker-test/vault-crypto-worker.bundle.js",
    { type: "module", name: "vault-app-worker-test" }
  );
  try {
    const ping = await appRequest(appWorker, "PING");
    assert(ping.type === "READY", "Application Worker did not answer PING.");

    const vaultId = "11111111-1111-4111-8111-111111111111";
    const recordId = "22222222-2222-4222-8222-222222222222";
    const unlockText = "browser-worker-only-test-secret";
    const unlockBytes = new TextEncoder().encode(unlockText);
    const secretBuffer = unlockBytes.buffer;
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const expectedSalt = btoa(String.fromCharCode(...saltBytes));
    const saltBuffer = saltBytes.buffer;

    const initializedPromise = appRequest(appWorker, "INITIALIZE", {
      unlockSecretBuffer: secretBuffer,
      saltBytes: saltBuffer,
      profileId: 1,
      vaultId
    }, [secretBuffer, saltBuffer]);
    assert(secretBuffer.byteLength === 0 && saltBuffer.byteLength === 0,
      "Application Worker secret inputs were not transferred.");
    const initialized = await initializedPromise;
    assert(initialized.type === "INITIALIZED", "Application Worker initialization failed.");
    assert(initialized.salt === expectedSalt, "Application Worker changed the public KDF salt.");

    const plaintext = JSON.stringify({
      accountName: "Test account",
      username: "test@example.invalid",
      password: "never-a-real-password",
      backupCodes: "TEST-CODE-ONLY"
    });
    const encrypted = await appRequest(appWorker, "ENCRYPT_RECORD", { recordId, plaintext });
    assert(encrypted.type === "ENCRYPTED_RECORD", "Application Worker encryption failed.");
    assert(!JSON.stringify(encrypted).includes("never-a-real-password"),
      "Application Worker returned plaintext in its encryption response.");

    const decrypted = await appRequest(appWorker, "DECRYPT_RECORD", {
      recordId,
      envelope: encrypted.envelope
    });
    assert(decrypted.type === "DECRYPTED_RECORD" && decrypted.plaintext === plaintext,
      "Application Worker round-trip did not preserve the test record.");

    const locked = await appRequest(appWorker, "LOCK");
    assert(locked.type === "LOCKED", "Application Worker did not lock.");
    const denied = await appRequest(appWorker, "DECRYPT_RECORD", {
      recordId,
      envelope: encrypted.envelope
    });
    assert(denied.type === "ERROR" && denied.code === "LOCKED",
      "Application Worker allowed decryption after lock.");

    const wrongBytes = new TextEncoder().encode("incorrect-test-secret");
    const wrongBuffer = wrongBytes.buffer;
    const wrongSalt = Uint8Array.from(atob(initialized.salt), c => c.charCodeAt(0)).buffer;
    const wrongUnlock = await appRequest(appWorker, "UNLOCK", {
      unlockSecretBuffer: wrongBuffer,
      saltBytes: wrongSalt,
      profileId: initialized.profileId,
      wrappedKeyEnvelope: initialized.wrappedKeyEnvelope,
      vaultId
    }, [wrongBuffer, wrongSalt]);
    assert(wrongUnlock.type === "ERROR" && wrongUnlock.code === "UNLOCK_FAILED",
      "Wrong Unlock Secret was not rejected with the generic error.");

    const correctBytes = new TextEncoder().encode(unlockText);
    const correctBuffer = correctBytes.buffer;
    const correctSalt = Uint8Array.from(atob(initialized.salt), c => c.charCodeAt(0)).buffer;
    const unlocked = await appRequest(appWorker, "UNLOCK", {
      unlockSecretBuffer: correctBuffer,
      saltBytes: correctSalt,
      profileId: initialized.profileId,
      wrappedKeyEnvelope: initialized.wrappedKeyEnvelope,
      vaultId
    }, [correctBuffer, correctSalt]);
    assert(unlocked.type === "UNLOCKED", "Correct Unlock Secret did not unlock the Vault.");

    const tampered = {
      ...encrypted.envelope,
      authTag: (encrypted.envelope.authTag[0] === "A" ? "B" : "A") + encrypted.envelope.authTag.slice(1)
    };
    const tamperResult = await appRequest(appWorker, "DECRYPT_RECORD", { recordId, envelope: tampered });
    assert(tamperResult.type === "ERROR" && tamperResult.code === "CRYPTO_FAILED",
      "Tampered record authentication tag was not rejected.");

    // Termination, not a queued LOCK message, is the cancellation boundary
    // for in-flight synchronous KDF or asynchronous WebCrypto operations.
    let lateResponse = false;
    const terminationRequestId = "terminate_" + crypto.randomUUID().replaceAll("-", "");
    const onLateResponse = event => {
      if (event.data?.requestId === terminationRequestId) lateResponse = true;
    };
    appWorker.addEventListener("message", onLateResponse);
    appWorker.postMessage({
      type: "ENCRYPT_RECORD",
      requestId: terminationRequestId,
      recordId: "33333333-3333-4333-8333-333333333333",
      plaintext: JSON.stringify({ accountName: "Termination test", notes: "x".repeat(12_000) })
    });
    appWorker.terminate();
    await new Promise(resolve => setTimeout(resolve, 100));
    assert(!lateResponse, "Terminated Worker returned an in-flight crypto response.");

  } finally {
    appWorker.terminate();
  }
}

try {
  await waitFor("WORKER_STARTED");
  const ready = waitFor("READY");
  worker.postMessage({ type: "INIT" });
  await ready;

  const passwordBuffer = new TextEncoder().encode("test-only worker input").buffer;
  const saltBuffer = new Uint8Array(16).fill(0x42).buffer;
  const derived = waitFor("DERIVED_AND_VERIFIED");
  worker.postMessage(
    { type: "DERIVE_AND_SELF_TEST", passwordBuffer, saltBuffer, profileId: 1 },
    [passwordBuffer, saltBuffer]
  );

  if (passwordBuffer.byteLength !== 0 || saltBuffer.byteLength !== 0) {
    throw new Error("Secret buffers were not detached from the main thread.");
  }
  await derived;
  result.textContent = "PASS — isolated Argon2id PoC Worker.";
  await testApplicationWorker();
  result.textContent = "PASS — isolated Argon2id PoC and application Vault crypto Worker.";
  window.__argonWorkerResult = { done: true, ok: true };
} catch (error) {
  result.textContent = "FAIL — " + String(error?.message || "Worker test failed.");
  window.__argonWorkerResult = { done: true, ok: false, error: String(error?.message || error) };
} finally {
  worker.terminate();
}
