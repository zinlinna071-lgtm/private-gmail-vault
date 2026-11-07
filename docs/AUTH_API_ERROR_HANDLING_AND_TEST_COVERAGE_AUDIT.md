# Authentication API Error Handling and Test Coverage Audit

Date: 2026-11-06
Branch: `feature/vault-authentication`
Scope: Read-only audit of the existing authentication API routes, shared auth helpers, Vitest configuration, and current test inventory.

## Scope and safety boundary

This document records code-level findings only. No application code, database schema, Supabase project, live account, or production deployment was changed as part of this audit. The audit does not prove that any failure has occurred in a real account.

## Verified test inventory

The branch contains `vitest.config.mts` (not `vitest.config.ts`) and configures Vitest to discover `tests/**/*.test.ts` in the Node environment.

The `tests/` directory currently contains six test files:

- `tests/auth-primitives.test.ts`
- `tests/auth-routes.test.ts`
- `tests/recovery-route.test.ts`
- `tests/recovery-acknowledgement-route.test.ts`
- `tests/rate-limit.test.ts`
- `tests/gmail-token-encryption.test.ts`

The tests cover credential validation and hashing, same-origin checks, pending recovery-code encryption, registration/login route behavior, recovery and acknowledgement route behavior, and rate-limit identity selection. The CI workflow runs `npm test`, typecheck, and production build after dependency installation.

Correction to an earlier preliminary note: the absence of `vitest.config.ts` and a route-specific test file at `app/api/auth/recovery/route.test.ts` does not mean the project lacks test configuration or recovery tests. The actual config is `vitest.config.mts`, and route tests are organized under `tests/`.

## Findings

### 1. Raw exception messages can reach API clients

The catch blocks in these routes serialize `error.message` into the JSON response:

- `app/api/auth/register/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/recovery/route.ts`

Some expected validation errors are intentionally user-readable, but unexpected provider, database, or configuration exceptions may reveal implementation details. The API should distinguish known safe validation errors from unexpected failures and return stable, generic client messages for the latter. Detailed diagnostics, if needed, should be recorded server-side only after secret and personal-data redaction.

The acknowledgement route already uses a generic catch response, which is the safer pattern.

### 2. Recovery test codifies the unsafe post-password-update release behavior

`tests/recovery-route.test.ts` includes the test named:

`releases the claim if staging fails after the password update`

It asserts that `release_vault_recovery` is called after `updateUserById` succeeds but `finish_vault_recovery` does not successfully stage the replacement Recovery Code.

This is not merely missing test coverage: the test explicitly preserves the risky behavior identified in the separate recovery failure-window audit. A future state-machine redesign must replace this expectation with failure-injection tests that prove an operation remains recoverable after the external Auth password update may have succeeded. Do not change this test in isolation before the replacement recovery protocol is designed and reviewed.

### 3. Error paths need explicit regression coverage

The current route tests cover important success and selected failure cases, but the following cases should be added to the future recovery-protocol test plan:

- Unexpected exceptions in Register, Login, and Recovery return generic client-safe errors.
- Failure to read the recovery profile does not proceed as though the profile were valid or absent.
- Failure or timeout after the Auth provider update begins leaves a durable, reconcilable operation state.
- Retrying the same operation does not generate a second replacement Recovery Code or repeat a non-idempotent provider action.
- Responses and server diagnostics do not contain Master Passwords, Recovery Codes, OAuth tokens, encryption keys, or service credentials.
- Pending-code acknowledgement is bound to the authenticated owner and the exact pending operation/version.

These are recommendations for the redesigned flow, not claims that the current tests execute these scenarios.

### 4. Rate-limit fallback identity requires deployment verification

`lib/auth/rate-limit.ts` intentionally does not trust `x-forwarded-for`. It prefers `x-real-ip`, then `x-vercel-forwarded-for`, and otherwise uses the literal fallback `unknown`.

This avoids accepting a client-controlled forwarding header, but if the deployed proxy does not provide either trusted header, requests can share the same IP bucket. Verify the actual hosting header behavior in a disposable environment before changing this logic. Do not broaden trust to arbitrary forwarding headers.

### 5. Existing test coverage is not equivalent to an end-to-end provider test

The inspected route tests mock Supabase clients and RPC calls. They are useful deterministic unit/API tests, but they do not establish the real Supabase Auth behavior for same-password retries, ambiguous network failures, session cookies, or transaction boundaries across Auth and Postgres. Those behaviors still require a separate disposable Supabase project and controlled failure-injection testing.

## Recommended remediation order

1. Keep the legacy recovery endpoint unchanged while the new recovery operation state machine is specified.
2. Design safe error categories and redacted server-side diagnostics; avoid exposing raw unexpected exception messages.
3. Design the new recovery protocol and its durable operation states before changing the claim-release test.
4. Add deterministic failure-injection tests for every transition and ambiguous provider outcome.
5. Validate proxy identity headers and actual Supabase Auth retry semantics only in a disposable project.
6. Run the full CI workflow and review the resulting checks before any merge request is considered.

## Current conclusion

The project has a real Vitest setup and a meaningful initial test suite. The highest-priority issues are not the absence of tests: they are the raw exception-message responses and a recovery test that currently codifies the known unsafe failure window. No production or active Supabase changes are authorized by this audit.
