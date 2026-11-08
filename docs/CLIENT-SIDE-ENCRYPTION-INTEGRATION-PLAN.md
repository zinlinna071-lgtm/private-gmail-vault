# Client-Side Encryption Integration Plan

**Status:** Architecture and integration checklist only. Client-side envelope primitives exist, but the active Vault flow is still server-readable.
**Branch:** `design/cyber-visual-architecture`
**Production impact:** None. This document does not authorize migrations, deployment, or changes to production secrets.

## 1. Verified current state

The following files were reviewed on this branch:

- `lib/vault/record-envelope.ts` implements browser Web Crypto AES-256-GCM record encryption/decryption with a fresh 96-bit IV and AAD bound to the Vault ID, record ID, record type, and protocol version.
- `lib/vault/key-envelope.ts` implements browser-side DEK wrapping/unwrapping using a non-extractable AES-256-GCM KEK. It expects a 32-byte KDF result; it does not implement Argon2id itself.
- `security/argon2-wasm/` is an isolated Argon2id WASM proof of concept, not integrated into the app.
- `app/api/vault/items/route.ts` currently accepts plaintext credential fields on POST, encrypts them on the server, and decrypts records on GET.
- `app/api/vault/items/[id]/route.ts` currently accepts plaintext fields on PUT and encrypts them on the server. DELETE is owner-filtered.
- `lib/vault/item-encryption.ts` derives a server-side encryption key from `VAULT_ENCRYPTION_KEY`.

**Conclusion:** the current active CRUD path is not zero-knowledge. The client-side primitives do not protect records until every read/write path uses them and the legacy server key path is retired.

## 2. Target trust boundary

The browser is the only component that should ever handle decrypted credential content or the unwrapped DEK during normal use.

- Authentication password: used only for account authentication; never reused as the Vault Unlock Secret.
- Vault Unlock Secret: entered locally and used as Argon2id input; it must never be sent to an API, logged, stored in analytics, or included in puzzle/challenge flows.
- Argon2id: run in a dedicated Web Worker using a fixed, reviewed profile. Do not expose arbitrary memory, iteration, parallelism, algorithm, or output-length parameters to callers.
- KEK: derived in the Worker/client from the Unlock Secret and per-Vault random salt, then imported as a non-extractable AES-256-GCM key.
- DEK: generated as 32 cryptographically random bytes in the browser, wrapped by the KEK, imported as a non-extractable AES-256-GCM key, and never uploaded in raw form.
- Record encryption: performed in the browser using the DEK and `record-envelope.ts`; each record uses a fresh random nonce and context-bound AAD.
- Server/database: receives only encrypted record envelopes, wrapped DEK, public KDF metadata, IDs, and the minimum operational metadata required for auth, ownership, quota, and recovery-state management.

The Owner account must have its own independent Vault key hierarchy. Owner privileges must not create a shared key, server escrow, support key, impersonation path, or ability to unwrap a Secondary user's DEK.

## 3. Required Worker protocol

Implement only after the Argon2id PoC has passed its cryptographic and runtime gates.

1. The main thread requests a challenge-free local unlock operation; no unlock secret is sent over HTTP.
2. The Worker receives the unlock secret and public KDF metadata through a narrowly typed message. Avoid logging or reflecting secret values in errors.
3. The Worker derives exactly 32 bytes using the fixed approved Argon2id profile and unique per-Vault salt.
4. Import the derived bytes through `importVaultKeyEncryptionKey`, ensuring temporary raw bytes are zeroed.
5. The Worker unwraps the DEK using the Vault ID as authenticated context.
6. Keep the DEK non-extractable and Worker-confined where feasible. If a CryptoKey must cross a Worker boundary, use structured cloning only after a browser compatibility test and preserve non-extractability.
7. Unlock success returns only a minimal status; never return the Unlock Secret, derived key bytes, or raw DEK to the UI.
8. On lock, logout, tab close, idle timeout, or failed re-authentication, drop references and terminate the Worker. JavaScript cannot guarantee physical zeroization of all engine-managed copies; document this limitation.
9. Permit one KDF operation per Vault at a time. Reject duplicate requests, enforce bounded input sizes, and handle Worker crash/OOM as a safe failure without falling back to server decryption.

