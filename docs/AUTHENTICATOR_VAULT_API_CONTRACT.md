# Authenticator Vault API Contract

**Status:** Proposed API contract for review. No routes are implemented by this document.
**Branch:** `feature/vault-authentication`
**Scope:** Authenticator TOTP + Google backup-code vault, including its independent recovery lifecycle.
**Compatibility:** Preserve existing Vault login, Gmail OAuth/API routes, and legacy Recovery Code endpoints. Do not reuse the legacy acknowledgement RPC for Authenticator Vault finalization.

## 1. Purpose and implementation boundary

This contract translates the existing Authenticator Vault design, SQL draft, state machine, and atomic-finalization design into route-level behavior that fits the current Next.js App Router project.

The API stores and returns encrypted material only. Browser code generates the random Vault Data Key (VDK), derives wrapping keys, encrypts/decrypts TOTP seeds and backup-code collections, and generates TOTP values. The server authenticates the Vault user, validates request shape and cryptographic metadata bounds, stores ciphertext, and performs atomic state transitions.

This document does not authorize implementation, migration, production configuration changes, merge, or deployment.

## 2. Existing repository conventions verified

The current feature branch uses:

- Next.js App Router route handlers under `app/api/**/route.ts`.
- `createSupabaseServerClient()` from `lib/supabase/server.ts` and `supabase.auth.getUser()` to validate the cookie-backed Vault session.
- `createSupabaseAdminClient()` from `lib/supabase/admin.ts` for privileged database operations after authentication and owner scoping.
- `isSameOriginRequest()` for browser-originated state-changing auth/recovery requests.
- `allowAuthAttempt()` for database-backed rate limits.
- `Cache-Control: no-store` and `Pragma: no-cache` in existing auth/recovery responses.
- Stable machine-readable error identifiers in Gmail APIs; auth APIs often return a safe human-readable `error` string.

Current route behavior relevant to this design:

1. `POST /api/auth/login` signs in through Supabase Auth, then reads pending Recovery Code material.
2. `POST /api/auth/recovery` currently starts without a Vault session: it verifies Login ID + Recovery Code, claims recovery, updates the Supabase Auth password, stages a pending replacement Recovery Code, and signs in.
3. `POST /api/auth/recovery/acknowledge` requires an authenticated session and calls the legacy `acknowledge_vault_recovery_code(p_user_id)` RPC.
4. Gmail routes authenticate the cookie session, query Gmail connections using `user_id = session user.id`, and keep refresh tokens server-side.
5. The admin Supabase client is marked server-only and uses the server secret/service-role credential. It must never be imported into client code.

**Important recovery distinction:** the new Authenticator recovery protocol must support a pre-session claim because a user who lost the Master Password cannot already have a valid Vault session. After the new Master Password has been set, the browser signs in and completes the authenticated finalization step.

## 3. Shared API rules

### 3.1 Authentication and ownership

- Envelope and factor CRUD routes require a valid Vault session resolved by `supabase.auth.getUser()`.
- Derive `user_id` exclusively from the authenticated session. Never accept a caller-supplied `user_id` as authority.
- Every service-role query, insert, update, and delete must include the session user's ID or be performed by an RPC that verifies the owner internally.
- Factor IDs and operation IDs are identifiers, not authorization credentials.
- Recovery claim is the one exception to normal session authentication: it starts with Login ID + Recovery Code and must be protected by a short-lived, opaque recovery-operation handle after successful verification.
- Recovery stage/finalize/abandon must prove possession of the operation handle and bind it to the same user and operation. Finalization additionally requires a newly authenticated Vault session.

### 3.2 Request protection

