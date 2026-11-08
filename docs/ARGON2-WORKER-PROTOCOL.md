# Vault Crypto Worker Protocol

**Status:** Design specification; no application Worker is wired or enabled.
**Parent plan:** `docs/CLIENT-SIDE-ENCRYPTION-INTEGRATION-PLAN.md`
**Branch:** `design/cyber-visual-architecture`

## Security decision

The Worker should own the entire key lifecycle, not merely run Argon2id and send derived bytes back to the main thread. The Worker is the crypto boundary for this browser tab:

- Unlock Secret bytes enter the Worker through a transferable `ArrayBuffer`.
- Argon2id runs synchronously inside the Worker, never on the UI thread.
- The Worker imports the derived KEK and unwraps the DEK.
- The non-extractable DEK remains inside the Worker.
- Record encryption and decryption happen inside the Worker using the existing record-envelope module.
- The main thread receives ciphertext envelopes for writes and plaintext only when a record must be displayed or edited.
- The Worker never performs network requests and never receives an auth password, session token, or API response containing unrelated data.

This design reduces exposure of key material to the main thread. It does not protect against malicious JavaScript served by the application origin, browser extensions, device compromise, or memory inspection by a sufficiently privileged local attacker.

## Message contract

All messages use a strict discriminated union with a request ID. Reject unknown message types, unknown fields, malformed IDs, oversized buffers, and requests received while a KDF operation is already running.

### Main thread to Worker

| Type | Fields | Purpose |
|---|---|---|
| `INITIALIZE` | `requestId, unlockSecretBuffer, saltBytes, profileId, vaultId` | First-time setup: derive KEK, create wrapped DEK, retain DEK in Worker |
| `UNLOCK` | `requestId, unlockSecretBuffer, saltBytes, profileId, wrappedKeyEnvelope, vaultId` | Derive KEK and unwrap existing DEK |
| `ENCRYPT_RECORD` | `requestId, recordId, plaintext` | Encrypt a validated record payload using the in-memory DEK |
| `DECRYPT_RECORD` | `requestId, recordId, envelope` | Authenticate and decrypt a record envelope |
| `LOCK` | `requestId` | Drop the DEK reference and clear unlocked state |
| `PING` | `requestId` | Health check; must never disclose key state or material |

The secret buffer is transferred, not cloned. The caller must immediately discard its reference and must not persist it. The Worker validates UTF-8 byte length before KDF allocation, clears the received byte array in a `finally` block, and never includes values in errors.

### Worker to main thread

| Type | Fields | Purpose |
|---|---|---|
| `READY` | `requestId` | Worker initialized |
| `INITIALIZED` | `requestId, salt, profileId, wrappedKeyEnvelope` | Public key metadata to persist with the user's Vault profile |
| `UNLOCKED` | `requestId` | Unlock succeeded; no key material returned |
| `ENCRYPTED_RECORD` | `requestId, envelope` | Ciphertext envelope ready for API upload |
| `DECRYPTED_RECORD` | `requestId, plaintext` | Decrypted record for immediate UI display |
| `LOCKED` | `requestId` | Worker dropped its DEK reference |
| `ERROR` | `requestId, code` | Stable non-sensitive error code only |

Do not return the Argon2id output, KEK, raw DEK, CryptoKey, or internal stack trace to the main thread. A wrong secret and a tampered wrapped envelope should produce the same generic unlock failure to reduce information leakage.

## Lifecycle and concurrency

- Worker starts in a locked state.
- Only one `INITIALIZE` or `UNLOCK` KDF operation may run at a time.
- Do not queue unbounded KDF requests; reject a concurrent request with `BUSY`.
- Record operations are accepted only in the unlocked state.
- A failed unlock leaves the Worker locked.
- `LOCK` clears the in-memory key reference and rejects pending record operations.
- Logout, explicit lock, idle timeout, page visibility policy, and fatal Worker errors must trigger lock/termination.
- Worker termination is the strongest practical lifecycle boundary available to this web design, but it cannot guarantee physical erasure of browser engine memory.
- Do not automatically unlock from browser storage, URL parameters, remembered passwords, or authentication cookies.
- No fallback to the legacy server encryption API is permitted if Worker initialization, WASM loading, or KDF execution fails.

