# Authenticator Vault Recovery State Machine and Test Plan

**Status:** Design and test specification only. Not an implementation approval.
**Scope:** Authenticator Vault Data Key (VDK) recovery, Recovery Code rotation, and encrypted factor persistence.
**Safety boundary:** Do not apply SQL, change existing recovery RPCs, alter OAuth scopes, or deploy production as part of this document.

## 1. Security invariants

1. TOTP seeds, Google backup codes, VDK plaintext, and derived wrapping keys are never sent to the server, logs, analytics, error trackers, or AI services.
2. The database stores only authenticated ciphertext, IVs, authentication tags, salts, KDF metadata, non-secret identity metadata, and version counters.
3. A Vault user may access only rows whose `user_id` equals the authenticated Vault session user ID. Never trust a browser-supplied user ID as authorization.
4. A Recovery Code is one-time. The old code remains valid until the user explicitly acknowledges successful storage of the replacement.
5. The active Recovery Code verifier and active recovery-wrapped VDK must always belong to the same recovery generation. They must be promoted atomically.
6. A failed, expired, interrupted, or replayed recovery attempt must not invalidate the last working password wrapper or active Recovery Code wrapper.
7. Gmail OAuth connection status is independent of authenticator-factor availability.
8. Every update to an envelope or factor uses optimistic concurrency (expected version) or an equivalent compare-and-swap guard.
9. A server-side database compromise alone must not reveal TOTP seeds, backup codes, or the VDK.
10. If both the Master Password and the current Recovery Code are lost, encrypted factors are intentionally unrecoverable. There is no server bypass.

## 2. Required lifecycle states

### Envelope lifecycle

- **ABSENT** — no VDK envelope exists; authenticator vault has not been initialized.
- **ACTIVE(vN)** — password and recovery wrappers for the same VDK generation are present.
- **ROTATION_PENDING(vN, pending)** — active wrappers remain authoritative; a proposed replacement wrapper set is staged and has not yet been acknowledged.
- **RECOVERY_CLAIMED(vN, lease)** — a single recovery attempt owns a time-limited claim. Existing active wrappers remain unchanged.
- **RECOVERY_STAGED(vN, pending)** — new password wrapper, new recovery wrapper, and pending Recovery Code verifier are staged together; old active generation remains authoritative until acknowledgement.
- **LOCKED/UNAVAILABLE** — client has no unlocked VDK in memory. This is a client session state, not a database state.
- **DELETED** — explicit user-initiated deletion after reauthentication; ciphertext is removed according to the approved retention policy.

A pending state must include a random operation/claim identifier, expiry, and expected active version. A retry with the same operation identifier must be idempotent; a different concurrent operation must fail closed.

### Factor lifecycle

- **NOT_ENROLLED** — no factor record exists.
- **ENROLLMENT_PENDING** — secret generated locally and awaiting first-code verification; it is not persisted as plaintext.
- **ACTIVE** — encrypted seed stored after successful verification; factor can generate TOTP after VDK unlock.
- **DISABLED** — factor is disabled without silently deleting the encrypted record.
- **DELETED** — explicit deletion after reauthentication and confirmation.

Backup codes have independent per-code states (unused/used/revoked) inside the encrypted client-side bundle. The server must not receive individual plaintext codes or their plaintext usage history.

## 3. Enrollment flow

1. Require an authenticated Vault session and an unlocked VDK.
2. Resolve the Google identity using a verified Google subject; email is display metadata, not the unique identity key.
3. Generate the TOTP secret in the browser using a cryptographically secure random generator.
4. Display a provisioning URI/QR and manual-entry fallback. Do not transmit the secret to the server.
5. Ask the user to enroll it in Google Authenticator or another compatible authenticator.
6. Verify a current 6-digit code locally, allowing only a narrowly bounded clock-skew window.
7. Encrypt the seed using AES-256-GCM with a fresh 96-bit IV and canonical, versioned AAD binding user ID, factor ID, provider, purpose, and schema version.
8. Persist ciphertext only through an authenticated server route; enforce owner scope and expected factor version.
9. For Google backup codes, instruct the user to obtain them from Google Security settings. Gmail API does not provide these codes. Accept them only in a secure local input flow, encrypt the complete structured collection in the browser, and never echo them in logs or responses.
10. Read back ciphertext metadata and verify client-side decryption before reporting enrollment complete.

