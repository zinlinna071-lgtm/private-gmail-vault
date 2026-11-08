"use client";

import Link from "next/link";
import { useState } from "react";

const chapters = [
  { id: "question", label: "01 / THE QUESTION", title: "Why must a nonce never repeat?", body: "AES-GCM combines encryption with an authentication tag. Its security depends on using a unique nonce for every encryption performed with the same key. A nonce is not a password or a secret; uniqueness is the critical property.", my: "AES-GCM မှာ Key တစ်ခုတည်းကို သုံးပြီး စာဝှက်တိုင်းအတွက် Nonce အသစ်တစ်ခုစီ ဖြစ်ရပါမယ်။ Nonce ကို လျှို့ဝှက်ထားဖို့ထက် ထပ်မသုံးမိဖို့က အရေးကြီးပါတယ်။" },
  { id: "model", label: "02 / SAFE MODEL", title: "One key. Two messages. Two nonces.", body: "This is a conceptual illustration, not a cryptographic operation or captured traffic. The same key is shown twice so the only variable is nonce reuse.", my: "ဒီပုံက သဘောတရားရှင်းပြတဲ့ Illustration သာဖြစ်ပြီး တကယ့် Encryption လုပ်ဆောင်ချက် သို့မဟုတ် Network Traffic မဟုတ်ပါဘူး။" },
  { id: "decision", label: "03 / YOUR DECISION", title: "Choose the safer design.", body: "You are encrypting two records with the same AES-GCM key. Which nonce strategy should the application use?", my: "AES-GCM Key တစ်ခုတည်းနဲ့ Record နှစ်ခုကို စာဝှက်မယ်ဆိုရင် ဘယ် Nonce နည်းလမ်းကို ရွေးသင့်သလဲ။" },
  { id: "finding", label: "04 / THE FINDING", title: "Uniqueness is a security requirement.", body: "Reusing a nonce with the same AES-GCM key can reveal relationships between plaintexts and can enable authentication forgeries. Use a fresh, unique 96-bit nonce for each encryption under a given key, and design storage so collisions are prevented—not merely unlikely by habit.", my: "Key တစ်ခုတည်းနဲ့ Nonce ပြန်သုံးမိရင် မူရင်းစာသားတွေရဲ့ ဆက်စပ်မှု ပေါ်ထွက်နိုင်ပြီး Authentication ကိုလည်း အတုလုပ်နိုင်တဲ့ အန္တရာယ်ရှိပါတယ်။ Encryption တစ်ကြိမ်စီမှာ 96-bit Nonce အသစ်၊ မတူညီတာကို သုံးပါ။" }
];

