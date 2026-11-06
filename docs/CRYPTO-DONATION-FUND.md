# Personal Crypto Research Fund — Verification & Accounting Design

**Status:** Design specification; no live donation intake  
**Owner:** Individual project owner, personally receiving and managing contributions  
**Public surface:** `/support`, read-only  
**Implementation status:** Static disclosure page only; no wallet addresses, RPC integration, transaction verifier, spending ledger, or live balances are active  
**Production impact:** None. This document does not authorize publishing wallet addresses, accepting funds, changing production configuration, or deploying.

## 1. Purpose and disclosure

The fund supports independent cybersecurity research personally conducted and managed by the project owner. It is not presented as a registered charity, nonprofit, investment, token sale, or financial product. Donors must be told plainly that funds are received and controlled by the owner personally, that contributions are voluntary, and that no financial return, ownership, tax deduction, or specific research outcome is promised.

The public page must explain intended use, risks of irreversible crypto transfers, supported assets and exact networks, the accounting method, and the fact that donations are not enabled until the receiving arrangement and applicable legal/tax requirements have been reviewed.

## 2. Public accounting model

Show separate, asset-denominated figures for each supported network and token:

- Confirmed donations received.
- Pending/unconfirmed transfers (display separately; never include in confirmed totals).
- Verified research expenditure.
- Remaining accounted fund balance.
- Last reconciliation timestamp and any reconciliation warning.

Never silently combine BTC, ETH, and USDT into one coin total. A fiat equivalent may be shown only as a secondary estimate with currency, rate source, and valuation timestamp. The public dashboard must distinguish:

1. **Donation receipts** — verified inbound transfers qualifying as external contributions.
2. **Fund expenses** — actual outflows for disclosed research purposes, supported by a reviewed record.
3. **Wallet balances** — current on-chain balances at listed addresses; these are not the same as total donations.
4. **Internal transfers** — transfers between owner-controlled wallets, excluded from donation receipts and counted only as movements between tracked accounts.

No synthetic/demo donations, estimated amounts presented as actual, or fabricated transaction activity.

## 3. Supported asset identity

An asset is identified by a strict tuple, not ticker text alone:

- Chain/network identifier.
- Native asset or token contract address.
- Decimals.
- Canonical display symbol and name.
- Minimum confirmation/finality policy.
- Trusted explorer link template and RPC/indexer source.

BTC must be Bitcoin mainnet only if explicitly enabled. ETH must be Ethereum mainnet only if explicitly enabled. USDT is network-specific: do not accept an unspecified "USDT" transfer. A particular supported USDT contract and network must be selected, verified, and published before its address is displayed. Never infer a network from a ticker or accept bridged/wrapped variants as equivalent without explicit review.

## 4. Transaction verification pipeline

A transaction hash submitted by an owner or discovered by an indexer is only a **candidate**, not proof of a donation.

1. Receive candidate metadata through a private owner-only workflow; the public site has no transaction submission or test controls.
2. Validate hash syntax and resolve the exact configured network.
3. Fetch transaction, receipt, block, and (for tokens) the matching token transfer log from an independent chain data source.
4. Verify successful execution, exact receiving address, asset identity, token contract, amount/decimals, block inclusion, and timestamp.
5. Verify the receiving address belongs to the published fund wallet registry and the transfer is not an owner-controlled internal transfer.
6. Apply network-specific confirmation/finality policy. A pending or reorganized transaction is not confirmed.
7. Deduplicate by network + transaction hash + transfer/log index (for token transfers).
8. Store immutable raw verification facts privately; publish only a sanitized record after reconciliation and owner review.
9. Recheck recent records for chain reorganizations or provider corrections. If a previously confirmed transfer is removed or reversed by a reorg, publish a correction event and recompute totals with an audit trail.

A single explorer API response must not be treated as infallible. Production verification should compare independent sources or a trusted self-operated node for high-value accounting. Provider disagreement moves the record to **REVIEW_REQUIRED**, not confirmed.

### Required transaction states

- `CANDIDATE` — discovered/submitted, not verified.
- `PENDING` — transfer matches but confirmation/finality threshold is not met.
- `CONFIRMED` — all verification rules and confirmation policy pass.
- `REVIEW_REQUIRED` — provider disagreement, ambiguous source, or suspected internal transfer.
- `REORGED` — previously observed inclusion is no longer canonical.
- `REJECTED` — wrong network/asset/recipient, failed transaction, duplicate, or invalid transfer.

Only `CONFIRMED` records count toward received totals. State changes must be auditable; do not overwrite history silently.

## 5. Minimum public ledger fields