If verification or persistence fails, discard the pending local secret and do not create an ACTIVE factor.

## 4. Master Password change

1. Authenticate and unlock the existing VDK using the current Master Password.
2. Derive a new wrapping key using the approved, pinned KDF parameters and a fresh random salt.
3. Wrap the same VDK; do not re-encrypt every factor solely because the password changed.
4. Submit the new password wrapper with expected envelope version.
5. Atomically replace only the password wrapper and increment the envelope version.
6. Keep the recovery wrapper unchanged.
7. On conflict, reload envelope metadata and require the user to retry; never overwrite a newer wrapper.

## 5. Recovery Code rotation

1. Require an unlocked VDK and recent reauthentication.
2. Generate a new high-entropy one-time Recovery Code in the browser.
3. Derive a recovery wrapping key from the new code using a separate fresh salt and approved KDF parameters.
4. Wrap the existing VDK under the new recovery key.
5. Stage the new recovery wrapper and the server-side verifier for the new code as one pending generation. The old active wrapper and verifier remain active.
6. Show the new code once and require explicit user acknowledgement that it has been saved.
7. On acknowledgement, atomically promote both the pending recovery wrapper and pending Recovery Code verifier in one database transaction, clear pending material, and increment the envelope version.
8. If acknowledgement does not arrive before expiry, discard the pending generation and retain the old active recovery pair.
9. Never promote the verifier and wrapper in separate requests or transactions.

## 6. Lost-device recovery flow

1. User signs into the Vault using the supported Vault account recovery path.
2. Server verifies the submitted Recovery Code using the stored verifier and rate limits the attempt.
3. Server creates a short-lived, single-use recovery claim using compare-and-swap. A concurrent claim must fail.
4. Browser derives the recovery wrapping key locally and attempts to unwrap the VDK. Wrong code, malformed envelope, or authentication-tag failure must return a generic failure without revealing which check failed.
5. Once unlocked, user sets a new Master Password. Browser creates a new password wrapper and a new recovery wrapper using a newly issued Recovery Code.
6. Server stages the new password wrapper, recovery wrapper, pending Recovery Code verifier, operation ID, and expiry as one pending generation. Active generation remains untouched.
7. User saves the new Recovery Code and explicitly acknowledges it.
8. A single atomic finalization transaction verifies claim ownership, claim expiry, pending operation ID, and expected active version, then promotes the password wrapper, recovery wrapper, and Recovery Code verifier together.
9. Finalization clears claim and pending fields and increments the version. A repeated acknowledgement must be idempotent and must not rotate again.
10. If the claim expires or the browser closes before acknowledgement, pending data is discarded after expiry; the previous active generation remains usable.

**Important compatibility finding:** The existing `acknowledge_vault_recovery_code(p_user_id)` RPC promotes only `recovery_code_hash` and `recovery_code_salt`. It does not atomically promote an Authenticator Vault recovery-wrapped VDK (or a new password wrapper). It must not be reused as the finalization step for this design. A separately reviewed transactional finalization operation and matching pending fields/state are required. Do not modify the existing RPC until that design is approved.

## 7. Concurrency, expiry, and idempotency rules

- Every envelope/factor update supplies `expected_version`; update succeeds only if the stored version matches, then increments it.
- Factor update/delete also checks owner ID, factor ID, and expected version.
- Recovery claims use an unguessable random claim token, short bounded lease, and atomic conditional update.
- Staging and finalization use a unique operation ID. Duplicate requests with the same completed operation ID return the prior outcome without repeating state transitions.
- A stale operation ID, expired claim, mismatched version, or claim owned by another attempt fails closed.
- Pending ciphertext is never treated as active data.
- Expiry cleanup must be safe to run more than once and must never delete the active generation.
- Do not expose whether a Recovery Code matched through different response bodies, timing-sensitive details, or account enumeration.

## 8. Test plan

### Cryptography and format

