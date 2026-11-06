# Argon2id Browser Compatibility Spike

**Status:** Harness added; CI/browser execution result pending.  
**Scope:** Isolated test-only dependencies. Nothing is added to the root application dependency graph.

This harness bundles the pinned `@noble/hashes@2.4.0` Argon2id implementation for a real Chromium browser context and runs:

- RFC 9106 §5.3 exact known-answer test, including secret K and associated-data X.
- Mutation checks for password, salt, secret K, and associated-data X.

Run locally:

```sh
npm install --ignore-scripts --no-audit --no-fund
npx playwright install chromium
npm test
```

The RFC vector uses only 32 KiB of memory and is a compatibility check, **not** a production KDF parameter recommendation. A passing Chromium test does not establish Android/iOS performance, mobile memory safety, cancellation behavior, or production suitability. Those require measurements on physical low-, mid-, and high-end devices.

The harness must never receive a real Master Password or derive a real user's Vault key.
