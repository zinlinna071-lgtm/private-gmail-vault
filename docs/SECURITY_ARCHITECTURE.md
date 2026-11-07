# Private Account Vault — Security Architecture

## Security objective

Build the smallest useful personal credential vault with a zero-knowledge data model: the browser encrypts account records before upload, and the server stores and serves ciphertext only. The server, database operator, hosting operator, and a database-only attacker must not be able to decrypt account names, usernames, passwords, backup codes, or notes.

No system can honestly promise that no attacker can ever compromise it. The engineering objective is to minimize trust, reduce attack surface, prevent one compromised layer from exposing plaintext, and make compromise detectable and recoverable.

## Product scope

The only user-facing features are:
- Create and unlock the private Vault.
- Add, view, search, edit, copy, and delete account records.
- Each record contains account name, email/username, password, and backup codes.
- Lock the Vault and sign out.

No Gmail OAuth, mailbox, external account connection, AI, analytics, sharing, teams, or unnecessary dashboard.

## Required security model

### 1. Zero-knowledge client-side encryption

The current branch uses server-side AES-256-GCM with VAULT_DATA_ENCRYPTION_KEY. That is encryption at rest, not zero knowledge: the server can decrypt every record. It must not be described as the final high-security design.

Target model:
1. Generate a random 256-bit Vault Data Encryption Key (VDEK) in the browser using Web Crypto crypto.getRandomValues.
2. Encrypt each complete record in the browser using AES-256-GCM with a fresh 96-bit nonce. Never reuse a nonce with the same key.
3. Bind ciphertext to immutable record identity and format using canonical authenticated additional data (AAD): application purpose, schema version, Vault ID, and record ID.
4. Derive a Key Encryption Key (KEK) from the user's Vault Unlock Passphrase using Argon2id with a unique random salt and reviewed, versioned parameters. The passphrase never leaves the browser and is not used as the server login credential.
5. Wrap the VDEK with the KEK using an authenticated wrapping construction. Store only the wrapped VDEK, salt, KDF parameters, version identifiers, and encrypted records.
6. The server and database never receive the passphrase, KEK, VDEK, plaintext records, or decrypted search index.
7. Search is performed locally after the user unlocks and decrypts records. Do not introduce server-side plaintext search.

Use a maintained, audited Argon2id implementation that works in supported browsers. Benchmark parameters on low-end mobile devices while meeting current OWASP guidance. Store KDF parameters with the wrapped key so future versions can upgrade safely.

### 2. Independent authentication and unlock

Do not reuse the Vault Unlock Passphrase as the Supabase login password. Authentication and decryption are separate security boundaries.

Preferred sign-in: WebAuthn/passkey with server-side challenge verification, origin and RP ID validation, user verification required, challenge expiry, replay prevention, and credential revocation. Keep a secure fallback that does not silently downgrade to password-only access.

The unlock passphrase is entered only after authentication and used locally to unwrap the VDEK. Do not persist it in localStorage, sessionStorage, IndexedDB, cookies, URLs, logs, telemetry, or browser autofill. Clear key material and plaintext state on lock, sign-out, idle timeout, page hide where feasible, and authentication loss. Explain that browser memory cannot be reliably zeroized in JavaScript.

### 3. Recovery without a server backdoor

Generate a high-entropy, one-time-display Recovery Key in the browser. Derive a separate recovery KEK from it and use it to wrap the same VDEK. Store only the recovery-wrapped VDEK and required salt/metadata. The server must never store a decryptable recovery key or a plaintext recovery code.

Recovery should require the user to present the Recovery Key, unwrap the VDEK locally and allow the user to set a new Unlock Passphrase, rotate the Recovery Key and re-wrap the VDEK after successful recovery, keep recovery material out of the same place as the device being protected, and warn clearly that losing both unlock and recovery material means encrypted data is unrecoverable by design.

Never implement an admin override or a server-side master decryption key.

### 4. Browser and API boundaries

- Enforce HTTPS, HSTS, secure HttpOnly SameSite cookies, strict Origin checks on every state-changing cookie-authenticated route, and CSRF defenses.
- Use a restrictive Content Security Policy, no inline script exceptions unless nonce/hash protected, frame-ancestors 'none', object-src 'none', base-uri 'self', and a minimal permissions policy.
- Avoid third-party scripts, analytics, advertising, remote fonts, and unnecessary dependencies on every secret-bearing page.
- Add Cache-Control: no-store to all secret-bearing responses and appropriate Referrer-Policy.
- Validate request sizes, schemas, IDs, and content types. Rate-limit authentication and sensitive actions at a trusted edge/server layer. Fail closed if rate-limit storage is unavailable.
- Prevent secrets from entering logs, traces, exception messages, URLs, error reports, source maps, and CI artifacts.
- Use generic authentication and recovery errors to reduce account enumeration.
- Keep security headers and cookie configuration centralized and covered by integration tests.

