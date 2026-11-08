# Argon2id browser-WASM proof of concept

**Status:** isolated research PoC; not integrated into the Vault  
**Crate:** RustCrypto `argon2 = 0.6.0`  
**Algorithm:** Argon2id v1.3 (`Version::V0x13`)  
**Output:** 32 bytes for AES-256 KEK import  
**Production approval:** none

## Scope

This crate is deliberately isolated under `security/argon2-wasm`. It is not imported by the Next.js application, does not alter the current Vault API, and must not be treated as evidence that the application is zero-knowledge.

The public WASM function accepts password bytes, a 16-byte salt, and one profile ID. It does not accept arbitrary memory, iteration, parallelism, output-length, algorithm, or version parameters. Unknown profile IDs fail closed.

## Fixed PoC profiles

| Profile ID | Memory | Iterations | Lanes | Reference |
|---|---:|---:|---:|---|
| 1 | 19 MiB | 2 | 1 | OWASP password-storage baseline reference |
| 2 | 64 MiB | 3 | 4 | RFC 9106 memory-constrained reference |

These profiles exist only to compare build/runtime behavior. Neither is approved as the Vault production KDF profile. The RFC profile is a reference configuration, not a claim that browser WASM implements parallel lanes concurrently.

The 16-byte salt must be generated in the browser with a cryptographically secure random generator and must be unique per Vault. Salt generation is outside this PoC function.

## Tests

The native Rust unit test suite includes:
- strict profile allowlisting;
- input-size validation before Argon2 memory allocation;
- RFC 9106 §5.3 Argon2id v1.3 known-answer vector, including the vector's test-only secret and associated data.

The RFC test uses the standard vector's 32 KiB memory setting only to keep the known-answer test fast. It is not a candidate production setting.

## Build and test

From the repository root:

```sh
cargo test --manifest-path security/argon2-wasm/Cargo.toml
cargo build --manifest-path security/argon2-wasm/Cargo.toml --target wasm32-unknown-unknown --release
cargo install wasm-bindgen-cli --version 0.2.130 --locked
wasm-bindgen --target nodejs --out-dir security/argon2-wasm/pkg --out-name vault_argon2_wasm_poc security/argon2-wasm/target/wasm32-unknown-unknown/release/vault_argon2_wasm_poc.wasm
node security/argon2-wasm/tests/wasm-smoke.cjs
```

The GitHub Actions `argon2-wasm-poc` job runs the native tests, compiles the browser target, generates Node.js bindings with the pinned `wasm-bindgen-cli` version, and runs `tests/wasm-smoke.cjs` against the generated module. The `.wasm`, generated glue, and Cargo lockfile are uploaded as a CI artifact for inspection; they are not deployed. The Node.js smoke test validates the WASM/JavaScript boundary only; it is not a browser compatibility or Worker test.

## Security limitations / next gates

- The exported function is synchronous. Application integration must call it from a dedicated Web Worker and prevent unbounded concurrent derivations.
- JavaScript must clear its own password byte buffer after the call. WASM cannot guarantee erasure of browser/JS copies or protect against a compromised page script.
- The PoC clears its temporary 32-byte Rust output buffer after copying the result into a JavaScript `Uint8Array`. The selected crate's `zeroize` feature is enabled, but the complete memory-clearing behavior and all transient stack/register copies still require source-level review and independent verification.
- Browser memory limits, allocation-failure behavior, responsiveness, and repeat-unlock behavior have not been measured on lower-powered Android devices or mobile Safari.
- Cross-implementation KAT comparison, dependency provenance review, generated JS glue inspection, worker cancellation/serialization, and independent cryptographic review remain outstanding.
- Do not add this crate to the application bundle or enable real credential storage until all KDF, key lifecycle, ciphertext-only API, recovery, migration, and audit gates pass.


## Dedicated browser Worker proof-of-concept harness

An isolated harness now exercises the Rust-generated **web-target** bindings from a real module Worker:

1. Build the WASM target and generate browser glue:
   ```sh
   cargo build --manifest-path security/argon2-wasm/Cargo.toml --target wasm32-unknown-unknown --release
   cargo install wasm-bindgen-cli --version 0.2.130 --locked
   wasm-bindgen --target web --out-dir security/argon2-wasm/pkg-web --out-name vault_argon2_wasm_poc security/argon2-wasm/target/wasm32-unknown-unknown/release/vault_argon2_wasm_poc.wasm
   ```
2. Install the isolated browser-test dependencies and browser engines:
   ```sh
   cd tools/argon2id-browser-spike
   npm install --ignore-scripts --no-audit --no-fund
   npx playwright install chromium firefox webkit
   node run-rust-wasm-worker-test.mjs
   ```

The harness uses a public test-only secret, transfers password and salt buffers to the Worker, checks that the main-thread buffers become detached, derives the Argon2id output inside the Worker, imports it as a non-extractable AES-GCM key, and performs a local encrypt/decrypt self-test without returning key bytes. It runs in Chromium, Firefox, and WebKit.

This remains a **PoC boundary test**, not the application Worker or Vault integration. It does not test mobile devices, Worker idle/lock lifecycle, application unlock flows, key-envelope persistence, or ciphertext-only API behavior. A browser-matrix PASS must come from a completed CI run with all three engines; source presence is not test evidence.
