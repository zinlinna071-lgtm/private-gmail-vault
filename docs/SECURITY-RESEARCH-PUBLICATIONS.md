# Security Research Publications

## Purpose

Publish evidence-backed cybersecurity research produced by authorized testing in the owner-only Private Security Lab. Publications help the public understand security engineering, attack and defense concepts, measured outcomes, and remediation without exposing systems or people to unnecessary risk.

A test result is not a research paper until it has been reviewed and approved. Raw test output must never flow directly into the public registry.

## Bilingual publication requirement

Every public research paper must have two substantive editions:

- **English edition (en):** the technical reference edition, with precise terminology, methodology, evidence references, and standards citations.
- **Burmese edition (my):** a complete Burmese-language edition for public accessibility. Keep essential English technical terms in parentheses on first use where this improves precision.

The two editions must communicate the same scope, findings, severity, confidence, limitations, remediation, and retest status. A fluent Burmese technical reviewer must review terminology and meaning before release. If translation review is incomplete, the paper must not be published.

Each publication has one publication ID and version shared by both language editions.

## Public research library

The public library route is `/security/research`. It displays only entries in the validated published registry. An honest empty state is required while no paper has passed all gates. No placeholder or fabricated findings may appear as real research.

Individual web articles are implemented. PDF generation, downloads, version history, and corrections are not yet implemented.

## Publication lifecycle

1. **Draft** — Create a paper from a completed, identifiable test run.
2. **Technical review** — Verify methodology, environment, telemetry, measurements, conclusions, and reproducibility.
3. **Security and privacy review** — Remove credentials, tokens, personal data, private infrastructure details, raw sensitive logs, and operational exploit instructions. Unpatched vulnerabilities must not be disclosed in actionable detail.
4. **Bilingual review** — Confirm both language editions are substantively equivalent.
5. **Owner approval** — Require explicit owner approval before publication.
6. **Publish** — Publish the approved web article. PDF publication remains future work.
7. **Maintain** — Version corrections, add remediation and retest updates, and preserve history when versioning is implemented.

No automatic publication directly from raw test logs is permitted.

## Required paper structure

Each publication must include:

- Title, publication ID, version, status, and publication date
- Research question and objective
- Authorized scope and explicit exclusions
- Test environment, runtime, harness, data classification, exact commit, and test-run ID
- Methodology and safe, reproducible test description
- Sanitized evidence references and integrity hashes where available
- Findings classified as confirmed, observation, hypothesis, or not tested
- Severity and confidence for each finding
- Defensive controls and remediation status, with exact commit when implemented
- Retest status, exact run ID and commit when a retest was performed
- Limitations, assumptions, and unresolved questions
- References and standards
- Four recorded approvals: technical, security/privacy, bilingual, and owner

Clearly distinguish **confirmed findings**, **observations**, **hypotheses**, and **not tested** items. A finding must reference evidence. Never imply that one passing test proves a system is secure overall.

## Evidence and provenance

Every factual test claim must map to a verified test run and evidence. Record:

- Repository and exact commit
- Test-run identifier and timestamp in the source record
- Test module and version
- Environment type (isolated lab, CI, or approved device test)
- Scope and test-data classification
- Result status: PASS, FAIL, BLOCKED, or NOT RUN
- Evidence artifact identifiers and integrity hashes where available
- Review approval dates

The current public schema validates the presence and consistency of provenance references, evidence IDs, approval gates, HTTPS links, and retest/remediation metadata. It does not independently query GitHub or cryptographically verify remote evidence at publication time; that server-side verification remains a separate implementation requirement.

Public papers must use sanitized evidence summaries or redacted artifacts. Do not publish raw secrets, personal data, session material, production data, private endpoints, or unpatched exploit details.

## Research quality and safety rules

- Use only systems and environments explicitly authorized for testing.
- Prefer synthetic data and isolated fixtures.
- Describe attack techniques at a level that supports learning and defense without providing instructions that enable abuse of third-party systems.
- Coordinate responsible disclosure before discussing vulnerabilities in third-party products.
- Do not publish actionable details of an unpatched vulnerability.
- State test limitations, including what was not tested.
- Never claim “unhackable”, independent audit, or certification without substantiation.
- Public demonstrations must use genuine, verified test events; illustrative visuals must be labeled illustrative.

## Initial research categories

- Authentication, passkeys, and session security
- Client-side encryption and key management
- API authorization and access isolation
- Browser and application security controls
- Software supply-chain integrity
- Post-quantum cryptography evaluation
- Security telemetry, detection, and incident response

## Implementation status

**Implemented:**
- Runtime schema for bilingual publication metadata, scope, environment, provenance, evidence, findings, remediation, retest, limitations, and review approvals
- Validation for evidence references, unique IDs, HTTPS links, and exact commits for implemented remediation/completed retests
- Public searchable-ready library shell, honest empty state, and individual web article rendering
- Automated tests for publication validation

**Not yet implemented:**
- Private authoring interface and persistent draft workflow
- Independent GitHub run/commit/evidence verification at publish time
- Reviewer identity and approval audit trail storage
- PDF generation and download
- Versioning, corrections, and publication history

The current registry intentionally remains empty. No research paper is published by this change.
