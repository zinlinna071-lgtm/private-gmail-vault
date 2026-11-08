# Vault Cryptographic Protocol Specification

**Status: DRAFT PROTOCOL — DESIGN REVIEW REQUIRED — NOT APPROVED FOR IMPLEMENTATION**  
**Date:** 2026-11-08  
**Branch:** `design/cyber-visual-architecture`  
**Scope:** Proposed browser-side record encryption, DEK wrapping, unlock-secret KDF, recovery wrapping, API envelope contract, versioning, and cryptographic validation.

> This specification is a proposed target protocol, not a description of the active Vault implementation. It does not authorize dependency installation, code changes, database changes, migration, or deployment. All cryptographic formats and parameters remain subject to independent review and test-vector verification.

## 1. Current implementation versus proposed protocol

### Current source facts

- `lib/vault/client-encryption.ts` currently implements AES-256-GCM directly with a non-extractable 256-bit DEK, a fresh random 12-byte IV, a 128-bit tag, and AAD containing protocol label, record format version, Vault ID, record ID, and the `account` purpose.
- The current record envelope is version 1: `version`, `algorithm`, `iv`, `ciphertext`, and `authTag`.
- `lib/vault/key-envelope.ts` implements version 1 AES-256-GCM wrapping of a 32-byte DEK. It accepts a pre-derived 32-byte KEK; it does not implement Argon2id.
- `lib/vault/encrypted-record-schema.ts` validates the version 1 opaque record envelope.
- The active API still decrypts records server-side and accepts plaintext writes. These client modules are not the active Vault storage protocol.

### Protocol decision boundary

The existing client record format is called **Client Record V1** below. It is a source implementation baseline, not yet approved as the final persistent format. The proposed **Client Record V2** adds explicit schema-version and purpose separation through a derived record subkey and stronger context binding. V2 must not be silently substituted for V1: implementation requires explicit version negotiation, test vectors, and a migration plan.

No persisted envelope may be reinterpreted under a different version or algorithm.

## 2. Cryptographic primitives and fixed sizes

| Item | Proposed value | Status |
|---|---|---|
| Record AEAD | AES-256-GCM | Existing client code uses it; target requires review |
| GCM nonce / IV | 96 bits (12 bytes) | Existing client code uses it |
| GCM authentication tag | 128 bits (16 bytes) | Existing client code uses it |
| Vault DEK | 256 random bits (32 bytes) | Existing helper can generate it |
| Unlock KEK | 256 bits (32-byte Argon2id output) | KDF integration absent |
| Recovery secret | 256 random bits (32 bytes) | Proposed |
| Argon2id salt | 128 random bits (16 bytes) | Proposed; parameter policy not frozen |
| HKDF hash | SHA-256 | Proposed |
| HKDF output | 256 bits for each AES-256 key | Proposed |
| Key-envelope IV | 96 bits (12 bytes) | Existing helper uses this |
| Encoding | Canonical standard Base64 for binary fields | Existing helpers validate canonical Base64 |

All randomness must come from a cryptographically secure platform random generator. Do not use timestamps, Math.random, user IDs, passwords, or UUID strings as substitutes for cryptographic key/salt/nonce material.

## 3. Canonical identifiers and serialization

1. Vault ID and record ID are canonical lowercase UUID strings at protocol boundaries. If the database retains uppercase UUID representations, normalize before building AAD.
2. Text inputs are UTF-8. Password strings must not be silently trimmed, lowercased, Unicode-normalized, or otherwise transformed unless a future format explicitly defines that behavior.
3. Structured AAD is serialized as UTF-8 JSON arrays in the exact field order shown below. Implementations must use the same literal labels and ordering; object-property order must not be relied upon.
4. Binary values are canonical padded standard Base64. Reject whitespace, URL-safe Base64, noncanonical encodings, and unexpected lengths.
5. Parsers reject unknown versions, algorithms, fields, missing fields, invalid UUIDs, malformed Base64, oversized inputs, and unsupported KDF parameters before cryptographic work.
6. Never infer a format version from field presence. The explicit version is authoritative.

## 4. Key hierarchy

### 4.1 Vault Data Encryption Key (DEK)