- All state-changing browser routes require POST/PATCH/DELETE as specified, JSON content type, and `isSameOriginRequest(request)`.
- Apply a dedicated rate-limit action for each operation, plus account/IP buckets. Do not trust arbitrary `x-forwarded-for`; follow the existing rate-limit helper's trusted proxy-header policy.
- Return `Cache-Control: no-store, max-age=0` and `Pragma: no-cache` for every endpoint carrying encrypted vault material, recovery state, or secret-adjacent metadata.
- Never place secrets, claim handles, or ciphertext in URLs, query strings, route params, analytics, telemetry, or audit-event payloads.
- Enforce request body size limits before parsing large encrypted backup-code bundles.
- Reject unknown fields or explicitly define a strict allowlist per request schema.
- Validate UUIDs, base64url encoding, ciphertext/IV/tag lengths, KDF name/version, allowed KDF parameter ranges, schema version, and expiry on the server. JSONB being an object is not sufficient KDF validation.
- Never log request bodies, passwords, Recovery Codes, claim handles, wrapped keys, TOTP seeds, backup codes, derived keys, or decrypted values. Use redacted structured error logging only.

### 3.3 Encryption boundary

- The browser generates a random 256-bit VDK.
- The browser encrypts TOTP seeds and the complete backup-code state collection with AES-256-GCM under the VDK.
- The browser wraps the VDK separately for Master Password and Recovery Code unlock paths.
- API payloads contain ciphertext, IV, authentication tag, KDF metadata, schema version, and concurrency version only.
- The server must not decrypt VDK, TOTP seed, backup codes, or user data ciphertext.
- A successful Vault session alone does not imply that the browser has unlocked the VDK. The UI must distinguish authenticated session from unlocked encrypted vault state.

### 3.4 Concurrency

- Every envelope/factor mutation carries `expectedVersion`.
- Updates must use compare-and-swap semantics: update only where the stored version equals `expectedVersion`, then increment exactly once.
- A stale version returns `409 version_conflict` with the current version only when safe; do not return secret material in an error.
- Backup-code used/unused state is inside the encrypted collection. The browser decrypts, updates one entry, re-encrypts the entire collection, then PATCHes the new ciphertext using CAS. The server must not accept plaintext code values or plaintext used-state arrays.

## 4. Proposed routes

These are proposed route names and contracts, not existing endpoints.

### 4.1 Read the key envelope

**GET `/api/authenticator-vault/envelope`**

Authentication: required.

Success `200`:

```json
{
  "envelope": {
    "schemaVersion": 1,
    "version": 4,
    "passwordWrapper": {
      "ciphertext": "<base64url>",
      "iv": "<base64url>",
      "authTag": "<base64url>",
      "kdf": {
        "name": "scrypt",
        "version": "<pinned-implementation-version>",
        "salt": "<base64url>",
        "parameters": {}
      }
    },
    "recoveryWrapper": {
      "ciphertext": "<base64url>",
      "iv": "<base64url>",
      "authTag": "<base64url>",
      "kdf": {
        "name": "scrypt",
        "version": "<pinned-implementation-version>",
        "salt": "<base64url>",
        "parameters": {}
      }
    }
  }
}
```

- Return `404 envelope_not_initialized` if no envelope exists.
- Return only the current user's wrappers.
- This response contains encrypted key material and must be no-store.
- Do not return a VDK, derived key, Master Password, Recovery Code, or plaintext factor.

### 4.2 Initialize an envelope

**POST `/api/authenticator-vault/envelope`**

Authentication: required; same-origin; rate-limited.

Purpose: create the initial VDK wrappers after the browser has generated the VDK and encrypted it separately under the Master Password-derived and Recovery Code-derived keys.

Request:

```json
{
  "schemaVersion": 1,
  "passwordWrapper": {
    "ciphertext": "<base64url>",
    "iv": "<base64url>",
    "authTag": "<base64url>",
    "kdf": {
      "name": "scrypt",
      "version": "<pinned-implementation-version>",
      "salt": "<base64url>",
      "parameters": {}
    }
  },
  "recoveryWrapper": {
    "ciphertext": "<base64url>",
    "iv": "<base64url>",
    "authTag": "<base64url>",
    "kdf": {
      "name": "scrypt",
      "version": "<pinned-implementation-version>",
      "salt": "<base64url>",
      "parameters": {}
    }
  }
}
```

