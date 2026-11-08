# Browser Argon2id Library Evaluation

**Review date:** 2026-11-08  
**Branch:** `design/cyber-visual-architecture`  
**Decision:** RustCrypto Argon2 0.6.0 is the preferred implementation candidate for an isolated browser-WASM proof of concept. Exact direct dependency versions are pinned in that PoC only; it is **not approved or integrated into the application**.  
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


## 5. Isolated WASM proof-of-concept implementation

An isolated crate has now been added at `security/argon2-wasm`:

- `argon2 = 0.6.0`, with default features disabled and only `alloc` + `zeroize` enabled; the PHC/password-hash and random-number-generation features are not needed by this raw KDF wrapper.
- `wasm-bindgen = 0.2.130` and `js-sys = 0.3.107` expose a typed-array boundary for browser integration.
- The exported API accepts password bytes, an exactly 16-byte salt, and a one-byte fixed profile ID. It does not accept caller-controlled memory, iteration, parallelism, algorithm, version, or output-size parameters.
- Profile 1 is 19 MiB / t=2 / p=1; Profile 2 is 64 MiB / t=3 / p=4. Both are benchmark candidates only, not approved production settings.
- The 32-byte temporary Rust output buffer is cleared after copying to a JavaScript `Uint8Array`. The upstream `zeroize` feature is enabled; full zeroization coverage still requires source-level review.
- The crate contains an RFC 9106 §5.3 Argon2id v1.3 known-answer test (m=32 KiB, t=3, p=4, with the RFC test-only secret and associated data), plus profile allowlist and input-boundary tests.
- The exported function is synchronous. It must be run from a dedicated Worker and protected by a single-flight lock before any application integration. JavaScript-owned password buffers must be cleared by the caller.

GitHub Actions now has a separate `argon2-wasm-poc` job that runs native Rust tests and compiles the `wasm32-unknown-unknown` release artifact. The artifact is uploaded for inspection only and is not deployed. The first run has not yet been confirmed at the time of this documentation update.

This is a source-code PoC only. No production application import, no API switch, no database migration, no preview, and no deployment have been performed. Do not treat a successful compile or KAT as independent security approval.

## 6. Remaining approval gates

1. Confirm the GitHub Actions native RFC vector test passes.
2. Confirm the browser-WASM target compiles and inspect the generated module/imports and final binary size.
3. Add and inspect the matching `wasm-bindgen` JavaScript glue in an isolated browser harness; verify the typed-array boundary and no unexpected imports.
4. Cross-check the RFC vector against an independent implementation, not just the same RustCrypto crate.
5. Inspect the exact dependency lockfile and source provenance; retain the lockfile used for the reviewed artifact.
6. Review the upstream zeroization implementation and verify what is and is not cleared on success, error, and allocation failure.
7. Benchmark both profiles on a lower-powered Android device and mobile Safari, including peak memory, elapsed time, responsiveness, repeated unlock, and memory pressure/OOM behavior.
8. Implement Worker serialization/cancellation and prove no unbounded concurrent KDF work is possible.
9. Obtain independent cryptographic review before any real credential storage is enabled.
