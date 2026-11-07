# Private Research Authoring and Review Workflow

## Workflow

The private authoring API stores drafts separately from the public publication registry. Drafts are never returned by public Research Library pages.

Approval order is strictly sequential:

1. Draft created by the configured owner.
2. Technical review by an assigned reviewer.
3. Security and privacy review by an assigned reviewer.
4. English/Burmese equivalence review by an assigned reviewer.
5. Final owner approval.
6. Marked READY_TO_PUBLISH for a separate publication release.

Reviewers are assigned through the server-side reviewer UUID allowlist. Technical, security/privacy, and bilingual approvals must come from different reviewer accounts; authors cannot approve their own reviews. Each decision is appended to review history rather than overwritten. A reviewer may approve or request changes. A changes-requested decision returns the draft to DRAFT; the author must update and resubmit it. Technical, security/privacy, and bilingual reviewers cannot approve their own authored draft. Owner approval is a separate final gate.

## Access configuration

Set the following server-only environment variables in the intended preview environment:

- `SECURITY_RESEARCH_OWNER_USER_ID`: exact Supabase Auth UUID of the research owner.
- `SECURITY_RESEARCH_REVIEWER_USER_IDS`: comma-separated Supabase Auth UUIDs assigned to technical, security/privacy, and bilingual review.

If the owner ID is missing or invalid, the workflow fails closed. Reviewer IDs are not accepted from request bodies. Never expose these values to client-side environment variables.

The current API supports:
- `GET/POST /api/security/research/drafts`
- `GET/PATCH /api/security/research/drafts/:id`
- `POST /api/security/research/review`

All mutations require same-origin JSON requests and an authenticated session. Owner draft reads and writes are scoped to the owner; reviewers see only their review queue and the sanitized draft content required for review. Review decisions require configured reviewer identity. The database table is service-role only with RLS enabled and no grants to anon/authenticated roles.

## Draft contents

The strict schema requires a bilingual research question, objective, explicit authorized scope and exclusions, environment, test-run ID, exact commit, result, sanitized HTTPS evidence references, evidence-linked findings, remediation, retest, limitations, complete English and Burmese editions, and references.

Only sanitized summaries and artifacts belong in the workflow. Do not submit raw webhook payloads, passwords, OAuth tokens, recovery codes, private keys, session cookies, production personal data, or unredacted exploit details.

## Publication boundary

READY_TO_PUBLISH is not the same as published. The current public library is a validated, code-reviewed registry. A ready draft must be converted into a complete publication record, verified against canonical CI/lab evidence, reviewed for sensitive data, and added through a reviewed feature-branch commit before the public site can show it.

This separation prevents a compromised authoring endpoint or incomplete review from dynamically exposing a paper. The workflow does not automatically deploy or publish anything.

## Database migration

Migration: `supabase/migrations/202611070002_security_research_workflow.sql`

It has been added to the feature branch but is not automatically applied to any Supabase project. Apply it only to the intended non-production/preview project after owner approval and backup. The preview feature requires the server-side owner/reviewer environment variables above.
