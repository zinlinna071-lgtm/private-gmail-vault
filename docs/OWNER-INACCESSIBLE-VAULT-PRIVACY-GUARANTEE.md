# Owner-Inaccessible Vault Privacy Guarantee

**Status:** Public commitment draft — NOT YET ACHIEVED / DO NOT PRESENT AS A CURRENT SECURITY GUARANTEE  
**Branch:** `design/cyber-visual-architecture`  
**Applies to:** Secondary-account Vault records  
**Owner access:** Master/Owner may administer the Research Lab, but must never possess a decryption path to Secondary users' records.

## 1. The promise we intend to make

The Master/Owner account must not be able to read, reveal, search, export, decrypt, or otherwise recover the plaintext contents of any Secondary user's Vault records. This applies to account names, email addresses/usernames, passwords, backup codes, and private notes stored inside encrypted records.

The restriction must be enforced cryptographically, not by hiding buttons, relying on an internal policy, or trusting the Owner not to inspect data.

The Owner may operate the security research environment and see only explicitly approved, non-secret operational metadata. Owner administration must not include a "view as user", impersonation, secret reveal, decryption, key reset, or recovery override feature.

## 2. Critical current-state disclosure

**This promise is not true in the current implementation.**

The current `/api/vault/items` route accepts plaintext account fields, encrypts them on the server, and decrypts them on reads. The server holds the encryption key. Therefore a sufficiently privileged server operator, including an operator who can access the relevant runtime secret and database, can technically obtain plaintext records through the existing application path.

Existing browser-side AES-GCM and DEK-envelope modules are not enough: they are not yet the active end-to-end data path, the Argon2id adapter and complete unlock/recovery protocol are not finished, and the API is still server-readable.

Until all release gates in this document pass, the service must not advertise that the Master/Owner or server is technically unable to read Secondary records. Users must not store high-value credentials in the current prototype.

## 3. Required cryptographic architecture

### 3.1 Per-user cryptographic isolation

- Each Secondary Vault receives an independent random 256-bit Data Encryption Key (DEK), generated inside the user's browser.
- The DEK is never sent unwrapped to the server, Owner account, database, logs, or analytics.
- A client-only Vault Unlock Secret is processed with a maintained, independently reviewed Argon2id implementation and a unique random salt to derive a Key Encryption Key (KEK).
- The KEK wraps the DEK using an authenticated, versioned envelope. The server stores only the wrapped DEK and bounded public KDF metadata.
- The user's complete record is encrypted and decrypted in the browser using Web Crypto AES-256-GCM. Every encryption uses a fresh random 96-bit nonce for that DEK.
- Authenticated Additional Data binds each record to its vault ID, record ID, record type, protocol purpose, and version.
- The login/authentication credential is separate from the Vault Unlock Secret. Successful login alone never decrypts a record.
- No shared Owner key, global master key, server escrow key, support key, or administrative recovery backdoor is permitted.

### 3.2 Server and database limitations

The API and database may process only:
- Ciphertext and authentication metadata;
- Wrapped DEKs and public KDF/format metadata;
- Random record identifiers and minimum operational metadata;
- The authenticated Secondary account identifier needed for ownership enforcement.

The server must never receive:
- Plaintext account fields, passwords, backup codes, or private notes;
- The Vault Unlock Secret, KEK, or unwrapped DEK;
- A recovery secret that can independently decrypt a user's Vault.

The server may enforce that each Secondary user owns at most four records, but it must do so without decrypting or inspecting their contents. The maximum of four applies to records per Secondary Vault, not to the number of Secondary accounts.

### 3.3 Owner separation

- Master/Owner identity is provisioned outside public registration.
- Owner authentication and recent MFA protect Research Lab operations.
- Owner authorization is checked on every Research Lab API request.
- Owner permissions do not include Secondary Vault decryption or impersonation.
- Secondary record APIs always scope rows to the authenticated Secondary user's immutable ID.
- Cross-user record access is denied even if a record UUID is known.
- Research Lab audit events contain metadata only, never credential values or ciphertext plaintext.

