# Private Account Vault — Security Foundation

**Status:** Architecture standard / implementation gates  
**Applies to:** `feature/vault-authentication` and all future releases  
**Security objective:** Minimize the amount of trust placed in the application server and make compromise of any single component insufficient to reveal stored account secrets.

> No software can honestly promise to be impossible to breach. This project aims for defense in depth, explicit threat modeling, independently testable controls, and safe failure. Security claims must describe verified behavior, not aspirations.

## 1. Product boundary

The product is a personal vault for manually storing credentials belonging to any online or offline account.

The minimum user-facing functions are:
- Create, view, search, edit, and delete account records.
- Store account name, email/username, password, and backup codes.
- Reveal or conceal secrets and copy them on explicit user action.

Out of scope unless separately approved:
- Gmail or other provider integrations.
- External account sign-in or automated recovery.
- AI, analytics, advertising, tracking, social features, and unnecessary dashboards.
- Any feature that bypasses another provider's authentication or security controls.

The interface should remain minimal. Complexity belongs in the security implementation, tests, and documentation—not in unnecessary user-facing features.

## 2. Security principles

1. **Zero-knowledge by design:** The server stores ciphertext and protocol metadata only. It must not receive the Master Password, plaintext account secrets, or usable data-encryption keys.
2. **Client-side encryption:** Encrypt before network transmission; decrypt only after the user unlocks the vault in a trusted client.
3. **Least privilege:** Every identity, API route, database role, and deployment receives only the permissions it needs.
4. **No implicit trust:** Validate identity, authorization, record ownership, schema, sizes, and cryptographic metadata at every boundary.
5. **Fail closed:** Unknown algorithms, versions, malformed ciphertext, missing keys, invalid tags, and incomplete recovery state must fail without returning plaintext.
6. **Authenticated encryption:** Confidentiality and integrity are both mandatory.
7. **Safe recovery:** Recovery must not silently weaken encryption or create a server-side decryption backdoor.
8. **Minimal exposure:** Secrets must not appear in logs, telemetry, URLs, analytics, crash reports, clipboard history by design, or error messages.
9. **Verifiable security:** Each security claim must map to code, tests, operational controls, and a release gate.
10. **No absolute claims:** Never market the vault as unhackable or mathematically immune to compromise.

## 3. Threat model

### Assets to protect
- Account passwords, usernames, email addresses, backup/recovery codes, and private notes if ever explicitly approved.
- Master Password-derived keys, data-encryption keys, recovery material, and authentication credentials.
- Session cookies, encrypted backups, database records, and deployment integrity.

### Threat actors and failure cases
- Database snapshot theft or unauthorized database reads.
- Compromised or malicious server operator / hosting credentials.
- Cross-user authorization flaws and insecure direct object references.
- XSS, malicious dependencies, compromised build pipeline, or altered client JavaScript.
- Phishing, credential stuffing, brute-force attempts, session theft, CSRF, and clickjacking.
- Lost devices, stolen backups, accidental deletion, key loss, and malicious insiders.
- Vulnerabilities in browsers, operating systems, cryptographic libraries, or the user's device.

### Security goals and limits
The design should protect stored secrets against a database-only compromise and prevent the ordinary application server from decrypting vault contents. It cannot protect secrets while they are displayed on a compromised endpoint, against malware/keyloggers on the user's device, or against a malicious client bundle delivered to the browser. These residual risks must be documented and mitigated operationally.

## 4. Target cryptographic architecture

### 4.1 Key hierarchy

Use envelope encryption:

- Generate a random 256-bit Data Encryption Key (DEK) using a cryptographically secure random number generator for each vault (or an explicitly documented key scope).
- Encrypt each record in the browser using AES-256-GCM with a fresh, unique 96-bit nonce for every encryption under a given DEK.
- Derive a Key Encryption Key (KEK) from the Master Password using Argon2id with a unique random salt and calibrated parameters.
- Use the KEK only to wrap/unwrap the DEK. Do not use the password-derived key directly for every record.
- Store only the wrapped DEK, salt, KDF parameters, algorithm/version identifiers, and ciphertext on the server.
- Keep the plaintext DEK and KEK in memory only while the vault is unlocked. Clear references and lock the vault on logout, timeout, or explicit lock; acknowledge that JavaScript cannot guarantee secure memory zeroization.

Argon2id parameters must be benchmarked on supported mobile devices and selected against current OWASP guidance. Record the exact parameters and version in the format metadata. Enforce safe upper bounds when parsing untrusted KDF metadata to prevent resource-exhaustion attacks. Do not silently downgrade parameters.

### 4.2 Encryption format