Success `201`: `{ "version": 1 }`.

- Enforce one envelope per Vault user.
- A duplicate initialization returns `409 envelope_already_initialized`; do not overwrite an existing envelope.
- Do not accept a client-provided `userId` or initial `version`.
- Require the browser to verify local encrypt/decrypt round-trip before submission.

### 4.3 List authenticator factors

**GET `/api/authenticator-vault/factors`**

Authentication: required.

Success `200`:

```json
{
  "factors": [
    {
      "id": "<uuid>",
      "provider": "google",
      "googleSubject": "<stable Google subject>",
      "accountEmail": "<Google account email>",
      "label": "<optional user label>",
      "totp": {
        "ciphertext": "<base64url>",
        "iv": "<base64url>",
        "authTag": "<base64url>",
        "algorithm": "SHA1",
        "digits": 6,
        "periodSeconds": 30
      },
      "backupCodes": {
        "ciphertext": "<base64url>",
        "iv": "<base64url>",
        "authTag": "<base64url>"
      },
      "version": 2,
      "createdAt": "<ISO-8601>",
      "updatedAt": "<ISO-8601>",
      "disabledAt": null
    }
  ]
}
```

- Return encrypted factor payloads so the owner browser can unlock them locally.
- Omit `backupCodes` when none are stored.
- Do not return plaintext seed, TOTP value, backup codes, or decrypted per-code usage state.
- Do not require an active Gmail OAuth connection; Google factor records must remain usable if Gmail OAuth is revoked.
- The UI should mask account identifiers where practical.

### 4.4 Create a factor

**POST `/api/authenticator-vault/factors`**

Authentication: required; same-origin; rate-limited.

Request:

```json
{
  "provider": "google",
  "googleSubject": "<stable Google subject>",
  "accountEmail": "<Google account email>",
  "label": "<optional label>",
  "totp": {
    "ciphertext": "<base64url>",
    "iv": "<base64url>",
    "authTag": "<base64url>",
    "algorithm": "SHA1",
    "digits": 6,
    "periodSeconds": 30
  },
  "backupCodes": {
    "ciphertext": "<base64url>",
    "iv": "<base64url>",
    "authTag": "<base64url>"
  }
}
```

- `backupCodes` is optional and may be omitted until the user imports their Google-generated backup codes.
- Require the client to verify the first TOTP code during enrollment before it submits the encrypted seed.
- Do not accept an unverified factor state as active. If the implementation needs a pending enrollment record, define a separate explicit pending state and expiry rather than silently treating it as active.
- Success `201`: `{ "id": "<uuid>", "version": 1 }`.
- Duplicate `(user_id, provider, google_subject)` returns `409 factor_already_exists`.

### 4.5 Update a factor

**PATCH `/api/authenticator-vault/factors/{factorId}`**

Authentication: required; same-origin; rate-limited.

Request:

```json
{
  "expectedVersion": 2,
  "label": "<new optional label>",
  "totp": {
    "ciphertext": "<base64url>",
    "iv": "<base64url>",
    "authTag": "<base64url>",
    "algorithm": "SHA1",
    "digits": 6,
    "periodSeconds": 30
  },
  "backupCodes": {
    "ciphertext": "<base64url>",
    "iv": "<base64url>",
    "authTag": "<base64url>"
  }
}
```

- Only fields explicitly included are updated; define whether `backupCodes: null` means remove the bundle.
- Every update increments `version` once using CAS.
- Success `200`: `{ "id": "<uuid>", "version": 3 }`.
- Missing or foreign-owned factor returns the same `404 factor_not_found` response.
- Stale version returns `409 version_conflict`.
- The browser must encrypt a fresh IV for every new AES-GCM encryption.

### 4.6 Disable or delete a factor

**DELETE `/api/authenticator-vault/factors/{factorId}`**

Authentication: required; same-origin; rate-limited; recent reauthentication required by product policy.

