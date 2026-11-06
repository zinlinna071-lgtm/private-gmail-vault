# Argon2id Compatibility Spike

**Status:** RFC 9106 §5.3 KAT and input-mutation checks passed in isolated Node.js and Chromium browser harnesses; physical-device validation remains pending  
**Branch:** `feature/vault-authentication`  
**Production impact:** None. No production dependency, KDF parameter, or key format is approved by this document.

## 1. Purpose

Compare browser-compatible Argon2id implementations without adding either candidate to the application's dependency graph. The spike must establish algorithm compatibility first, then measure real-device performance and memory behavior. It must not derive or handle any real user's Vault key.

Candidates:
- `@noble/hashes@2.4.0`
- `hash-wasm@4.12.0`

Install them only in a disposable, isolated test harness, never in the root application package during this evaluation.

## 2. Normative known-answer test

Use RFC 9106, Section 5.3, Argon2id test vector. This is an algorithm correctness test, not a recommendation for production password KDF parameters.

| Input | Value |
|---|---|
| Variant | Argon2id |
| Version | 0x13 (19) |
| Memory | 32 KiB |
| Passes | 3 |
| Parallelism | 4 |
| Output | 32 bytes |
| Password | 32 bytes of 0x01 |
| Salt | 16 bytes of 0x02 |
| Secret key K | 8 bytes of 0x03 |
| Associated data X | 12 bytes of 0x04 |

Expected output (hex):

```
0d640df58d78766c08c037a34a8b53c9
d01ef0452d75b65eb52520e96b01e659
```

Source: RFC 9106 §5.3, https://www.rfc-editor.org/rfc/rfc9106.html

### Candidate API mapping

For `@noble/hashes@2.4.0`:
- Import `argon2idAsync` from `@noble/hashes/argon2.js`.
- Map RFC K to the API's `key` option.
- Map RFC X to the API's `personalization` option. In this Argon2 API, this option is encoded as the RFC optional X input; it is not a claim that the Argon2 RFC field is a BLAKE2 personalization field.
- Set `t=3`, `m=32`, `p=4`, `dkLen=32`, `version=0x13`.
- `m` is in KiB; `maxmem` is in bytes. Set `maxmem` explicitly to a bounded value that is at least the actual test allocation (32 KiB for this vector); do not rely on the 1 GiB default.
- Upstream source inspection at the 2.4.0 release commit confirms that `argon2InitialHash` serializes `key` and `personalization` as the RFC's `LE32(length(K)) || K` and `LE32(length(X)) || X` inputs. This confirms the API mapping, but is not a test result.
- The API also exposes an async variant. It yields to the scheduler, but does not expose an AbortSignal parameter; do not describe it as user-cancellable until a tested cancellation design exists.

For `hash-wasm@4.12.0`:
- Import `argon2id` from `hash-wasm`.
- The documented options expose `secret`, but do not document a distinct associated-data/X input.
- Therefore do not claim that its API can execute the exact RFC vector above unless source inspection confirms an equivalent, supported X input.
- If it cannot represent X, mark the exact-vector test **unsupported by the public API**. Do not silently omit X and compare against the RFC expected output.
- A separate K/X-empty vector may be used only when its expected output is obtained from a trusted independent reference implementation and checked into the harness with provenance.

## 3. Test requirements

A candidate is not considered compatible until all applicable checks pass:

1. Exact RFC 9106 §5.3 output matches byte-for-byte.
2. Output length and Argon2 version are verified.
3. Mutating one password, salt, secret, or associated-data byte changes the output.
4. Invalid or excessive memory/pass/parallelism values are rejected before expensive allocation.
5. Two independent implementations agree on at least one additional vector with K and X empty, where the expected output is independently sourced.
6. The test runs in a real browser build, not only Node.js.
7. The tested package tarball and lockfile integrity match the exact pinned versions.

A candidate that cannot express the complete RFC vector is not automatically incorrect; record the API limitation and use an independently sourced compatible vector. Never mislabel a partial-input test as the complete RFC vector.

## 4. Browser and device benchmark protocol

Do not benchmark only on desktop.