### 5. Database isolation

- Store ciphertext, nonce, authentication tag, wrapped VDEK, and non-secret version/KDF metadata only.
- Use user-scoped RLS as defense in depth. Do not rely solely on a service-role client and application-side filters.
- If privileged server access remains necessary, keep it server-only, narrowly scoped, audited, and never expose it to browser bundles.
- Test cross-user read/update/delete attempts at the database and API layers.
- Add constraints for ciphertext/nonce/tag sizes, record ownership, and schema versions.
- Use encrypted backups and test restoration. Database backups contain ciphertext but still require careful access controls.

### 6. Operational security

- Keep production secrets in the platform secret manager; never commit them or print them in CI.
- Separate development, test, and production Supabase projects and credentials.
- Pin dependencies with a committed lockfile; run dependency, secret, static-analysis, and build checks in CI.
- Require review for dependency changes, auth, cryptography, database policy, and deployment workflow changes.
- Use reproducible builds where feasible, protected branch rules, least-privilege repository/deployment permissions, and manual production promotion.
- Maintain a security incident and key-rotation procedure. Test backups and recovery before production.
- Never claim a penetration test or independent cryptographic audit unless one actually occurred.

## Current code review findings — blockers before production

1. lib/vault/item-encryption.ts decrypts with a server-only VAULT_DATA_ENCRYPTION_KEY; the server can read every saved credential. Replace this with browser-side zero-knowledge encryption before calling the product zero-knowledge.
2. The current Vault Master Password is also the Supabase Auth password. Separate account authentication from local encryption unlock.
3. The account CRUD POST/PUT/DELETE routes do not currently enforce same-origin checks. Add origin/CSRF protection before enabling any deployment.
4. The admin Supabase client bypasses ordinary RLS evaluation. Every route currently filters by authenticated user.id, but the database policy must independently enforce tenant isolation and be tested.
5. The current UI includes a Notes field, while the API schema rejects notes; remove the field to match the requested minimal record schema.
6. The current browser UI keeps decrypted secrets in React state. A lock lifecycle, idle timeout, page-hide handling, and clearing of sensitive state are required.
7. The current rate limiter trusts x-real-ip/x-vercel-forwarded-for according to hosting assumptions. Confirm the exact trusted proxy contract and enforce edge limits; do not accept client-controlled forwarding headers.
8. Current tests cover basic AES-GCM round trips, tampering, and user/record AAD, but do not establish zero-knowledge, RLS isolation, CSRF, CSP, WebAuthn, key recovery, or production readiness.

## Delivery gates

### Gate A — remove unrelated product surface
- Remove Gmail routes, Gmail UI, Gmail token code, Gmail-only tests, and Gmail-specific active documentation.
- Preserve migration history until the target Supabase database's applied migration state is verified. Do not delete or rewrite migrations that may already have been applied.
- Keep the active UI to the four requested account fields and essential actions.

### Gate B — security architecture and cryptographic implementation
- Implement browser-only VDEK generation, Argon2id passphrase wrapping, recovery-key wrapping, record encryption, versioned metadata, and safe key lifecycle.
- Add independent WebAuthn authentication; do not send the unlock passphrase to the auth provider.
- Add negative tests for wrong passphrase, tampering, swapped records, wrong Vault/user, malformed metadata, KDF limits, recovery rotation, and loss/recovery cases.

### Gate C — application hardening
- Add CSRF/origin protection, strict headers/CSP, request limits, trusted rate limiting, session lifecycle, RLS, generic errors, and no-secret logging.
- Test all cross-user authorization boundaries and security headers.

### Gate D — independent verification
- Run unit, integration, typecheck, build, dependency and secret scans.
- Perform threat modeling and independent security review/penetration testing before production.
- Complete restore and recovery drills. Keep production deployment disabled until explicitly approved.

## Non-negotiable rule

Do not send plaintext credentials or any key capable of decrypting the vault to the server. If a feature requires server-side plaintext access, it is outside this product's security model and must be rejected or redesigned.