# Vault Cryptographic Implementation Review

**Status: SOURCE REVIEW ONLY — NOT A SECURITY AUDIT, NOT A PENETRATION TEST, AND NOT APPROVED FOR IMPLEMENTATION**  
**Date:** 2026-11-08  
**Reviewed branch:** `design/cyber-visual-architecture`  
**Scope:** Existing cryptographic modules, related tests, current Vault API data flow, and recovery-related code.

This checklist records what is present in the inspected source. A module or unit test passing does not prove that the complete application uses that module securely. “Not found” means not found in the reviewed paths and branch snapshot; it is not a claim about every possible runtime or external system.

## 1. Executive finding

The repository contains two materially different encryption paths:

1. **Current application path:** server-side AES-256-GCM encryption using `VAULT_ENCRYPTION_KEY`. The collection GET route decrypts every row on the server and returns account fields as plaintext JSON to the authenticated browser. POST and PUT accept plaintext account fields and encrypt them on the server.
2. **Client-side cryptographic building blocks:** browser AES-256-GCM record encryption and a client-side DEK envelope helper exist, with focused unit tests. The reviewed Vault API and Vault manager have not been wired to use these modules as the active storage/read/write path.

Therefore, the current Vault is **server-mediated encryption, not zero-knowledge and not end-to-end encrypted against the application server**. The client modules are useful foundations, not evidence of an integrated client-key architecture.

## 2. Evidence reviewed

| Source | What the inspected source establishes |
|---|---|
| `lib/vault/client-encryption.ts` | Browser Web Crypto AES-256-GCM record encrypt/decrypt, non-extractable DEK checks, fresh 12-byte IV generation, 128-bit authentication tag, versioned envelope, Vault/record AAD. |
| `lib/vault/key-envelope.ts` | Client-side AES-256-GCM wrapping/unwrapping of a random 32-byte DEK; non-extractable KEK/DEK imports; Vault-bound AAD; version 1 envelope. |
| `lib/vault/record-protocol.ts` | Record format version 1 and algorithm identifier. |
| `lib/vault/encrypted-record-schema.ts` | Strict opaque envelope shape and canonical Base64/size validation for an API boundary. |
| `lib/vault/item-encryption.ts` | Active server-only AES-256-GCM encryption using a configured server master key and HKDF-derived item key. |
| `app/api/vault/items/route.ts` | Current collection GET decrypts all rows server-side; POST accepts plaintext fields and encrypts server-side. |
| `app/api/vault/items/[id]/route.ts` | Current PUT accepts plaintext fields and encrypts server-side; DELETE removes the owned row. |
| `lib/auth/recovery-encryption.ts` and `app/api/auth/recovery/route.ts` | Existing account-recovery-code workflow; pending recovery code is encrypted server-side with the application key. This is not the proposed client-side DEK recovery envelope. |
| `lib/auth/vault.ts` | Login ID helpers, password length validation, recovery-code generation/hash/verification, and same-origin request validation. |
| `tests/client-vault-encryption.test.ts` | Focused tests for browser record crypto behavior. |
| `tests/vault-key-envelope.test.ts` | Focused tests for client DEK envelope behavior. |
| `tests/vault-item-encryption.test.ts` | Focused tests for current server-side item encryption. |
| `docs/ARGON2ID-LIBRARY-REVIEW.md` | KDF candidate review and isolated RFC-vector evidence; it explicitly says no KDF package is approved/installed for the application path. |
| `docs/VAULT-KEY-HIERARCHY-AND-RECOVERY.md` | Proposed future key hierarchy and recovery model, explicitly proposal-only. |

## 3. Requirement-by-requirement checklist

Status meanings:
- **Present in source:** relevant code exists; this does not imply full integration or independent review.
- **Partially present:** a foundation exists, but important controls or application wiring remain.
- **Not found in reviewed path:** no implementation was established in the inspected source.
- **Current limitation:** behavior of the active application path conflicts with the proposed target architecture.

