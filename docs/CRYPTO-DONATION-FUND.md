# Personal Crypto Research Fund — Verification & Accounting Design

**Status:** Design specification; Sepolia read-only verification adapter implemented on the feature branch; no live donation intake  
**Owner:** Individual project owner, personally receiving and managing contributions  
**Public surface:** \`/support\`, read-only  
**Production impact:** None. No wallet addresses, live RPC credentials, production settings, or deployment are authorized by this work.

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

Never silently combine BTC, ETH, and USDT into one coin total. A fiat equivalent may be shown only as a secondary estimate with currency, rate source, and valuation timestamp. The public dashboard must distinguish donation receipts, fund expenses, wallet balances, and internal transfers. No synthetic/demo donations or fabricated activity.

## 3. Supported asset identity

An asset is identified by a strict tuple: chain/network identifier, native asset or token contract, decimals, canonical symbol/name, confirmation policy, and trusted data source. USDT is network-specific; never infer its network from the ticker. No token contract is currently configured.

## 4. Transaction verification pipeline

A transaction hash is a candidate, not proof of a donation. The private owner workflow must:

1. Validate the hash and exact configured network.
2. Fetch transaction, receipt, block, and (for tokens) the matching token transfer log.
3. Verify successful execution, exact receiving address, asset identity, amount, block inclusion, canonical block hash, and timestamp.
4. Verify that the receiving address belongs to the approved fund wallet registry and is not an owner-controlled internal transfer.
5. Apply network-specific confirmation/finality policy.
6. Deduplicate by network + transaction hash + transfer/log index.
7. Store immutable raw verification facts privately; publish only a sanitized record after reconciliation and owner review.
8. Recheck recent records for reorganizations and provider corrections.
9. Compare independent sources or a trusted self-operated node before any production accounting confirmation. Provider disagreement means REVIEW_REQUIRED.

## 5. Verification states

- \`CANDIDATE\` — discovered/submitted, not verified.
- \`PENDING\` — transfer matches but confirmation threshold is not met or data is not yet available.
- \`CONFIRMED\` — all configured verification rules and confirmation policy pass.
- \`REVIEW_REQUIRED\` — provider disagreement, inconsistent block evidence, ambiguous transfers, or suspected internal transfer.
- \`REORGED\` — previously observed inclusion is no longer canonical.
- \`REJECTED\` — wrong network/asset/recipient, failed transaction, duplicate, or invalid transfer.

Only reviewed and approved CONFIRMED records may count toward public receipts. The current adapter does not write a ledger or publish balances.

## 6. Implemented Sepolia read-only adapter

Files:
- \`lib/research-fund/evm-verification.ts\` — pure policy evaluator.
- \`lib/research-fund/sepolia-rpc.ts\` — RPC fact reader and strict transfer verifier.
- \`lib/research-fund/sepolia-rpc-client.ts\` — server-only JSON-RPC transport using the server environment variable \`SEPOLIA_RPC_URL\`.
- \`tests/research-fund-sepolia-rpc.test.ts\` — deterministic mocked-RPC tests.

The adapter:
- Checks RPC chain ID is Sepolia (\`11155111\`).
- Fetches transaction, receipt, latest block, and canonical inclusion block.
- Checks transaction/receipt hash and block inclusion agree.
- Checks successful receipt status and canonical block hash.
- Verifies plain native ETH transfers only (contract calls are rejected).
- Verifies an ERC-20 Transfer event from one exact configured token contract to the exact receiving address; ambiguous multiple matching logs require review.
- Uses integer base units and \`bigint\`; returns the transfer log index for future idempotent ledger keys.
- Returns PENDING, CONFIRMED, REJECTED, or REVIEW_REQUIRED.
- Performs read-only calls only; no signing, private-key access, transaction submission, or wallet custody.

The RPC endpoint is read from a server-only environment variable and is never accepted from a public request. It must be HTTPS and cannot include embedded credentials or a URL fragment. No endpoint or credential is committed to the repository.

### Limitations — not production donation verification

- No RPC endpoint is configured in the repository or production environment.
- No receiving wallet or token contract is configured.
- The adapter currently trusts one configured RPC transport; it does not independently compare providers.
- Reorg monitoring across time, persistent deduplication, immutable audit storage, owner review, internal-transfer classification, expense reconciliation, and public ledger projection are not implemented.
- Sepolia ETH/USDT-like test transfers are not real donations and must never be counted or displayed as public fundraising receipts.
- Tests are written against mocked RPC responses; a passing mock suite does not prove live provider correctness.

## 7. Expense ledger and reconciliation

Each expense record should include date, asset, exact amount, category, purpose, transaction reference where available, and a redacted supporting-evidence reference. Owner-managed spending must be labeled honestly; it is not independently audited unless an actual independent review occurs.

For each asset/network, reconcile:

\`opening accounted balance + confirmed receipts - verified expenses +/- documented adjustments = closing accounted balance\`

Wallet balances are reconciled separately. Explain any difference rather than forcing totals to match.

## 8. Security and operational controls

- Keep seed phrases and private keys offline; never place them in source control, browser code, frontend environment variables, analytics, logs, or the public dashboard.
- The public website must never sign transactions, custody donor funds, or expose wallet-management actions.
- Publish receiving addresses only after verifying control and testing with a small amount on the exact network.
- Restrict private reconciliation to the owner with strong authentication and least privilege.
- Expose only a read-only, sanitized public projection.
- Never accept arbitrary RPC URLs from public users.
- Back up ledger data and preserve a tamper-evident audit trail.

## 9. Legal, tax, and donor-consent release gate

Before enabling contributions, confirm the legal receiving model and relevant requirements in the owner's actual jurisdiction, including crypto fundraising/solicitation, tax treatment, recordkeeping, sanctions/AML obligations where applicable, and any restrictions on public appeals. Obtain qualified local advice where needed. Do not describe donations as tax-deductible or tax-exempt unless confirmed by a qualified authority.

No wallet address may be published and no fundraising may be launched until the owner has reviewed and approved the completed disclosure and compliance gate.

## 10. Delivery phases

A. Static disclosure and documentation.  
B. Network/custody/legal decisions and exact test configuration.  
C. Private testnet verification, adversarial fixtures, and independent provider comparison.  
D. Persistent private ledger, reorg/deduplication, owner review, and public read-only projection.  
E. Legal/tax and security review, followed by explicit owner approval before any controlled launch.

## 11. Current truthful status

The branch contains a static \`/support\` disclosure, a pure verification policy core, and a Sepolia-only read adapter. There are no active receiving addresses, no configured RPC endpoint, no persistent donation ledger, no live donation records, and no live balance calculation. No production deployment or fundraising launch has occurred as part of this work.
