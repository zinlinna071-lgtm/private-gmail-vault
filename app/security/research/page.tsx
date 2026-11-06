import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security Research Library | Private Account Vault",
  description: "Bilingual English and Burmese cybersecurity research papers based on verified, authorized security testing."
};

export default function SecurityResearchPage() {
  return (
    <main className="security-shell">
      <header className="security-nav">
        <Link className="security-brand" href="/">
          <span className="security-brand-mark">V</span>
          <span>PRIVATE ACCOUNT VAULT <small>RESEARCH LIBRARY</small></span>
        </Link>
        <span className="security-nav-status">ENGLISH · မြန်မာ</span>
      </header>

      <section className="security-hero">
        <div className="security-kicker">SECURITY RESEARCH PUBLICATIONS · သုတေသနစာတမ်းများ</div>
        <h1>Research with evidence.<br /><em>Knowledge for everyone.</em></h1>
        <p className="security-lead">Every approved paper will be published in English and Burmese, with its test scope, methodology, evidence, findings, remediation, and limitations.</p>
        <p className="security-lead" lang="my">အတည်ပြုထုတ်ဝေမည့် သုတေသနစာတမ်းတိုင်းကို အင်္ဂလိပ်နှင့် မြန်မာဘာသာနှစ်မျိုးဖြင့် ဖော်ပြမည်။ စမ်းသပ်မှုအတိုင်းအတာ၊ နည်းလမ်း၊ သက်သေအထောက်အထား၊ တွေ့ရှိချက်၊ ပြုပြင်ကာကွယ်မှုနှင့် ကန့်သတ်ချက်များ ပါဝင်မည်။</p>
      </section>

      <section className="security-notice">
        <span className="notice-icon">i</span>
        <div>
          <strong>Publication library is being prepared · စာတမ်းစာကြည့်တိုက် ပြင်ဆင်နေဆဲ</strong>
          <p>No research paper is listed until its underlying test run is verified and the paper passes technical review, security/privacy review, and owner approval.</p>
          <p lang="my">သက်ဆိုင်ရာ စမ်းသပ်မှုရလဒ်ကို အတည်ပြုပြီး နည်းပညာစစ်ဆေးမှု၊ လုံခြုံရေးနှင့် ကိုယ်ရေးအချက်အလက် စစ်ဆေးမှု၊ ပိုင်ရှင်၏ အတည်ပြုချက်တို့ မပြီးမချင်း စာတမ်းကို အများပြည်သူထံ မထုတ်ပြန်ပါ။</p>
        </div>
      </section>

      <section className="security-section">
        <div className="security-section-heading">
          <div><span className="section-index">01 / PUBLICATION STANDARD</span><h2>One study. Two languages.</h2></div>
          <span className="section-aside">EN · MY</span>
        </div>
        <div className="security-module-grid">
          <article className="security-module"><span className="module-number">01</span><h3>English edition</h3><p>Technical terminology, reproducible methodology, references, and evidence provenance.</p></article>
          <article className="security-module"><span className="module-number">02</span><h3 lang="my">မြန်မာဘာသာမူ</h3><p lang="my">နည်းပညာဝေါဟာရများကို တိကျစွာထိန်းသိမ်းပြီး ဖတ်ရှုနားလည်လွယ်သော မြန်မာဘာသာဖြင့် ရှင်းပြချက်။</p></article>
          <article className="security-module"><span className="module-number">03</span><h3>Verified evidence</h3><p>Every factual claim maps to a test-run ID, exact commit, environment, and reviewed evidence.</p></article>
          <article className="security-module"><span className="module-number">04</span><h3>Web + PDF</h3><p>Planned paired web articles and downloadable PDF editions with matching publication IDs and versions.</p></article>
        </div>
      </section>

      <section className="security-section security-method">
        <div><span className="section-index">02 / REVIEW WORKFLOW</span><h2>Reviewed before release.</h2></div>
        <div className="method-steps">
          <div><b>01</b><span><strong>Draft from verified test</strong><small>စာတမ်းမူကြမ်းကို အတည်ပြုထားသော စမ်းသပ်မှုမှသာ ရေးသားမည်။</small></span></div>
          <div><b>02</b><span><strong>Technical review</strong><small>နည်းလမ်း၊ ရလဒ်၊ ကိုးကားချက်နှင့် ဘာသာပြန်တိကျမှုကို စစ်ဆေးမည်။</small></span></div>
          <div><b>03</b><span><strong>Security & privacy review</strong><small>လျှို့ဝှက်ချက်၊ ကိုယ်ရေးအချက်အလက်နှင့် အလွဲသုံးစားပြုနိုင်သော အသေးစိတ်များကို ဖယ်ရှားမည်။</small></span></div>
          <div><b>04</b><span><strong>Owner approval & publication</strong><small>ပိုင်ရှင်အတည်ပြုပြီးမှ Web နှင့် PDF မူများကို ထုတ်ဝေမည်။</small></span></div>
        </div>
      </section>

      <footer className="security-footer">
        <div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT</strong></div>
        <p>Research publication is not a security certification. စာတမ်းထုတ်ဝေခြင်းသည် လုံခြုံရေးအသိအမှတ်ပြုလက်မှတ် မဟုတ်ပါ။</p>
        <Link href="/security">Security dashboard ↗</Link>
      </footer>
    </main>
  );
}