| Requirement | Source evidence / current status | Gap and risk | Next validation required |
|---|---|---|---|
| Random 256-bit client DEK | **Present in source.** `generateVaultDataKey()` uses Web Crypto AES-GCM 256-bit generation with extractable=false. | No evidence the active Vault initializes or uses this DEK. | Trace initialization and prove no raw DEK leaves the browser. |
| Client record AES-256-GCM | **Present in source.** `encryptVaultRecord` / `decryptVaultRecord`. | Not wired to active collection GET/POST/PUT flow. | Integrate only after API contract and migration design approval; add end-to-end tests. |
| Fresh 96-bit record IV | **Present in source.** 12 random bytes generated per encryption. | Random IV generation alone does not prove a system-wide nonce budget or collision monitoring for a long-lived key. | Define maximum encryptions per key, rotation thresholds, and format invariants. |
| 128-bit GCM tag | **Present in source.** Client module uses tagLength 128 and splits 16-byte tag. | Needs interoperability and negative-case tests across supported browsers. | Browser matrix and tamper tests. |
| Vault/record AAD | **Present in source.** Client record AAD includes protocol label, format version, Vault ID, record ID, and account purpose. | Field-level separation is not implemented; the whole account object is encrypted as one payload. | Confirm immutable identifiers and schema/purpose migration rules. |
| Non-extractable DEK | **Present in source.** Generated/imported as non-extractable CryptoKey. | Non-extractability does not protect against same-origin malicious JS/XSS or a compromised app delivery pipeline. | Threat-model review and XSS/dependency controls. |
| KEK from Argon2id | **Not found as an integrated application KDF.** Key-envelope helper accepts an already-derived 32-byte byte array. The KDF review says no package is approved/installed for the app. | No password-to-KEK path, salt/parameter metadata protocol, or app unlock lifecycle established. | Select and review a KDF, verify official vectors, benchmark real mobile devices, bound hostile parameters. |
| Non-extractable KEK import | **Present in source.** `importVaultKeyEncryptionKey` imports AES-GCM key and clears provided byte array and copy. | The caller/KDF adapter and its ownership semantics are not integrated. JS memory clearing is best-effort, not guaranteed erasure. | Test adapter contract and document memory limitations. |
| DEK envelope | **Present in source.** AES-256-GCM, random IV, version 1, wrapped key, Vault-bound AAD. | Envelope persistence, retrieval, rotation, and recovery are not connected to active API/database flows. | Add schema/API only after approval; test concurrency and lost-response cases. |
| Purpose-separated HKDF subkeys | **Partially present.** Current server encryption derives an item key with HKDF-SHA-256 and fixed purpose labels. | The client design proposal calls for purpose-specific subkeys from the DEK, but no client HKDF derivation helper was found in reviewed Vault modules. | Specify labels, salt, context encoding, versioning, and independent vectors. |
| Client-side encryption before upload | **Current limitation.** Active POST/PUT receive plaintext account fields and encrypt on the server. | Server and request-processing layer can see secrets. This is not zero-knowledge. | Replace active write contract only through separately approved migration. |
| Ciphertext-only collection API | **Current limitation.** GET decrypts all rows server-side and returns plaintext account data. | Server can read every stored secret; all records are sent to browser at once. | Design metadata-only list and per-record ciphertext retrieval. |
| Ciphertext-only update API | **Current limitation.** PUT accepts plaintext fields and server encrypts them. | Server sees plaintext on every edit. | Validate opaque envelope server-side without decrypting. |
| Opaque envelope validation | **Present as a helper.** `parseEncryptedVaultRecord` validates strict keys, version, algorithm, canonical Base64, IV/tag lengths, and size. | It must be verified at every relevant API boundary; helper existence does not prove route usage. | Add route-level tests for malformed and oversized payloads. |
| Recovery DEK envelope | **Not found in reviewed active path.** Existing recovery handles account recovery codes and server-encrypted pending codes. | It is not the proposed user-held recovery secret that locally unwraps the DEK. | Implement only after recovery design review and explicit approval. |
| Unlock-secret rotation | **Not found as an integrated client flow.** | No verified re-wrap workflow, old-envelope invalidation, or concurrency handling. | Use the recovery/rotation test plan after implementation. |
| Recovery-key rotation | **Not found as a client DEK-envelope flow.** | Existing account recovery-code rotation is a different mechanism. | Verify new envelope persistence before invalidating old envelope. |
| Rollback/replay protection | **Not established by the reviewed client crypto modules.** | AES-GCM AAD authenticates context but does not by itself prevent restoring an older valid ciphertext/envelope. | Define monotonic versioning or another authenticated freshness mechanism. |
| Secret-safe logging | **Partially present.** Current collection route logs stage and sanitized error code, with an explicit no-secret logging comment. | Review all routes, platform logs, tracing, analytics, crash reporting, and provider-side retention. | Automated log-redaction tests and deployment configuration review. |
| Cache controls | **Present in current API response helper.** no-store and Pragma headers are set on collection and item responses. | Cache headers do not remove plaintext from JS state, memory, browser extensions, or developer tools. | Verify all routes and browser/network behavior. |
| Legacy data migration | **Not implemented as client-side migration in reviewed path.** | Existing records use server-side encryption and cannot simply be re-labelled as client-encrypted. | Rehearse an idempotent, checkpointed migration with synthetic data and verified rollback. |