- Generate one independent random 32-byte DEK per Vault.
- Import it into Web Crypto as AES-GCM, non-extractable, with only the usages required by the protocol.
- Never serialize, upload, log, persist in localStorage/sessionStorage/IndexedDB, or expose the raw DEK to the server.
- A browser `CryptoKey` being non-extractable is not protection against XSS, malicious same-origin JavaScript, a compromised browser extension, or compromised application delivery.
- JavaScript buffer clearing is best-effort only; it is not a guarantee of physical memory erasure.

### 4.2 Unlock-secret KEK

The target unlock secret is separate from the Supabase authentication password.

Proposed derivation:

```text
passwordBytes = UTF8(exact user-entered Vault unlock secret)
KEK_bytes = Argon2id(
  password = passwordBytes,
  salt = per-envelope 16-byte random salt,
  version = 0x13,
  memory = approved bounded parameter,
  passes = approved bounded parameter,
  parallelism = approved bounded parameter,
  outputLength = 32 bytes
)
KEK = WebCrypto.importKey("raw", KEK_bytes, AES-GCM-256, extractable=false)
```

**Not frozen:** memory, passes, parallelism, package/library, browser execution strategy, and latency target. Do not copy the RFC 9106 example profile into production without device benchmarking and independent review.

Requirements:
- Exact KDF identifier and version must be stored in the envelope metadata.
- KDF parameters must be allow-listed and bounded before invoking Argon2id. Never accept arbitrary server-supplied memory/time/parallelism values.
- The selected implementation must pass official Argon2id v1.3 known-answer vectors in the actual browser bundle.
- Benchmark representative low-end Android devices and supported iOS/desktop browsers.
- The 32-byte derived buffer is consumed by the key import helper and cleared best-effort. Do not claim guaranteed zeroization.

### 4.3 HKDF purpose separation

For Client Record V2 and recovery wrapping, use HKDF-SHA-256 with explicit context-specific `info` values. Proposed info encodings:

```text
recordInfo  = UTF8(JSON.stringify([
  "private-account-vault", 2, vaultId, "record-payload"
]))

recoveryInfo = UTF8(JSON.stringify([
  "private-account-vault", 1, vaultId, "recovery-dek-wrap"
]))
```

The HKDF salt and exact extract/expand conventions must be specified in the final implementation vector set. Use independent random 16-byte salts for each stored derived-key envelope where applicable; do not reuse a key across record and wrapping purposes.

**Compatibility note:** Client Record V1 currently encrypts directly with the DEK and does not derive a record subkey. Do not describe V1 as HKDF-separated. V2 is a distinct format and needs separate implementation and migration approval.

## 5. Client Record envelope

### 5.1 Client Record V1 — existing source format

```json
{
  "version": 1,
  "algorithm": "AES-256-GCM",
  "iv": "<canonical-base64-12-bytes>",
  "ciphertext": "<canonical-base64-non-empty>",
  "authTag": "<canonical-base64-16-bytes>"
}
```

V1 AAD, exact UTF-8 JSON array:

```json
[
  "private-account-vault",
  1,
  "<vaultId>",
  "<recordId>",
  "account"
]
```

V1 encrypts the complete account payload as one plaintext string. The current source sets a 20,000-byte plaintext/ciphertext bound. API request-body limits must account for Base64 expansion and JSON overhead separately.

### 5.2 Client Record V2 — proposed, not implemented

V2 is a proposed successor, not an instruction to mutate V1 in place.

- Derive a record-payload key from the DEK using the approved HKDF-SHA-256 context.
- Use a fresh 12-byte random IV for every encryption under that derived key.
- Encrypt the complete record payload with AES-256-GCM and a 128-bit tag.
- Bind AAD to Vault ID, record ID, record schema version, and purpose.

Proposed AAD:

```json
[
  "private-account-vault",
  2,
  "<vaultId>",
  "<recordId>",
  "account-record",
  1
]
```

Proposed envelope:

```json
{
  "version": 2,
  "algorithm": "AES-256-GCM",
  "keyDerivation": "HKDF-SHA-256",
  "keyDerivationVersion": 1,
  "schemaVersion": 1,
  "iv": "<canonical-base64-12-bytes>",
  "ciphertext": "<canonical-base64-non-empty>",
  "authTag": "<canonical-base64-16-bytes>"
}
```