## 4. Ciphertext-only API contract

Replace the current active API path as one coordinated change:

- POST accepts a client-generated record UUID and a strictly validated versioned ciphertext envelope. It must reject plaintext fields such as `accountName`, `password`, and `backupCodes`.
- GET returns opaque envelopes and public metadata only. It must not import `item-encryption.ts`, derive a server key, or decrypt.
- PUT accepts only a validated ciphertext envelope and updates a row filtered by both record ID and authenticated user ID.
- DELETE remains filtered by both record ID and authenticated user ID.
- All responses remain `no-store`; request bodies remain bounded; origin and content-type checks remain enforced.
- Validate envelope version, algorithm, exact allowed keys, base64 lengths, nonce/tag sizes, and ciphertext size on the server without attempting decryption.
- The database must store the wrapped DEK and public KDF metadata separately from record envelopes. No raw KEK/DEK or Unlock Secret columns.
- Keep the four-record Secondary quota enforced transactionally in PostgreSQL. Quota enforcement must not require plaintext access.
- Keep Owner role assignment out-of-band and server/database controlled.

Do not deploy an API that expects ciphertext until the matching browser client and an isolated database migration are ready together. A partial rollout could make existing records unreadable or make new record creation fail.

## 5. Legacy record migration

Existing rows were encrypted with the server-held `VAULT_ENCRYPTION_KEY`. They cannot be transformed into client-side encryption by the server without decrypting them.

Use an explicit, user-mediated migration:

1. User signs in and the legacy record is retrieved only through the old, clearly disclosed migration path.
2. Browser receives the legacy plaintext during this one-time migration; this is an acknowledged temporary exposure and must be clearly disclosed.
3. User creates/enters the Vault Unlock Secret and completes local key setup.
4. Browser encrypts each record with the new DEK and uploads the ciphertext envelope.
5. Verify the saved ciphertext by fetching it back and decrypting locally.
6. Only after successful per-record verification, mark that record as migrated.
7. Do not silently delete legacy data before verification. Define a reviewed retention/deletion plan for old ciphertext and server-key retirement.
8. Once migration is complete and independently verified, remove legacy server decrypt/encrypt code and retire the server encryption secret through an approved operational process.

Do not claim the legacy migration preserves confidentiality from the server: the legacy data is already server-readable by design.

## 6. Required test gates

### Cryptography
- RFC 9106 Argon2id v1.3 known-answer vectors match exactly.
- Cross-check outputs against an independent Argon2id implementation.
- Verify salt uniqueness, fixed profile allowlist, parameter bounds, and deterministic output for the same input tuple.
- Verify wrong Unlock Secret, wrong Vault ID, tampered wrapped DEK, wrong record ID, altered ciphertext, nonce, or tag all fail closed.
- Confirm no plaintext, Unlock Secret, derived bytes, or raw DEK appears in logs, network requests, browser storage, analytics, or error telemetry.

### Browser/runtime
- Run the KDF in a dedicated Worker on supported mobile browsers, including lower-powered Android devices and iOS Safari.
- Measure unlock time, peak memory, responsiveness, repeated unlock behavior, and OOM/crash behavior.
- Verify one-in-flight KDF behavior and lock/logout Worker termination.
- Test offline and network-failure behavior without a server-side decryption fallback.

### API/database
- Assert GET/POST/PUT schemas reject plaintext credential fields.
- Assert the API never imports or calls the server item-encryption module.
- Assert users cannot read/update/delete another user's envelopes or wrapped DEK.
- Assert Owner cannot read or unwrap Secondary Vault content.
- Assert Secondary four-record quota remains atomic under concurrent inserts.
- Test migration rollback and legacy data compatibility in a disposable database only.

### Release gates
- All relevant unit, integration, PostgreSQL, typecheck, build, browser, and mobile tests must pass with recorded evidence.
- GitHub Actions runner allocation is now functioning for this public repository; continue requiring successful branch-specific CI evidence for each integration change.
- Complete independent cryptographic and application-security review.
- Obtain explicit approval before applying any migration to a live database, changing production secrets, or deploying.

## 8. Argon2id PoC verification checkpoint — 2026-11-08

