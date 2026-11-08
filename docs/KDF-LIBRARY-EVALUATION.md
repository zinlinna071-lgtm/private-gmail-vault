# Browser Argon2id Library Evaluation

**Review date:** 2026-11-08  
**Branch:** `design/cyber-visual-architecture`  
**Decision:** No Argon2id package is approved or pinned yet.  
**Production impact:** None. This is a research record only.

## 1. Required properties

The Vault Unlock Secret must be processed only in the browser. The selected KDF must:

- Implement Argon2id with a documented, interoperable version and known-answer test vectors.
- Run in current browsers, including mobile Safari and Android Chrome.
- Return exactly 32 bytes for AES-256-GCM KEK import.
- Accept a unique cryptographically random salt per Vault.
- Expose explicit, versioned memory, iteration, and parallelism parameters.
- Avoid accepting untrusted KDF cost parameters from database metadata without strict allowlisting and upper bounds.
- Have a defensible maintenance, provenance, license, and security-review history.
- Be benchmarked on lower-powered mobile devices before production parameters are fixed.

KDF output is key material, not an authentication password hash. It must never be sent to the server.

## 2. Candidates reviewed

### A. hash-wasm

- Package: [hash-wasm on npm](https://www.npmjs.com/package/hash-wasm)
- Repository: [Daninet/hash-wasm](https://github.com/Daninet/hash-wasm)
- Browser support: documented for Chrome, Safari, Firefox, and Edge.
- Argon2id support: WebAssembly implementation, output can be requested as binary bytes, with explicit memory, iteration, parallelism, and output-length options.
- Dependency profile: package documentation reports no runtime dependencies.
- Maintenance concern: the current package version surfaced in this review is 4.12.0, with the latest publication roughly two years ago. Independent package-health reporting also notes no recent release/commit activity.

**Assessment:** Technically promising for browser performance, but the maintenance signal does not currently satisfy this project's requirement for an actively maintained security-critical dependency. Do not pin it yet. Re-check upstream activity and review the exact source/version before reconsideration.

### B. @noble/hashes

- Package: [@noble/hashes on npm](https://www.npmjs.com/package/@noble/hashes)
- Repository: [paulmillr/noble-hashes](https://github.com/paulmillr/noble-hashes)
- Current package information surfaced in this review: version 2.4.0, published recently.
- The project describes an independently audited, minimal cryptographic library and includes Argon2id APIs.
- Its own Argon2 documentation warns that Argon2 is slow in pure JavaScript due to 64-bit arithmetic limitations and suggests considering scrypt for performance-sensitive use.

**Assessment:** Stronger current maintenance and transparency signals, but pure-JavaScript Argon2 performance may be unsuitable on lower-powered phones at security-relevant memory settings. The general library audit statement must not be treated as proof that every Argon2 code path was independently audited. Do not pin it until the exact Argon2 implementation scope and mobile performance are reviewed.

### C. openpgpjs/argon2id

- Package: [argon2id on npm](https://www.npmjs.com/package/argon2id)
- Repository: [openpgpjs/argon2id](https://github.com/openpgpjs/argon2id)
- Browser support: compact WebAssembly implementation with SIMD and fallback paths.
- The npm version surfaced in this review is 1.0.1, last published roughly three years ago.

**Assessment:** Browser/WASM architecture is attractive, but the release and maintenance activity is too old for this project's current dependency-selection requirement. Do not pin it.

## 3. Decision

No candidate is approved in this checkpoint.

The project will not silently substitute PBKDF2 or scrypt for the specified Argon2id design, and it will not select a stale package merely because its API is convenient. The KEK import and DEK wrapping modules remain KDF-agnostic. They accept exactly 32 derived bytes and clear the caller-provided byte array after import.

## 4. Required next review

Before implementation:

1. Re-check upstream releases, commits, advisories, package provenance, and license for the shortlisted library.
2. Inspect the exact Argon2id implementation and confirm its version and known-answer vectors.
3. Benchmark candidate configurations on a lower-powered Android phone and mobile Safari, measuring elapsed time, peak memory, responsiveness, and repeated-unlock behavior.
4. Test memory-exhaustion behavior and ensure the UI cannot launch unbounded concurrent KDF operations.
5. Fix KDF parameters in a versioned allowlist; do not accept arbitrary memory/iteration values from a database row.
6. Store only the random salt and public KDF profile/version alongside the wrapped DEK. Never store the Vault Unlock Secret or derived KEK.
7. Add cross-browser deterministic test vectors and verify that the same secret/salt/profile derives the same 32-byte key across supported browsers.
8. Obtain an independent review of the selected implementation and protocol before enabling it for real credentials.

No production KDF parameters are approved in this document. The current application remains on the legacy server-readable API and must not be described as zero-knowledge.
