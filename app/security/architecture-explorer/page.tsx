"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Layer = {
  id: string;
  name: string;
  myName: string;
  status: "implemented" | "partial" | "poc" | "planned";
  statusLabel: string;
  summary: string;
  mySummary: string;
  detail: string;
  myDetail: string;
};

const layers: Layer[] = [
  {
    id: "browser",
    name: "Browser · Vault UI",
    myName: "Browser · Vault UI",
    status: "implemented",
    statusLabel: "ACTIVE CRUD ENTRY",
    summary: "The current Vault interface sends record data to the server API.",
    mySummary: "လက်ရှိ Vault UI က Record Data ကို Server API ဆီ ပို့ပါတယ်။",
    detail: "In the current CRUD path, record content is plaintext at the browser/API boundary. The browser-side encryption worker is not yet connected to these create, read, update, and delete operations.",
    myDetail: "လက်ရှိ CRUD လုပ်ငန်းစဉ်မှာ Browser ကနေ API သို့ ပို့တဲ့အချိန် Record Content ဟာ Plaintext ဖြစ်နေပါတယ်။ Browser Encryption Worker ကို CRUD လုပ်ဆောင်ချက်တွေနဲ့ မချိတ်ဆက်ရသေးပါဘူး။"
  },
  {
    id: "api",
    name: "Vault API",
    myName: "Vault API",
    status: "implemented",
    statusLabel: "ACTIVE · SERVER-READABLE",
    summary: "The API receives plaintext, encrypts on the server, and decrypts on reads.",
    mySummary: "API က Plaintext ကို လက်ခံပြီး Server ပေါ်မှာ Encrypt လုပ်ကာ Read လုပ်ချိန်မှာ Decrypt ပြန်လုပ်ပါတယ်။",
    detail: "This is the current trust boundary: server-side code can access plaintext during processing. Do not describe the current Vault as end-to-end encrypted or owner-blind.",
    myDetail: "ဒါဟာ လက်ရှိ Trust Boundary ဖြစ်ပါတယ်။ Server-side Code က လုပ်ဆောင်နေစဉ် Plaintext ကို ဖတ်ရှုနိုင်ပါတယ်။ လက်ရှိ Vault ကို End-to-End Encrypted သို့မဟုတ် Owner ကပါ မဖတ်နိုင်တဲ့စနစ်လို့ မဖော်ပြရပါဘူး။"
  },
  {
    id: "database",
    name: "Encrypted storage",
    myName: "Encrypted storage",
    status: "implemented",
    statusLabel: "SERVER-ENCRYPTED STORAGE",
    summary: "The active server path persists encrypted record payloads.",
    mySummary: "လက်ရှိ Server လုပ်ငန်းစဉ်က Encrypted Record Payload တွေကို သိမ်းဆည်းပါတယ်။",
    detail: "Encryption at rest is not the same as client-side end-to-end encryption. A service that holds the decryption capability can still read records when the API decrypts them.",
    myDetail: "သိမ်းဆည်းထားစဉ် Encrypt လုပ်ထားခြင်းဟာ Client-side End-to-End Encryption နဲ့ မတူပါဘူး။ Decryption လုပ်နိုင်တဲ့ Server က API မှတစ်ဆင့် Record တွေကို ဖတ်နိုင်ပါတယ်။"
  },
  {
    id: "worker",
    name: "Browser crypto worker",
    myName: "Browser crypto worker",
    status: "partial",
    statusLabel: "EXISTS · NOT INTEGRATED",
    summary: "Worker and browser crypto modules exist, but active Vault CRUD does not use them yet.",
    mySummary: "Worker နဲ့ Browser Crypto Module တွေ ရှိပေမယ့် လက်ရှိ Vault CRUD မှာ မသုံးရသေးပါဘူး။",
    detail: "The worker can hold a non-extractable DEK during its lifetime. The active UI/API flow has not been migrated to call it. Locking can terminate the worker, but JavaScript memory erasure cannot be guaranteed.",
    myDetail: "Worker အသက်ဝင်နေစဉ် Non-extractable DEK ကို ထိန်းထားနိုင်ပါတယ်။ ဒါပေမယ့် လက်ရှိ UI/API လုပ်ငန်းစဉ်က Worker ကို ခေါ်သုံးဖို့ မပြောင်းရသေးပါဘူး။ Lock လုပ်ချိန် Worker ကို ပိတ်နိုင်ပေမယ့် JavaScript Memory ကို အပြည့်အဝ ဖျက်ပစ်နိုင်မယ်လို့ အာမမခံနိုင်ပါဘူး။"
  },
  {
    id: "envelope",
    name: "DEK envelope & AAD",
    myName: "DEK envelope & AAD",
    status: "partial",
    statusLabel: "MODULES · NOT INTEGRATED",
    summary: "Client-side key-envelope and authenticated context modules are not in the live CRUD path.",
    mySummary: "Client-side Key Envelope နဲ့ Authenticated Context Module တွေကို လက်ရှိ CRUD လုပ်ငန်းစဉ်မှာ မချိတ်ဆက်ရသေးပါဘူး။",
    detail: "The intended design wraps a random 256-bit DEK with a KEK derived from a separate client-only unlock secret. AES-256-GCM uses fresh 96-bit nonces and AAD binding vault, record, type, purpose, and version. This remains a target design, not a deployed guarantee.",
    myDetail: "ရည်ရွယ်ထားတဲ့ Design မှာ Random 256-bit DEK ကို သီးခြား Client-only Unlock Secret ကနေ ရတဲ့ KEK နဲ့ Wrap လုပ်ပါမယ်။ AES-256-GCM မှာ 96-bit Nonce အသစ်နဲ့ Vault၊ Record၊ Type၊ Purpose၊ Version တို့ကို ချိတ်ဆက်ထားတဲ့ AAD ကို သုံးပါမယ်။ ဒါဟာ ရည်မှန်းထားတဲ့ Design သာဖြစ်ပြီး လက်ရှိအသုံးပြုနေတဲ့ အာမခံချက် မဟုတ်သေးပါဘူး။"
  },
  {
    id: "argon",
    name: "Argon2id WASM",
    myName: "Argon2id WASM",
    status: "poc",
    statusLabel: "ISOLATED PROOF OF CONCEPT",
    summary: "A Rust/WASM Argon2id proof of concept has independent tests and build checks.",
    mySummary: "Rust/WASM Argon2id Proof of Concept ကို သီးခြားစမ်းသပ်ပြီး Build စစ်ဆေးမှုတွေ လုပ်ထားပါတယ်။",
    detail: "The PoC validates a candidate KDF implementation and browser binding boundary. It is not yet proof that Vault unlock, DEK wrapping, or CRUD uses Argon2id end to end.",
    myDetail: "PoC က KDF Implementation နဲ့ Browser Binding Boundary ကို စစ်ဆေးတာဖြစ်ပါတယ်။ Vault Unlock၊ DEK Wrapping သို့မဟုတ် CRUD တစ်လျှောက်လုံးမှာ Argon2id ကို အသုံးပြုနေပြီဆိုတဲ့ သက်သေ မဟုတ်သေးပါဘူး။"
  }
];