The isolated Rust Argon2id v1.3 PoC passed its CI gates on branch `design/cyber-visual-architecture`:

- Native RFC 9106 §5.3 known-answer vector and input validation passed.
- The pinned Rust toolchain compiled the WASM module.
- Pinned `wasm-bindgen` generated the JavaScript bindings.
- The generated JavaScript boundary smoke test passed.
- The separate browser Worker harness passed in Chromium, Firefox, and WebKit (workflow run `42471022882`).
- Main repository CI, including tests, typecheck, PostgreSQL migrations, and production build, passed at commit `686ac3e` (workflow run `42472354256`).

This is evidence for the isolated PoC only. It does not approve a production KDF profile, prove Android/iOS performance, package WASM into the Next.js app, or enable client-side encryption in the active Vault CRUD path. The current API remains server-readable.

## 7. Public security claim boundary

Until all gates pass, public copy must state that the current prototype uses server-side encryption and that privileged server access can technically expose plaintext through the legacy API.

After implementation and independent review, a defensible claim may state that the reviewed deployed application/backend has no Owner or backend decryption key or normal API capability for Secondary Vault records. Do not promise absolute security. Website deployment control, compromised devices, malicious browser extensions, phishing, and malicious client-code updates remain relevant threats.

If a user loses all unlock and recovery material, the data may be permanently unrecoverable. No Owner/support bypass should be added to solve that tradeoff.


## 9. Latest CI and application packaging checkpoint — 2026-11-08

The latest branch run, `42473339553`, completed successfully:

- Main `verify` job: all checks passed, including automated tests, type check, PostgreSQL migration tests (webhook, Curator, Secondary quota, and client Vault key metadata), and production build.
- Argon2id WASM PoC job: Rust formatting, native RFC 9106/input-validation tests, WASM compilation, pinned wasm-bindgen CLI installation, generated Node bindings, JavaScript boundary smoke test, and artifact upload all passed.
- The separate test-only browser Worker workflow previously passed in Chromium, Firefox, and WebKit (run `42471022882`).

These results establish the isolated PoC and repository CI gates only. They do not establish that the generated browser WASM package is included in the Next.js/OpenNext Cloudflare production asset graph.

### Packaging decision gate before application Worker implementation

The application currently builds with Next.js 15 and OpenNext Cloudflare. The PoC workflow generates `pkg-web` only inside CI and uploads it as a short-retention artifact; it does not publish that generated package into the application source tree or production static assets. The application has no Rust/WASM generation step in its build scripts.

Before importing the PoC into a production Worker, choose and verify a reproducible asset strategy that works in both the repository's production build and OpenNext Cloudflare output. The strategy must pin Rust, wasm-bindgen, and generated artifact hashes; avoid runtime CDN or untrusted remote WASM loading; and have a production-build test that proves the Worker JavaScript and WASM binary are present at the exact paths used by the browser. A CI-only artifact is not a production packaging solution.

Do not create an application Worker that references a missing generated module, add a server-side KDF fallback, or switch the CRUD API before the asset strategy and matching browser client are verified. Keep the current server-readable disclosure active. No live migration or deployment is authorized by this checkpoint.


## 10. Reproducible browser-WASM asset packaging gate

Commit `087054f8f1c44d1a78f7c09d3c244ee216ecc37e` adds `scripts/package-argon2-wasm-assets.mjs` and a CI step that:

1. Generates the browser-target bindings from the pinned Rust/WASM toolchain.
2. Copies only the expected generated JavaScript glue, WASM binary, and TypeScript declaration into the ignored `public/crypto/argon2/` build directory.
3. Writes a manifest containing byte lengths and SHA-256 digests for those three generated files.
4. Runs the OpenNext Cloudflare build and checks that the generated files and manifest appear under `.open-next/assets/crypto/argon2/`.
5. Retains the generated assets as a short-lived CI artifact for inspection.

The generated directory is intentionally ignored by Git and is rebuilt from source in CI. It contains no user data or credentials.

This is a packaging verification gate only. The application does not yet load this WASM module, and the current test-only Worker remains separate from the future application Worker. A passing OpenNext packaging check will prove asset inclusion, not production crypto integration or safe client-side Vault behavior. The production deployment pipeline must use the same pinned build step before any future Worker import is enabled.