## 4. Important source-level observations

### 4.1 Current server-side key derivation
`lib/vault/item-encryption.ts` derives a dedicated item-encryption key from the configured server master key using HKDF-SHA-256 and fixed salt/info labels. Its AAD binds purpose, version, user ID, and item ID. This is a useful server-side separation measure, but the server still possesses the key material required to decrypt all records.

### 4.2 Client key envelope is deliberately KDF-agnostic
`lib/vault/key-envelope.ts` explicitly does not implement Argon2id. It expects a reviewed adapter to provide exactly 32 derived bytes. This separation is reasonable, but there is currently no complete unlock-secret-to-KEK integration established by the reviewed files.

### 4.3 Existing recovery is not Vault DEK recovery
The current recovery route verifies a recovery code, changes the Supabase Auth password, and manages a pending recovery code. The pending code is encrypted with the server's `VAULT_ENCRYPTION_KEY`. This does not create a user-held recovery envelope capable of locally unwrapping the Vault DEK.

### 4.4 Current API is the decisive integration gap
The active collection GET route calls `decryptVaultItem` for each row and returns parsed account fields. POST and PUT accept account fields in plaintext and call `encryptVaultItem`. The client-side crypto modules are therefore not the active storage protocol.

## 5. Required security gates before any implementation

1. **Protocol gate:** approve exact record, key-envelope, KDF metadata, AAD, nonce, and versioning formats.
2. **KDF gate:** select a maintained implementation; verify official known-answer vectors in supported browsers; benchmark representative Android/iOS devices; set strict parameter bounds.
3. **Key lifecycle gate:** define initialization, unlock, lock, timeout, tab close, sign-out, rotation, recovery, multi-device behavior, and failure recovery.
4. **API gate:** collection metadata must not contain secret payloads; record APIs must accept and return opaque ciphertext only; ownership, origin, rate limits, body bounds, and schema checks must remain enforced.
5. **Recovery gate:** prove that recovery unwraps locally and that no server-side recovery bypass exists; rehearse lost-response and partial-commit cases.
6. **Migration gate:** use synthetic data first; checkpoint each record; verify ciphertext read-back; retain a separately protected rollback path until reconciliation is complete; never silently discard legacy data.
7. **Independent review gate:** review protocol, implementation, dependencies, threat model, and test evidence before real credentials are used.

## 6. Review limitations

- This is a source inspection of selected files on the named branch, not a complete repository audit.
- No live application, production database, deployment environment, or secret value was accessed.
- No penetration test, external cryptographic review, browser QA, mobile-device benchmark, or accessibility test was performed as part of this review.
- Existing unit-test source was inspected; **this review did not execute the tests**.
- Historical CI evidence applies only to the exact historical workflows/commits described elsewhere. It must not be interpreted as proof that this review or current branch passed CI.
- No production-readiness, zero-knowledge, or invulnerability claim is made.

## 7. Approval boundary

This document is review-only. It does not authorize:
- changes to authentication, crypto implementation, API behavior, database schema, or migrations;
- production secrets or environment changes;
- real-account credential testing or migration;
- deployment, preview generation, or production release;
- merge into `main`.

**Current conclusion:** retain the current Vault as server-mediated encryption until the proposed client-key architecture is separately approved, implemented, tested, migrated, and independently reviewed. Do not store high-value real credentials on the assumption that the client-side modules already protect the active application.