- RFC 6238 known-answer vectors for SHA-1, 6 digits, 30-second period.
- Correct TOTP at time-step boundaries; previous/next-step tolerance only within the documented skew.
- Reject malformed Base32, unsupported algorithms, invalid digit counts, and invalid periods.
- AES-GCM round trip with fresh IV; reject altered ciphertext, IV, tag, or AAD.
- Reject cross-user, cross-factor, cross-provider, and cross-purpose ciphertext substitution.
- Verify KDF parameters against strict server-side allowlists and resource bounds; reject oversized or unsupported parameters before expensive derivation.
- Confirm browser and server never receive or log plaintext VDK, TOTP seed, backup codes, derived keys, or Recovery Code.
- Verify exact encoding/length limits for ciphertext, IV, tag, salt, and serialized backup-code bundle.

### Enrollment and factor management

- Successful enrollment requires valid first TOTP before persistence.
- Invalid first code, expired enrollment, duplicate Google subject, and persistence failure do not create an ACTIVE factor.
- Multiple Google identities can have separate factors for one Vault user.
- Gmail OAuth revocation does not remove or disable a saved authenticator factor.
- Disable, re-enable, and delete require correct ownership and the required reauthentication.
- Backup-code reveal/copy/mark-used operations require an unlocked vault; used codes cannot be marked unused without an explicit replacement workflow.

### Password and Recovery Code lifecycle

- Correct Master Password unwraps VDK; wrong password does not.
- Correct current Recovery Code unwraps VDK; wrong, expired, replayed, and already-used codes fail.
- Password change rewraps the same VDK and leaves recovery wrapper valid.
- Recovery Code rotation keeps old pair active until acknowledgement.
- Acknowledgement promotes verifier and recovery wrapper atomically.
- Simulate failure between every stage and prove no mixed generation can become active.
- Expired pending rotation leaves old active pair valid.
- Lost-device recovery stages all new wrappers and verifier, then promotes all of them atomically.
- Lost response after finalization is safe to retry using operation ID.
- Old Recovery Code is rejected only after successful atomic promotion.
- If both credentials are lost, no server-side recovery bypass exists.

### Concurrency and authorization

- Two simultaneous recovery claims: exactly one succeeds.
- Two simultaneous factor updates with same expected version: exactly one succeeds.
- Stale version, stale claim token, wrong operation ID, and expired lease cannot overwrite active state.
- Cross-user read/write/update/delete attempts fail even when IDs are guessed.
- Browser roles have no direct table privileges; service routes enforce authenticated session ownership.
- Rate limiting applies to password, Recovery Code, TOTP verification, and recovery claim attempts.
- Audit events contain event type/outcome only and never secret values or Gmail message content.

### Operational and UX

- Lock clears in-memory VDK and derived keys; inactivity, sign-out, and tab close trigger best-effort cleanup.
- UI warns that browser memory cannot be guaranteed securely erased.
- Clock drift is explained without disclosing seed material.
- Recovery Code is shown only at creation/rotation and is not recoverable from server plaintext.
- Accessibility, mobile QR/manual setup, clipboard confirmation, and interrupted-flow recovery are tested.
- No success message appears before persistence/finalization is confirmed.

## 9. Approval gates before implementation

- [ ] Select and pin a maintained browser KDF implementation after independent review and Android/desktop benchmarks.
- [ ] Approve KDF parameter bounds and migration/version policy.
- [ ] Approve canonical AAD encoding and envelope/factor version strategy.
- [ ] Design pending recovery fields and a new atomic finalization transaction; preserve existing recovery behavior until separately approved.
- [ ] Add optimistic version columns/guards to the SQL design.
- [ ] Review exact SQL against the repository's existing schema and run it only in a disposable test database after approval.
- [ ] Implement crypto unit tests and database integration tests before UI wiring.
- [ ] Complete focused security review before any production migration.

## 10. Explicitly out of scope

- Applying SQL to Supabase or moving the draft into `supabase/migrations/`.
- Changing existing Recovery Code RPCs or current Vault sign-in/recovery behavior.
- Changing Gmail OAuth scopes or Gmail management permissions.
- Merging into `main`, creating a production deployment, or changing production data.
- Claiming that this app can approve Google Prompts, bypass Google's identity checks, or retrieve Google backup codes through Gmail API.