The final field names and schema must be agreed with API/database design before implementation. Do not accept V2 until the server-side opaque parser and client encrypt/decrypt implementation share the exact same schema.

### 5.3 Nonce policy

- Never reuse an IV with the same AES-GCM key.
- Generate each IV independently using the secure random generator.
- Establish a conservative maximum number of encryptions per key and a rotation policy through a cryptographic review; do not invent an operational threshold in application code.
- If nonce generation fails or secure randomness is unavailable, fail closed.
- Do not retry an encryption operation by reusing the same IV.
- Add tests for IV length, tag length, tampering, wrong key, wrong Vault, wrong record, and malformed encodings.

Random 96-bit IVs have a nonzero collision probability. The system must define a per-key usage budget and rotation strategy before production use.

## 6. Unlock DEK envelope

### 6.1 Proposed JSON shape

```json
{
  "version": 1,
  "algorithm": "AES-256-GCM",
  "kdf": {
    "name": "Argon2id",
    "version": 19,
    "salt": "<canonical-base64-16-bytes>",
    "memoryKiB": "<approved-integer>",
    "passes": "<approved-integer>",
    "parallelism": "<approved-integer>",
    "outputBytes": 32
  },
  "iv": "<canonical-base64-12-bytes>",
  "wrappedKey": "<canonical-base64-48-bytes>"
}
```

- `version: 19` represents Argon2 version 0x13; final serialization convention must be fixed and tested.
- `wrappedKey` is 32 bytes of DEK plus a 16-byte GCM tag.
- The KEK is derived locally. Only KDF metadata, IV, and wrapped ciphertext may reach the server.
- The server must never receive the unlock secret, password bytes, derived KEK, or unwrapped DEK.

Key-envelope AAD should bind the envelope to the Vault and wrapping purpose. The current helper uses:

```json
[
  "private-account-vault",
  1,
  "<vaultId>",
  "vault-data-encryption-key"
]
```

The current helper's version 1 format does not include the KDF metadata in AAD. Before any production use, decide whether the final format must authenticate the KDF metadata through AAD or through a separately authenticated envelope structure; changing this requires a new envelope version and test vectors.

## 7. Recovery DEK envelope

Proposed first-release recovery model: user-held random recovery secret, separate from both Supabase password and Vault unlock secret.

1. Generate 32 random bytes on the client.
2. Encode for user display/export only through a separately reviewed encoding and checksum design.
3. Derive a 32-byte recovery wrapping key using HKDF-SHA-256 with a unique 16-byte random salt and the recovery-specific `info` context.
4. Wrap the same DEK with AES-256-GCM using a fresh 12-byte IV and 128-bit tag.
5. Bind AAD to protocol label, envelope version, Vault ID, and recovery purpose.
6. Upload only the salt and encrypted DEK envelope. Never upload the recovery secret or derived wrapping key.
7. Verify the new recovery envelope locally before asking the user to confirm safe storage.
8. Do not mark recovery setup complete until the server confirms persistence and the client verifies a read-back unwrap.

Proposed AAD:

```json
[
  "private-account-vault",
  1,
  "<vaultId>",
  "recovery-dek-envelope"
]
```

Recovery envelope metadata and exact encoding are **not yet frozen**. The current account Recovery Code flow is not this protocol and must remain clearly distinguished.

## 8. API contract requirements

The target server is an opaque ciphertext store, not a cryptographic decryption service.

### Collection/list endpoint

May return only reviewed non-secret metadata, such as:
- stable record ID;
- envelope version and algorithm;
- creation/update timestamps;
- explicitly approved non-secret operational metadata.

It must not return decrypted account name, username, password, backup codes, raw keys, unlock secret, or recovery secret. Decide whether account names and usernames are encrypted; the privacy-preserving default is to encrypt them with the record payload.

### Record endpoint

