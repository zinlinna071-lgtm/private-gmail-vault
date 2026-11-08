"use client";

import Link from "next/link";
import { useState } from "react";

const chapters = [
  {
    id: "question",
    label: "01 / THE QUESTION",
    eyebrow: "START WITH THE PRINCIPLE",
    title: "Why must a nonce never repeat?",
    body: "AES-GCM combines encryption with authentication. Its security depends on using a unique nonce for every encryption performed with the same key. A nonce is not a password and does not need to be secret; uniqueness is the critical property.",
    my: "AES-GCM မှာ Key တစ်ခုတည်းကို အသုံးပြုပြီး စာဝှက်တိုင်းအတွက် Nonce အသစ်တစ်ခုစီ လိုအပ်ပါတယ်။ Nonce ကို လျှို့ဝှက်ထားဖို့ထက် ထပ်မသုံးမိဖို့က အရေးကြီးပါတယ်။",
    takeaway: "A nonce may be public. Reuse is the danger.",
    takeawayMy: "Nonce ကို သိရှိနိုင်တာက ပြဿနာမဟုတ်ပါဘူး။ ပြန်သုံးမိတာက အန္တရာယ်ပါ။",
  },
  {
    id: "model",
    label: "02 / SAFE MODEL",
    eyebrow: "COMPARE THE INPUTS",
    title: "One key. Two messages. Two nonces.",
    body: "The same key is used for both records, while each encryption receives a distinct nonce. This is a conceptual model—not a cryptographic operation, captured traffic, or a live system event.",
    my: "Record နှစ်ခုလုံးမှာ Key တစ်ခုတည်းကို သုံးထားပေမယ့် Encryption တစ်ကြိမ်စီအတွက် Nonce မတူညီပါဘူး။ ဒီပုံဟာ သဘောတရားပြပုံသာဖြစ်ပြီး တကယ့် Encryption သို့မဟုတ် Network Traffic မဟုတ်ပါဘူး။",
    takeaway: "Keep the key context. Change the nonce every time.",
    takeawayMy: "Key တူနေလည်း Encryption တစ်ကြိမ်စီမှာ Nonce အသစ်ဖြစ်ရပါမယ်။",
  },
  {
    id: "decision",
    label: "03 / YOUR DECISION",
    eyebrow: "ACTIVE RECALL",
    title: "Choose the safer design.",
    body: "You are encrypting two records with the same AES-GCM key. Which nonce strategy should the application use?",
    my: "AES-GCM Key တစ်ခုတည်းနဲ့ Record နှစ်ခုကို စာဝှက်မယ်ဆိုရင် ဘယ် Nonce နည်းလမ်းကို ရွေးချယ်သင့်သလဲ။",
    takeaway: "Make the decision before revealing the rule.",
    takeawayMy: "စည်းမျဉ်းကို မကြည့်ခင် ကိုယ်တိုင်အရင်ဆုံးဖြတ်ကြည့်ပါ။",
  },
  {
    id: "finding",
    label: "04 / THE FINDING",
    eyebrow: "APPLY THE RULE",
    title: "Uniqueness is a security requirement.",
    body: "Reusing a nonce with the same AES-GCM key can expose relationships between plaintexts and enable authentication forgeries. Use a fresh, unique 96-bit nonce for each encryption under a given key. Design nonce allocation so collisions are prevented—not merely left to habit.",
    my: "Key တစ်ခုတည်းနဲ့ Nonce ပြန်သုံးမိရင် မူရင်းစာသားတွေရဲ့ ဆက်စပ်မှု ပေါ်ထွက်နိုင်ပြီး Authentication ကို အတုလုပ်နိုင်တဲ့ အန္တရာယ်ရှိပါတယ်။ Key တစ်ခုအောက်က Encryption တစ်ကြိမ်စီမှာ 96-bit Nonce အသစ်၊ မတူညီတာကို အသုံးပြုပါ။",
    takeaway: "96-bit nonce · unique per key · every encryption.",
    takeawayMy: "96-bit Nonce · Key တစ်ခုစီအောက်မှာ မတူညီရ · Encryption တစ်ကြိမ်စီတိုင်း။",
  },
];