Use Web Crypto API AES-GCM for authenticated encryption and a vetted Argon2id implementation compiled to WebAssembly where browser support requires it.

For each encrypted record:
- Generate a fresh nonce with `crypto.getRandomValues`.
- Bind immutable context as Additional Authenticated Data (AAD), such as format version, vault ID, record ID, and record type.
- Serialize a versioned envelope containing algorithm ID, format version, nonce, ciphertext, and required metadata.
- Reject duplicate, malformed, truncated, unsupported, or oversized envelopes.
- Never reuse a nonce with the same DEK. Treat nonce uniqueness as a critical invariant and test it.

Use cryptographically secure random generation only. Do not implement custom ciphers, custom KDFs, or home-grown cryptographic protocols.

### 4.3 Password handling

The Master Password is never sent to the server and is never stored. It is used locally as input to Argon2id. Do not log it, place it in URLs, persist it in localStorage/sessionStorage, or include it in analytics or crash reports.

A separate server-side authentication verifier may be required to authenticate an account. It must be independent from the encryption key hierarchy and must never enable the server to derive the DEK. Prefer passkey/WebAuthn authentication where feasible. If a password-based login verifier is retained, use a separate salted password-hashing scheme and never reuse the encryption KDF output as the login credential.

## 5. Authentication is not encryption

Passkey/WebAuthn is for phishing-resistant authentication to the service. It is not automatically the vault's encryption key and must not be treated as a substitute for the Master Password or recovery material.

- Validate WebAuthn challenges, origins, RP IDs, credential ownership, signatures, and replay protection on the server.
- Use secure, HttpOnly, SameSite cookies for sessions; rotate session identifiers after authentication and privilege changes.
- Keep session lifetime and idle-lock behavior conservative and documented.
- Protect state-changing requests against CSRF.
- Rate-limit authentication and recovery endpoints; return generic errors that do not disclose whether an account exists.
- Provide a clear, secure process for revoking sessions and lost authenticators.

## 6. Recovery and backup

Recovery is a first-class security protocol, not an afterthought.

- Generate high-entropy recovery material client-side using a cryptographically secure RNG.
- Show recovery material once, require the user to confirm they have saved it, and explain that anyone possessing it may be able to recover the vault.
- Recovery material must be independent from the primary device and should be stored offline by the user.
- Design recovery so it can unwrap or re-establish access to the DEK without giving the server a decryption capability.
- Do not store the only recovery factor inside the vault it is meant to recover.
- Encrypted exports must be encrypted on the client and require a separate strong secret or recovery mechanism. Never create plaintext exports by default.
- Test recovery, loss, rotation, revocation, and interrupted-recovery scenarios before release.
- If all decryption and recovery material is lost, explain honestly that the encrypted data may be unrecoverable. Do not add a hidden master key or support backdoor.

A recovery design must be reviewed independently before implementation. The exact protocol, key derivation, recovery envelope, and user experience must be specified and tested before migration or production use.

## 7. Application and browser defenses

- Strict Content Security Policy; avoid inline scripts and unsafe evaluation.
- Minimize third-party scripts and dependencies; no advertising, analytics, or remote widgets on secret-bearing pages.
- Escape output and validate inputs; use safe rendering patterns to prevent XSS.
- Use dependency pinning, lockfiles, automated vulnerability scanning, and review of dependency changes.
- Apply secure headers, HTTPS, HSTS, clickjacking protection, MIME sniffing protection, and a restrictive referrer policy.
- Do not expose secrets through URLs, browser history, server-rendered HTML, source maps, error boundaries, or debug output.
- Avoid caching decrypted responses; use no-store for sensitive API responses.
- Lock on inactivity and when the user explicitly locks the vault. Do not rely on client timers as the only session control.
- Treat clipboard copy as an explicit user action and clear the clipboard when practical, while explaining that browsers and operating systems may retain clipboard contents.

A zero-knowledge browser application still trusts the code delivered to the browser. Protect the build pipeline, deployment credentials, branch protections, review process, and release artifacts. A compromised deployment can steal secrets at unlock time even if the database contains ciphertext only.

## 8. Database and backend controls

- Store encrypted payloads and only the minimum metadata required for synchronization and authorization.
- Enable Row Level Security and deny access by default.
- Use server-side authorization checks on every request; never trust a client-supplied user ID or record ownership claim.
- Keep privileged database credentials server-only and use a least-privilege service role or restricted database functions.
- Validate request shape, content type, record size, and rate limits.
- Use parameterized queries and safe database access patterns.
- Do not log request bodies, ciphertext-derived plaintext, credentials, tokens, or recovery material.
- Keep audit events metadata-only (event type, actor ID, timestamp, result); never record secret values.
- Encrypt transport with TLS and protect backups and infrastructure credentials separately.
- Review migrations before applying them. Never delete or rewrite migration history simply to remove legacy naming; use a safe forward migration after inspecting the actual database state.

