# Live Research Theater — Public Experience and Safety Architecture

**Status:** Architecture proposal for staged implementation  
**Branch:** `design/cyber-visual-architecture`  
**Audience:** Public, read-only observers and learners  
**Execution:** Owner-authorized private lab only  
**Production impact:** None. This document does not authorize deployment, production testing, database migration, or live third-party testing.

## 1. Product intent

Create a live, evidence-led cybersecurity research experience that combines:
- real authorized security testing that the public can watch;
- clear visual storytelling and meaningful motion;
- interactive research publications;
- safe puzzles and hands-on learning;
- public access to useful knowledge without requiring a donation.

The experience should be exciting because real engineering work is happening and is explained well—not because the interface invents attacks, counters, packets, alerts, or success states.

## 2. Public and private boundary

The platform has three distinct surfaces:

1. **Private Research Control Room**
   - Owner/reviewer-only.
   - Starts and controls bounded tests against explicitly allowlisted, isolated lab targets.
   - Uses synthetic accounts and disposable fixtures.
   - Displays full private diagnostics only to authorized operators.
   - Enforces authorization on every server route and action; hiding UI controls is not access control.

2. **Public Live Research Theater**
   - Read-only audience experience.
   - Receives a narrowly defined, sanitized event projection from an authenticated private-lab event source.
   - Can show the current session phase, approved high-level activity, safe visualizations, timestamps, and the published scope.
   - Cannot start tests, submit attack payloads, select arbitrary targets, access raw logs, or interact with private lab APIs.

3. **Public Learning & Research Studio**
   - Interactive articles, concept visualizations, synthetic-data exercises, puzzles, and safe browser-based labs.
   - Any exercise that executes code or security tests runs in a disposable sandbox with strict resource limits and no access to production credentials, user data, private services, or arbitrary third-party targets.

The public and private surfaces must not share privileged cookies, API credentials, database roles, storage permissions, or secrets. A separate deployment and data environment is preferred for public interactive exercises.

## 3. What "Live Hacking" means here

A session may be labelled **LIVE** only while an authorized test is actually executing and its authenticated event source is delivering current events.

Every session must disclose:
- session ID and title;
- owner-approved target identifier and environment class;
- explicit authorized scope and exclusions;
- test objective and high-level method;
- start time and timezone;
- event source and last-received timestamp;
- current phase and whether the feed is connected, delayed, or unavailable;
- completion status, evidence reference, and limitations.

Public-safe phases may include:
1. Scope confirmation
2. Reconnaissance of the isolated target
3. Controlled attack simulation
4. Detection and evidence capture
5. Defensive change
6. Retest
7. Session review and publication

Do not expose operational details that would enable attacks against real systems. Public storytelling should explain the security principle, observed behavior, and defensive lesson while keeping sensitive exploit mechanics, private endpoints, raw payloads, secrets, and unpatched vulnerability details private.

If the source disconnects, stop presenting the session as live. Show **FEED DELAYED** or **SOURCE DISCONNECTED** with the last verified event time. Do not extrapolate activity or fill gaps with generated events.

Recorded sessions must be labelled **RECORDED** with the original execution time. Explanatory animations must be labelled **ILLUSTRATIVE**. Synthetic exercises must be labelled **SIMULATED / DEMO DATA**. These labels must remain visible in cards, embeds, exports, and screenshots.

## 4. Event and evidence trust model

The existing `lib/security-lab/telemetry.ts` schema is a bounded event contract, not by itself an authenticated event transport or proof that an event occurred.

Before public live streaming:
- private runners must authenticate to a server-only ingestion endpoint;
- events must be integrity-protected (for example, signed batches or mutually authenticated transport with a server-verified run identity);
- each event must bind to a registered session, approved target, exact application commit, runner identity, and monotonic sequence;
- the server must reject unknown sessions, stale/replayed sequence numbers, malformed payloads, unapproved sources, and events outside the session's time window;
- idempotency and bounded event rates/batch sizes must be enforced;
- the public projection must be generated server-side from verified allowlisted fields;
- raw logs, request/response bodies, credentials, cookies, tokens, private keys, recovery codes, and raw exploit payloads must never enter the public event schema;
- all published sessions must pass technical review and sensitive-data review.