- Public ledger entry ID.
- Asset and exact network.
- Amount in native asset units (exact decimal string; never floating-point arithmetic).
- Transaction hash and transfer/log index where applicable.
- Block height and block timestamp.
- Confirmation/finality status and last verification time.
- Optional fiat estimate with currency, source, and rate timestamp.
- Redaction note where public details are intentionally omitted.

Never publish donor names, email addresses, IP addresses, wallet ownership assumptions, private messages, or identifying metadata. Blockchain addresses and transaction hashes are public-chain data and may reveal donor activity; disclose this privacy limitation before donation. If displaying a transaction hash would create an unacceptable privacy risk, do not promise anonymity: explain that the public chain remains traceable.

## 6. Expense ledger and reconciliation

Each expense record should include date, asset, exact amount, category, purpose, transaction reference where available, and a redacted supporting-evidence reference. Categories may include research experiments, testing infrastructure, security tools, and research publications.

Publish a correction trail for amended or reversed records. Do not expose invoices containing home addresses, private account details, personal identifiers, or confidential vendor information. Owner-managed spending must be labeled honestly; it is not independently audited unless an actual independent review occurs.

For each asset/network, reconcile:

`opening accounted balance + confirmed receipts - verified expenses +/- documented adjustments = closing accounted balance`

Wallet balances are reconciled separately because funds may be held in multiple wallets, moved internally, or remain unspent outside the published address set. Explain any difference rather than forcing totals to match.

## 7. Security and operational controls

- Keep seed phrases and private keys offline in a secure hardware wallet or equivalent cold-storage arrangement; never place them in source control, browser code, frontend environment variables, analytics, logs, or the public dashboard.
- The public website must never sign transactions, custody donor funds, or expose wallet-management actions.
- Publish receiving addresses only after verifying control and testing with a small amount on the exact network.
- Use a separate receiving wallet/account for the research fund; maintain a documented process for internal transfers.
- Restrict the private reconciliation workflow to the owner with strong authentication and least privilege.
- Store verification metadata and audit events server-side; expose only a read-only, sanitized public projection.
- Rate-limit candidate lookup and protect provider credentials. Never accept arbitrary RPC URLs from public users.
- Do not make refunds or payments automatically based only on a public form or transaction hash.
- Back up ledger data and preserve a tamper-evident audit trail.

## 8. Legal, tax, and donor-consent release gate

Before enabling contributions, confirm the legal receiving model and relevant requirements in the owner's actual jurisdiction, including crypto fundraising/solicitation, tax treatment, recordkeeping, sanctions/AML obligations where applicable, and any restrictions on public appeals. Obtain qualified local advice where needed. Do not describe donations as tax-deductible or tax-exempt unless that status is confirmed by a qualified authority.

The donor must see, before sending funds:

- The owner personally receives and controls the funds.
- This is not a registered charity or nonprofit (unless status later changes and is verified).
- Contributions are voluntary and are not investments; no return or benefit is promised.
- Crypto transfers are generally irreversible and sending the wrong asset/network may cause permanent loss.
- Exact asset, network, token contract, and address.
- Public-chain privacy and traceability limitations.
- Intended uses and the public accounting policy.
- Any relevant jurisdictional restrictions and contact/disclosure details.

No wallet address may be published and no fundraising may be launched until the owner has reviewed and approved the completed disclosure and compliance gate.

## 9. Delivery phases

### Phase A — documentation and static disclosure
- Keep `/support` public and read-only.
- Show no live address or fabricated amount.
- State clearly that no live wallet integration or verified donation exists.

### Phase B — network and custody decision
- Confirm jurisdiction and legal/tax advice.
- Choose the receiving wallet/custody model.
- Select exact networks and token contracts.
- Define confirmation/finality thresholds and independent data sources.
- Obtain owner approval before publishing addresses.

### Phase C — private verification prototype
- Use testnet or controlled fixtures only.
- Implement candidate lookup, validation, deduplication, confirmation tracking, reorg handling, and audit events.
- Test wrong network, wrong recipient, failed transaction, duplicate log, token spoofing, internal transfer, provider outage/disagreement, and reorg cases.
- Do not touch production wallets or funds during this phase.

### Phase D — public read-only ledger
- Publish sanitized, reviewed confirmed receipts and expenses.
- Derive totals from verified ledger entries, not editable dashboard counters.
- Add reconciliation timestamps and correction history.
- Keep public access read-only and separate from private owner controls.

### Phase E — controlled launch
- Complete legal/tax and security review.
- Owner explicitly approves the exact addresses, networks, disclosures, and public page.
- Start with a low-risk, clearly documented amount and reconcile before broader promotion.

## 10. Current truthful status

As of this document revision, the repository contains a static `/support` disclosure and empty-state page. There are no active receiving addresses, no blockchain RPC/indexer integration, no transaction verification service, no live donation records, and no live balance calculation. The public page must continue to say so until each capability is implemented and verified.