export default function ResearchStoriesPage() {
  const [chapter, setChapter] = useState(0);
  const [choice, setChoice] = useState<"repeat" | "fresh" | null>(null);
  const current = chapters[chapter];
  const correct = choice === "fresh";
  const progress = ((chapter + 1) / chapters.length) * 100;

  function goToChapter(next: number) {
    setChapter(Math.max(0, Math.min(chapters.length - 1, next)));
  }

  return (
    <main className="security-shell nonce-story">
      <header className="security-nav">
        <Link className="security-brand" href="/security/research"><span className="security-brand-mark">V</span><span>PRIVATE ACCOUNT VAULT <small>INTERACTIVE RESEARCH STORY</small></span></Link>
        <nav className="security-nav-links"><Link href="/security">Security operations</Link><Link href="/security/research">Research library</Link></nav>
        <span className="security-nav-status">CONCEPT LESSON · SYNTHETIC</span>
      </header>

      <section className="security-hero nonce-hero">
        <div className="nonce-hero-copy">
          <div className="security-kicker">INTERACTIVE RESEARCH STORY · 01 / CRYPTOGRAPHIC DESIGN</div>
          <h1>One nonce.<br /><em>One use.</em></h1>
          <p className="security-lead">A visual investigation into AES-GCM nonce reuse. Explore the model, make a design decision, and connect the rule to secure application architecture.</p>
          <p className="security-lead" lang="my">AES-GCM မှာ Nonce ကို ဘာကြောင့် ပြန်မသုံးသင့်သလဲဆိုတာကို ပုံနဲ့တကွ လေ့လာပြီး လုံခြုံတဲ့ Design ကို ကိုယ်တိုင်ရွေးချယ်ကြည့်ပါ။</p>
          <div className="security-hero-meta"><span><b>MODE</b> Concept lesson</span><span><b>DATA</b> Synthetic only</span><span><b>EXECUTION</b> No encryption run</span></div>
        </div>
        <div className="nonce-hero-art" aria-label="Conceptual illustration showing a key and two distinct nonce values">
          <div className="nonce-art-top"><span>CRYPTOGRAPHIC MODEL</span><span>NOT LIVE DATA</span></div>
          <svg viewBox="0 0 480 310" role="img" aria-labelledby="nonce-svg-title nonce-svg-desc">
            <title id="nonce-svg-title">One key with two distinct nonces</title>
            <desc id="nonce-svg-desc">Two message paths share key K but each uses a different nonce, 01 and 02.</desc>
            <defs><linearGradient id="nonce-line" x1="0" x2="1"><stop offset="0" stopColor="#4ba98f"/><stop offset="1" stopColor="#8ce8d0"/></linearGradient><filter id="nonce-glow"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <circle cx="240" cy="145" r="66" fill="#123b3b" stroke="#5ed5b0" strokeOpacity=".65"/>
            <circle cx="240" cy="145" r="52" fill="none" stroke="#78e2c4" strokeOpacity=".24" strokeDasharray="3 7"/>
            <path d="M218 143a22 22 0 1 1 42 9h-8v13h-12v-13h-8v-9" fill="none" stroke="#b5f5df" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
            <text x="240" y="198" textAnchor="middle" fill="#b5f5df" fontSize="11" fontWeight="700">KEY K</text>
            <path d="M185 110C130 72 95 65 63 65M295 110C350 72 385 65 417 65M185 180C130 218 95 245 63 245M295 180C350 218 385 245 417 245" fill="none" stroke="url(#nonce-line)" strokeWidth="2" strokeOpacity=".48"/>
            <g filter="url(#nonce-glow)"><circle cx="63" cy="65" r="4" fill="#8ce8d0"/><circle cx="417" cy="65" r="4" fill="#8ce8d0"/><circle cx="63" cy="245" r="4" fill="#8ce8d0"/><circle cx="417" cy="245" r="4" fill="#8ce8d0"/></g>
            <g><rect x="18" y="26" width="120" height="74" rx="10" fill="#0b202b" stroke="#397d6c"/><text x="78" y="49" textAnchor="middle" fill="#80b9aa" fontSize="9">MESSAGE A</text><text x="78" y="72" textAnchor="middle" fill="#d9fff0" fontSize="16" fontWeight="700">NONCE 01</text><text x="78" y="87" textAnchor="middle" fill="#70d8b7" fontSize="8">UNIQUE</text></g>
            <g><rect x="342" y="26" width="120" height="74" rx="10" fill="#0b202b" stroke="#397d6c"/><text x="402" y="49" textAnchor="middle" fill="#80b9aa" fontSize="9">MESSAGE B</text><text x="402" y="72" textAnchor="middle" fill="#d9fff0" fontSize="16" fontWeight="700">NONCE 02</text><text x="402" y="87" textAnchor="middle" fill="#70d8b7" fontSize="8">UNIQUE</text></g>
            <g><rect x="18" y="208" width="120" height="74" rx="10" fill="#0b202b" stroke="#397d6c"/><text x="78" y="231" textAnchor="middle" fill="#80b9aa" fontSize="9">SAME KEY</text><text x="78" y="254" textAnchor="middle" fill="#d9fff0" fontSize="15" fontWeight="700">AES-GCM</text><text x="78" y="269" textAnchor="middle" fill="#70d8b7" fontSize="8">ENCRYPTION A</text></g>
            <g><rect x="342" y="208" width="120" height="74" rx="10" fill="#0b202b" stroke="#397d6c"/><text x="402" y="231" textAnchor="middle" fill="#80b9aa" fontSize="9">SAME KEY</text><text x="402" y="254" textAnchor="middle" fill="#d9fff0" fontSize="15" fontWeight="700">AES-GCM</text><text x="402" y="269" textAnchor="middle" fill="#70d8b7" fontSize="8">ENCRYPTION B</text></g>
          </svg>
          <div className="nonce-art-foot"><span><i /> SAME KEY CONTEXT</span><span><i /> DISTINCT NONCES</span></div>
        </div>
      </section>

      <section className="nonce-progress-wrap" aria-label="Story progress">
        <div className="nonce-progress-label"><span>YOUR LEARNING PATH</span><strong>{String(chapter + 1).padStart(2, "0")} <i>/</i> 04</strong></div>
        <div className="nonce-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Story completion"><span style={{ width: progress + "%" }} /></div>
      </section>

      <section className="security-section nonce-learning-layout" aria-label="Interactive research story">
        <aside className="nonce-chapter-rail">
          <div className="nonce-rail-heading"><span className="section-index">FIELD NOTES</span><small>CHAPTER NAVIGATION</small></div>
          {chapters.map((item, index) => <button key={item.id} type="button" className={chapter === index ? "nonce-chapter active" : "nonce-chapter"} aria-current={chapter === index ? "step" : undefined} onClick={() => goToChapter(index)}><span className="nonce-chapter-number">{String(index + 1).padStart(2, "0")}</span><span className="nonce-chapter-copy"><small>{item.label}</small><b>{item.title}</b></span><span className="nonce-chapter-state">{index < chapter ? "✓" : index === chapter ? "●" : "—"}</span></button>)}
          <div className="nonce-rail-note"><b>LEARNING METHOD</b><p>Observe → Compare → Decide → Apply</p><p lang="my">လေ့လာ → နှိုင်းယှဉ် → ဆုံးဖြတ် → အသုံးချ</p></div>
        </aside>

        <article className="nonce-chapter-panel" aria-live="polite" key={current.id}>
          <div className="nonce-panel-top"><span className="section-index">{current.eyebrow}</span><span className="nonce-panel-count">CHAPTER {String(chapter + 1).padStart(2, "0")}</span></div>
          <h2>{current.title}</h2>
          <p className="nonce-panel-body">{current.body}</p>
          <p className="nonce-panel-body" lang="my">{current.my}</p>

          {chapter === 0 && <div className="nonce-principle-card"><span className="nonce-principle-icon">01</span><div><b>THE CORE PRINCIPLE</b><strong>Nonce uniqueness is mandatory.</strong><p>A nonce is a value used once within its key context. It is not a substitute for a key and is not intended to be a secret.</p></div></div>}

          {chapter === 1 && <div className="nonce-compare">
            <div className="nonce-compare-card"><span>ENCRYPTION A</span><b>Key K</b><strong>Nonce 01</strong><small>Distinct value</small></div>
            <div className="nonce-compare-connector"><span>≠</span><small>NONCE VALUES</small></div>
            <div className="nonce-compare-card"><span>ENCRYPTION B</span><b>Key K</b><strong>Nonce 02</strong><small>Distinct value</small></div>
            <p>Same key · different nonce values · conceptual illustration only</p>
          </div>}

          {chapter === 2 && <div className="nonce-decision">
            <div className="nonce-decision-heading"><span>DESIGN REVIEW / 01</span><b>SELECT ONE STRATEGY</b></div>
            <button type="button" className={choice === "repeat" ? "nonce-option selected" : "nonce-option"} aria-pressed={choice === "repeat"} onClick={() => setChoice("repeat")}><span className="nonce-option-letter">A</span><span><b>Reuse the previous nonce</b><small>Use the same nonce value for the next record.</small></span><i>{choice === "repeat" ? "SELECTED" : "CHOOSE"}</i></button>
            <button type="button" className={choice === "fresh" ? "nonce-option selected" : "nonce-option"} aria-pressed={choice === "fresh"} onClick={() => setChoice("fresh")}><span className="nonce-option-letter">B</span><span><b>Generate a fresh unique nonce</b><small>Use a new nonce value for every encryption under this key.</small></span><i>{choice === "fresh" ? "SELECTED" : "CHOOSE"}</i></button>
            {choice && <div className={correct ? "nonce-feedback success" : "nonce-feedback caution"} role="status"><b>{correct ? "CORRECT DESIGN" : "NOT SAFE — REVIEW THE MODEL"}</b><p>{correct ? "A fresh unique nonce is required for each encryption under the same AES-GCM key." : "Nonce reuse with the same AES-GCM key can compromise confidentiality and authentication. Select the fresh unique nonce strategy."}</p><p lang="my">{correct ? "မှန်ကန်ပါတယ်။ AES-GCM Key တစ်ခုတည်းအောက်မှာ စာဝှက်တိုင်း Nonce အသစ်လိုအပ်ပါတယ်။" : "ဒီနည်းလမ်းက မလုံခြုံပါဘူး။ Key တစ်ခုတည်းအောက်မှာ Nonce ပြန်မသုံးသင့်ပါဘူး။"}</p></div>}
          </div>}

          {chapter === 3 && <div className="nonce-rule-card"><span className="section-index">IMPLEMENTATION RULE</span><strong>96-bit nonce</strong><div className="nonce-rule-tags"><span>UNIQUE PER KEY</span><span>EVERY ENCRYPTION</span><span>COLLISION-AWARE</span></div><p>Use a carefully designed counter or a cryptographically secure random strategy with collision management appropriate to the message volume. Never assume a nonce is secret.</p><p lang="my">Counter စနစ်ကို သေချာဒီဇိုင်းလုပ်ခြင်း သို့မဟုတ် အသုံးပြုမည့် Message အရေအတွက်နဲ့ ကိုက်ညီတဲ့ Collision စီမံခန့်ခွဲမှုပါဝင်သော လုံခြုံတဲ့ Random နည်းလမ်းကို သုံးပါ။</p><small>Reference: NIST SP 800-38D, §§8.2–8.3. This lesson is conceptual, not a test result for this application.</small></div>}

          <div className="nonce-takeaway"><span>CHAPTER TAKEAWAY</span><b>{current.takeaway}</b><p lang="my">{current.takeawayMy}</p></div>
          <div className="nonce-story-controls"><button type="button" onClick={() => goToChapter(chapter - 1)} disabled={chapter === 0}>← PREVIOUS</button><button type="button" onClick={() => goToChapter(chapter + 1)} disabled={chapter === 3 || (chapter === 2 && !correct)}>NEXT CHAPTER <span>↗</span></button></div>
        </article>
      </section>

      <section className="security-section nonce-next">
        <div><span className="section-index">CONTINUE THE INVESTIGATION</span><h2>Next: see authentication detect tampering.</h2><p>Run a browser-local AES-GCM example with synthetic text, then alter one ciphertext bit and observe tag verification reject it.</p><p lang="my">နောက်သင်ခန်းစာမှာ Browser ထဲက Web Crypto ကို အသုံးပြုပြီး စိတ်ကူးယဉ်စာသားကို တကယ်စာဝှက်ပါမယ်။ Ciphertext ကို ပြောင်းလဲပြီး Authentication က ဘယ်လိုပယ်ချသလဲ ကြည့်နိုင်ပါတယ်။</p><Link href="/security/research-stories/aes-gcm-integrity">OPEN STORY 02 · BROWSER INTEGRITY DEMONSTRATION ↗</Link></div>
        <div className="nonce-next-index"><span>02</span><small>INTEGRITY</small><b>AUTHENTICATED<br />ENCRYPTION</b></div>
      </section>

      <section className="security-section nonce-disclosure"><span className="section-index">EVIDENCE & LIMITATIONS</span><h2>What this story does—and does not—prove.</h2><p>This is an illustrative learning module. It uses no real keys, records, telemetry, external targets, or cryptographic execution. It explains a documented cryptographic rule; it does not audit or certify this Vault implementation.</p><p lang="my">ဒီသင်ခန်းစာမှာ တကယ့် Key၊ Record၊ Telemetry၊ ပြင်ပ Target သို့မဟုတ် Encryption လုပ်ဆောင်ချက် မပါဝင်ပါဘူး။ Cryptography စည်းမျဉ်းကို ရှင်းပြတာသာဖြစ်ပြီး Vault ရဲ့ လုံခြုံရေးကို Audit လုပ်ထားတာ မဟုတ်ပါဘူး။</p><Link href="/security/puzzle-arena">Try the Safe Puzzle Arena · Five defensive challenges ↗</Link><br /><Link href="/security/research">← Back to Research Library</Link></section>

      <footer className="security-footer"><div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT</strong></div><p>Learn by exploring. Verify before concluding.</p></footer>

      <style jsx>{`
        .nonce-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.82fr);gap:clamp(22px,5vw,64px);align-items:center;padding-top:clamp(34px,6vw,68px);padding-bottom:clamp(34px,6vw,68px)}
        .nonce-hero-copy{min-width:0}.nonce-hero h1{font-size:clamp(48px,7.2vw,86px);line-height:.94;letter-spacing:-.075em}.nonce-hero h1 em{color:#83e4c5;font-style:normal}
        .nonce-hero-art{min-width:0;padding:15px;border:1px solid #315b61;border-radius:16px;background:radial-gradient(ellipse at 50% 45%,#17433e 0%,#0b202b 58%,#091722 100%);box-shadow:0 24px 70px #0005,inset 0 0 45px #73e2bd0c}
        .nonce-art-top,.nonce-art-foot{display:flex;justify-content:space-between;gap:10px;color:#83aaa5;font:800 8px/1.5 var(--vault-font-mono);letter-spacing:.12em}.nonce-hero-art svg{display:block;width:100%;height:auto;margin:8px 0}.nonce-art-foot{justify-content:center;gap:20px}.nonce-art-foot span{display:flex;align-items:center;gap:7px}.nonce-art-foot i{width:6px;height:6px;border-radius:50%;background:#79dfbd}
        .nonce-progress-wrap{width:min(100% - 48px,1180px);margin:4px auto 0;padding:0 0 22px}.nonce-progress-label{display:flex;justify-content:space-between;color:#84aaa8;font:800 9px/1.5 var(--vault-font-mono);letter-spacing:.12em}.nonce-progress-label strong{color:#c7f6e5}.nonce-progress-label i{color:#5b8580;font-style:normal}.nonce-progress-track{height:4px;margin-top:9px;overflow:hidden;border-radius:9px;background:#19333e}.nonce-progress-track span{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,#4ca88f,#9cf0d1);box-shadow:0 0 15px #65d7b45c;transition:width .35s ease}
        .nonce-learning-layout{display:grid;grid-template-columns:minmax(235px,.68fr) minmax(0,1.65fr);gap:18px;align-items:start}
        .nonce-chapter-rail,.nonce-chapter-panel{min-width:0;border:1px solid #24434d;border-radius:15px;background:linear-gradient(150deg,#0d202c,#091722)}
        .nonce-chapter-rail{position:sticky;top:18px;padding:17px}.nonce-rail-heading{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:3px 2px 14px}.nonce-rail-heading small{color:#678a92;font:700 7px var(--vault-font-mono);letter-spacing:.1em}
        .nonce-chapter{display:flex;align-items:center;gap:11px;width:100%;padding:13px 10px;margin:5px 0;border:1px solid transparent;border-radius:9px;background:transparent;color:#9db5bc;text-align:left;cursor:pointer;transition:background .2s,border-color .2s}
        .nonce-chapter:hover{background:#102b34}.nonce-chapter.active{border-color:#4b8978;background:linear-gradient(110deg,#143b36,#102a32);color:#effff8}
        .nonce-chapter-number{display:grid;place-items:center;flex:0 0 30px;height:30px;border:1px solid #2a4a53;border-radius:8px;color:#83cdb4;font:800 10px var(--vault-font-mono)}.nonce-chapter.active .nonce-chapter-number{border-color:#6bcda9;background:#1a5145;color:#e0fff1}
        .nonce-chapter-copy{display:grid;gap:5px;min-width:0}.nonce-chapter-copy small{color:#75c6a9;font:800 7px var(--vault-font-mono);letter-spacing:.09em}.nonce-chapter-copy b{font-size:11px;line-height:1.4}.nonce-chapter-state{margin-left:auto;color:#6fcba8;font-size:10px}
        .nonce-rail-note{margin-top:17px;padding:14px;border:1px solid #25444b;border-radius:9px;background:#091923}.nonce-rail-note>b{color:#78d7b6;font:800 8px var(--vault-font-mono);letter-spacing:.12em}.nonce-rail-note p{margin:7px 0 0;color:#9bb5b7;font-size:10px;line-height:1.6}
        .nonce-chapter-panel{padding:clamp(19px,3.5vw,36px);animation:nonce-panel-in .28s ease both}.nonce-panel-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.nonce-panel-count{color:#688d93;font:800 8px var(--vault-font-mono);letter-spacing:.12em}
        .nonce-chapter-panel h2{margin:18px 0 14px;color:#effff9;font-size:clamp(27px,4vw,42px);line-height:1.1;letter-spacing:-.045em}.nonce-panel-body{max-width:78ch;color:#a9c0c5;font-size:13px;line-height:1.9}.nonce-panel-body[lang="my"]{color:#c0d2d0;line-height:2}
        .nonce-principle-card{display:flex;gap:15px;margin:24px 0;padding:19px;border:1px solid #32685c;border-radius:11px;background:linear-gradient(115deg,#12352f,#0b2029)}.nonce-principle-icon{display:grid;place-items:center;flex:0 0 42px;height:42px;border:1px solid #4b9a7d;border-radius:10px;color:#9df0d0;font:800 12px var(--vault-font-mono)}.nonce-principle-card div{display:grid;gap:7px}.nonce-principle-card b,.nonce-decision-heading span{color:#79d9b7;font:800 8px var(--vault-font-mono);letter-spacing:.13em}.nonce-principle-card strong{color:#e3fff3;font-size:17px}.nonce-principle-card p{margin:0;color:#9dbbb4;font-size:11px;line-height:1.7}
        .nonce-compare{display:grid;grid-template-columns:1fr 70px 1fr;align-items:center;gap:8px;margin:24px 0}.nonce-compare-card{display:grid;gap:10px;min-width:0;padding:17px 12px;border:1px solid #397263;border-radius:11px;background:radial-gradient(ellipse at top,#17443b,#0b202a)}.nonce-compare-card span{color:#85b9a9;font:800 8px var(--vault-font-mono);letter-spacing:.1em}.nonce-compare-card b{color:#d8eee7;font-size:12px}.nonce-compare-card strong{color:#9ef0d1;font:800 clamp(14px,2vw,20px) var(--vault-font-mono)}.nonce-compare-card small{color:#7bc8aa;font-size:9px}.nonce-compare-connector{text-align:center}.nonce-compare-connector span{display:grid;place-items:center;width:35px;height:35px;margin:auto;border:1px solid #4a8876;border-radius:50%;color:#a1efd2;font-size:20px}.nonce-compare-connector small{display:block;margin-top:7px;color:#759c98;font:700 7px var(--vault-font-mono)}.nonce-compare>p{grid-column:1/-1;margin:5px 0 0;color:#78989c;text-align:center;font-size:9px}
        .nonce-decision{display:grid;gap:10px;margin:24px 0}.nonce-decision-heading{display:flex;justify-content:space-between;gap:10px;padding-bottom:9px;border-bottom:1px solid #23424b}.nonce-decision-heading b{color:#7e9da1;font:700 8px var(--vault-font-mono)}.nonce-option{display:flex;align-items:center;gap:12px;width:100%;padding:14px;border:1px solid #2a4c56;border-radius:10px;background:#0b1d28;color:#d7eae5;text-align:left;cursor:pointer;transition:border-color .18s,background .18s}.nonce-option:hover,.nonce-option.selected{border-color:#65cda9;background:#12352f}.nonce-option-letter{display:grid;place-items:center;flex:0 0 32px;height:32px;border:1px solid #355b62;border-radius:8px;color:#9ce9cd;font:800 12px var(--vault-font-mono)}.nonce-option>span:nth-child(2){display:grid;gap:5px;min-width:0}.nonce-option b{font-size:12px}.nonce-option small{color:#93adb3;font-size:10px;line-height:1.5}.nonce-option i{margin-left:auto;color:#7ec9ae;font:800 7px var(--vault-font-mono);font-style:normal;letter-spacing:.08em}.nonce-feedback{padding:15px;border:1px solid #806b46;border-radius:9px;background:#29251b}.nonce-feedback.success{border-color:#397c66;background:#102e29}.nonce-feedback>b{color:#f0d3a0;font:800 8px var(--vault-font-mono);letter-spacing:.12em}.nonce-feedback.success>b{color:#8be6c2}.nonce-feedback p{margin:8px 0 0;color:#c5b69e;font-size:11px;line-height:1.7}.nonce-feedback.success p{color:#b5d8ca}
        .nonce-rule-card{margin:24px 0;padding:20px;border:1px solid #39735f;border-radius:11px;background:linear-gradient(130deg,#12352f,#0a2029)}.nonce-rule-card>strong{display:block;margin:13px 0;color:#e2fff2;font:800 clamp(24px,4vw,36px) var(--vault-font-mono);letter-spacing:-.05em}.nonce-rule-tags{display:flex;flex-wrap:wrap;gap:7px}.nonce-rule-tags span{padding:7px 9px;border:1px solid #376e5e;border-radius:5px;color:#9ce9c9;font:800 7px var(--vault-font-mono);letter-spacing:.08em}.nonce-rule-card p{color:#a9c3ba;font-size:11px;line-height:1.8}.nonce-rule-card small{display:block;margin-top:13px;padding-top:12px;border-top:1px solid #2a5146;color:#84a59a;font-size:9px;line-height:1.7}
        .nonce-takeaway{margin-top:24px;padding:16px 18px;border-left:2px solid #70d9b5;background:linear-gradient(90deg,#12342f,#0c2029)}.nonce-takeaway>span{color:#7bdcba;font:800 8px var(--vault-font-mono);letter-spacing:.14em}.nonce-takeaway>b{display:block;margin-top:8px;color:#e4fff4;font-size:14px}.nonce-takeaway p{margin:6px 0 0;color:#a9c7bd;font-size:11px;line-height:1.7}
        .nonce-story-controls{display:flex;justify-content:space-between;gap:12px;margin-top:25px;padding-top:18px;border-top:1px solid #23414b}.nonce-story-controls button{min-height:42px;padding:0 15px;border:1px solid #397563;border-radius:7px;background:#102c2a;color:#a5efd3;font-size:9px;font-weight:900;letter-spacing:.08em;cursor:pointer}.nonce-story-controls button:disabled{opacity:.35;cursor:not-allowed}.nonce-story-controls button:last-child{background:linear-gradient(100deg,#1b5b4b,#17463f);color:#d6ffed}
        .nonce-next{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:25px;margin-top:35px;padding:clamp(22px,4vw,36px);border:1px solid #315b61;border-radius:15px;background:radial-gradient(ellipse at 85% 20%,#1c625322,transparent 45%),linear-gradient(130deg,#102b38,#091722)}.nonce-next h2,.nonce-disclosure h2{margin:13px 0;color:#edfff8;font-size:clamp(23px,3vw,32px);letter-spacing:-.04em}.nonce-next p,.nonce-disclosure p{max-width:75ch;color:#a9bfca;font-size:12px;line-height:1.9}.nonce-next a,.nonce-disclosure a{display:inline-block;margin-top:12px;color:#8ce8d0;font-size:9px;font-weight:900;letter-spacing:.06em;text-decoration:none}.nonce-next-index{display:grid;place-items:center;min-width:130px;padding:20px;border:1px solid #397263;border-radius:12px;background:#0b202b}.nonce-next-index span{color:#a0f1d2;font:800 55px var(--vault-font-mono);letter-spacing:-.08em}.nonce-next-index small{color:#7ec6ac;font:800 8px var(--vault-font-mono);letter-spacing:.16em}.nonce-next-index b{margin-top:10px;color:#9bb9b5;text-align:center;font:800 8px/1.6 var(--vault-font-mono)}
        .nonce-disclosure{margin-top:22px;padding:clamp(20px,3vw,30px);border:1px solid #284752;border-radius:14px;background:#0a1b27}.nonce-disclosure p[lang="my"]{line-height:2}
        @keyframes nonce-panel-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:850px){.nonce-hero{grid-template-columns:1fr}.nonce-hero-art{width:min(100%,560px);margin-inline:auto}.nonce-learning-layout{grid-template-columns:1fr}.nonce-chapter-rail{position:static}.nonce-chapter{padding:11px}.nonce-rail-note{display:none}}
        @media(max-width:560px){.nonce-progress-wrap{width:calc(100% - 28px)}.nonce-hero-art{padding:9px}.nonce-art-top,.nonce-art-foot{font-size:6px}.nonce-chapter-rail{padding:12px}.nonce-chapter{gap:8px}.nonce-chapter-copy b{font-size:10px}.nonce-compare{grid-template-columns:1fr 38px 1fr;gap:4px}.nonce-compare-card{padding:13px 8px}.nonce-compare-card strong{font-size:13px}.nonce-compare-connector small{font-size:6px}.nonce-option{padding:12px 10px}.nonce-option i{font-size:6px}.nonce-next{grid-template-columns:1fr}.nonce-next-index{grid-template-columns:auto auto;justify-content:center;gap:12px}.nonce-next-index span{grid-row:span 2;font-size:42px}.nonce-next-index b{margin:0}.nonce-story-controls button{flex:1;padding:0 8px;font-size:8px}}
        @media(prefers-reduced-motion:reduce){.nonce-progress-track span,.nonce-chapter,.nonce-option{transition:none}.nonce-chapter-panel{animation:none}}
      `}</style>
    </main>
  );
}