const statusText: Record<Layer["status"], string> = {
  implemented: "IMPLEMENTED",
  partial: "PARTIAL / NOT INTEGRATED",
  poc: "PROOF OF CONCEPT",
  planned: "PLANNED"
};

export default function SecurityArchitectureExplorerPage() {
  const [selectedId, setSelectedId] = useState("api");
  const [showBurmese, setShowBurmese] = useState(true);
  const selected = useMemo(() => layers.find((layer) => layer.id === selectedId) ?? layers[0]!, [selectedId]);

  return (
    <main className="security-shell architecture-explorer">
      <header className="security-nav">
        <Link className="security-brand" href="/security/research">
          <span className="security-brand-mark">V</span>
          <span>PRIVATE ACCOUNT VAULT <small>ARCHITECTURE EXPLORER</small></span>
        </Link>
        <nav className="security-nav-links" aria-label="Learning navigation">
          <Link href="/security/research">Research library</Link>
          <Link href="/security/research-stories">Research stories</Link>
          <Link href="/security/puzzle-arena">Puzzle Arena</Link>
        </nav>
        <span className="security-nav-status">IMPLEMENTATION STATUS · VERIFIED</span>
      </header>

      <section className="security-hero architecture-hero">
        <div>
          <div className="security-kicker">INTERACTIVE SYSTEM MAP · LEARNING STUDIO</div>
          <h1>Understand the boundary.<br /><em>Follow the data.</em></h1>
          <p className="security-lead">Explore what is implemented today, what exists but is not integrated, and what remains a target design. Select any component to inspect its role and trust boundary.</p>
          <p className="security-lead" lang="my">လက်ရှိ တကယ်အလုပ်လုပ်နေတဲ့အပိုင်း၊ ရှိပေမယ့် မချိတ်ဆက်ရသေးတဲ့အပိုင်းနဲ့ အနာဂတ် ရည်မှန်းချက်တွေကို ခွဲခြားကြည့်ရှုနိုင်ပါတယ်။ Component တစ်ခုကို ရွေးပြီး သူ့ရဲ့ တာဝန်နဲ့ Trust Boundary ကို လေ့လာပါ။</p>
          <div className="architecture-status-key">
            <span><i className="dot implemented" /> Implemented</span>
            <span><i className="dot partial" /> Partial / not integrated</span>
            <span><i className="dot poc" /> Proof of concept</span>
          </div>
        </div>
        <aside className="architecture-warning">
          <div className="architecture-orbit" role="img" aria-label="Static conceptual illustration of the Vault browser, API, and encrypted storage architecture. This is not live telemetry.">
            <div className="architecture-orbit-caption"><span>ARCHITECTURE / 01</span><span>STATIC SYSTEM MAP</span></div>
            <svg viewBox="0 0 520 330" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="orbitLine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#75e0bd" stopOpacity=".85"/><stop offset="1" stopColor="#78a8d8" stopOpacity=".22"/></linearGradient>
                <radialGradient id="coreGlow"><stop offset="0" stopColor="#8ce9ca" stopOpacity=".25"/><stop offset="1" stopColor="#8ce9ca" stopOpacity="0"/></radialGradient>
              </defs>
              <circle cx="260" cy="160" r="126" fill="none" stroke="#8bd9c2" strokeOpacity=".13" strokeWidth="1" strokeDasharray="3 8"/>
              <circle cx="260" cy="160" r="93" fill="none" stroke="#8bd9c2" strokeOpacity=".22" strokeWidth="1"/>
              <circle cx="260" cy="160" r="70" fill="url(#coreGlow)"/>
              <path d="M120 104 C164 42 348 42 400 104" fill="none" stroke="url(#orbitLine)" strokeWidth="1.5"/>
              <path d="M400 218 C348 280 164 280 120 218" fill="none" stroke="url(#orbitLine)" strokeWidth="1.5" strokeDasharray="5 6"/>
              <path d="M151 160 H202 M318 160 H369" stroke="#8bd9c2" strokeOpacity=".75" strokeWidth="1.5"/>
              <path d="M193 154 L202 160 L193 166 M360 154 L369 160 L360 166" fill="none" stroke="#8bd9c2" strokeWidth="1.5"/>
              <path d="M260 90 L282 103 V135 C282 151 273 163 260 171 C247 163 238 151 238 135 V103 Z" fill="#122f35" stroke="#8fe2c5" strokeWidth="1.5"/>
              <path d="M250 129 L257 136 L271 119" fill="none" stroke="#a7f0d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <text x="260" y="195" textAnchor="middle" fill="#d8f2e8" fontSize="11" letterSpacing="2">VAULT CORE</text>
              <text x="260" y="211" textAnchor="middle" fill="#86aaa9" fontSize="8" letterSpacing="1.5">TRUST BOUNDARY</text>
              <rect x="20" y="129" width="132" height="62" rx="9" fill="#0d202b" stroke="#4e806f"/>
              <circle cx="37" cy="148" r="4" fill="#72d6a9"/>
              <text x="49" y="151" fill="#e0f1ed" fontSize="10" fontWeight="600">BROWSER</text>
              <text x="36" y="171" fill="#88a9ad" fontSize="8" letterSpacing="1">PLAINTEXT ENTRY</text>
              <rect x="368" y="129" width="132" height="62" rx="9" fill="#0d202b" stroke="#a17b5a"/>
              <circle cx="385" cy="148" r="4" fill="#d9ad7d"/>
              <text x="397" y="151" fill="#f2e7dc" fontSize="10" fontWeight="600">SERVER API</text>
              <text x="384" y="171" fill="#bda48f" fontSize="8" letterSpacing="1">DECRYPTION ACCESS</text>
              <text x="260" y="28" textAnchor="middle" fill="#7faeaa" fontSize="8" letterSpacing="2">CURRENT IMPLEMENTATION · NOT A LIVE FEED</text>
              <text x="260" y="310" textAnchor="middle" fill="#7faeaa" fontSize="8" letterSpacing="2">ENCRYPTED STORAGE · SERVER-SIDE KEY CONTROL</text>
            </svg>
            <div className="architecture-orbit-foot"><span><i className="orbit-dot active" /> ACTIVE PATH</span><span><i className="orbit-dot boundary" /> TRUST BOUNDARY</span></div>
          </div>
          <span className="section-index">IMPORTANT SECURITY FACT</span>
          <strong>Current Vault CRUD is server-readable.</strong>
          <p>Records are sent as plaintext to the API, encrypted server-side, and decrypted by the API on reads. Client-side encryption is not yet end-to-end integrated.</p>
          <p lang="my">လက်ရှိ CRUD မှာ Record တွေကို Plaintext အဖြစ် API ဆီပို့ပြီး Server ပေါ်မှာ Encrypt လုပ်ပါတယ်။ Read လုပ်ချိန်မှာ API က Decrypt ပြန်လုပ်ပါတယ်။ Client-side Encryption ကို အဆုံးအထိ မချိတ်ဆက်ရသေးပါဘူး။</p>
        </aside>
      </section>

      <section className="security-section architecture-map-section">
        <div className="architecture-section-heading">
          <div><span className="section-index">01 / CURRENT DATA PATH</span><h2>What happens in the current implementation</h2></div>
          <span className="architecture-path-label">ACTIVE CRUD · SERVER TRUST</span>
        </div>
        <p className="architecture-intro">Select a node. The arrows show the current record path, not a live network trace or telemetry feed.</p>
        <div className="architecture-current-flow" aria-label="Current data flow components">
          {layers.slice(0, 3).map((layer, index) => (
            <div className="architecture-flow-unit" key={layer.id}>
              <button type="button" className={"architecture-node " + (selectedId === layer.id ? "selected" : "")} onClick={() => setSelectedId(layer.id)} aria-pressed={selectedId === layer.id}>
                <span className="architecture-node-index">0{index + 1}</span>
                <strong>{layer.name}</strong>
                <small>{layer.statusLabel}</small>
              </button>
              {index < 2 && <span className="architecture-arrow" aria-hidden="true">→</span>}
            </div>
          ))}
        </div>
        <div className="architecture-direction-notes">
          <p><b>CREATE / UPDATE</b><span>Browser sends plaintext → API encrypts → encrypted payload is stored.</span></p>
          <p><b>READ</b><span>Storage returns encrypted payload → API decrypts → plaintext is returned to browser.</span></p>
        </div>
        <div className="architecture-detail-panel" aria-live="polite">
          <div className="architecture-detail-heading">
            <span className={"architecture-status-pill " + selected.status}>{statusText[selected.status]}</span>
            <span className="section-index">{selected.statusLabel}</span>
          </div>
          <h3>{selected.name}</h3>
          <p>{selected.summary}</p>
          {showBurmese && <p lang="my">{selected.mySummary}</p>}
          <div className="architecture-detail-rule" />
          <p>{selected.detail}</p>
          {showBurmese && <p lang="my">{selected.myDetail}</p>}
        </div>
      </section>

      <section className="security-section architecture-map-section">
        <div className="architecture-section-heading">
          <div><span className="section-index">02 / CLIENT CRYPTO FOUNDATION</span><h2>What exists beyond the active CRUD path</h2></div>
          <span className="architecture-path-label">NOT END-TO-END INTEGRATED</span>
        </div>
        <div className="architecture-foundation-grid">
          {layers.slice(3).map((layer, index) => (
            <button type="button" key={layer.id} className={"architecture-foundation-card " + (selectedId === layer.id ? "selected" : "")} onClick={() => setSelectedId(layer.id)} aria-pressed={selectedId === layer.id}>
              <span className="architecture-node-index">0{index + 4}</span>
              <strong>{layer.name}</strong>
              <span className={"architecture-status-pill " + layer.status}>{statusText[layer.status]}</span>
              <p>{layer.summary}</p>
              {showBurmese && <p lang="my">{layer.mySummary}</p>}
            </button>
          ))}
        </div>
      </section>

      <section className="security-section architecture-boundary">
        <div className="architecture-section-heading">
          <div><span className="section-index">03 / TRUST BOUNDARIES</span><h2>What this map does—and does not—prove</h2></div>
          <button type="button" className="architecture-language-toggle" onClick={() => setShowBurmese((value) => !value)} aria-pressed={showBurmese}>{showBurmese ? "BURMESE ON" : "BURMESE OFF"}</button>
        </div>
        <div className="architecture-boundary-grid">
          <article><b>Verified from implementation</b><p>The current server-readable CRUD model, existing browser crypto modules, and isolated Argon2id WASM PoC are represented as separate states.</p></article>
          <article><b>Not a security certification</b><p>This map is documentation, not an independent audit, penetration test, or proof that the product is secure against every attacker.</p></article>
          <article><b>No live telemetry</b><p>All visuals are static explanations of known architecture. No fake packets, counters, attack animations, or fabricated operational events are shown.</p></article>
        </div>
        <p className="architecture-note">Do not store real or high-value credentials in this Vault until client-side encryption is integrated, independently reviewed, and the remaining trust assumptions are documented.</p>
        <div className="architecture-links">
          <Link href="/security/research">← Research Library</Link>
          <Link href="/security/puzzle-arena">Practice with five safe puzzles ↗</Link>
          <Link href="/security/research-stories/aes-gcm-integrity">See the browser AES-GCM demonstration ↗</Link>
        </div>
      </section>

      <footer className="security-footer"><div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT</strong></div><p>Knowledge should be accessible. Evidence should be verifiable.</p></footer>

      <style jsx>{`
        .architecture-hero{grid-template-columns:1.12fr .88fr;align-items:center;gap:clamp(24px,4vw,58px);position:relative;overflow:hidden}
        .architecture-hero:before{content:"";position:absolute;inset:-30% -10% auto auto;width:58%;height:150%;pointer-events:none;background:radial-gradient(ellipse,rgba(63,142,128,.13),transparent 68%)}
        .architecture-hero>div,.architecture-warning{position:relative;z-index:1}
        .architecture-hero .security-kicker{color:#8de0c2;letter-spacing:.2em}
        .architecture-hero h1{font-size:clamp(39px,6vw,70px);line-height:1.02;letter-spacing:-.065em;text-wrap:balance}
        .architecture-hero h1 em{font-style:normal;color:#9fe5cb;text-shadow:0 0 34px #6cc8a52b}
        .architecture-hero .security-lead{max-width:62ch}
        .architecture-orbit{position:relative;margin:-4px -7px 21px;padding:9px 9px 7px;border:1px solid #284c50;border-radius:15px;background:radial-gradient(ellipse at 50% 48%,#17343a 0%,#0a1b25 58%,#0a1721 100%);box-shadow:inset 0 0 45px #6dc8a50a,0 18px 50px #0003;overflow:hidden}
        .architecture-orbit:after{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(#b5f0d10a 1px,transparent 1px),linear-gradient(90deg,#b5f0d10a 1px,transparent 1px);background-size:24px 24px;mask-image:linear-gradient(transparent,#000 18%,#000 80%,transparent)}
        .architecture-orbit-caption,.architecture-orbit-foot{position:relative;z-index:1;display:flex;justify-content:space-between;gap:10px;color:#80aaa7;font-size:7px;font-weight:900;letter-spacing:.16em}
        .architecture-orbit svg{display:block;width:100%;height:auto;max-height:275px;overflow:visible}
        .architecture-orbit-foot{justify-content:center;gap:20px;padding:3px 0 8px;color:#a5c4bf;font-size:7px}
        .architecture-orbit-foot span{display:flex;align-items:center;gap:7px}
        .orbit-dot{width:6px;height:6px;border-radius:50%;display:inline-block}.orbit-dot.active{background:#72d6a9;box-shadow:0 0 10px #72d6a9}.orbit-dot.boundary{background:#d9ad7d}
        .architecture-warning{padding:22px;border:1px solid #a16e4e;border-radius:12px;background:linear-gradient(145deg,#241f1d,#171d22 78%);box-shadow:0 22px 70px #0004}
        .architecture-warning strong{font-size:clamp(17px,2vw,21px)}
        .architecture-warning .section-index{color:#e2b98f}
        .architecture-map-section{position:relative}
        .architecture-map-section:before{content:"";position:absolute;left:0;top:0;width:1px;height:100%;background:linear-gradient(transparent,#4e8978 15%,#4e8978 85%,transparent);opacity:.45}
        .architecture-node,.architecture-foundation-card{position:relative;overflow:hidden;transition:transform .24s ease,border-color .24s ease,background .24s ease,box-shadow .24s ease}
        .architecture-node:before,.architecture-foundation-card:before{content:"";position:absolute;inset:0 auto 0 0;width:2px;background:linear-gradient(transparent,#86d8b8,transparent);opacity:0;transition:opacity .2s ease}
        .architecture-node:hover,.architecture-foundation-card:hover{transform:translateY(-3px);border-color:#70bda1;box-shadow:0 15px 35px #0004}
        .architecture-node:hover:before,.architecture-foundation-card:hover:before,.architecture-node.selected:before,.architecture-foundation-card.selected:before{opacity:1}
        .architecture-detail-panel{position:relative;overflow:hidden;background:linear-gradient(135deg,#102a2e,#0b2029 72%);box-shadow:0 18px 45px #0003}
        .architecture-detail-panel:after{content:"";position:absolute;right:-65px;top:-90px;width:220px;height:220px;border:1px solid #8fe0b91b;border-radius:50%;box-shadow:0 0 0 22px #8fe0b90a,0 0 0 48px #8fe0b906;pointer-events:none}
        .architecture-section-heading h2{max-width:24ch;text-wrap:balance}
        .architecture-foundation-card{background:linear-gradient(150deg,#102631,#0a1b26)}
        .architecture-boundary-grid article{transition:border-color .2s ease,transform .2s ease}
        .architecture-boundary-grid article:hover{transform:translateY(-2px);border-color:#557f75}
        .architecture-links a{transition:color .2s ease,text-shadow .2s ease}
        .architecture-links a:hover{color:#d1ffe9;text-shadow:0 0 18px #8fe0b955}
        .architecture-explorer{background-image:radial-gradient(ellipse at 85% 6%,#1c544324,transparent 34%),linear-gradient(180deg,#091721 0%,#0a1721 46%,#09131c 100%)}
        .architecture-explorer .security-nav{backdrop-filter:blur(18px);background:#091720c9;border-bottom:1px solid #25434b}
        .architecture-explorer .security-section{padding-top:clamp(32px,5vw,62px);padding-bottom:clamp(32px,5vw,62px)}
        .architecture-explorer button:focus-visible{outline:2px solid #a5f0d3;outline-offset:4px;box-shadow:0 0 0 6px #a5f0d31c}
        @media(max-width:760px){.architecture-hero{grid-template-columns:1fr;gap:25px}.architecture-orbit{margin:0 0 16px}.architecture-orbit svg{max-height:none}.architecture-hero h1{font-size:clamp(38px,11vw,58px)}}
        @media(max-width:420px){.architecture-orbit-caption,.architecture-orbit-foot{font-size:6px}.architecture-warning{padding:17px}.architecture-detail-panel{padding:17px}}
        @media(prefers-reduced-motion:reduce){.architecture-explorer *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
        .architecture-warning{padding:23px;border:1px solid #a16e4e;border-radius:12px;background:#241f1d}
        .architecture-warning strong{display:block;margin:15px 0;color:#f0c5a3;font-size:20px;line-height:1.35}
        .architecture-warning p,.architecture-intro{color:#a9bdc4;font-size:12px;line-height:1.8}
        .architecture-status-key{display:flex;flex-wrap:wrap;gap:15px;margin-top:22px;color:#9db5bd;font-size:10px}
        .architecture-status-key span{display:flex;align-items:center;gap:7px}
        .dot{width:8px;height:8px;border-radius:50%;display:inline-block}.dot.implemented{background:#63c99e}.dot.partial{background:#e0b56f}.dot.poc{background:#80a9ec}
        .architecture-section-heading{display:flex;align-items:end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px}
        .architecture-section-heading h2{margin:10px 0 0;font-size:clamp(23px,3vw,34px);letter-spacing:-.04em}
        .architecture-path-label{padding:8px 10px;border:1px solid #365361;border-radius:5px;color:#a2c7c8;font-size:8px;font-weight:900;letter-spacing:.12em}
        .architecture-current-flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:12px;margin:22px 0}
        .architecture-flow-unit{display:contents}
        .architecture-node,.architecture-foundation-card{width:100%;min-height:126px;padding:17px;text-align:left;border:1px solid #31505d;border-radius:10px;background:#0b1d29;color:#e2edf0;cursor:pointer}
        .architecture-node.selected,.architecture-foundation-card.selected{border-color:#8cdbbc;background:#102b2d;box-shadow:0 0 0 1px #4e9b7c inset}
        .architecture-node-index{display:block;margin-bottom:12px;color:#7fa5b0;font-size:9px;font-weight:900;letter-spacing:.12em}
        .architecture-node strong,.architecture-foundation-card strong{display:block;font-size:14px;line-height:1.45}
        .architecture-node small{display:block;margin-top:10px;color:#91c9b6;font-size:8px;font-weight:900;letter-spacing:.09em}
        .architecture-arrow{color:#7bc7ac;font-size:24px}
        .architecture-direction-notes{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .architecture-direction-notes p{display:grid;gap:8px;margin:0;padding:15px;border:1px solid #294653;border-radius:8px;background:#0c202b;color:#a8bec6;font-size:11px;line-height:1.7}
        .architecture-direction-notes b{color:#b9e5d5;font-size:9px;letter-spacing:.1em}
        .architecture-detail-panel{margin-top:16px;padding:22px;border:1px solid #3b665e;border-radius:11px;background:#0d242b}
        .architecture-detail-heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .architecture-status-pill{display:inline-block;padding:7px 9px;border:1px solid currentColor;border-radius:5px;font-size:8px;font-weight:900;letter-spacing:.09em}
        .architecture-status-pill.implemented{color:#8fe0b9}.architecture-status-pill.partial{color:#e4bd78}.architecture-status-pill.poc{color:#9bbaff}.architecture-status-pill.planned{color:#a8aeb7}
        .architecture-detail-panel h3{margin:16px 0 8px;font-size:23px}
        .architecture-detail-panel p,.architecture-foundation-card p{color:#a9bec5;font-size:12px;line-height:1.8}
        .architecture-detail-panel [lang="my"],.architecture-foundation-card [lang="my"]{color:#c0d0d1}
        .architecture-detail-rule{height:1px;margin:17px 0;background:#294b51}
        .architecture-foundation-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .architecture-foundation-card{display:flex;flex-direction:column;align-items:flex-start;gap:10px;min-height:230px}
        .architecture-foundation-card p{margin:0}
        .architecture-language-toggle{padding:9px 12px;border:1px solid #4b746d;border-radius:6px;background:#102a2b;color:#bde9d8;font-size:9px;font-weight:900;letter-spacing:.08em;cursor:pointer}
        .architecture-boundary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .architecture-boundary-grid article{padding:16px;border:1px solid #294653;border-radius:9px;background:#0c202b}
        .architecture-boundary-grid b{color:#bce6d6;font-size:12px}
        .architecture-boundary-grid p,.architecture-note{color:#a8bdc5;font-size:11px;line-height:1.8}
        .architecture-note{margin:20px 0;padding:14px;border-left:3px solid #c18b62;background:#211f1d;color:#e2c7b1}
        .architecture-links{display:flex;flex-wrap:wrap;gap:18px;margin-top:20px}
        .architecture-links a{color:#9cebd0;font-size:11px;font-weight:800;text-decoration:none}
        .architecture-explorer button:focus-visible{outline:2px solid #a5f0d3;outline-offset:3px}
        @media(max-width:760px){.architecture-hero{grid-template-columns:1fr}.architecture-current-flow{grid-template-columns:1fr}.architecture-flow-unit{display:grid;grid-template-columns:1fr auto;align-items:center}.architecture-arrow{transform:rotate(90deg)}.architecture-direction-notes,.architecture-foundation-grid,.architecture-boundary-grid{grid-template-columns:1fr}}
        @media(prefers-reduced-motion:reduce){.architecture-explorer *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
      `}</style>
    </main>
  );
}