Preferred initial behavior: soft-disable using `disabled_at`, incrementing the version with CAS. This preserves a clear recovery/audit lifecycle while making the factor unavailable in normal retrieval UI. Permanent deletion can be a separately confirmed action after recovery implications are shown.

Request:

```json
{ "expectedVersion": 3 }
```

Success `200`: `{ "success": true, "disabled": true, "version": 4 }`.

- Never delete a factor belonging to another user.
- Do not make a disabled factor available to normal TOTP/backup-code retrieval.
- If permanent deletion is later implemented, require explicit confirmation and a separate audited operation.

## 5. Authenticator recovery API

### 5.1 Start recovery claim (pre-session)

**POST `/api/authenticator-vault/recovery/claim`**

Authentication: no Vault session yet; this is the deliberate lost-password entry point. Same-origin and strict rate limiting are mandatory.

Request:

```json
{
  "loginId": "<Vault Login ID>",
  "recoveryCode": "<user-entered current Recovery Code>",
  "operationId": "<client-generated UUID>"
}
```

Server behavior:

1. Normalize and validate Login ID using the existing Vault rules.
2. Apply account/IP rate limits before expensive verification.
3. Read only the account's active Recovery Code verifier and the relevant Authenticator envelope version.
4. Verify the submitted Recovery Code using the current server verifier implementation.
5. Atomically claim the recovery operation only if no other unexpired claim exists for that user and active envelope version.
6. Generate a high-entropy opaque claim handle; store only a verifier/hash of that handle where feasible.
7. Bind claim to user ID, operation ID, expected envelope version, expiry, and state.
8. Return generic errors that do not disclose whether a Login ID exists or which recovery field failed.

Success `200`:

```json
{
  "operationId": "<uuid>",
  "claimHandle": "<opaque high-entropy value>",
  "expectedEnvelopeVersion": 4,
  "expiresAt": "<ISO-8601>"
}
```

**Recovery Code transport note:** the existing project stores a server-verifiable scrypt hash, so the current verification approach requires the entered Recovery Code to reach the server transiently over HTTPS. It must never be logged, persisted as plaintext, placed in a URL, or returned. A future proof-based protocol could avoid sending the raw code, but it requires a separately reviewed verifier/proof design; do not invent one inside implementation.

### 5.2 Stage recovery generation

**POST `/api/authenticator-vault/recovery/stage`**

Authentication: valid recovery claim handle; same-origin; strict rate limit. This route is called after the browser has unlocked the VDK using the old Recovery Code and created the new password/recovery wrappers.

Request:

```json
{
  "operationId": "<uuid>",
  "claimHandle": "<opaque high-entropy value>",
  "expectedEnvelopeVersion": 4,
  "newPassword": "<new Vault Master Password>",
  "pendingPasswordWrapper": {
    "ciphertext": "<base64url>",
    "iv": "<base64url>",
    "authTag": "<base64url>",
    "kdf": {
      "name": "scrypt",
      "version": "<pinned-implementation-version>",
      "salt": "<base64url>",
      "parameters": {}
    }
  },
  "pendingRecoveryWrapper": {
    "ciphertext": "<base64url>",
    "iv": "<base64url>",
    "authTag": "<base64url>",
    "kdf": {
      "name": "scrypt",
      "version": "<pinned-implementation-version>",
      "salt": "<base64url>",
      "parameters": {}
    }
  },
  "pendingRecoveryCodeVerifier": {
    "hash": "<server-generated-compatible verifier>",
    "salt": "<base64url-or-existing-format>"
  }
}
```

Server behavior:

- Validate claim ownership, operation ID, expiry, state, and expected active envelope version.
- Validate all wrapper/KDF fields and strict size bounds.
- Update the Supabase Auth Master Password using the established server-side admin mechanism. This means the new Master Password is transmitted to the server over HTTPS for the Auth password update; it must be handled transiently and never logged or stored outside Supabase Auth.
- The browser must derive the password wrapping key locally and submit only the resulting encrypted VDK wrapper. The server must not derive or receive the VDK.
- The Recovery Code verifier must be computed using the exact approved existing verifier format, or a separately versioned format with an explicit migration plan. Do not trust arbitrary client-selected hash parameters.
- Stage the pending wrappers and pending verifier without changing the active envelope wrappers or active Recovery Code verifier.
- Ensure the legacy pending-code columns/RPCs are not silently repurposed for this new protocol.