Record for each device:
- Device model, OS version, browser version, available memory class.
- Cold and warm start time.
- Median and p95 derivation duration across at least 10 runs.
- Peak memory or best available memory-pressure indicator.
- UI responsiveness while derivation runs.
- Behavior when the tab is backgrounded, suspended, or cancelled.
- Whether the tab reloads or the browser kills the process under memory pressure.

Test at least:
- Low-memory Android device (minimum supported target).
- Mid-range Android device.
- Current high-end Android device.
- Current iPhone/iOS Safari device.

Do not choose production parameters from desktop results. A 64 MiB / 3-pass / 4-lane profile is only an RFC reference profile for evaluation, not an approved production setting.

## 5. Security and implementation constraints

- Never use a real Master Password, account password, recovery code, or production key in this harness.
- Use only fixed public test-vector bytes and randomly generated synthetic benchmark inputs.
- Do not log passwords, derived keys, salts from user sessions, or raw key material.
- Clear mutable input/output buffers best-effort after each test, while documenting that JavaScript engines and WASM runtimes do not guarantee zeroization.
- Do not add either package to the root `package.json` or root lockfile during the spike.
- Do not change `lib/vault/key-envelope.ts` or wire KDF into the Vault UI until a candidate and parameters are approved.
- Do not freeze the on-disk KDF metadata format yet.

## 6. Decision record

| Check | noble 2.4.0 | hash-wasm 4.12.0 |
|---|---|---|
| API supports RFC K and X inputs | Source mapping confirmed | Public API X support unconfirmed |
| Exact RFC §5.3 vector | Node.js and Chromium passed | Unsupported until X support is confirmed |
| Additional independent vector | Not run | Not run |
| Browser build | Chromium headless passed | Not run |
| Android low-memory benchmark | Not run | Not run |
| iOS Safari benchmark | Not run | Not run |
| Package provenance review | Pending | Pending |
| Independent Argon2 audit evidence | Argon2 excluded from the historic Cure53 audit | Not established |
| Decision | Not approved | Not approved |

## 7. Exit criteria

A candidate may be proposed (not automatically approved) only after:
- KAT results and exact package provenance are recorded;
- browser compatibility and supported-device benchmarks are complete;
- maintenance, audit scope, and supply-chain risks are accepted in writing;
- parameter bounds and cancellation behavior are tested;
- the crypto protocol receives independent review.

Until then, the current Vault remains a development prototype and must not store real high-value credentials.

## 8. Isolated Node.js harness (2026-11-07)

A standalone test harness exists under `tools/argon2id-spike/`:
- `package.json` pins the test-only `@noble/hashes` dependency to 2.4.0; it is not part of the root application dependency graph.
- `test-rfc9106.mjs` executes the complete §5.3 vector, checks the 32-byte result, and checks that changing the password, salt, secret K, or associated data X changes the output.
- `.github/workflows/argon2id-spike.yml` defines a branch-scoped GitHub Actions job for the isolated test.

**Execution status (verified):** GitHub Actions run [42272387331](https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42272387331) completed successfully for commit `889ee746033675175dfb5496e6e57eb6ed7c3821`. The exact RFC 9106 §5.3 output matched byte-for-byte, and all four mutation checks passed (password, salt, secret K, and associated data X).

## 9. Isolated Chromium browser harness (2026-11-07)

A separate browser-only harness has been added under `tools/argon2id-browser-spike/`. It bundles the pinned candidate into a browser script with esbuild and runs it in a real headless Chromium page through Playwright. Dependencies remain isolated from the root application.

The first CI attempt used the Ubuntu 26.04 runner and failed before executing tests because the pinned Playwright release did not support that runner image. This was an environment compatibility failure, not a cryptographic test failure. The workflow was changed to the supported `ubuntu-24.04` runner.

**Execution status (verified):** GitHub Actions run [42281120467](https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42281120467) completed successfully for commit `70cbd9eadd3970896fc49852a07f7a28ec2dfab3`. In Chromium, the exact RFC 9106 §5.3 output matched byte-for-byte and all four mutation checks passed: password, salt, secret K, and associated data X.

**Scope limitation:** This is a headless Chromium compatibility result on a hosted Linux runner. It is not a measurement on Android or iOS devices, does not establish real-device memory pressure or cancellation behavior, and does not approve production KDF parameters or the production dependency. The harness uses only public test-vector bytes and does not import application code or handle real user secrets.