## 4. Important limitation: browser and deployment trust

Client-side encryption prevents the normal server/database path from decrypting stored records only if the client code and user's device are trustworthy.

It cannot guarantee protection if:
- The user's phone, browser, operating system, or browser extensions are compromised;
- Malware, keyloggers, screen capture, or remote-control software accesses an unlocked Vault;
- A malicious or compromised website build is delivered to the browser and captures data after the user unlocks it;
- The user is phished into entering the unlock secret on a fake site;
- The user voluntarily shares their unlock secret or recovery material;
- Cryptographic libraries, browser implementations, or dependencies contain exploitable defects.

Because the service operator controls deployment, a claim that "the Owner can never read anything under every possible circumstance" would be too absolute. The technically defensible commitment is narrower: **the deployed, reviewed application and server architecture do not give the Master/Owner or backend a decryption key or normal API capability to read Secondary Vault records.** This claim must be tied to a specific release and evidence set.

To reduce deployment trust, publish source revisions, build provenance, dependency versions, release hashes, and independent audit reports. Consider reproducible builds and an independently monitored release process. These controls reduce risk but do not eliminate trust in the code delivered to a browser.

## 5. Recovery trade-off — no hidden override

If only the user possesses the decryption and recovery material, the service operator cannot reset the Vault Unlock Secret and recover plaintext.

Therefore:
- Recovery material must be generated client-side and shown to the user once.
- The user must store it separately and safely.
- Recovery must unwrap the DEK client-side and allow re-wrapping under a new unlock secret.
- The server must not escrow plaintext recovery codes or hold a recovery key that can decrypt all users' records.
- If the user loses every device, unlock secret, and recovery factor, the encrypted records may be permanently unrecoverable.
- Support and the Master/Owner cannot bypass this outcome.

This is a deliberate privacy trade-off and must be clearly explained before users store data.

## 6. Evidence required before making the public guarantee

No single test proves absolute security. The following evidence is required and must be published with commit, build, environment, date, scope, result, and limitations.

### A. Code and architecture evidence
- Source review confirms no server-side record decryption path remains.
- No production or preview server secret can decrypt Secondary record ciphertext.
- No Owner endpoint, database function, admin tool, or support workflow can obtain user DEKs or plaintext.
- No Master/Owner credential or session is accepted by Secondary unlock APIs.
- No hidden impersonation or key escrow mechanism exists.

### B. Network and runtime evidence
- Capture create/read/update requests from a synthetic test account and confirm only ciphertext, wrapped-key material, and public metadata leave the browser.
- Confirm plaintext passwords, backup codes, notes, unlock secrets, KEKs, and unwrapped DEKs are absent from requests, responses, logs, traces, error reports, and analytics.
- Confirm responses use `Cache-Control: no-store`.
- Confirm the server returns opaque envelopes and does not call a decrypt function.

### C. Cryptographic evidence
- Known-answer and cross-browser tests for the selected KDF and AES-GCM protocol.
- Correct-key round trip, wrong-key failure, ciphertext tamper failure, wrong-AAD failure, malformed envelope rejection, nonce uniqueness, and bounded KDF metadata tests.
- Verify key wrapping/unwrapping and recovery using synthetic accounts only.
- Verify the Owner has no key material capable of unwrapping a Secondary DEK.

### D. Authorization and isolation evidence
- Owner attempts to access Secondary record APIs are denied.
- Secondary A cannot read, update, delete, or infer Secondary B's records.
- Guessing or learning a record UUID does not bypass ownership checks.
- The four-record limit holds under concurrent insert attempts and is enforced transactionally.
- Owner Research Lab endpoints require Owner role and recent MFA but never return Secondary record content.

### E. Independent review
- A qualified independent security reviewer examines the crypto protocol, key lifecycle, API, database policies, recovery, build pipeline, and deployment.
- All critical/high findings are fixed and retested, or explicitly disclosed with a release-blocking decision.
- Publish the review scope, reviewer identity/credentials where disclosure is permitted, date, commit, tested build, findings summary, and unresolved limitations.
- Do not call internal unit tests, a code review by the project owner, or a green CI run an independent audit.

