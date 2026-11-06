# Argon2id Browser Library Review

**Status:** Evaluation only — no dependency selected or installed  
**Date:** 2026-11-06  
**Branch:** `feature/vault-authentication`

## Decision

Do not select a KDF package based on popularity or bundle size alone. The vault's Master Password protects the only client-side path to the data-encryption key, so the implementation must be reviewed and benchmarked on supported mobile devices before the format is frozen.

Argon2id is the target KDF. RFC 9106 defines Argon2id and gives a 64 MiB, 3-pass, 4-lane option for environments with substantially less memory than its 2 GiB primary recommendation. These are reference starting points, not parameters automatically approved for this application.

## Candidates reviewed

### `@noble/hashes` 2.4.0

- Current package line includes Argon2 / Argon2id and async variants.
- Zero direct dependencies and active releases in 2026.
- ESM-only; version 2 requires Node.js 20.19 or newer for Node-side tooling.
- Its own documentation warns that pure JavaScript Argon2 is materially slower than native implementations and recommends considering scrypt.
- The published independent Cure53 audit described by the project did not cover Argon2. The project reports more recent self-audits, which are useful but are not a substitute for an independent Argon2 review.

**Assessment:** Strong maintenance and ecosystem signals, but the pure-JavaScript performance and Argon2 audit scope need explicit evaluation.

### `hash-wasm` 4.12.0

- Supports Argon2id v1.3 in WebAssembly.
- The package reports a small compressed Argon2 bundle.
- It is widely used, but the latest release is old relative to this project and external package-health reports indicate little recent maintenance activity.

**Assessment:** Promising browser performance profile, but maintenance and release cadence are concerns for a security-critical dependency.

### `argon2id` 1.0.1

- RFC 9106-oriented Argon2id implementation using WebAssembly.
- Small package and simple browser integration.
- Its published release is several years old and the package has a much smaller adoption footprint.

**Assessment:** Not selected without stronger maintenance and review evidence.

## Required checks before choosing

1. Confirm supported browser and bundler behavior in the current Next.js App Router build.
2. Pin an exact version and verify package provenance, license, release history, source, and vulnerability status.
3. Run official Argon2id known-answer test vectors against the exact browser build.
4. Benchmark unlock time and memory on representative low-, mid-, and high-range Android devices and current iOS devices.
5. Bound all stored KDF parameters before allocation or computation to prevent malicious metadata from causing memory or CPU exhaustion.
6. Confirm cancellation, failure cleanup, and memory handling behavior.
7. Have the selected implementation and protocol independently reviewed before storing real credentials.

## Security rule

Do not substitute PBKDF2 or a custom password hash merely to avoid choosing a dependency. Any KDF change requires a versioned format and migration plan. The package choice and calibrated parameters remain release blockers until the above checks pass.
