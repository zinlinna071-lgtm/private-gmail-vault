# Vault Cryptographic Test Vector & Compatibility Catalog

**Status: TEST DESIGN / COVERAGE INVENTORY — NOT A TEST EXECUTION REPORT**  
**Date:** 2026-11-08  
**Branch:** `design/cyber-visual-architecture`  
**Production impact:** None. This document adds no cryptographic implementation, dependency, API, database, authentication, or deployment changes.

> All vectors are public, deterministic test inputs. Never substitute real account credentials, production keys, recovery material, or user data. A passing primitive vector does not approve a production protocol or establish zero-knowledge security.

## 1. Purpose and scope

This catalog maps the proposed Vault protocol to reproducible Known-Answer Tests (KATs), compatibility checks, and negative tests. It separates:

- **Existing evidence:** checks already represented by source or previously recorded CI runs.
- **Existing test coverage:** repository tests that exercise current helper behavior.
- **Required KAT:** deterministic primitive-level expected-output comparison still needed.
- **Not implemented:** proposed protocol features for which there is no active implementation to test.

This is a coverage plan, not an assertion that every listed test was executed in this change.

## 2. Current source and test inventory

| Area | Current source/test evidence | Remaining gap |
|---|---|---|
| Argon2id v1.3 | Isolated RFC 9106 §5.3 vector and four input-mutation checks previously passed in Node.js and Chromium, Firefox, WebKit CI harnesses | Real Android/iOS device performance, memory pressure, and package approval remain open |
| AES-256-GCM record encryption | `client-vault-encryption.test.ts` covers generated key properties, round-trip, fresh IV, Vault/record AAD binding, tamper/wrong-key rejection, malformed input, and size bounds | Add a fixed NIST known-answer vector against the browser Web Crypto primitive |
| DEK envelope | `vault-key-envelope.test.ts` covers derived-byte consumption, non-extractable KEK/DEK, wrap/unwrap round-trip, fresh IV, wrong Vault/KEK, tamper, version and malformed fields | Add a deterministic AES-GCM primitive KAT and explicit envelope-context negative cases; current wrapper uses random IVs |
| Opaque record schema | `encrypted-record-schema.test.ts` covers accepted V1 shape, exact keys, canonical Base64, IV/tag lengths, empty and oversized ciphertext | Add boundary cases for noncanonical padding and maximum encoded lengths if not already covered |
| HKDF-SHA-256 | Targeted in the proposed protocol only | No active HKDF helper or implementation was found in the reviewed Vault crypto modules; no application-level HKDF test can pass yet |
| Recovery DEK envelope | Specified as a future design | Not implemented; do not create a test that implies recovery is available |
| Client Record V2 | Proposed separately from V1 | Not implemented; no V2 vector or compatibility claim |
| API ciphertext-only contract | Design documents specify the target | Current API still has legacy server-mediated behavior; protocol KATs do not verify API migration |

### Existing Argon2id evidence

The isolated RFC 9106 §5.3 vector uses Argon2id v1.3, memory 32 KiB, 3 passes, 4 lanes, 32-byte output, password 32 bytes of `0x01`, salt 16 bytes of `0x02`, secret K 8 bytes of `0x03`, and associated data X 12 bytes of `0x04`. The expected output is:

```
0d640df58d78766c08c037a34a8b53c9
d01ef0452d75b65eb52520e96b01e659
```

Previously recorded CI evidence:
- Node.js isolated harness: run [42272387331](https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42272387331).
- Chromium browser harness: run [42281120467](https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42281120467).
- Chromium, Firefox, and WebKit multi-engine harness: run [42281411743](https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42281411743).

These are historical hosted-runner results, not physical-device benchmarks or approval of an Argon2 package, parameters, or persistent key format. The RFC vector's 32 KiB memory setting is for algorithm correctness only.

## 3. Normative vector sources

Use the primary specifications and official test data. Pin the exact vector identifier, source revision, input bytes, expected bytes, and license/provenance in the test fixture.