A valid signature or authenticated transport establishes source authenticity/integrity within its trust model. It does not prove that the test method is complete, the target was safe, or the conclusion is correct. Human review and evidence are still required.

## 5. Visual storytelling and motion

Motion is part of the teaching method, not decoration pretending to be telemetry.

Allowed:
- animate a real event only after it is received and validated;
- show a documented attack path as an explicitly explanatory diagram;
- reveal how a defensive control changes the observed result;
- animate real before/after measurements with units, time range, and source;
- use short transitions for navigation, focus, chapter changes, evidence reveal, and puzzle feedback;
- provide a reduced-motion mode and a fully understandable static presentation.

Not allowed:
- random packet streams, fake terminal output, invented alerts, fabricated progress percentages, or arbitrary threat counters;
- continuously moving indicators that imply an active test when none is running;
- green PASS states before the corresponding test has completed and been verified;
- using a decorative animation as evidence.

Every visualization must expose its data status: **LIVE**, **DELAYED**, **RECORDED**, **ILLUSTRATIVE**, **SIMULATED**, or **UNAVAILABLE**. Use timestamps and source labels where applicable.

## 6. Interactive research publications

A publication should be readable as a structured paper and explorable as an interactive story. The same evidence must remain available in a conventional text format.

Suggested chapter flow:
1. The question — what are we trying to understand?
2. The stakes — why does this security property matter?
3. The system — a safe architecture diagram with labelled trust boundaries.
4. The experiment — scope, environment, controls, and method.
5. Watch the evidence — event timeline, sanitized logs, and measured results.
6. Try it yourself — a synthetic, bounded puzzle or concept exercise.
7. The finding — what the evidence does and does not establish.
8. The fix — the defensive change and its rationale.
9. The retest — independently traceable before/after evidence.
10. The limits — untested browsers, devices, threat classes, and assumptions.
11. References — standards, papers, source commits, and test records.

Interaction must never hide important caveats, limitations, or methodology. Keyboard navigation, accessible names, readable contrast, mobile layouts, and reduced motion are required.

## 7. Puzzle and learning design

Puzzles should teach a specific concept and provide feedback that explains the reasoning—not merely award points.

Initial safe categories:
- encoding versus encryption;
- hash and salt concepts;
- password entropy and rate limiting;
- authentication/session reasoning;
- log and evidence interpretation;
- secure input validation;
- cryptographic integrity and tamper detection;
- threat modelling and defensive decision-making.

Every puzzle must:
- use fictional/synthetic fixtures;
- run locally or in an isolated sandbox;
- have bounded CPU, memory, input size, and execution time;
- avoid arbitrary URL fetch, shell execution, unrestricted code execution, or third-party targets;
- explain the correct answer and common misconceptions;
- avoid collecting real passwords, tokens, recovery codes, or personal information.

## 8. Existing foundation to reuse

The repository already contains relevant building blocks:
- `app/security/lab-activity-console.tsx` — truthful observability shell with a public-safe session viewer placeholder, explicit session-state definitions, and a no-source-connected state;
- `lib/security-lab/telemetry.ts` — strict bounded event schema;
- `lib/security-research/test-run.ts` — public test-run metadata and publication gate;
- `lib/security-research/test-run.ts` and `docs/SECURITY-TEST-RUN-CONTRACT.md` — evidence/provenance contract;
- `app/security/research` — bilingual public research library and article surface;
- `app/security/research/workbench` and `docs/SECURITY-RESEARCH-WORKFLOW.md` — private draft/review workflow;
- `app/security/cryptography-learning-lab.tsx` — interactive cryptography learning surface;
- `docs/CYBER-VISUAL-ARCHITECTURE.md` — motion, visual truth, and accessibility foundation.