Success `200`: `{ "operationId": "<uuid>", "status": "staged", "expiresAt": "<ISO-8601>" }`.

### 5.3 Finalize recovery atomically

**POST `/api/authenticator-vault/recovery/finalize`**

Authentication: required. The browser must first sign in with the new Master Password after staging. Same-origin and rate-limited.

Request:

```json
{
  "operationId": "<uuid>",
  "claimHandle": "<opaque high-entropy value>",
  "expectedEnvelopeVersion": 4,
  "acknowledgement": "I_HAVE_SAVED_THE_NEW_RECOVERY_CODE"
}
```

Server/database behavior in one transaction:

1. Verify authenticated session user matches the recovery operation owner.
2. Verify claim handle, operation ID, staged state, expiry, and expected active version.
3. Verify all required pending wrapper and verifier fields are present and valid.
4. Promote the password wrapper, recovery wrapper, and Recovery Code verifier together.
5. Increment envelope version exactly once.
6. Mark the operation finalized and clear pending wrapper/verifier/claim material.
7. Commit; on any failure, roll back all changes.

Success `200`: `{ "operationId": "<uuid>", "status": "finalized", "envelopeVersion": 5 }`.

- Retry after a committed response-loss must return the already-finalized result without incrementing version again.
- A stale version, wrong owner, wrong handle, expired claim, or mismatched operation must fail closed.
- Do not call `acknowledge_vault_recovery_code(p_user_id)` from this route. That legacy RPC promotes only `vault_profiles.recovery_code_hash` and salt and does not atomically promote the Authenticator VDK wrappers.

### 5.4 Query recovery operation status

**GET `/api/authenticator-vault/recovery/operations/{operationId}`**

Authentication: valid recovery claim handle before sign-in, or authenticated session belonging to the operation owner after sign-in. The handle must be supplied in a protected header, not a URL/query string.

Success `200` returns only:

```json
{
  "operationId": "<uuid>",
  "status": "claimed",
  "expectedEnvelopeVersion": 4,
  "expiresAt": "<ISO-8601>"
}
```

Allowed statuses: `claimed`, `staged`, `finalized`, `abandoned`, `expired`.

Never return pending ciphertext, verifier hashes, Recovery Code, Master Password, or claim token.

### 5.5 Abandon or expire recovery

**POST `/api/authenticator-vault/recovery/abandon`**

Authentication: valid claim handle or authenticated owner session; same-origin.

Request:

```json
{
  "operationId": "<uuid>",
  "claimHandle": "<opaque high-entropy value>"
}
```

- Abandon only the caller's own unfinalized operation.
- Cleanup may remove only expired pending transition material.
- Active wrappers and active Recovery Code verifier must remain byte-for-byte unchanged.
- Operation is idempotent.
- A finalized operation cannot be abandoned.

## 6. Response and error contract

Use stable machine-readable codes for new endpoints:

| HTTP | Error code | Meaning |
|---|---|---|
| 400 | `invalid_request` | Invalid JSON or schema |
| 401 | `authentication_required` | Vault session missing/invalid |
| 403 | `invalid_origin` | Same-origin validation failed |
| 404 | `factor_not_found` / `envelope_not_found` | Resource absent or not owned |
| 409 | `version_conflict` | CAS version no longer current |
| 409 | `recovery_in_progress` | Another valid claim exists |
| 409 | `operation_state_conflict` | Operation cannot make requested transition |
| 429 | `rate_limit_exceeded` | Attempt limit reached |
| 503 | `vault_storage_unavailable` | Required database/RPC unavailable |
| 500 | `internal_error` | Unexpected server failure |

Response shape:

```json
{
  "error": {
    "code": "version_conflict",
    "message": "This item changed elsewhere. Refresh and try again."
  }
}
```