## 7. Public statement — publish only after verification

> **Owner-Inaccessible Vault Records**
>
> Secondary Vault records are encrypted in the user's browser before they are transmitted to our servers. The Master/Owner account is designed to administer the private Security Research Lab, not to read Secondary users' saved credentials.
>
> The application does not provide the Master/Owner or backend service with the keys needed to decrypt Secondary Vault records. The server stores encrypted record envelopes and limited operational metadata. The user's Vault Unlock Secret and unwrapped data key remain on the user's device during normal operation.
>
> This statement applies only to the named release and the published verification evidence. It is not a promise that every device, browser, network, dependency, or future release is immune to compromise. A compromised device or malicious client code could expose information while the Vault is unlocked.
>
> Users are responsible for protecting their devices and recovery material. If all unlock and recovery material is lost, the service operator cannot restore the plaintext records. Keep an independent secure backup of recovery material.
>
> See the published architecture, test evidence, release hash, independent review, and known limitations before relying on the Vault.

**Publication gate:** Do not display the above as a current fact until all mandatory evidence is complete, the production release matches the reviewed commit, and the owner has approved publication. Before then, publish only the current-state disclosure in Section 2.

## 8. Legal and responsibility notice — review required

The service must explain risks and user responsibilities in clear language, but must not use a blanket "we are not responsible for anything" clause or suggest that users waive rights that cannot lawfully be waived.

Proposed plain-language notice:

> **Important Security and Data-Loss Notice**
>
> No online service can guarantee absolute security or uninterrupted availability. Users must protect their devices, browsers, authentication factors, Vault Unlock Secret, and recovery material. Do not store information unless you understand the risks and have safely retained the recovery material.
>
> Strong client-side encryption is intentionally designed so the service operator cannot recover plaintext records when a user loses all valid unlock and recovery material. The service may therefore be unable to restore records after user-side loss.
>
> The service will describe known limitations, security incidents, and material changes honestly and will take reasonable steps to protect the service and respond to incidents. Nothing in this notice excludes or limits liability, remedies, or data-subject rights where such exclusion or limitation is prohibited by applicable law.
>
> This notice does not replace the Privacy Notice, Terms of Service, breach-response obligations, or any legally required disclosures.

This is draft product language, not legal advice or a complete privacy policy. Before public launch, a lawyer qualified in the applicable jurisdictions must review the Privacy Notice, Terms of Service, controller/processor roles, lawful basis, retention, international transfers, breach process, consumer terms, and any liability wording. If Thai users are served, specifically review the Thai Personal Data Protection Act B.E. 2562 and current subordinate notifications. A disclaimer cannot automatically remove statutory duties or liability.

## 9. Release checklist

- [ ] Browser-only encryption is the active create/read/update/delete data path.
- [ ] Argon2id implementation and parameters are selected, pinned, reviewed, and mobile-tested.
- [ ] Authentication is separate from Vault Unlock Secret.
- [ ] Recovery is client-side, tested, and contains no server escrow.
- [ ] Legacy server-side encryption/decryption is removed from all active routes and admin tools.
- [ ] Database and API store/return opaque ciphertext only.
- [ ] Owner has no Secondary DEK, no decryption endpoint, no impersonation path, and no recovery override.
- [ ] Cross-user isolation, Owner denial, and transactional four-record limit pass tests.
- [ ] Network, runtime, logs, and build-artifact leakage checks pass.
- [ ] Independent security review is complete and findings are resolved/disclosed.
- [ ] Public evidence links identify the exact deployed commit and release.
- [ ] Legal counsel reviews public privacy, terms, and responsibility wording.
- [ ] The verified production release is explicitly approved before the public guarantee is enabled.

**Until every mandatory item passes, status remains: NOT YET VERIFIED.**
