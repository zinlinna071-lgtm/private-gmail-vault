import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support Independent Security Research | Private Account Vault",
  description: "Discover the public cybersecurity research, practical learning tools, and transparent personal research fund supported by voluntary contributions.",
  alternates: { canonical: "/support" },
  openGraph: {
    type: "website",
    title: "Support Independent Security Research",
    description: "Help sustain practical cybersecurity research and free public learning through transparent, voluntary support."
  }
};

const impactAreas = [
  {
    number: "01",
    eyebrow: "INVESTIGATION",
    title: "Independent security research",
    description: "Time and resources for careful investigation, controlled experiments, technical validation, and responsible disclosure.",
    detail: "Research that is evidence-led, reproducible, and honest about its limits."
  },
  {
    number: "02",
    eyebrow: "REAL-WORLD TESTING",
    title: "Isolated testing infrastructure",
    description: "Compute, lab environments, and specialist tooling for authorized experiments without putting real users or systems at risk.",
    detail: "A safer place to test, measure, learn, and improve."
  },
  {
    number: "03",
    eyebrow: "PUBLIC KNOWLEDGE",
    title: "Open learning & publications",
    description: "Interactive security explainers, practical learning labs, and research papers written to make complex security ideas easier to understand.",
    detail: "Knowledge that remains accessible to everyone."
  }
];

