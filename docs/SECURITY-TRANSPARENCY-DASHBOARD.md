# Security Transparency Dashboard

**Status:** Architecture and publication policy  
**Branch:** `feature/vault-authentication`  
**Audience:** Public, read-only  
**Execution access:** Private Security Lab only  
**Production impact:** None; this document does not authorize a deployment, public route, production data access, or live security testing.

## 1. Product decision

The project will have two strictly separated surfaces:

1. **Private Security Lab** — the owner and authorized testing workflow execute security checks against isolated, non-production fixtures and services.
2. **Public Security Transparency Dashboard** — visitors can observe approved test activity, verified outcomes, methods, limitations, remediation history, and supporting evidence. Visitors cannot launch tests, submit payloads, access the lab, or interact with real vault data.

This is a public transparency/reporting surface, not a public penetration-testing playground.

## 2. Public dashboard experience

The dashboard may use polished motion design and animated visualizations:
- A test-run timeline showing queued, running, completed, failed, and blocked states.
- Attack-path animations illustrating the *documented test scenario* and the defensive control that handled it.
- Module views for authentication, session handling, encryption, authorization/isolation, API validation, browser defenses, and recovery.
- Result cards showing PASS, FAIL, BLOCKED, or NOT RUN.
- A security history showing when a finding was discovered, fixed, retested, and verified.
- A methods and evidence section linking to sanitized reports, test IDs, commit identifiers, CI run records, and relevant documentation.
- A clear scope/limitations panel stating what the test does and does not prove.

Animation must be honest: it must be driven by a real test run or explicitly labeled as an explanatory visualization. Never show a simulated animation as a live attack, live scan, real-time threat, or verified result if no corresponding test actually ran.

## 3. Publication pipeline

Private Lab -> test result artifact -> validation and secret redaction -> human approval -> public sanitized report -> read-only dashboard.

No private test output is published automatically without validation. Public records must be immutable/versioned or have an auditable revision history.

Each published result should contain:
- Test ID and title.
- Category and objective.
- Test method at a safe, reproducible level.
- Environment and scope (for example, isolated local fixture or hosted CI browser).
- Exact application commit and test-harness version.
- Execution timestamp.
- Expected behavior and observed outcome.
- Status: PASS, FAIL, BLOCKED, or NOT RUN.
- Evidence link, such as a public CI run or sanitized report.
- Limitations and follow-up/remediation status.

A PASS means only that the named test passed in the stated environment and revision. It is not proof of complete security, absence of vulnerabilities, or certification.

## 4. Information that must never be public

Do not publish:
- Passwords, Master Passwords, OTPs, recovery codes, session cookies, access/refresh tokens, API keys, encryption keys, or raw key material.
- Real user data, real account identifiers, private email addresses, database rows, or production secrets.
- Raw request/response bodies if they may contain sensitive values.
- Exploit payloads that enable attacks against real third-party systems.
- Unpatched vulnerability details before a safe remediation/disclosure decision.
- Private endpoint URLs, internal hostnames, deployment secrets, environment values, or infrastructure details that increase exposure.
- Logs, screenshots, crash dumps, or browser traces before redaction review.

Use synthetic identities and fixtures for every demonstration.

## 5. Trust and security controls

- Dashboard is read-only: no test-trigger endpoints, shell, arbitrary URL fetch, user-provided code, upload, or mutation actions.
- Publish data as sanitized static artifacts or through a narrowly scoped read-only API.
- Do not expose the Private Lab route, API, credentials, cookies, database, storage, or secrets to the public site.
- Prefer separate deployment projects and separate Supabase projects/databases for lab and production; do not share auth cookies, keys, buckets, or privileged credentials.
- Enforce private lab access on the server for every route and API, not merely through hidden links or client-side guards.
- Use least privilege, rate limiting, security headers, no-store for sensitive lab views, and audit logging.
- Public dashboard must not reveal private lab controls or allow visitors to infer secret values from test output.
- Public content must be reviewed before publication.

## 6. Reporting language

Use precise language:
- "This check passed on commit X in environment Y."
- "This issue was reproduced in the isolated test environment."
- "Fix verified by test Z."
- "Not tested on real Android/iOS devices."
- "This result does not constitute an independent security audit."

Avoid:
- "Unhackable", "100% secure", "military-grade" without a precise, substantiated claim, "no hacker can break it", or arbitrary security percentages.
- "Live attack" or "live protection" for pre-recorded or illustrative animations.
- Presenting a unit test as a penetration test, or a CI compatibility test as an independent audit.

## 7. Current evidence baseline (2026-11-07)

The isolated Argon2id candidate compatibility harness has:
- Passed the RFC 9106 §5.3 known-answer test and four input-mutation checks in Node.js CI run [42272387331](https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42272387331).
- Passed the same vector and mutations in hosted Chromium in run [42281120467](https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42281120467).
- Passed the expanded Chromium, Firefox, and WebKit browser-engine run [42281411743](https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42281411743).

These results verify a candidate KDF library's compatibility in the named test environments only. They do not approve production KDF parameters, prove mobile performance, or establish end-to-end Vault security.

Current application limitations that must be disclosed until fixed:
- The Master Password is still used as the Supabase Auth password.
- Vault records are still decrypted server-side by the current API.
- Client-side encryption and key-envelope utilities are not yet integrated into the full user flow.
- Recovery remains a server-side legacy flow and is not yet a zero-knowledge recovery design.
- Real Android/iOS performance and memory testing is outstanding.
- No independent security audit has been completed.

## 8. Delivery stages

### Stage A — reporting contract
- Maintain this document and a structured result schema.
- Use CI run records and sanitized evidence as the initial source of truth.
- Keep the public dashboard unimplemented until publication data is stable.

### Stage B — private test orchestration
- Finish safe, isolated, repeatable test harnesses.
- Keep real production data and credentials out of the lab.
- Verify every result against exact commit and environment.

### Stage C — public read-only visual dashboard
- Build an animated, responsive, accessible dashboard using only approved sanitized reports.
- Show when an animation is illustrative versus tied to a real run.
- Show test scope, result, evidence, limitations, and remediation status together.
- No public test controls or arbitrary test inputs.

### Stage D — controlled publication
- Require review/approval before each report is published.
- Add a documented correction and withdrawal process.
- Consider independent third-party review before making broader security claims.

## 9. Release gates

Do not publish the dashboard as a reliable security-status source until:
- The report schema and redaction process are implemented and tested.
- Public read-only access is separated from the private lab.
- Test results are bound to exact commit and environment identifiers.
- Failed, blocked, stale, and untested checks are visible rather than hidden.
- Every animation is clearly tied to evidence or labeled illustrative.
- Current architecture limitations are prominently disclosed.
