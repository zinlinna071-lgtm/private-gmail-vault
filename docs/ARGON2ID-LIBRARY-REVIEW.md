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

## Updated evidence review

### Browser implementation candidate: `hash-wasm` 4.12.0

The current package documentation confirms:
- Argon2id v1.3 is included and exposed through a Promise-based browser API.
- The project uses hand-tuned WebAssembly binaries, supports modern browsers and Web Workers, and bundles its WASM modules in the package.
- The documented Argon2 API accepts explicit `memorySize` in KiB, `iterations`, `parallelism`, `salt`, and output length.
- The project's published benchmark compares Argon2id on desktop Chrome 131 / Ryzen 9 7900X. That benchmark is not evidence of acceptable latency or memory use on Android phones.

Maintenance caveat: npm lists 4.12.0 as the latest release, published in November 2024. The long gap since that release is a material maintenance and supply-chain risk for a security-critical dependency. High download volume and no reported known vulnerability do not establish that the Argon2 implementation is independently audited or free of defects.

### Updated assessment

`hash-wasm` is the strongest browser/WASM candidate in this review for a compatibility spike, not an approved production dependency. Do not add it to the application until:
1. The exact 4.12.0 source and bundled WASM build are matched to the published package and reviewed.
2. The package's Argon2id output is checked against RFC 9106 known-answer vectors in the browser test environment.
3. Android memory pressure, background-tab behavior, cancellation, and unlock latency are measured on real devices.
4. The project accepts the maintenance gap or selects a better-maintained independently reviewed implementation.

`@noble/hashes` remains a readable, minimal alternative, but its own current documentation warns that pure-JavaScript Argon2 is slow; the project's Cure53 audit scope explicitly excluded Argon2. Therefore the general audit claim must not be interpreted as an Argon2 audit.

### Current implementation boundary

No Argon2 package has been installed. The current `importVaultKeyEncryptionKey` function only accepts a 32-byte derived output and imports it as a non-extractable AES-GCM key; it does not derive that output or validate a password. This separation is intentional until the KDF is selected and tested.


## 2026-11-07 evidence addendum

The candidate comparison was refreshed against current package and upstream project information.

### `@noble/hashes` 2.4.0 — active, but Argon2 remains a caveat

- The upstream changelog records releases in April, August, and August 27, 2026, including Argon2 correctness/performance changes and improved cleanup behavior.
- Its README says the historic Cure53 audit excluded Argon2. The newer project self-audit process is useful evidence, but does not convert that excluded code into an independently audited Argon2 implementation.
- The project explicitly warns that JavaScript Argon2 is slow and that JIT/GC make strict constant-time behavior difficult.
- Version 2.4.0 is ESM-only; verify compatibility with this repository's Next.js client bundling and existing TypeScript version before adoption.

**Updated assessment:** Best maintenance signal among the reviewed browser candidates, but not automatically the safest or fastest KDF. It is a candidate for an isolated RFC 9106 compatibility/benchmark spike only.

### `hash-wasm` 4.12.0 — browser WASM, maintenance gap remains

- npm still lists 4.12.0 as the latest published release, from November 2024.
- Its Argon2id v1.3 WebAssembly support is attractive, but recent download volume does not compensate for the prolonged release gap.
- No independent Argon2-specific audit was established by this review.

**Updated assessment:** Keep as a comparator for performance testing only. Do not select as production dependency until source/WASM provenance and maintenance risk are resolved.

### `argon2id` 1.0.1 — not selected

- npm still lists 1.0.1 as latest, published approximately three years ago.
- The repository is a small project with limited activity evidence.

**Updated assessment:** Not selected.

### Decision after refreshed review

No package is approved for production at this point. The next safe engineering step is a throwaway, isolated compatibility spike that does not modify the production dependency graph:

1. Evaluate `@noble/hashes` 2.4.0 and `hash-wasm` 4.12.0 separately in a disposable test harness.
2. Verify Argon2id v1.3 outputs against official RFC 9106 known-answer vectors using identical password bytes, salt, memory, passes, lanes, and output length.
3. Measure cold-start and steady-state memory/latency on representative Android devices, including the lowest-memory device in the support target.
4. Exercise cancellation/backgrounding and confirm the app remains responsive; do not assume JavaScript zeroization or WASM memory release is guaranteed.
5. Review exact npm tarballs, lockfile integrity, build output, license, provenance, and transitive dependency footprint.
6. Make a documented choice only after those results exist. Do not freeze KDF parameters or a persistent envelope format before then.

The 64 MiB / 3-pass / 4-lane RFC profile remains a test vector profile, not an approved production setting. Device measurements and a security review are still required.


## 2026-11-07 source-level API verification

The isolated compatibility spike review inspected the `@noble/hashes@2.4.0` published API documentation and the upstream `src/argon2.ts` source at the signed 2.4.0 release commit.

Confirmed:
- `argon2idAsync` is exported from `@noble/hashes/argon2.js`.
- The Argon2 options include `key` and `personalization`; source-level initial-hash construction serializes them as the RFC optional secret K and associated-data X fields, respectively.
- `m` is expressed in KiB, while `maxmem` is expressed in bytes and is checked against the actual memory allocation.
- The asynchronous API yields to the scheduler but has no public `AbortSignal` argument. Cancellation must not be claimed without a separately designed and tested wrapper.
- The package's documentation warns that its pure-JavaScript Argon2 implementation is materially slower than native implementations. The historic Cure53 audit scope explicitly excluded Argon2.

This improves confidence that Noble can represent the full RFC §5.3 input tuple. It does **not** establish that the vector has been executed successfully in this repository, nor does it establish acceptable mobile performance or independent Argon2 audit coverage.

**Decision unchanged:** `@noble/hashes@2.4.0` remains an isolated test candidate only. No KDF dependency, parameters, or persistent format is approved.

## 2026-11-07 isolated RFC vector result

The pinned `@noble/hashes@2.4.0` candidate has now passed the complete RFC 9106 §5.3 Argon2id known-answer test in the isolated Node.js GitHub Actions harness:
- Workflow run: [42272387331](https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42272387331)
- Commit: `889ee746033675175dfb5496e6e57eb6ed7c3821`
- Exact 32-byte RFC output matched.
- Mutating each of password, salt, secret K, and associated data X produced a different output.

This upgrades the evidence from source-level API mapping to a passing Node.js known-answer test. It does **not** establish browser compatibility, acceptable Android/iOS latency or memory use, cancellation behavior, independent Argon2 audit coverage, or production readiness. The 32 KiB RFC vector is a correctness vector, not a secure production KDF setting.

**Decision remains unchanged:** `@noble/hashes@2.4.0` is still an isolated candidate. Do not add it to the root dependency graph or freeze production KDF parameters until browser/device benchmarks, provenance review, and independent security review are complete.