export default function ResearchStoriesPage() {
  const [chapter, setChapter] = useState(0);
  const [choice, setChoice] = useState<"repeat" | "fresh" | null>(null);
  const current = chapters[chapter];
  const correct = choice === "fresh";

  return (
    <main className="security-shell">
      <header className="security-nav">
        <Link className="security-brand" href="/security/research"><span className="security-brand-mark">V</span><span>PRIVATE ACCOUNT VAULT <small>INTERACTIVE RESEARCH STORY</small></span></Link>
        <nav className="security-nav-links"><Link href="/security">Security operations</Link><Link href="/security/research">Research library</Link></nav>
        <span className="security-nav-status">ILLUSTRATIVE · SYNTHETIC</span>
      </header>
      <section className="security-hero">
        <div className="security-kicker">INTERACTIVE RESEARCH STORY · 01</div>
        <h1>One nonce.<br /><em>One use.</em></h1>
        <p className="security-lead">A guided security lesson about AES-GCM nonce reuse. Explore the concept, make a design decision, and see why the rule matters.</p>
        <p className="security-lead" lang="my">AES-GCM မှာ Nonce ကို ဘာကြောင့် ပြန်မသုံးသင့်သလဲဆိုတာကို အဆင့်လိုက် လေ့လာပြီး လုံခြုံတဲ့ Design ကို ကိုယ်တိုင်ရွေးချယ်ကြည့်ပါ။</p>
        <div className="security-hero-meta"><span><b>MODE</b> Concept lesson</span><span><b>DATA</b> Synthetic only</span><span><b>EXECUTION</b> No attack or encryption run</span></div>
      </section>
      <section className="security-section story-layout" aria-label="Interactive research story">
        <aside className="story-chapters">
          <span className="section-index">STORY CHAPTERS</span>
          {chapters.map((item, index) => <button key={item.id} type="button" className={chapter === index ? "story-chapter active" : "story-chapter"} onClick={() => setChapter(index)}><span>{item.label}</span><b>{item.title}</b></button>)}
          <div className="story-progress"><span style={{ width: ((chapter + 1) / chapters.length * 100) + "%" }} /></div>
          <small>CHAPTER {chapter + 1} / {chapters.length}</small>
        </aside>
        <article className="story-panel" aria-live="polite">
          <span className="section-index">{current.label}</span>
          <h2>{current.title}</h2>
          <p>{current.body}</p>
          <p lang="my">{current.my}</p>
          {chapter === 1 && <div className="nonce-model" aria-label="Illustrative nonce comparison"><div><small>MESSAGE A</small><b>KEY K</b><span>NONCE 01</span><em>UNIQUE</em></div><div><small>MESSAGE B</small><b>KEY K</b><span>NONCE 02</span><em>UNIQUE</em></div><p>Same key · distinct nonce values · conceptual only</p></div>}
          {chapter === 2 && <div className="story-choice"><button type="button" className={choice === "repeat" ? "selected" : ""} onClick={() => setChoice("repeat")}><b>A</b><span>Reuse the previous nonce</span></button><button type="button" className={choice === "fresh" ? "selected" : ""} onClick={() => setChoice("fresh")}><b>B</b><span>Generate a fresh unique nonce</span></button>{choice && <p className={correct ? "choice-feedback good" : "choice-feedback"}>{correct ? "Correct. A fresh unique nonce is required for each encryption under the same key." : "Not safe. Reusing a nonce with the same AES-GCM key can compromise confidentiality and authentication. Try again."}</p>}</div>}
          {chapter === 3 && <div className="story-finding"><b>DESIGN RULE</b><strong>96-bit nonce · unique per key · every encryption</strong><p>Use a carefully designed counter or a cryptographically secure random strategy with collision management appropriate to the message volume. Never assume a nonce is secret.</p><small>Reference: NIST SP 800-38D, §8.2 and §8.3. This lesson is conceptual and is not a test result for this application.</small></div>}
          <div className="story-controls"><button type="button" onClick={() => setChapter((value) => Math.max(0, value - 1))} disabled={chapter === 0}>← PREVIOUS</button><button type="button" onClick={() => setChapter((value) => Math.min(chapters.length - 1, value + 1))} disabled={chapter === chapters.length - 1 || (chapter === 2 && !correct)}>NEXT CHAPTER ↗</button></div>
        </article>
      </section>
      <section className="security-section story-integrity"><span className="section-index">EVIDENCE & LIMITATIONS</span><h2>What this story does—and does not—prove.</h2><p>This is an illustrative learning module using no real keys, records, telemetry, external targets, or cryptographic execution. It explains a documented cryptographic rule; it does not audit or certify this Vault implementation.</p><p lang="my">ဒီသင်ခန်းစာမှာ တကယ့် Key၊ Record၊ Telemetry၊ ပြင်ပ Target သို့မဟုတ် Encryption လုပ်ဆောင်ချက် မပါဝင်ပါဘူး။ Cryptography စည်းမျဉ်းကို ရှင်းပြတာသာဖြစ်ပြီး Vault ရဲ့ လုံခြုံရေးကို Audit လုပ်ထားတာ မဟုတ်ပါဘူး။</p><Link href="/security/research">← Back to Research Library</Link></section>
      <footer className="security-footer"><div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT</strong></div><p>Learn by exploring. Verify before concluding.</p></footer>
      <style jsx>{`
        .story-layout{display:grid;grid-template-columns:minmax(210px,.65fr) 1.6fr;gap:18px;align-items:start}
        .story-chapters,.story-panel,.story-integrity{border:1px solid #24414c;border-radius:12px;background:#0b1b27;padding:clamp(16px,3vw,26px)}
        .story-chapters{position:sticky;top:18px}
        .story-chapter{display:block;width:100%;text-align:left;margin-top:10px;padding:13px;border:1px solid #203b47;border-radius:8px;background:#0d202c;color:#a8bdc8;cursor:pointer}
        .story-chapter.active{border-color:#63c9a8;background:#12332f}
        .story-chapter span,.story-chapter b{display:block}.story-chapter span{font-size:9px;letter-spacing:.1em;color:#70cdb0}.story-chapter b{font-size:12px;margin-top:6px}
        .story-progress{height:3px;background:#203945;margin:20px 0 8px}.story-progress span{display:block;height:100%;background:#63c9a8;transition:width .2s}
        .story-chapters>small{font-size:9px;color:#7896a0;letter-spacing:.12em}
        .story-panel h2,.story-integrity h2{font-size:clamp(25px,4vw,38px);margin:14px 0}.story-panel p,.story-integrity p{color:#a0b7c0;font-size:13px;line-height:1.8}
        .nonce-model{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0}.nonce-model div{padding:18px;border:1px solid #2a5360;border-radius:9px;background:radial-gradient(ellipse at top,#17403e,#0b1b27)}.nonce-model small,.nonce-model b,.nonce-model span,.nonce-model em{display:block}.nonce-model small{color:#7c9da6;font-size:9px}.nonce-model b{margin:16px 0;color:#d5fff0}.nonce-model span{color:#9cebd0;font:700 14px monospace}.nonce-model em{margin-top:10px;color:#70cdb0;font-size:9px;font-style:normal}.nonce-model>p{grid-column:1/-1;text-align:center;font-size:10px}
        .story-choice{display:grid;gap:10px;margin:22px 0}.story-choice button{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #31505b;border-radius:8px;background:#0d202c;color:#d3e6e8;text-align:left;cursor:pointer}.story-choice button.selected{border-color:#67d5b3;background:#12332f}.story-choice button b{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#1c3e49}.choice-feedback{padding:12px;border-left:3px solid #d6ad68;background:#2c2519}.choice-feedback.good{border-color:#67d5b3;background:#12332f}
        .story-finding{margin:22px 0;padding:18px;border:1px solid #39705e;border-radius:9px;background:#102b29}.story-finding>*{display:block}.story-finding b{color:#72d9b7;font-size:10px;letter-spacing:.14em}.story-finding strong{margin:10px 0;color:#e1fff4;font-size:18px}.story-finding p,.story-finding small{color:#a1bdb7;font-size:11px;line-height:1.7}
        .story-controls{display:flex;justify-content:space-between;gap:12px;margin-top:26px;padding-top:18px;border-top:1px solid #203b47}.story-controls button{padding:11px 14px;border:1px solid #3c7467;border-radius:6px;background:#102d2b;color:#a7f0d7;font-size:10px;font-weight:800;letter-spacing:.08em;cursor:pointer}.story-controls button:disabled{opacity:.35;cursor:not-allowed}
        .story-integrity{margin-top:24px}.story-integrity a{display:inline-block;margin-top:12px;color:#9cebd0;font-weight:800;text-decoration:none}
        @media(max-width:760px){.story-layout{grid-template-columns:1fr}.story-chapters{position:static}.nonce-model{grid-template-columns:1fr 1fr}}
        @media(prefers-reduced-motion:reduce){.story-progress span{transition:none}}
      `}</style>
    </main>
  );
}
