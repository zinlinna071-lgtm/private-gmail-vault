# Authentication Error Disclosure Review

Date: 2026-11-07
Branch: `feature/vault-authentication`
Review type: Source remediation and mocked regression tests

## Observation

The Login, Registration, and Recovery route catch blocks previously returned `error.message` directly to the client. Unexpected errors from Supabase, database operations, crypto helpers, or runtime configuration could therefore disclose internal diagnostic details.

## Remediation

The three route handlers now return stable generic messages with HTTP 500 for unexpected exceptions:

- Login: `Unable to complete sign-in. Please try again.`
- Registration: `Unable to create the Vault account. Please try again.`
- Recovery: `Unable to complete account recovery. Please try again.`

Known protocol outcomes continue to use their existing explicit status codes and safe messages (for example invalid credentials, rate limiting, invalid request format, and recovery state conflicts).

No raw exception text is returned by these catch blocks. This change does not add server-side logging; do not add diagnostic logging until a redaction policy is implemented and tested.

## Regression coverage

New mocked route tests inject synthetic internal exception strings into Login, Registration, and Recovery. Each test asserts a generic response and verifies the internal exception text is absent from the response body.

## Limitations

- This is source-level remediation plus mocked route coverage, not a live Supabase provider test.
- No production credentials, live database, or real user records were used.
- No production configuration, migration, deployment, merge, or Search Console action was performed.
- CI must pass on the exact commit before this remediation is called verified.

## Follow-up correction — Recovery input validation status

A subsequent source review found that the Recovery route called `validatePassword()` inside the broad exception handler. A normal user input error was therefore being returned as HTTP 500 instead of a client validation response. The route now catches Login ID and Master Password validation failures locally and returns safe HTTP 400 messages without exposing exception text or contacting the account database for an invalid password. A mocked regression test covers the invalid Master Password path.

This remains source-level and mocked coverage. The equivalent Login and Registration validation paths should be checked for consistent client-error handling in a separate follow-up.