const principles = [
  ["No paywall", "Public learning resources remain free. A contribution never unlocks essential knowledge."],
  ["No invented impact", "No fabricated donor counts, progress bars, attack statistics, or success stories."],
  ["Proof before totals", "Only independently checked on-chain transfers can enter the confirmed donation record."],
  ["Clear ownership", "This is a personally managed research project, not a registered charity or nonprofit."]
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

      <section className="fund-hero fund-hero-premium">
        <div className="fund-hero-copy">
          <span className="section-index">INDEPENDENT CYBERSECURITY RESEARCH · VOLUNTARY SUPPORT</span>
          <div className="fund-open-status"><i /> CONTRIBUTION INTAKE NOT OPEN</div>
          <h1>Help make security knowledge <em>more open.</em></h1>
          <p className="security-lead">Behind every useful security lesson is time spent researching, testing, documenting, and making the result understandable. Voluntary support can help keep that work moving — and keep the learning open to everyone.</p>
          <div className="fund-hero-actions">
            <a className="fund-primary-link" href="#research-impact">See what support makes possible <span>↓</span></a>
            <Link className="fund-secondary-link" href="/security">Explore the security lab ↗</Link>
          </div>
          <p className="fund-hero-note">No pressure. No membership. No paid access to essential research.</p>
        </div>
        <div className="fund-visual" aria-label="Abstract illustration representing open cybersecurity research">
          <div className="fund-visual-orbit fund-orbit-one" />
          <div className="fund-visual-orbit fund-orbit-two" />
          <div className="fund-visual-core">
            <span className="fund-core-overline">OPEN KNOWLEDGE</span>
            <strong>SECURITY<br /><em>FOR ALL</em></strong>
            <span className="fund-core-rule" />
            <small>RESEARCH · VERIFY · SHARE</small>
          </div>
          <span className="fund-visual-tag fund-tag-top">EVIDENCE FIRST</span>
          <span className="fund-visual-tag fund-tag-bottom">PUBLIC LEARNING</span>
          <span className="fund-visual-cross fund-cross-one">+</span>
          <span className="fund-visual-cross fund-cross-two">+</span>
        </div>
      </section>

      <section className="fund-values-strip" aria-label="Project commitments">
        <div><strong>FREE</strong><span>Public learning</span></div>
        <div><strong>REAL</strong><span>Evidence-led research</span></div>
        <div><strong>OPEN</strong><span>Transparent records</span></div>
        <div><strong>VOLUNTARY</strong><span>Support by choice</span></div>
      </section>

      <section className="security-section fund-section fund-impact" id="research-impact">
        <div className="security-section-heading">
          <div><span className="section-index">01 / WHAT YOUR SUPPORT MAKES POSSIBLE</span><h2>Fuel the work. Share the knowledge.</h2></div>
          <span className="section-aside">THREE AREAS OF FOCUS</span>
        </div>
        <p className="fund-section-intro">The goal is not to sell access. It is to build a stronger body of practical security knowledge and make more of it available to the public.</p>
        <div className="fund-impact-grid">
          {impactAreas.map((item) => (
            <article className="fund-impact-card" key={item.number}>
              <div className="fund-impact-top"><span>{item.number}</span><small>{item.eyebrow}</small></div>
              <div className="fund-impact-symbol" aria-hidden="true">{item.number === "01" ? "⌁" : item.number === "02" ? "◈" : "✳"}</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <div className="fund-impact-detail">{item.detail}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="security-section fund-section fund-why">
        <div className="fund-why-panel">
          <span className="section-index">WHY THIS MATTERS</span>
          <h2>Security should not be a black box.</h2>
          <p>People deserve more than dramatic screens and impressive-sounding claims. They deserve explanations they can inspect, experiments with clear boundaries, and findings backed by evidence.</p>
          <p>This project is being built around that idea: learn in public, test responsibly, document honestly, and never pretend that an unverified result is real.</p>
          <Link href="/security">Explore the public security experience ↗</Link>
        </div>
        <div className="fund-principles">
          {principles.map(([title, description], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="security-section fund-section">
        <div className="security-section-heading">
          <div><span className="section-index">02 / FUND TRANSPARENCY</span><h2>Every number must earn its place.</h2></div>
          <span className="section-aside">BLOCKCHAIN-VERIFIED ONLY</span>
        </div>
        <div className="fund-transparency-layout">
          <div className="fund-empty-total">
            <span className="fund-empty-mark">CONFIRMED CONTRIBUTIONS</span>
            <strong>No confirmed donations yet</strong>
            <p>Contribution intake is not open. When it is, public totals will appear only after real transactions are verified and reconciled. No sample or estimated donations will be included.</p>
            <p lang="my">လက်ရှိမှာ အလှူလက်ခံမှု မဖွင့်ရသေးပါ။ အမှန်တကယ်ရရှိပြီး Blockchain မှာ စစ်ဆေးအတည်ပြုထားတဲ့ အလှူငွေတွေရှိလာမှသာ ဒီနေရာမှာ စုစုပေါင်းကို ဖော်ပြပါမယ်။</p>
          </div>
          <div className="fund-transparency-points">
            <article><span>01</span><div><strong>Verified on-chain</strong><p>Network, recipient, asset, amount, and confirmation state must match.</p></div></article>
            <article><span>02</span><div><strong>Pending is not received</strong><p>Unconfirmed transfers stay separate and never inflate confirmed totals.</p></div></article>
            <article><span>03</span><div><strong>Receipts are not impact</strong><p>Receiving a transfer does not prove how funds were later spent. Spending needs its own records.</p></div></article>
          </div>
        </div>
        <div className="fund-asset-grid">
          <article className="fund-asset-card"><span>BTC</span><strong>Not connected</strong><small>Bitcoin · Network not enabled</small></article>
          <article className="fund-asset-card"><span>ETH</span><strong>Not connected</strong><small>Ethereum · Network not enabled</small></article>
          <article className="fund-asset-card"><span>USDT</span><strong>Not connected</strong><small>Network selection required</small></article>
        </div>
        <p className="security-footnote">These are potential asset categories only. No receiving wallet, token contract, or donation network is active or published.</p>
      </section>

      <section className="security-section fund-section">
        <div className="security-section-heading"><div><span className="section-index">03 / HOW THE FUND IS MANAGED</span><h2>Clear purpose. Careful accounting.</h2></div><span className="section-aside">PERSONALLY MANAGED</span></div>
        <div className="fund-account-grid">
          <article><span>Total received</span><strong>Not available yet</strong><small>Confirmed donations only</small></article>
          <article><span>Research spending</span><strong>Not available yet</strong><small>Published after record review</small></article>
          <article><span>Remaining fund</span><strong>Not available yet</strong><small>Reconciled accounting balance</small></article>
          <article><span>Last reconciliation</span><strong>Not started</strong><small>No live wallet integration</small></article>
        </div>
        <p className="security-footnote">Wallet balances, confirmed receipts, expenses, and internal transfers will be reported separately. Owner-managed spending is not an independent audit. Any fiat estimate will include its currency, rate source, and valuation time.</p>
      </section>

      <section className="security-section fund-section fund-ledger-section">
        <div className="security-section-heading"><div><span className="section-index">04 / PUBLIC DONATION LEDGER</span><h2>A record you can check.</h2></div><span className="section-aside">APPEND-ONLY · READ ONLY</span></div>
        <div className="fund-ledger-empty">
          <span className="fund-ledger-icon">⌁</span>
          <strong>No verified transactions to display.</strong>
          <p>When contributions are enabled, eligible entries will show the asset, exact network, amount, transaction hash, confirmation state, and block time. Pending transfers will be clearly separated.</p>
          <p lang="my">အလှူလက်ခံမှု စတင်ပြီး အတည်ပြုထားတဲ့ Transaction များရှိလာမှသာ Coin အမျိုးအစား၊ Network၊ ပမာဏ၊ Transaction Hash နဲ့ အတည်ပြုမှုအခြေအနေတို့ကို ဒီနေရာမှာ ဖော်ပြပါမယ်။</p>
        </div>
      </section>

      <section className="security-section fund-section">
        <div className="security-section-heading"><div><span className="section-index">05 / BEFORE CONTRIBUTING</span><h2>Make an informed choice.</h2></div><span className="section-aside">ALWAYS OPTIONAL</span></div>
        <div className="fund-disclosure fund-final-disclosure">
          <div>
            <span className="fund-disclosure-kicker">PERSONAL PROJECT DISCLOSURE</span>
            <h3>Your support helps the work continue — it does not buy a promise.</h3>
            <p>This is a personally operated research project, not a registered charity or nonprofit organization. Contributions, if enabled, will be voluntary and personally received and managed by the project owner. They are not investments and provide no ownership, financial return, or guaranteed outcome.</p>
            <p lang="my">ဤ Project သည် ပိုင်ရှင်ကိုယ်တိုင် စီမံခန့်ခွဲသော ကိုယ်ပိုင်သုတေသနလုပ်ငန်းဖြစ်ပြီး မှတ်ပုံတင်ထားသော အလှူအဖွဲ့အစည်း မဟုတ်ပါ။ လှူဒါန်းမှုသည် ဆန္ဒအလျောက်ဖြစ်ပြီး အမြတ်ငွေ၊ ပိုင်ဆိုင်ခွင့် သို့မဟုတ် အကျိုးအမြတ်တစ်စုံတစ်ရာကို အာမခံမပေးပါ။</p>
          </div>
          <div className="fund-risk-notes">
            <strong>Before sending any cryptocurrency</strong>
            <ul>
              <li>Review applicable tax and legal requirements in your jurisdiction. No tax-deductible status or regulatory approval is claimed.</li>
              <li>Crypto transfers are generally irreversible. A wrong asset or network can result in permanent loss.</li>
              <li>Public blockchain activity can be traced. A transaction hash does not make a donor anonymous.</li>
              <li>Never share a seed phrase, private key, or wallet recovery code with anyone.</li>
            </ul>
            <p lang="my">Crypto လွှဲပြောင်းမှုကို ပုံမှန်အားဖြင့် ပြန်ဖျက်၍မရပါ။ Network မှားပို့ခြင်းကြောင့် ဆုံးရှုံးနိုင်ပြီး Public Blockchain ပေါ်က လှုပ်ရှားမှုများကိုလည်း ခြေရာခံနိုင်ပါတယ်။ Seed Phrase နဲ့ Private Key ကို မည်သူ့ကိုမျှ မပေးပါနဲ့။</p>
          </div>
          <div className="fund-intake-state">
            <span className="fund-intake-indicator"><i /> NOT OPEN</span>
            <strong>Contribution details are not available yet.</strong>
            <p>Wallet custody, exact network support, verification, and applicable legal/tax review must be completed before any address is published. Please do not send funds to addresses shared outside this official page.</p>
          </div>
        </div>
      </section>

      <section className="fund-closing">
        <span className="section-index">THANK YOU FOR CARING ABOUT OPEN SECURITY KNOWLEDGE</span>
        <h2>Explore first.<br /><em>Support when ready.</em></h2>
        <p>Whether you contribute or simply learn and share what you discover, you are welcome here.</p>
        <Link href="/security">Visit the public security lab ↗</Link>
      </section>

      <footer className="security-footer">
        <div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT</strong></div>
        <p>Transparent records are not a charity certification or financial audit.</p>
        <Link href="/security">Security dashboard ↗</Link>
      </footer>
    </main>
  );
}
