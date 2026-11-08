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
```

The GitHub Actions `argon2-wasm-poc` job runs the same native tests and compiles the browser target. The generated `.wasm` file is uploaded as a CI artifact for inspection; it is not deployed.

## Security limitations / next gates

- The exported function is synchronous. Application integration must call it from a dedicated Web Worker and prevent unbounded concurrent derivations.
- JavaScript must clear its own password byte buffer after the call. WASM cannot guarantee erasure of browser/JS copies or protect against a compromised page script.
- The PoC clears its temporary 32-byte Rust output buffer after copying the result into a JavaScript `Uint8Array`. The selected crate's `zeroize` feature is enabled, but the complete memory-clearing behavior and all transient stack/register copies still require source-level review and independent verification.
- Browser memory limits, allocation-failure behavior, responsiveness, and repeat-unlock behavior have not been measured on lower-powered Android devices or mobile Safari.
- Cross-implementation KAT comparison, dependency provenance review, generated JS glue inspection, worker cancellation/serialization, and independent cryptographic review remain outstanding.
- Do not add this crate to the application bundle or enable real credential storage until all KDF, key lifecycle, ciphertext-only API, recovery, migration, and audit gates pass.
