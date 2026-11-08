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
  result.textContent = "PASS — KDF executed in Worker; secret buffers transferred; derived key stayed inside Worker.";
  window.__argonWorkerResult = { done: true, ok: true };
} catch (error) {
  result.textContent = "FAIL — " + String(error?.message || "Worker test failed.");
  window.__argonWorkerResult = { done: true, ok: false, error: String(error?.message || error) };
} finally {
  worker.terminate();
}