- Authenticated per-record GET returns the opaque envelope only.
- POST/PUT accept strict, bounded, versioned ciphertext envelopes only.
- DELETE remains ownership-scoped.
- Every request validates session, owner binding, same-origin policy, content type, body size, schema, version, and allowed algorithms.
- The server never decrypts client record envelopes and never logs request bodies or ciphertext.
- The client must not trust a client-supplied user ID; ownership is derived from the authenticated server session.

The API shape, DB columns, concurrency/ETag strategy, and metadata privacy rules require a separate approved design before implementation.

## 9. Versioning and migration

- Record format version, key-envelope version, KDF version, and record schema version are independent fields; do not overload one version number.
- Unknown versions fail closed with a safe user-facing recovery message. Never attempt a best-guess decrypt.
- Readers may support a bounded set of explicitly approved versions. Writers emit only the current approved version.
- Version upgrade must be decrypt → validate → encrypt under new format → persist → read back → verify → checkpoint.
- Never delete the old ciphertext until all records are reconciled and rollback policy is approved.
- A server-side migration that decrypts with the server key does not create a zero-knowledge migration. For a client-key target, migration encryption must occur in the authorized browser after local unlock.
- Migration must be idempotent and resumable; record IDs must remain stable or AAD must be deliberately regenerated with a fully tested re-encryption.

## 10. Required test vectors and negative tests

Before implementation is approved, publish deterministic non-production vectors for:
1. Argon2id exact input bytes, salt, version, memory, passes, lanes, output length, and expected 32-byte output.
2. HKDF-SHA-256 IKM, salt, info, output length, and expected derived key for each purpose.
3. AES-GCM plaintext bytes, key, IV, exact AAD bytes, ciphertext, and tag.
4. DEK wrapping and unwrapping.
5. Recovery envelope wrapping and unwrapping.
6. Canonical Base64 parser acceptance/rejection.

Required negative tests:
- Wrong password, wrong recovery secret, wrong KEK, wrong DEK.
- Modified IV, ciphertext, tag, AAD, Vault ID, record ID, purpose, and version.
- Cross-Vault and cross-record ciphertext substitution.
- Invalid/oversized KDF metadata and unsupported KDF version.
- Duplicate/invalid IV handling and secure-random failure.
- Truncated, oversized, noncanonical Base64, extra fields, missing fields, unknown algorithms.
- Replay of older valid envelopes and records; expected behavior must be defined by the version/concurrency design.
- Concurrent unlock-secret/recovery-key rotation and interrupted persistence.
- API attempts to submit plaintext or retrieve another user's envelope.

Never publish real user credentials or production secrets in test vectors.

## 11. Open decisions before protocol freeze

1. Final Argon2id implementation, exact package version, provenance, browser compatibility, and mobile benchmarks.
2. Argon2id memory/passes/parallelism allow-list and upgrade policy.
3. Whether final unlock envelope authenticates KDF metadata in AAD or uses another reviewed authenticated encoding.
4. Whether Client Record V1 is retained temporarily or V2 becomes the first production client format.
5. HKDF salt construction and exact deterministic vectors for record and recovery keys.
6. Per-key AES-GCM usage budget and key rotation threshold.
7. Record schema and whether any metadata is allowed to remain visible.
8. Optimistic concurrency and rollback/replay detection.
9. Recovery secret human-readable encoding, checksum, export, and confirmation UX.
10. Multi-device enrollment and revocation model.
11. Legacy server-encrypted data migration and rollback procedure.

No open decision should be silently filled by implementation convenience.

## 12. Approval gates and non-authorization

Required sequence:
1. Protocol review by application owner and independent cryptographic reviewer.
2. Dependency and KDF selection with source/provenance review.
3. Test-vector publication and cross-browser verification.
4. Threat-model update and abuse-case review.
5. API/database schema proposal and explicit approval.
6. Isolated synthetic implementation and full negative-test suite.
7. Migration rehearsal and independent review.
8. Only then consider a separately authorized production migration/release.

**This document does not authorize** source implementation, dependency installation, API/authentication changes, database migrations, production secret changes, real credential testing, preview, deployment, or merge into `main`.

**Security statement:** This is a draft protocol specification. The active Vault remains server-mediated encryption. No zero-knowledge, end-to-end, certification, or invulnerability claim is made.