Do not expose SQL messages, Supabase service-role errors, account-existence hints, hashes, ciphertext, or stack traces.

## 7. Audit events

Audit only event metadata:

- `authenticator_envelope_initialized`
- `authenticator_factor_enrolled`
- `authenticator_factor_updated`
- `authenticator_factor_disabled`
- `authenticator_recovery_claimed`
- `authenticator_recovery_staged`
- `authenticator_recovery_finalized`
- `authenticator_recovery_abandoned`
- `authenticator_recovery_expired`

Allowed metadata: Vault user ID, factor ID, operation ID, event timestamp, result code, and version numbers where useful.

Forbidden audit content: passwords, Recovery Codes, claim handles, VDK, derived keys, TOTP seeds/codes, backup codes, decrypted state, ciphertext, or full request bodies.

## 8. Required tests before route implementation

### Authentication and isolation
- Missing/expired session cannot read or mutate envelope/factors.
- User A cannot read, update, disable, or delete User B's factor by guessing its ID.
- Caller-supplied `userId` is rejected/ignored and never overrides session identity.
- Recovery claim cannot be used for a different user or operation.

### Request and secret handling
- Cross-origin state-changing requests fail before database access.
- Rate limits cover account and trusted client IP; rate-limit backend failure fails closed.
- Invalid UUIDs, oversized payloads, malformed base64url, invalid IV/tag lengths, unsupported KDFs, and out-of-range KDF parameters fail safely.
- All encrypted-material responses are no-store.
- Tests assert no secrets appear in logs, errors, audit events, URLs, or returned metadata.

### Envelope and factors
- Envelope initialization is one-time and duplicate-safe.
- Wrong password/recovery key cannot decrypt the VDK in browser crypto tests.
- AES-GCM tampering and wrong AAD fail closed.
- TOTP RFC 6238 test vectors pass in browser crypto tests.
- Factor enrollment cannot become active before a valid TOTP proof.
- Factor reads remain independent of Gmail OAuth connection status.
- Stale factor/envelope versions return conflict and do not overwrite newer data.
- Concurrent backup-code bundle updates allow only one CAS write.
- Backup-code plaintext and per-code usage state never reach the server.

### Recovery lifecycle
- Correct Recovery Code obtains one claim; wrong code gets a generic failure.
- Concurrent claims produce exactly one winner per envelope generation.
- Expired/abandoned claims preserve the active generation.
- Stage cannot change active wrappers/verifier.
- Finalize promotes password wrapper, recovery wrapper, and verifier in one transaction.
- Injected failure at every promotion step rolls back all changes.
- Wrong owner/handle/operation, stale version, expired lease, and incomplete pending fields cannot finalize.
- Two concurrent finalize requests increment the version only once.
- Retry after response loss returns finalized status without a second rotation.
- Existing legacy Recovery Code registration, login, recovery, and acknowledgement tests continue to pass unchanged.

## 9. Implementation sequence and approval gates

1. Review this contract against the existing SQL draft and state-machine design.
2. Resolve the recovery verifier format and whether a separate transition table or pending columns will hold claim/staged state.
3. Approve and pin a maintained browser KDF implementation; benchmark Android and desktop.
4. Review canonical AAD, ciphertext encodings, parameter bounds, and claim-handle storage.
5. Review additive SQL/RPC design and failure-injection tests.
6. Only after explicit approval, add route implementation and unit/integration tests on this feature branch.
7. Review preview and security behavior.
8. Merge, deploy, and apply any migration only after separate explicit approval.

## 10. Explicit non-goals

- No approval of Google Prompt or trusted-device challenges.
- No bypass of Google's sign-in or account-recovery checks.
- No retrieval of Google backup codes from Gmail API.
- No expansion of Gmail OAuth scopes.
- No change to the existing Gmail inbox/message endpoints.
- No modification of legacy Recovery Code routes or RPCs in this contract.
- No database migration execution, production change, merge, or deployment.
