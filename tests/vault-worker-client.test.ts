import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VaultCryptoWorkerClient } from "../lib/vault/worker-client";

class FakeWorker extends EventTarget {
  readonly messages: Array<{ type: string; requestId: string }> = [];
  terminated = false;

  postMessage(message: { type: string; requestId: string }) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  respond(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  crash() {
    this.dispatchEvent(new Event("error"));
  }

  sendUnreadableMessage() {
    this.dispatchEvent(new Event("messageerror"));
  }
}

const vaultId = "11111111-1111-4111-8111-111111111111";
const salt = "AAAAAAAAAAAAAAAAAAAAAA==";
const wrappedKeyEnvelope = {
  version: 1 as const,
  algorithm: "AES-256-GCM" as const,
  iv: "AAAAAAAAAAAAAAAA",
  wrappedKey: "A".repeat(64)
};

function setup() {
  const worker = new FakeWorker();
  const client = new VaultCryptoWorkerClient(() => worker as unknown as Worker);
  return { client, worker };
}

describe("VaultCryptoWorkerClient", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  it("routes a successful unlock response to the matching request", async () => {
    const { client, worker } = setup();
    const result = client.unlock(vaultId, "test unlock secret", salt, 1, wrappedKeyEnvelope);
    const request = worker.messages[0];

    expect(request.type).toBe("UNLOCK");
    worker.respond({ type: "UNLOCKED", requestId: request.requestId });

    await expect(result).resolves.toBeUndefined();
    client.close();
    expect(worker.terminated).toBe(true);
  });

  it("maps Worker error codes to safe user-facing errors", async () => {
    const { client, worker } = setup();
    const result = client.unlock(vaultId, "test unlock secret", salt, 1, wrappedKeyEnvelope);
    const request = worker.messages[0];

    worker.respond({ type: "ERROR", requestId: request.requestId, code: "UNLOCK_FAILED" });
    await expect(result).rejects.toThrow("The Vault Unlock Secret could not unlock this Vault.");
    client.close();
  });

  it("rejects a valid but unexpected response type", async () => {
    const { client, worker } = setup();
    const result = client.unlock(vaultId, "test unlock secret", salt, 1, wrappedKeyEnvelope);
    const request = worker.messages[0];

    worker.respond({ type: "LOCKED", requestId: request.requestId });
    await expect(result).rejects.toThrow("unexpected response");
    client.close();
  });

  it("rejects all pending requests and terminates after a Worker error", async () => {
    const { client, worker } = setup();
    const result = client.unlock(vaultId, "test unlock secret", salt, 1, wrappedKeyEnvelope);

    worker.crash();
    await expect(result).rejects.toThrow("stopped unexpectedly");
    expect(worker.terminated).toBe(true);
    await expect(client.unlock(vaultId, "test unlock secret", salt, 1, wrappedKeyEnvelope))
      .rejects.toThrow("Worker is closed");
  });

  it("terminates the Worker after an acknowledged lock", async () => {
    const { client, worker } = setup();
    const result = client.lock();
    const request = worker.messages[0];

    expect(request.type).toBe("LOCK");
    worker.respond({ type: "LOCKED", requestId: request.requestId });
    await expect(result).resolves.toBeUndefined();
    expect(worker.terminated).toBe(true);
  });

  it("rejects an unreadable Worker message and terminates", async () => {
    const { client, worker } = setup();
    const result = client.unlock(vaultId, "test unlock secret", salt, 1, wrappedKeyEnvelope);

    worker.sendUnreadableMessage();
    await expect(result).rejects.toThrow("response could not be read");
    expect(worker.terminated).toBe(true);
  });
});