| Primitive | Normative source | Planned vector |
|---|---|---|
| Argon2id v1.3 | [RFC 9106 §5.3](https://www.rfc-editor.org/rfc/rfc9106.html) | Exact full-input KAT already used by isolated spike |
| HKDF-SHA-256 | [RFC 5869 §A.1](https://www.rfc-editor.org/rfc/rfc5869.html) | Test Case 1, SHA-256, 42-byte output |
| AES-GCM | [NIST SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final) and official NIST CAVP GCM test vectors | Select and pin one AES-256-GCM encryption/decryption vector with explicit IV, AAD, plaintext, ciphertext, and tag |
| Base64 | RFC 4648 §4 | Canonical standard Base64 fixtures, including padding and invalid encodings |

Do not hand-author expected cryptographic outputs. Import them from the cited normative source or generate them with two independently reviewed implementations, record provenance, and have the values reviewed before committing fixtures.

## 4. HKDF-SHA-256 KAT — RFC 5869 Test Case 1

This is a primitive-level test fixture, not a claim that HKDF exists in the current Vault code.

| Field | Hex value |
|---|---|
| Hash | SHA-256 |
| IKM | `0b` repeated 22 times |
| Salt | `000102030405060708090a0b0c` |
| Info | `f0f1f2f3f4f5f6f7f8f9` |
| L | 42 bytes |
| Expected PRK | `077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5` |
| Expected OKM | `3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865` |

Required assertions:
1. Extract output equals the expected 32-byte PRK.
2. Expand output equals the expected 42-byte OKM.
3. A changed IKM, salt, or info changes the output.
4. Output lengths 0, negative, non-integer, and above the implementation's documented bound are rejected.
5. Empty salt and empty info behavior matches RFC 5869, not an application-specific guess.
6. The implementation uses SHA-256 and the exact RFC extract-then-expand ordering.

**Implementation gate:** Do not add a production HKDF module or wire it into Client Record V2 until the protocol's salt, info serialization, output length, and key-purpose labels are finalized and approved.

## 5. AES-256-GCM primitive KAT

The current record and key-envelope helpers use the Web Crypto AES-GCM interface with a 96-bit IV and 128-bit tag. Their current tests primarily verify round-trip and rejection behavior using randomly generated inputs.

Required deterministic fixture fields:
- AES key: exactly 32 bytes.
- IV: exactly 12 bytes.
- AAD: exact byte sequence, including the empty-AAD case if present in the chosen official vector.
- Plaintext: exact byte sequence.
- Ciphertext: exact expected bytes.
- Authentication tag: exact expected 16 bytes.
- Source standard, vector filename, vector case identifier, and source revision.

Required assertions:
1. Encrypt matches the official ciphertext and tag byte-for-byte.
2. Decrypt recovers the exact plaintext.
3. A one-bit change in ciphertext, tag, IV, AAD, or key fails authentication.
4. Wrong tag length, wrong IV length, and unsupported parameters fail closed.
5. The test verifies the Web Crypto combined output is split into ciphertext and tag consistently with the Vault envelope.
6. No fixed test key or IV is ever used outside test-only code.

**Pinned fixtures:** Section 11 records two AES-256-GCM vectors transcribed from a Chromium test fixture that identifies the original NIST CAVP `gcmEncryptExtIV256.rsp` source. Preserve that provenance when implementing the test.

## 6. DEK envelope compatibility tests

Current `lib/vault/key-envelope.ts` wraps a random 32-byte DEK using a caller-supplied 32-byte AES-GCM KEK, a random 12-byte IV, and Vault-bound AAD. It does not derive the KEK and does not implement Argon2id or HKDF.

Existing wrapper tests exercise successful unwrap and several failure cases. Extend coverage only after the primitive KAT is pinned:

| ID | Test | Expected result |
|---|---|---|
| ENV-01 | Create envelope then unwrap with same KEK and Vault ID | Imported DEK works for record encrypt/decrypt |
| ENV-02 | Unwrap under a different Vault ID | Authentication failure |
| ENV-03 | Unwrap under a different KEK | Authentication failure |
| ENV-04 | Change one wrapped-key byte | Authentication failure |
| ENV-05 | Change IV | Authentication failure |
| ENV-06 | Unknown version/algorithm or extra envelope fields | Rejected before decrypt |
| ENV-07 | Truncated or noncanonical Base64 | Rejected before decrypt |
| ENV-08 | Wrong wrapped-key decoded length | Rejected |
| ENV-09 | Two independent wraps under one KEK | Fresh IVs; envelope ciphertext differs for independent random DEKs |
| ENV-10 | Use test-only fixed primitive inputs | AES-GCM output matches pinned NIST KAT |

Do not make a deterministic production wrapper API merely to simplify tests. The fixed-vector test belongs at the primitive boundary; wrapper tests should continue to use cryptographically random IVs.

## 7. Record envelope and parser negative tests

Keep Client Record V1 distinct from the proposed V2. Required regression coverage:

- V1 encrypt/decrypt round-trip using synthetic payloads.
- Wrong Vault ID and wrong record ID fail because the AAD context differs.
- Ciphertext, tag, IV, and key tampering fail closed.
- Unknown version, algorithm, field, missing field, array, primitive, malformed UUID, invalid Base64, noncanonical Base64, empty ciphertext, and over-limit payload are rejected.
- A V2 envelope must never be accepted by the V1 parser.
- Unknown future versions must not be silently downgraded.
- Parser errors must not echo plaintext, ciphertext, keys, or request bodies.

## 8. Cross-runtime compatibility matrix

| Layer | Runtime | Status |
|---|---|---|
| Argon2id RFC vector | Node.js hosted CI | Previously passed |
| Argon2id RFC vector | Chromium hosted CI | Previously passed |
| Argon2id RFC vector | Firefox hosted CI | Previously passed |
| Argon2id RFC vector | WebKit hosted CI | Previously passed |
| Web Crypto AES-GCM KAT | Chromium / Firefox / WebKit | Isolated Node harness implemented; browser-engine run pending |
| HKDF-SHA-256 KAT | Node.js + browser Web Crypto | Isolated test harness uses Web Crypto HKDF; no production helper |
| DEK envelope round-trip | Current Vitest suite | Existing tests; no execution in this documentation task |
| Physical mobile memory/latency | Low-/mid-/high-range Android and iOS Safari | Not run |

Hosted browser-engine checks do not equal physical-device verification. Record device model, OS, browser version, cold/warm timing, median/p95, memory pressure, background-tab behavior, and UI responsiveness before recommending KDF parameters.

## 9. Evidence record format

Every future test result must record:

- Test ID and exact vector source/version.
- Input fixture identifier and expected-output digest or public vector bytes.
- Repository commit SHA and test-harness commit SHA.
- Runtime, browser engine, OS, and device model where applicable.
- Exact command/workflow run URL and result.
- Whether the test was deterministic, randomized, or a performance measurement.
- Failures, retries, and environmental limitations.
- Reviewer and review date.

Use the following status vocabulary consistently:
- **PLANNED** — designed but not implemented.
- **IMPLEMENTED** — test code exists, execution not yet evidenced.
- **PASSED** — exact recorded run passed.
- **FAILED** — exact recorded run failed.
- **NOT RUN** — no execution evidence.
- **NOT APPLICABLE** — documented reason.

## 10. Security and approval boundaries

- Test only public vectors and synthetic random inputs.
- Never handle real Gmail credentials, real Vault passwords, production DEKs, recovery secrets, or customer records.
- Do not log raw secret material, even in isolated test output.
- Buffer clearing is best-effort; do not claim JavaScript or WASM memory zeroization.
- Do not install dependencies in the root application package for this catalog.
- Do not change the active Vault API, authentication, database schema, encryption routes, or production secrets.
- Do not run migrations, merge to `main`, create a preview, or deploy.
- A passing KAT verifies a particular algorithm/input/output combination. It does not prove protocol correctness, side-channel resistance, supply-chain integrity, secure key lifecycle, zero-knowledge architecture, or overall product security.

**Current decision:** keep the catalog as a test plan. A dependency-free test-only harness now exists under `tools/crypto-primitives-spike/`; it exercises Web Crypto HKDF-SHA-256 and the two pinned AES-256-GCM vectors without importing application code. A local Node.js v22.16.0 spot-check of the three expected outputs and AES-GCM decryptions passed. The committed harness's full negative-test suite and its GitHub Actions workflow have not yet been observed passing; browser-engine and physical-device verification remain pending. No production crypto code is authorized by this document.


## 11. Pinned AES-256-GCM reference vectors — NIST CAVP source

The NIST CAVP block-cipher-modes page publishes GCM test vectors for informal correctness checks and explicitly notes that these vectors do not replace formal CAVP validation. The selected AES-256 vectors below are transcribed from Chromium's AES-256-GCM test fixture, whose source comments identify the original NIST file as `gcmEncryptExtIV256.rsp` downloaded from the NIST CAVP GCMVS page.

Primary source:
- NIST CAVP GCM test-vector index: https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/cavp-testing-block-cipher-modes
- NIST CAVP source-vector provenance and fixture values: https://chromium.googlesource.com/openscreen/quic/+/52292026ce8d262f8e5f25f69bdf728be5991b17/net/third_party/quic/core/crypto/aes_256_gcm_encrypter_test.cc

### AES256-GCM vector A — non-empty plaintext, empty AAD

| Field | Hex |
|---|---|
| Key (32 bytes) | `31bdadd96698c204aa9ce1448ea94ae1fb4a9a0b3c9d773b51bb1822666b8f22` |
| IV (12 bytes) | `0d18e06c7c725ac9e362e1ce` |
| Plaintext (16 bytes) | `2db5168e932556f8089a0622981d017d` |
| AAD | Empty |
| Ciphertext (16 bytes) | `fa4362189661d163fcd6a56d8bf0405a` |
| Tag (16 bytes) | `d636ac1bbedd5cc3ee727dc2ab4a9489` |

### AES256-GCM vector B — empty plaintext, non-empty AAD

| Field | Hex |
|---|---|
| Key (32 bytes) | `78dc4e0aaf52d935c3c01eea57428f00ca1fd475f5da86a49c8dd73d68c8e223` |
| IV (12 bytes) | `d79cf22d504cc793c3fb6c8a` |
| Plaintext | Empty |
| AAD (16 bytes) | `b96baa8c1c75a671bfb2d08d06be5f36` |
| Ciphertext | Empty |
| Tag (16 bytes) | `3e5d486aa2e30b22e040b85723a06e76` |

These two vectors cover both authenticated encryption of payload bytes and authentication of AAD when the plaintext is empty. Keep them as primitive-level test fixtures; do not treat them as tests of the Vault's specific AAD serialization or key-envelope protocol.

Required Web Crypto checks for each vector:
1. Build the AES-GCM key from the exact 32 key bytes.
2. Call `crypto.subtle.encrypt` with the exact 12-byte IV, exact AAD bytes (empty for A; vector B bytes for B), and `tagLength: 128`.
3. Split Web Crypto's combined output into ciphertext and final 16-byte tag.
4. Compare ciphertext and tag byte-for-byte to the vector.
5. Decrypt the concatenated ciphertext+tag and compare plaintext bytes.
6. Mutate a single bit of ciphertext, tag, IV, AAD, and key independently; every altered input must fail authentication or produce a distinct encryption result as appropriate.
7. Clear test buffers best-effort and ensure fixture keys are never reused outside tests.

**Provenance note:** Chromium's fixture documents that the values originate in NIST's `gcmEncryptExtIV256.rsp` and identifies the vector groups by key/IV/plaintext/AAD/tag lengths. The test fixture is a reproducible transcription reference; the authoritative source family remains NIST CAVP. NIST states that informal vectors do not confer CAVP validation.


## 12. Isolated primitive harness — implementation status (2026-11-08)

A dependency-free test harness has been added on `design/cyber-visual-architecture`:

- `tools/crypto-primitives-spike/package.json`
- `tools/crypto-primitives-spike/test-primitives.mjs`
- `.github/workflows/vault-crypto-primitives-spike.yml`

The harness uses Node.js Web Crypto only; it adds no root application dependency and imports no Vault application module. It includes:
- RFC 5869 Test Case 1 HKDF-SHA-256 expected-output check and IKM mutation check.
- NIST CAVP-origin AES-256-GCM vector A encryption/decryption and tamper checks.
- NIST CAVP-origin AES-256-GCM vector B encryption/decryption and AAD/tamper checks.
- Best-effort clearing of mutable test buffers.

**Local spot-check (verified):** Node.js v22.16.0 Web Crypto reproduced the RFC 5869 OKM and both AES-256-GCM ciphertext+tag outputs; both AES-GCM decryptions recovered the expected plaintext bytes.

**Not yet verified:** the committed `test-primitives.mjs` full test run, the new GitHub Actions workflow, Chromium/Firefox/WebKit execution of these HKDF/AES-GCM vectors, and physical mobile behavior. Do not mark those checks passed until a run URL and logs are inspected.

The workflow is scoped to pushes on `design/cyber-visual-architecture` that touch this isolated harness or its workflow file. It is not a production build, preview, deployment, or Vault integration.


### GitHub Actions runner investigation (2026-11-08)

The new workflow was triggered by push and produced run [42413906114](https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42413906114). Its first attempt failed; a single retry also failed immediately. Both job records reported an empty step list and `runner_id: 0` / no runner name. The job-log endpoint returned no available log artifact. Therefore the failure cannot currently be attributed to the test script, Node.js, HKDF, or AES-GCM vectors.

**Status:** workflow execution blocked/unresolved before any test-step evidence was exposed. Do not label the committed harness passed or failed cryptographically on this basis. The independent local Node.js v22.16.0 primitive spot-check remains the only new execution evidence for these three vector outputs. Investigate GitHub Actions runner/repository execution availability before changing the test code or claiming a CI result.
