import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Research Fund Transparency | Private Account Vault",
  description: "Public disclosure and verified accounting for the personally managed independent cybersecurity research fund."
};

const fundAssets = [
  { asset: "BTC", network: "Bitcoin", precision: "8 decimals" },
  { asset: "ETH", network: "Ethereum", precision: "18 decimals" },
  { asset: "USDT", network: "Network to be announced", precision: "Network-specific" }
];

export default function ResearchFundPage() {
  return (
    <main className="security-shell fund-shell">
      <header className="security-nav">
        <Link className="security-brand" href="/">
          <span className="security-brand-mark">V</span>
          <span>PRIVATE ACCOUNT VAULT <small>RESEARCH FUND</small></span>
        </Link>
        <span className="security-nav-status">PUBLIC · READ ONLY</span>
      </header>

      <section className="fund-hero">
        <span className="section-index">INDEPENDENT CYBERSECURITY RESEARCH</span>
        <h1>Research funding.<br /><em>Open accounting.</em></h1>
        <p className="security-lead">A public record of cryptocurrency contributions personally received and managed by the project owner. Every published donation must be independently verified on its blockchain network.</p>
        <div className="fund-disclosure">
          <strong>Personal project disclosure</strong>
          <p>This is a personally operated research project, not a registered charity or nonprofit organization. Contributions are voluntary donations, not investments. They provide no ownership, financial return, or promise of benefit.</p>
          <p lang="my">ဤ Project ကို ပိုင်ရှင်ကိုယ်တိုင် စီမံခန့်ခွဲသော ကိုယ်ပိုင်သုတေသနလုပ်ငန်းဖြစ်ပြီး မှတ်ပုံတင်ထားသော အလှူအဖွဲ့အစည်း သို့မဟုတ် အကျိုးအမြတ်မယူသော အဖွဲ့အစည်း မဟုတ်ပါ။ လှူဒါန်းငွေသည် ရင်းနှီးမြှုပ်နှံမှုမဟုတ်သလို အမြတ်ငွေ၊ ပိုင်ဆိုင်ခွင့် သို့မဟုတ် ပြန်လည်ရရှိမည့် အကျိုးအမြတ်ကိုလည်း မပေးပါ။</p>
        </div>
      </section>

      <section className="security-section fund-section">
        <div className="security-section-heading">
          <div><span className="section-index">01 / FUND SUMMARY</span><h2>Confirmed contributions</h2></div>
          <span className="section-aside">BLOCKCHAIN-VERIFIED ONLY</span>
        </div>
        <div className="fund-empty-total">
          <span className="fund-empty-mark">CONFIRMED DONATIONS</span>
          <strong>No confirmed donations yet</strong>
          <p>Public totals will appear here after real transactions are verified and reconciled. No sample or estimated donations are included.</p>
          <p lang="my">အမှန်တကယ်ရရှိပြီး Blockchain မှာ အတည်ပြုစစ်ဆေးပြီးသော အလှူငွေများရှိလာမှသာ စုစုပေါင်းကို ဒီနေရာမှာ ဖော်ပြပါမယ်။ နမူနာ သို့မဟုတ် ခန့်မှန်းထားသော ငွေပမာဏများကို မထည့်သွင်းပါ။</p>
        </div>
        <div className="fund-asset-grid">
          {fundAssets.map((item) => (
            <article className="fund-asset-card" key={item.asset}>
              <span>{item.asset}</span>
              <strong>Not connected</strong>
              <small>{item.network} · {item.precision}</small>
            </article>
          ))}
        </div>
        <p className="security-footnote">BTC, ETH, and USDT are listed as potential future asset categories only. No receiving wallet or donation network is active or published at this stage.</p>
      </section>

      <section className="security-section fund-section">
        <div className="security-section-heading"><div><span className="section-index">02 / ACCOUNTING</span><h2>Fund position</h2></div><span className="section-aside">VERIFIED RECORDS ONLY</span></div>
        <div className="fund-account-grid">
          <article><span>Total received</span><strong>Not available yet</strong><small>Confirmed donations only</small></article>
          <article><span>Research spending</span><strong>Not available yet</strong><small>Published after receipt review</small></article>
          <article><span>Remaining fund</span><strong>Not available yet</strong><small>Reconciled accounting balance</small></article>
          <article><span>Last reconciliation</span><strong>Not started</strong><small>No live wallet integration</small></article>
        </div>
        <p className="security-footnote">Wallet balances and donation totals will be reported separately. Transfers between wallets controlled by the owner will not be counted as donations. Each supported asset will be displayed in its own unit; any fiat estimate will be clearly labeled with its source and valuation time.</p>
      </section>

      <section className="security-section fund-section">
        <div className="security-section-heading"><div><span className="section-index">03 / TRANSACTION HISTORY</span><h2>Public donation ledger</h2></div><span className="section-aside">APPEND-ONLY RECORD</span></div>
        <div className="fund-ledger-empty">
          <strong>No verified transactions to display.</strong>
          <p>When donations are enabled, each eligible entry will show the asset, network, amount, transaction hash, confirmation state, and block time. Pending transfers will be clearly separated and excluded from confirmed totals.</p>
          <p lang="my">အလှူလက်ခံမှု စတင်ပြီးနောက် အတည်ပြုထားသော Transaction တစ်ခုချင်းစီ၏ Coin အမျိုးအစား၊ Network၊ ပမာဏ၊ Transaction Hash၊ အတည်ပြုမှုအခြေအနေနှင့် Block အချိန်တို့ကို ဖော်ပြပါမယ်။ Pending ဖြစ်နေသေးသော ငွေများကို သီးခြားပြပြီး အတည်ပြုပြီး စုစုပေါင်းထဲ မထည့်ပါ။</p>
        </div>
      </section>

      <section className="security-section fund-section">
        <div className="security-section-heading"><div><span className="section-index">04 / HOW FUNDS ARE USED</span><h2>Research expenditure</h2></div><span className="section-aside">OWNER-MANAGED</span></div>
        <div className="security-module-grid">
          <article className="security-module"><span className="module-number">01</span><h3>Research & experiments</h3><p>Controlled cybersecurity research, reproducible experiments, and technical validation.</p></article>
          <article className="security-module"><span className="module-number">02</span><h3>Testing infrastructure</h3><p>Computing resources and isolated environments used for authorized testing.</p></article>
          <article className="security-module"><span className="module-number">03</span><h3>Tools & publications</h3><p>Research tools, documentation, and English and Burmese educational publications.</p></article>
        </div>
        <p className="security-footnote">Spending will be listed only when actually paid from this fund and supported by a reviewed record. Sensitive personal or vendor information will be redacted.</p>
      </section>

      <section className="security-section fund-section">
        <div className="security-section-heading"><div><span className="section-index">05 / BEFORE YOU CONTRIBUTE</span><h2>Please decide freely.</h2></div><span className="section-aside">NO OBLIGATION</span></div>
        <div className="fund-disclosure">
          <p>Only contribute if you understand that the funds are received and managed personally by the project owner. Please consider applicable tax and legal requirements in your jurisdiction. No tax-deductible status or regulatory approval is claimed.</p>
          <p lang="my">အလှူငွေကို Project ပိုင်ရှင်ကိုယ်တိုင် လက်ခံပြီး စီမံခန့်ခွဲမည်ဆိုတာကို နားလည်သဘောပေါက်မှသာ လှူဒါန်းပါ။ သင့်နိုင်ငံနှင့် သက်ဆိုင်သော အခွန်နှင့် ဥပဒေဆိုင်ရာ သတ်မှတ်ချက်များကိုလည်း ထည့်သွင်းစဉ်းစားပါ။ အခွန်ကင်းလွတ်ခွင့် သို့မဟုတ် စည်းမျဉ်းဆိုင်ရာ ခွင့်ပြုချက်ရှိကြောင်း မကြေညာထားပါ။</p>
          <strong>Donation addresses are not published yet.</strong>
          <p>Wallet details will be displayed only after legal/tax review, dedicated-wallet custody planning, and transaction-verification testing are complete.</p>
        </div>
      </section>

      <footer className="security-footer">
        <div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT</strong></div>
        <p>Transparent records are not a charity certification or financial audit.</p>
        <Link href="/security">Security dashboard ↗</Link>
      </footer>
    </main>
  );
}
