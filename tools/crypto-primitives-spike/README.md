# Isolated Vault crypto primitive spike

This directory is a dependency-free correctness harness for public cryptographic test vectors. It does not import the Vault application and is not a production crypto module.

## Requirements

- Node.js 22 or newer
- Node.js Web Crypto API (`globalThis.crypto.subtle`)

No install step is required.

## Run

From this directory:

```sh
npm test
```

Or from the repository root:

```sh
npm --prefix tools/crypto-primitives-spike test
```

## Coverage

- RFC 5869 Appendix A.1 HKDF-SHA-256 expected output and IKM mutation.
- Two AES-256-GCM vectors transcribed from a Chromium fixture identifying NIST CAVP `gcmEncryptExtIV256.rsp` as the source.
- AES-GCM encrypt/decrypt byte-for-byte checks.
- Negative authentication checks for modified ciphertext/tag, IV, AAD, and key.

## Safety and limits

- Fixtures are public known-answer values; do not replace them with production credentials or keys.
- The fixed AES key/IV pairs are test-only and must never be reused in production.
- Best-effort buffer clearing is not a guarantee of JavaScript memory zeroization.
- Passing this harness verifies only these primitive vectors in the runtime where it was executed. It does not validate the Vault protocol, application key lifecycle, side-channel resistance, zero-knowledge architecture, or formal CAVP compliance.
- Browser-engine and physical-device tests are tracked separately in `docs/VAULT-CRYPTO-TEST-VECTOR-CATALOG.md`.


## Browser compatibility matrix

A separate browser-only harness runs the same public HKDF-SHA-256 and AES-256-GCM known-answer checks inside Chromium, Firefox, and WebKit. It reuses the Playwright and esbuild packages already isolated under **tools/argon2id-browser-spike**; it does not add dependencies to the root application.

Run from the repository root:

```sh
cd tools/argon2id-browser-spike
npm install --ignore-scripts --no-audit --no-fund
npx playwright install chromium firefox webkit
node run-crypto-primitives-browser-test.mjs
```

The browser runner bundles **tools/crypto-primitives-spike/browser-test-entry.js** and uses a local test-only HTTP server. It does not import the Vault application, call Vault APIs, or handle real credentials. The CI workflow is **.github/workflows/vault-crypto-primitives-browser.yml**.

**Status:** browser harness implemented; no browser-matrix PASS claim until the new workflow reaches and completes all three engines. A workflow that fails before test steps is UNRESOLVED / NOT RUN.
