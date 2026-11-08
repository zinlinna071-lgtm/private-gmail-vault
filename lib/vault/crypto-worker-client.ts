"use client";

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