## WASM packaging gate

The current Rust crate is a PoC and CI generates Node.js bindings for its smoke test. The application Worker requires a separate browser-target build and generated browser glue. Do not import a nonexistent generated package or silently bundle a placeholder.

Before application integration:

1. Generate browser-target wasm-bindgen output with the exact pinned CLI version.
2. Inspect generated glue and confirm no unexpected network fetch, eval, dynamic code execution, or secret logging.
3. Load the generated module from the dedicated Worker using a static, build-verified path.
4. Verify Next.js production and Cloudflare build outputs include the Worker and WASM assets correctly.
5. Run a real-browser test proving the KDF blocks neither painting nor input responsiveness.
6. Test Chromium, Firefox, and WebKit, plus lower-powered Android and iOS Safari devices.
7. Confirm the Argon2 profile memory/time settings are approved only after measurements and independent review.

The existing CI Node smoke test is not evidence for this browser Worker packaging gate.

## Required tests

- Secret input buffer is transferred and cleared on success and all failure paths.
- Invalid UTF-8, empty input, oversized input, invalid salt, and unsupported profile fail before expensive allocation.
- A second concurrent KDF request is rejected as `BUSY`.
- No secret or key bytes appear in Worker messages, logs, error telemetry, or network traffic.
- Initialize → encrypt → decrypt roundtrip succeeds with a non-extractable DEK.
- Wrong secret, wrong Vault ID, altered wrapped envelope, wrong record ID, modified ciphertext, IV, or tag fails closed.
- Lock makes every later record operation fail until a successful unlock.
- Worker crash/OOM leaves the UI locked and does not invoke a server-side decrypt fallback.
- API receives only ciphertext envelopes and public metadata after integration; network inspection verifies no plaintext fields are sent.
- Worker is terminated on logout and explicit lock; idle timeout behavior is tested.


## Protocol implementation checkpoint — 2026-11-08

A strict TypeScript contract has now been added at `lib/vault/worker-protocol.ts`:

- Discriminated request/response unions cover the message types above.
- Request parsing rejects unknown fields and message types, malformed request/Vault/record IDs, unsupported KDF profile IDs, invalid transferable buffer sizes, and malformed record envelopes.
- Response validation rejects extra fields and any response shape that attempts to return key material.
- Error responses are limited to stable non-sensitive codes.
- The contract contains no Worker runtime, KDF implementation, network access, or Vault API integration.

A focused test file was added at `tests/vault-worker-protocol.test.ts` for accepted and rejected message shapes. **These tests have been written but have not been executed or confirmed passing** because the repository's GitHub Actions runner allocation issue remains unresolved and no local test run has been performed.

This checkpoint does not change the implementation boundary below: there is still no application Worker source/client, browser-target WASM package, unlock UI, or ciphertext-only CRUD path. Do not treat the protocol module as an enabled security feature.

## Current implementation boundary

An isolated Rust Argon2id WASM Worker harness now exists under `security/argon2-wasm/browser-worker-test/`. It exercises the generated `--target web` bindings in a dedicated module Worker, transfers and clears test input buffers, imports the derived result as a non-extractable AES-GCM key, and performs a Worker-local self-test without returning key bytes. A Playwright workflow is defined to run Chromium, Firefox, and WebKit; until that workflow completes successfully, browser compatibility remains unverified.\n\nThis is **not** the production Vault Worker: no application Worker client, production unlock UI, integrated key-envelope lifecycle, ciphertext-only CRUD integration, or production key metadata migration exists yet. The active API still receives plaintext fields and decrypts server-side. The Vault must continue to display the existing privacy limitation and must not be used for real/high-value credentials until the complete migration and independent review are finished.
