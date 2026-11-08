# Browser Argon2id Library Evaluation

**Review date:** 2026-11-08  
**Branch:** `design/cyber-visual-architecture`  
**Decision:** RustCrypto Argon2 0.6.0 is the preferred implementation candidate for a browser-WASM proof of concept, but it is **not yet approved, integrated, or pinned**.  
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

### D. RustCrypto Argon2 compiled to browser WASM

- Crate: [argon2 0.6.0 on docs.rs](https://docs.rs/argon2/0.6.0/argon2/)
- Upstream: [RustCrypto/password-hashes](https://github.com/RustCrypto/password-hashes)
- Release surfaced in this review: 0.6.0, dated 2026-08-27; the RustCrypto password-hashes repository showed recent upstream activity in November 2026.
- Implementation: pure Rust; supports Argon2d, Argon2i, and Argon2id; supports embedded `no_std` environments.
- KDF API: documentation explicitly provides `hash_password_into(password, salt, output)` for deriving raw key material, avoiding the password-hash/PHC API.
- License: dual MIT / Apache-2.0.
- Proposed browser delivery: compile a narrow Rust wrapper to `wasm32-unknown-unknown` with `wasm-bindgen`; expose only a fixed-profile Argon2id derive function; keep all parameters allowlisted in Rust rather than supplied by the browser or database. This WASM build is a proposed integration approach and has **not** yet been compiled or verified.
- Parallelism: do not enable Rayon or assume native parallel execution is available in a browser WASM build. Benchmark the exact WASM build and parameter set.

**Assessment:** This is currently the strongest candidate to investigate because the upstream crate is actively releasing, has a direct raw-key-derivation API, and is written in Rust rather than pure JavaScript. It is not automatically security-audited merely because it is part of RustCrypto. Before approval, inspect the exact 0.6.0 source and dependency graph, compile the browser target, run official Argon2id v1.3 known-answer vectors, verify zeroization and error handling, and benchmark memory/time on Android Chrome and mobile Safari. Treat this as a preferred proof-of-concept candidate, not a production dependency approval.

### C. openpgpjs/argon2id

- Package: [argon2id on npm](https://www.npmjs.com/package/argon2id)
- Repository: [openpgpjs/argon2id](https://github.com/openpgpjs/argon2id)
- Browser support: compact WebAssembly implementation with SIMD and fallback paths.
- The npm version surfaced in this review is 1.0.1, last published roughly three years ago.

**Assessment:** Browser/WASM architecture is attractive, but the release and maintenance activity is too old for this project's current dependency-selection requirement. Do not pin it.

## 3. Parameter references and decision

[RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html) specifies Argon2 version 1.3 and recommends 16-byte unique salts. Its memory-constrained recommended profile is Argon2id with t=3, p=4, and m=64 MiB; its first recommended profile uses 2 GiB and is not a realistic initial target for mobile browser unlock. [OWASP Password Storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) currently lists 19 MiB, t=2, p=1 as a minimum Argon2id configuration for password storage. These are reference points, not an approved Vault KDF profile: key-derivation use, browser WASM behavior, mobile memory limits, and user experience must be benchmarked separately.

RustCrypto Argon2 0.6.0 is the preferred candidate for the next isolated WASM proof of concept. No candidate is approved for production or pinned in the application at this checkpoint.

The project will not silently substitute PBKDF2 or scrypt for the specified Argon2id design, and it will not select a stale package merely because its API is convenient. The KEK import and DEK wrapping modules remain KDF-agnostic. They accept exactly 32 derived bytes and clear the caller-provided byte array after import.

## 4. Required next review

Before implementation:

1. Pin the RustCrypto 0.6.0 source and verify release provenance, source diff, dependencies, license, and security advisories.
2. Build a minimal `wasm32-unknown-unknown` + `wasm-bindgen` proof of concept with only Argon2id v1.3 raw KDF support; do not expose a generic arbitrary-cost API.
3. Run RFC 9106 Argon2id v1.3 known-answer vectors and cross-check identical outputs against an independent reference implementation.
4. Benchmark candidate profiles (including OWASP's 19 MiB/t=2/p=1 baseline and RFC 9106's 64 MiB/t=3/p=4 memory-constrained profile) on a lower-powered Android phone and mobile Safari, measuring elapsed time, peak memory, responsiveness, and repeated-unlock behavior.
5. Test memory-exhaustion behavior and ensure the UI cannot launch unbounded concurrent KDF operations; run KDF work in a dedicated worker.
6. Fix KDF parameters in a versioned allowlist compiled into the client; do not accept arbitrary memory/iteration values from a database row.
7. Store only the random salt and public KDF profile/version alongside the wrapped DEK. Never store the Vault Unlock Secret or derived KEK.
8. Add cross-browser deterministic test vectors and verify that the same secret/salt/profile derives the same 32-byte key across supported browsers.
9. Obtain an independent review of the selected implementation and protocol before enabling it for real credentials.

No production KDF parameters are approved in this document. The current application remains on the legacy server-readable API and must not be described as zero-knowledge.
