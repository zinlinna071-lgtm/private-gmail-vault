import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  initialize: vi.fn(),
  unlock: vi.fn(),
  close: vi.fn()
}));

vi.mock("./worker-client", () => ({
  VaultCryptoWorkerClient: class {
    constructor(factory?: () => Worker) {
      mocks.constructor(factory);
    }
    initialize = mocks.initialize;
    unlock = mocks.unlock;
    close = mocks.close;
  }
}));

import { initializeClientVault, unlockClientVault } from "./client-vault-session";

const vaultId = "11111111-1111-4111-8111-111111111111";
const salt = "AAAAAAAAAAAAAAAAAAAAAA==";
const wrappedKeyEnvelope = {
  version: 1,
  algorithm: "AES-256-GCM",
  iv: "AAAAAAAAAAAAAAAA",
  wrappedKey: "A".repeat(64)
};
const metadata = {
  version: 1,
  kdfAlgorithm: "argon2id-v1.3",
  profileId: 1,
  salt,
  wrappedKeyEnvelope
};

describe("client Vault session orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.initialize.mockResolvedValue({ profileId: 1, salt, wrappedKeyEnvelope });
    mocks.unlock.mockResolvedValue(undefined);
  });

  it("initializes in the Worker and sends only public metadata to the API", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ metadata }), { status: 201 }));
    const factory = vi.fn() as unknown as () => Worker;

    const client = await initializeClientVault(vaultId, "private unlock phrase", 1, {
      fetcher: fetcher as typeof fetch,
      workerFactory: factory
    });

    expect(client).toBeDefined();
    expect(mocks.initialize).toHaveBeenCalledWith(vaultId, "private unlock phrase", 1);
    const [, request] = fetcher.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body).toEqual({ profileId: 1, salt, wrappedKeyEnvelope });
    expect(JSON.stringify(body)).not.toContain("private unlock phrase");
    expect(request.cache).toBe("no-store");
    expect(request.credentials).toBe("same-origin");
  });

  it("closes the Worker if metadata persistence fails", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Conflict" }), { status: 409 }));

    await expect(initializeClientVault(vaultId, "secret", 1, {
      fetcher: fetcher as typeof fetch
    })).rejects.toThrow("Conflict");
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("fetches metadata before creating and unlocking the Worker", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ metadata }), { status: 200 }));
    const client = await unlockClientVault(vaultId, "private unlock phrase", {
      fetcher: fetcher as typeof fetch
    });

    expect(client).toBeDefined();
    expect(fetcher).toHaveBeenCalledWith("/api/vault/key-metadata", expect.objectContaining({
      method: "GET",
      cache: "no-store",
      credentials: "same-origin"
    }));
    expect(mocks.unlock).toHaveBeenCalledWith(
      vaultId,
      "private unlock phrase",
      salt,
      1,
      wrappedKeyEnvelope
    );
  });

  it("does not silently initialize a Vault with missing metadata", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ metadata: null }), { status: 200 }));

    await expect(unlockClientVault(vaultId, "secret", {
      fetcher: fetcher as typeof fetch
    })).rejects.toThrow("missing or unsupported");
    expect(mocks.constructor).not.toHaveBeenCalled();
  });

  it("closes the Worker if the unlock operation fails", async () => {
    mocks.unlock.mockRejectedValue(new Error("Unlock failed"));
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ metadata }), { status: 200 }));

    await expect(unlockClientVault(vaultId, "wrong secret", {
      fetcher: fetcher as typeof fetch
    })).rejects.toThrow("Unlock failed");
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});