The public UI now includes a session-viewer shell and a legend defining LIVE, DELAYED, RECORDED, ILLUSTRATIVE, SIMULATED, and UNAVAILABLE. This is a presentation contract only. It is not proof that a public live stream, safe public execution sandbox, or complete research theater is implemented.

## 9. Staged implementation plan

### Stage 1 — truthful public experience
- [x] Refine the public Security page into a coherent Research Theater entry point.
- [ ] Add explicit navigation to Research Stories, Learning Lab, Puzzle Arena, and Research Archive.
- [x] Define display labels for live, delayed, recorded, illustrative, simulated, and unavailable content.
- [x] Improve the inactive-lab empty state with a public session-viewer placeholder and event provenance contract.
- [ ] Preserve all current evidence and limitation disclosures.

### Stage 2 — verified private lab event source
- [ ] Define a session registry and allowlisted target inventory.
- [ ] Implement authenticated private-runner event ingestion with replay protection and sequence validation.
- [ ] Add event redaction and public projection tests.
- [ ] Keep ingestion disabled until a separate non-production environment and credentials are approved.
- [ ] Verify source identity and end-to-end event delivery before showing LIVE.

### Stage 3 — public live observation
- [ ] Add a read-only server projection for approved live sessions.
- [ ] Stream only sanitized, bounded event summaries.
- [ ] Implement delayed/disconnected states and timestamp freshness rules.
- [ ] Add browser tests for reconnect, stale data, duplicated events, malformed events, and source loss.
- [ ] Never expose private runner controls or raw diagnostics.

### Stage 4 — interactive research stories
- [x] Add a chapter-based AES-GCM nonce-reuse lesson at `/security/research-stories` with accessible chapter navigation and reduced-motion handling.
- [x] Add a decision exercise that explains why nonce reuse is unsafe and requires a fresh unique nonce per encryption under the same key.
- [x] Label the lesson ILLUSTRATIVE / SYNTHETIC; it performs no encryption, emits no telemetry, and uses no real keys, records, or external targets.
- [ ] Bind every future empirical claim and visualization to publication evidence references.
- [ ] Keep printable/text-first reading mode and expand the story format to evidence-backed publications.
- [x] Link the interactive story from the public Research Library.

### Stage 5 — safe Puzzle Arena
- [ ] Build synthetic exercises with deterministic expected outcomes.
- [ ] Enforce sandbox resource and network boundaries.
- [ ] Add explanation-first feedback and accessible keyboard controls.
- [ ] Keep public exercises isolated from Vault auth, data, and secrets.

### Stage 6 — quality and release gates
- [ ] Cross-device visual and responsive QA.
- [ ] Keyboard-only and assistive-technology testing.
- [ ] Reduced-motion and contrast verification.
- [ ] Performance and sandbox isolation testing.
- [ ] Independent security review of ingestion, sandbox, and publication boundaries.
- [ ] Explicit owner approval before any deployment or external service activation.

## 10. Non-goals and prohibitions

- No public attack launcher or arbitrary target testing.
- No unauthorized testing of third-party services.
- No use of real Vault credentials or user data in demonstrations.
- No fake live activity, invented metrics, or misleading status labels.
- No public disclosure of exploitable details before safe remediation and disclosure review.
- No promise that a test pass proves the whole product secure.
- No tying donations to access, test results, ranking, or preferential treatment.

## 11. Current status

This document is an architecture plan. The public dashboard now has a session-viewer presentation shell, public event-field contract, and explicit state legend. It is still not connected to an authenticated private-lab live event source; the current session state remains UNAVAILABLE and no live or recorded session is claimed. The public research library and learning components are partial foundations. The private Vault API remains server-readable until the separately planned ciphertext-only migration is completed.

No production database, production secret, deployment, or live external target is changed or authorized by this plan.
