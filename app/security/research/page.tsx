import Link from "next/link";
import type { Metadata } from "next";
import { publishedResearch } from "@/lib/security-research/publications";

export const metadata: Metadata = {
  title: "Security Research Library | Private Account Vault",
  description: "Read evidence-backed cybersecurity research papers in English and Burmese, documenting authorized testing, methodology, findings, fixes, and limitations.",
  alternates: { canonical: "/security/research" },
  openGraph: {
    type: "website",
    title: "Bilingual Cybersecurity Research Library | Private Account Vault",
    description: "Evidence-backed cybersecurity research papers in English and Burmese."
  }
};

export default function SecurityResearchPage() {
  return (
    <main className="security-shell">
      <header className="security-nav">
        <Link className="security-brand" href="/">
          <span className="security-brand-mark">V</span>
          <span>PRIVATE ACCOUNT VAULT <small>RESEARCH LIBRARY</small></span>
        </Link>
        <nav className="security-nav-links" aria-label="Research navigation"><Link href="/security/architecture">UI/UX architecture</Link><Link href="/security">Security operations</Link><Link href="/security/collaboration">Human × AI</Link></nav><span className="security-nav-status">ENGLISH · မြန်မာ</span>
      </header>

      <section className="security-hero">
        <div className="security-kicker">SECURITY RESEARCH PUBLICATIONS · သုတေသနစာတမ်းများ</div>
        <h1>Research with evidence.<br /><em>Knowledge for everyone.</em></h1>
        <p className="security-lead">Read approved research papers directly on this website. Every publication includes its scope, methodology, evidence, findings, remediation, and limitations.</p>
        <p className="security-lead" lang="my">အတည်ပြုထားသော သုတေသနစာတမ်းများကို ဒီ Website ပေါ်မှာ တိုက်ရိုက်ဖတ်ရှုနိုင်ပါမယ်။ စမ်းသပ်မှုအတိုင်းအတာ၊ နည်းလမ်း၊ သက်သေအထောက်အထား၊ တွေ့ရှိချက်၊ ပြုပြင်ကာကွယ်မှုနှင့် ကန့်သတ်ချက်များ ပါဝင်မယ်။</p>
        <div className="security-hero-actions"><Link href="/security/research-stories">Story 01 · Why nonce reuse is dangerous ↗</Link><Link href="/security/research-stories/aes-gcm-integrity">Story 02 · See tamper detection in your browser ↗</Link><Link href="/security/puzzle-arena">Puzzle Arena · Test your defensive reasoning ↗</Link><span>ILLUSTRATIVE · SYNTHETIC DATA</span></div>
      </section>

      <section className="security-section research-reading-guide" aria-labelledby="research-reading-title">
        <div className="security-section-heading">
          <div><span className="section-index">HOW TO READ THE EVIDENCE</span><h2 id="research-reading-title">A result is only as broad as its test.</h2></div>
          <span className="section-aside">PLAIN LANGUAGE</span>
        </div>
        <p className="security-lead">A paper may describe a design, a source review, or an executed test. These are different kinds of evidence. Read the exact scope before drawing a conclusion.</p>
        <p className="security-lead" lang="my">စာတမ်းတစ်ခုမှာ ဒီဇိုင်းအကြောင်း၊ Code စစ်ဆေးချက်၊ ဒါမှမဟုတ် တကယ်လုပ်ဆောင်ခဲ့တဲ့ စမ်းသပ်မှု ပါဝင်နိုင်ပါတယ်။ ဒီအရာတွေဟာ သက်သေအမျိုးအစား မတူကြပါဘူး။ ရလဒ်ကို မဆုံးဖြတ်ခင် စမ်းသပ်ထားတဲ့ အတိုင်းအတာကို အရင်ဖတ်ပါ။</p>
        <div className="research-reading-list">
          <p><strong>PASS</strong><span>The named check succeeded in its recorded environment. It does not certify the whole product.</span></p>
          <p><strong>NOT RUN</strong><span>No test execution result exists. It is neither a pass nor a test failure.</span></p>
          <p><strong>LIMITED</strong><span>Only the stated component, behavior, or source area was reviewed.</span></p>
          <p><strong>PLANNED</strong><span>A proposed future task. It is not an implemented feature.</span></p>
        </div>
      </section>

      <section className="security-section">
        <div className="security-section-heading">
          <div><span className="section-index">01 / PUBLICATIONS</span><h2>Published research · ထုတ်ဝေပြီးစာတမ်းများ</h2></div>
          <span className="section-aside">{publishedResearch.length} PAPERS</span>
        </div>
        {publishedResearch.length ? (
          <div className="research-publication-list">
            {publishedResearch.map((paper) => (
              <article className="research-publication-card" key={paper.publicationId}>
                <div className="research-publication-meta">{paper.category} · {paper.publicationId} · v{paper.version}</div>
                <h3>{paper.title.en}</h3>
                <p>{paper.summary.en}</p>
                <h3 lang="my">{paper.title.my}</h3>
                <p lang="my">{paper.summary.my}</p>
                <div className="research-publication-footer">
                  <span>EN · MY · {paper.publishedAt}</span>
                  <Link href={`/security/research/${paper.slug}`}>Read paper / စာတမ်းဖတ်ရန် ↗</Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="research-empty-state">
            <span className="research-empty-mark">RESEARCH ARCHIVE / 00</span>
            <h3>No papers published yet.</h3>
            <h3 lang="my">သုတေသနစာတမ်းများ မထုတ်ဝေရသေးပါ။</h3>
            <p>Approved papers will appear here for everyone to read without signing in. We publish only after the test evidence, technical review, security/privacy review, bilingual review, and owner approval are complete.</p>
            <p lang="my">စာတမ်းတွေကို Login ဝင်စရာမလိုဘဲ လူတိုင်းဖတ်နိုင်အောင် ဒီနေရာမှာ ထုတ်ဝေမယ်။ စမ်းသပ်မှုအထောက်အထား၊ နည်းပညာစစ်ဆေးမှု၊ လုံခြုံရေးနှင့် ကိုယ်ရေးအချက်အလက်စစ်ဆေးမှု၊ ဘာသာပြန်စစ်ဆေးမှုနဲ့ ပိုင်ရှင်အတည်ပြုချက် ပြည့်စုံမှသာ ထုတ်ဝေမယ်။</p>
          </div>
        )}
      </section>

      <section className="security-section">
        <div className="security-section-heading">
          <div><span className="section-index">02 / PUBLICATION STANDARD</span><h2>One study. Two languages.</h2></div>
          <span className="section-aside">EN · MY</span>
        </div>
        <div className="security-module-grid">
          <article className="security-module"><span className="module-number">01</span><h3>English edition</h3><p>Technical terminology, reproducible methodology, references, and evidence provenance.</p></article>
          <article className="security-module"><span className="module-number">02</span><h3 lang="my">မြန်မာဘာသာမူ</h3><p lang="my">နည်းပညာဝေါဟာရများကို တိကျစွာထိန်းသိမ်းပြီး ဖတ်ရှုနားလည်လွယ်သော မြန်မာဘာသာဖြင့် ရှင်းပြချက်။</p></article>
          <article className="security-module"><span className="module-number">03</span><h3>Verified evidence</h3><p>Every factual claim maps to a test-run ID, exact commit, environment, and reviewed evidence.</p></article>
          <article className="security-module"><span className="module-number">04</span><h3>Web + PDF</h3><p>Web articles are the primary public format. Matching downloadable PDF editions are planned.</p></article>
        </div>
      </section>

      <section className="security-section security-method">
        <div><span className="section-index">03 / REVIEW WORKFLOW</span><h2>Reviewed before release.</h2></div>
        <div className="method-steps">
          <div><b>01</b><span><strong>Draft from verified test</strong><small>စာတမ်းမူကြမ်းကို အတည်ပြုထားသော စမ်းသပ်မှုမှသာ ရေးသားမည်။</small></span></div>
          <div><b>02</b><span><strong>Technical review</strong><small>နည်းလမ်း၊ ရလဒ်၊ ကိုးကားချက်နှင့် ဘာသာပြန်တိကျမှုကို စစ်ဆေးမည်။</small></span></div>
          <div><b>03</b><span><strong>Security & privacy review</strong><small>လျှို့ဝှက်ချက်၊ ကိုယ်ရေးအချက်အလက်နှင့် အလွဲသုံးစားပြုနိုင်သော အသေးစိတ်များကို ဖယ်ရှားမည်။</small></span></div>
          <div><b>04</b><span><strong>Owner approval & publication</strong><small>ပိုင်ရှင်အတည်ပြုပြီးမှ Website ပေါ်မှာ ထုတ်ဝေမည်။</small></span></div>
        </div>
      </section>

      <footer className="security-footer">
        <div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT</strong></div>
        <p>Research publication is not a security certification. စာတမ်းထုတ်ဝေခြင်းသည် လုံခြုံရေးအသိအမှတ်ပြုလက်မှတ် မဟုတ်ပါ။</p>
        <div className="security-footer-links"><Link href="/security/architecture">UI/UX engineering notes ↗</Link><Link href="/security">Security dashboard ↗</Link></div>
      </footer>
    </main>
  );
}