## 9. Operational and supply-chain security

- Protect GitHub and hosting accounts with passkeys or hardware security keys and MFA.
- Require review for security-sensitive changes; protect the production branch and restrict deployment permissions.
- Separate development, preview, and production environments and credentials.
- Use secret scanning and rotate any secret that has been exposed.
- Pin dependencies and review critical cryptographic, authentication, and build-tool updates.
- Generate an SBOM and retain build/deployment provenance where practical.
- Keep production secrets out of source control, client bundles, logs, and preview environments.
- Use backups with tested restore procedures and independent access controls.
- Establish a vulnerability response process: triage, severity, containment, patch, verification, and user notification when needed.

## 10. Security testing requirements

Required automated and manual tests include:

- Cryptographic known-answer tests where applicable, round trips, tamper detection, wrong-key failure, wrong-AAD failure, malformed envelope rejection, and nonce uniqueness.
- Argon2id parameter validation, salt uniqueness, resource-limit enforcement, and no silent downgrade.
- Cross-user isolation, IDOR, RLS policy tests, and authorization checks for every record operation.
- XSS, CSRF, CSP, session fixation, session theft, replay, brute-force, and rate-limit tests.
- Recovery success, wrong recovery material, interrupted recovery, revocation, and backup restore tests.
- Secret-leak scans across logs, API responses, browser storage, URLs, build artifacts, and error messages.
- Dependency, static analysis, type checking, unit, integration, and production-build checks.
- Independent security review and penetration testing before storing real high-value credentials.

Security tests must run in CI. A failed security gate blocks release. A passing test suite is evidence for tested cases only; it is not proof that the system is invulnerable.

## 11. Implementation phases and release gates

### Phase 0 — Inventory and containment
- Inspect current branch, routes, database schema, migrations, dependencies, and deployed configuration.
- Remove unused Gmail/provider functionality safely from the application.
- Preserve migration history; inspect database state before any destructive cleanup.
- Keep production and the main branch untouched during feature work.

### Phase 1 — Cryptographic protocol
- Finalize key hierarchy, envelope format, AAD fields, KDF parameters, recovery protocol, and versioning.
- Add a written threat model and security review.
- Implement isolated cryptographic modules and exhaustive tests before wiring the UI.

### Phase 2 — Zero-knowledge data path
- Encrypt/decrypt only in the browser.
- Ensure the server handles ciphertext only.
- Remove server-side plaintext access paths and legacy encryption paths only after compatibility and migration strategy are proven.
- Verify with network inspection and server-side tests that plaintext secrets and usable keys never reach the backend.

### Phase 3 — Authentication and recovery
- Implement WebAuthn/passkey and secure session lifecycle.
- Implement the independently reviewed recovery protocol.
- Test device loss, session revocation, recovery and backup restoration.

### Phase 4 — Hardening and independent review
- Apply browser, API, database, supply-chain, and operational controls.
- Run security tests and obtain independent review.
- Resolve all critical and high-severity findings before release.

### Phase 5 — Controlled release
- Apply only reviewed migrations to the intended environment.
- Configure and verify production secrets without exposing them.
- Deploy only after explicit approval and successful release gates.
- Monitor metadata-only security events and maintain an incident response plan.

## 12. Non-negotiable release checklist

A release is blocked unless all are true:

- [ ] The server cannot decrypt vault records.
- [ ] The Master Password and plaintext secrets never leave the client.
- [ ] Encryption uses reviewed standard algorithms and unique nonces.
- [ ] Key derivation and envelope metadata are versioned and safely bounded.
- [ ] AAD binds ciphertext to its intended vault and record.
- [ ] Authentication, authorization, RLS, and session controls are tested.
- [ ] Recovery has been independently reviewed and tested.
- [ ] No secrets appear in logs, URLs, analytics, or client persistence.
- [ ] CSP, dependency, build, and deployment controls are in place.
- [ ] Encrypted backup and restore have been tested.
- [ ] Critical/high findings are resolved or formally accepted with documented rationale.
- [ ] Production deployment and database changes have explicit approval.

## 13. Security claim policy

Allowed: "Vault records are encrypted client-side using the documented protocol; the server stores ciphertext and cannot decrypt records through the normal application design."

Not allowed: "Unhackable", "100% secure", "no hacker can break it", or claims that security has been independently verified when it has not.

Every public security statement must match the implementation currently deployed. Architecture plans must be labeled as plans until code, tests, and deployment evidence demonstrate them.
