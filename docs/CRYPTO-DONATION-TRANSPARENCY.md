# Crypto Donation Fund — Public Transparency Specification

## Purpose

The project owner personally receives and manages voluntary cryptocurrency contributions to support independent cybersecurity research. The public site must clearly disclose that this is a personally operated project, not a registered charity or nonprofit. Donations are not investments, do not grant ownership or financial returns, and are not represented as tax-deductible.

The public transparency page reports verifiable fund activity. It must never imply that a donation has been received until the relevant blockchain transaction has reached the configured confirmation threshold.

## Public dashboard

Publish a read-only page with these clearly separated figures:

1. **Total donations received** — sum of verified incoming donations, grouped by asset and network.
2. **Donations received during the selected period** — e.g. this month or all time.
3. **Research spending** — only expenses actually paid from the research fund and supported by a reviewed record.
4. **Remaining fund balance** — accounting balance after verified receipts and recorded spending.
5. **Current on-chain wallet balances** — independently displayed per public wallet address and asset. These are wallet balances, not automatically the same as the fund's available balance.
6. **Last reconciled time** — timestamp in UTC and a human-readable local display.

Never combine BTC, ETH, and stablecoin quantities into one unlabeled number. Show each asset and network separately. If a fiat estimate is displayed, label it as approximate, include the quote currency, price source, and exact valuation timestamp. The underlying crypto amount remains the primary figure.

## Donation verification

- Verify incoming transfers against the correct chain, network, public receiving address, asset contract (where applicable), transaction hash, amount, and block timestamp.
- Count a transfer only after it reaches a documented confirmation/finality threshold for that network.
- Show pending transfers separately and exclude them from confirmed totals.
- Prevent duplicate counting by using a unique chain/network + transaction hash + transfer/log index identity.
- Handle reorganizations, dropped transactions, token contract changes, and failed transfers; reverse or correct affected ledger entries with an auditable adjustment record.
- Do not trust donor-submitted screenshots or transaction hashes as proof without independent chain verification.
- Never claim that a wallet balance is a donation total: balances may include owner funds, transfers between owned wallets, or other non-donation movements.

## Public ledger and privacy

Each public donation entry may show:
- asset and network;
- received amount;
- transaction hash with an explorer link;
- confirmation status;
- block time;
- receiving address label (not private identity information).

Do not publish donor names, email addresses, IP addresses, personal messages, or other personal information without explicit informed consent. Do not promise that blockchain donations are anonymous; public-chain transactions and wallet relationships may be traceable.

For spending entries, publish date, amount, asset, broad research category, and a redacted receipt/reference where safe. Never publish passwords, account details, private keys, seed phrases, personal addresses, or sensitive vendor information.

## Accounting and reconciliation

Maintain an append-only internal ledger with event type (donation, expense, refund, transfer, correction), asset, network, amount, transaction/reference ID, timestamps, verification source, confirmation state, and review status.

- Transfers between wallets controlled by the owner are not donations or expenses.
- A correction must preserve the original entry and add a linked adjustment; do not silently rewrite history.
- Reconcile public wallet balances against chain data and the internal fund ledger on a regular schedule.
- Disclose any gap, unsupported balance, or delayed reconciliation instead of fabricating a figure.
- A public figure must be reproducible from the underlying verified entries.

## Operational and legal safeguards

- Keep the dashboard read-only. Visitors cannot initiate transactions or run tests from it.
- Never expose private keys, seed phrases, signing credentials, exchange credentials, or server secrets.
- Use dedicated receiving wallets for the research fund; do not mix personal holdings with fund receipts if avoidable.
- Before accepting public donations, obtain appropriate Thai legal and tax advice for the actual personal receiving arrangement, supported assets, and intended solicitation. Do not claim charity status, tax deductibility, or regulatory approval without documented authority.
- Publish the receiving-wallet details only after the receiving model, custody, key backup, and legal review are complete.

## Publication language

Suggested disclosure:

> **Personal research fund:** Contributions are received and managed personally by the project owner to support independent cybersecurity research. This is not a registered charity or nonprofit. Donations are voluntary, are not investments, and provide no financial return or ownership rights. Please review the purpose, fund records, and applicable tax considerations before contributing.

## Release gates

Do not launch the donation page or display wallet addresses until:
- the personal receiving arrangement has been reviewed for applicable legal and tax obligations;
- dedicated wallet custody and recovery procedures are documented and tested;
- chain/network/asset support and confirmation thresholds are defined;
- the indexer and duplicate/reorg handling have been tested against known transactions;
- ledger totals reconcile with chain data;
- privacy and security review is complete.

Until real verified donations exist, show a clear zero/empty state such as **No confirmed donations yet**. Never seed sample transactions or illustrative totals into the live public ledger.
