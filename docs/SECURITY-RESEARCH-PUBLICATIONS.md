# Security Research Publications

## Purpose

Publish evidence-backed cybersecurity research produced by authorized testing in the owner-only Private Security Lab. Publications help the public understand security engineering, attack and defense concepts, measured outcomes, and remediation without exposing systems or people to unnecessary risk.

This is a planned publication workflow. A test result is not a research paper until it has been reviewed and approved.



## Bilingual publication requirement

Every public research paper must have two substantive editions:

- **English edition (en):** the technical reference edition, with precise terminology, methodology, evidence references, and standards citations.
- **Burmese edition (my):** a complete Burmese-language edition for public accessibility. Keep essential English technical terms in parentheses on first use where this improves precision.

The two editions must communicate the same scope, findings, severity, confidence, limitations, and remediation status. Do not allow a translated edition to make stronger claims than the reviewed technical source. A fluent Burmese technical reviewer must review terminology and meaning before release. If translation review is incomplete, label that language edition as a draft and do not present it as an approved translation.

Each publication must have one publication ID and version shared by both language editions. Web and PDF versions must carry the same ID, version, and release status.

A bilingual authoring template is available at [docs/research-templates/SECURITY-RESEARCH-PAPER-BILINGUAL-TEMPLATE.md](./research-templates/SECURITY-RESEARCH-PAPER-BILINGUAL-TEMPLATE.md).

## Public research library route

The planned public library route is `/security/research`. It may show the publication policy and an honest empty state while no papers have passed review. It must not display placeholder or fabricated findings as real research. PDF generation and downloads remain planned until implemented and verified.

## Publication lifecycle

1. **Draft** — Create a paper from a completed, identifiable test run.
2. **Technical review** — Verify the methodology, environment, telemetry, measurements, conclusions, and reproducibility claims.
3. **Security and privacy review** — Remove credentials, tokens, personal data, private infrastructure details, raw sensitive logs, and operational exploit instructions. Unpatched vulnerabilities must not be disclosed in actionable detail.
4. **Owner approval** — Require explicit owner approval before publication.
5. **Publish** — Publish the approved web article and downloadable PDF.
6. **Maintain** — Version corrections, add remediation and retest updates, and preserve the publication history.

No automatic publication directly from raw test logs is permitted.

## Required paper structure

Each publication should include:

- Title, publication ID, version, status, and publication date
- Abstract and research question
- Objective and technical background
- Authorized scope and explicit out-of-scope systems
- Test environment, software revision, configuration summary, and test-run ID
- Methodology and safe, reproducible test description
- Evidence references and telemetry summary
- Findings, confidence level, and severity rationale
- Defensive controls and remediation
- Retest procedure and result, when performed
- Limitations, assumptions, and unresolved questions
- References and standards
- Responsible disclosure notes, where applicable

Clearly distinguish **confirmed findings**, **observations**, **hypotheses**, and **not tested** items. Never imply that one passing test proves a system is secure overall.

## Evidence and provenance

Every factual test claim must map to a verified test run and its evidence. Record:

- Repository and exact commit
- Test-run identifier and timestamp
- Test module and version
- Environment type (isolated lab, CI, or approved device test)
- Scope and test-data classification
- Result status: PASS, FAIL, BLOCKED, or NOT RUN
- Evidence artifact identifiers and integrity hashes where available
- Reviewer and approval record

Public papers must use sanitized evidence summaries or redacted artifacts. Do not publish raw secrets, personal data, session material, production data, private endpoints, or unpatched exploit details.

## Publication formats and public library

The public Security & Transparency Dashboard should eventually provide:

- Searchable publication library with topic and date filters
- Individual web article pages with table of contents
- Downloadable PDF editions
- Publication version and correction history
- Links between papers, approved test reports, and remediation records
- Clear labels for draft, reviewed, approved, and published states

Only approved and published items are visible publicly. Drafts, reviewer comments, raw evidence, and the private lab remain owner-only.

## Research quality and safety rules

- Use only systems and environments explicitly authorized for testing.
- Prefer synthetic data and isolated fixtures.
- Describe attack techniques at a level that supports learning and defense without providing instructions that enable abuse of third-party systems.
- Coordinate responsible disclosure before discussing vulnerabilities in third-party products.
- Do not publish actionable details of an unpatched vulnerability.
- State the limits of the test, including what was not tested.
- Never use words such as “unhackable” or claim a certification or independent audit that has not occurred.
- A public demonstration must be driven by genuine, verified test events; illustrative visuals must be labeled as illustrative.

## Initial research categories

- Authentication, passkeys, and session security
- Client-side encryption and key management
- API authorization and access isolation
- Browser and application security controls
- Software supply-chain integrity
- Post-quantum cryptography evaluation
- Security telemetry, detection, and incident response

## Implementation status

**Planned / not yet implemented as a complete publication system:**

- Research paper authoring and metadata schema
- Review and owner-approval workflow
- Evidence-to-test-run provenance validation
- Public searchable publication library
- Web article rendering
- PDF generation and download
- Versioning, corrections, and publication history

This document defines the requirements; it does not claim that these features are already implemented or that any paper has been published.
