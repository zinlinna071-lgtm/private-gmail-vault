"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type DemoState = "idle" | "verified" | "tampered" | "error";

const sampleMessage = "Synthetic research note: approve the test record.";

function toHex(bytes: number[]) {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

export default function AesGcmIntegrityStory() {
  const keyRef = useRef<CryptoKey | null>(null);
  const [nonce, setNonce] = useState<number[] | null>(null);
  const [ciphertext, setCiphertext] = useState<number[] | null>(null);
  const [state, setState] = useState<DemoState>("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Generate a fresh browser-only example to begin.");

  async function createExample() {
    setBusy(true);
    setState("idle");
    setMessage("Generating an ephemeral key and encrypting synthetic text locally…");
    setNonce(null);
    setCiphertext(null);
    keyRef.current = null;

    try {
      if (!globalThis.crypto?.subtle) {
        throw new Error("Web Crypto is unavailable. Use a secure browser context (HTTPS or localhost).");
      }

      const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(sampleMessage);
      const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
      const recovered = new TextDecoder().decode(decrypted);

      if (recovered !== sampleMessage) {
        throw new Error("The local round-trip did not match the synthetic input.");
      }

      keyRef.current = key;
      setNonce(Array.from(iv));
      setCiphertext(Array.from(new Uint8Array(encrypted)));
      setState("verified");
      setMessage("Authentication passed. The untouched ciphertext decrypted to the original synthetic message.");
    } catch (error) {
      keyRef.current = null;
      setState("error");
      setMessage(error instanceof Error ? error.message : "The browser demonstration could not run.");
    } finally {
      setBusy(false);
    }
  }

  async function tamperAndVerify() {
    if (!keyRef.current || !nonce || !ciphertext) return;
    setBusy(true);
    setMessage("Changing one ciphertext bit, then asking AES-GCM to authenticate it…");

    try {
      const altered = Uint8Array.from(ciphertext);
      altered[0] ^= 1;
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: Uint8Array.from(nonce) },
        keyRef.current,
        altered
      );
      setState("error");
      setMessage("Unexpected result: the altered ciphertext was accepted. Do not treat this demo as a valid result.");
    } catch {
      setState("tampered");
      setMessage("Authentication failed as expected. AES-GCM rejected the modified ciphertext; unauthenticated plaintext was not returned.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="security-shell">
      <header className="security-nav">
        <Link className="security-brand" href="/security/research"><span className="security-brand-mark">V</span><span>PRIVATE ACCOUNT VAULT <small>INTERACTIVE RESEARCH STORY</small></span></Link>
        <nav className="security-nav-links"><Link href="/security">Security operations</Link><Link href="/security/research">Research library</Link></nav>
        <span className="security-nav-status">LOCAL DEMO · SYNTHETIC</span>
      </header>

      <section className="security-hero">
        <div className="security-kicker">INTERACTIVE RESEARCH STORY · 02</div>
        <h1>Change one bit.<br /><em>Break the tag.</em></h1>
        <p className="security-lead">See authenticated encryption in action. Your browser creates a temporary AES-256-GCM key, encrypts a fictional message, then detects a one-bit ciphertext change.</p>
        <p className="security-lead" lang="my">Browser ထဲမှာ ယာယီ AES-256-GCM Key တစ်ခု ဖန်တီးပြီး စိတ်ကူးယဉ်စာသားကို စာဝှက်ပါမယ်။ Ciphertext ထဲက Bit တစ်ခုကို ပြောင်းလိုက်တဲ့အခါ Authentication က ဘယ်လိုပယ်ချသလဲ ကိုယ်တိုင်ကြည့်နိုင်ပါတယ်။</p>
        <div className="security-hero-meta"><span><b>KEY</b> Ephemeral · non-extractable</span><span><b>DATA</b> Synthetic only</span><span><b>NETWORK</b> No request sent</span></div>
      </section>

      <section className="security-section integrity-lab">
        <div className="integrity-process" aria-label="Demonstration stages">
          <div className={state === "idle" ? "integrity-stage active" : "integrity-stage complete"}><span>01</span><b>GENERATE KEY</b><small>Browser Web Crypto</small></div>
          <div className={state === "idle" ? "integrity-stage" : "integrity-stage complete"}><span>02</span><b>ENCRYPT</b><small>Fresh 96-bit IV</small></div>
          <div className={state === "tampered" ? "integrity-stage alert" : state === "verified" ? "integrity-stage complete" : "integrity-stage"}><span>03</span><b>VERIFY TAG</b><small>Authenticity check</small></div>
        </div>
        <div className="integrity-heading"><div><span className="section-index">BROWSER CRYPTOGRAPHY LAB</span><h2>Run the integrity demonstration.</h2></div><span className="integrity-state">ILLUSTRATIVE · LOCAL EXECUTION</span></div>
        <p className="integrity-explain">The key is generated by the browser and marked non-extractable. The 96-bit nonce and ciphertext below are generated for this session only. Nothing is uploaded or saved.</p>
        <p className="integrity-explain" lang="my">Key ကို Browser ကပဲ ဖန်တီးပြီး Export မလုပ်နိုင်အောင် သတ်မှတ်ထားပါတယ်။ Nonce နဲ့ Ciphertext တွေဟာ ဒီ Session အတွက်သာ ဖြစ်ပါတယ်။ Server ဆီ ပို့ခြင်း၊ သိမ်းဆည်းခြင်း မရှိပါဘူး။</p>

        <div className="integrity-message"><small>SYNTHETIC PLAINTEXT</small><code>{sampleMessage}</code></div>
        <div className="integrity-actions"><button type="button" onClick={createExample} disabled={busy}>{busy ? "WORKING…" : "01 · GENERATE & ENCRYPT"}</button><button type="button" onClick={tamperAndVerify} disabled={busy || state !== "verified"}>02 · TAMPER ONE BIT</button></div>

        <div className="integrity-grid">
          <div className="integrity-data"><small>96-BIT NONCE (IV)</small><code>{nonce ? toHex(nonce) : "— waiting for local run —"}</code></div>
          <div className="integrity-data"><small>CIPHERTEXT + AUTH TAG</small><code>{ciphertext ? toHex(ciphertext.slice(0, 32)) + (ciphertext.length > 32 ? " …" : "") : "— waiting for local run —"}</code><span>{ciphertext ? ciphertext.length + " bytes · includes authentication tag" : "No generated data"}</span></div>
        </div>

        <div className={`integrity-result ${state}`} role="status" aria-live="polite">
          <span>{state === "verified" ? "AUTHENTICATION PASSED" : state === "tampered" ? "TAMPER DETECTED" : state === "error" ? "DEMO ERROR" : "WAITING FOR YOUR ACTION"}</span>
          <p>{message}</p>
        </div>
        <div className="integrity-explanation"><b>What just happened?</b><p>AES-GCM authenticates ciphertext and associated data with an authentication tag. When a ciphertext bit changes, tag verification fails. A correct application must reject the message rather than release unauthenticated plaintext.</p><p lang="my">AES-GCM က Ciphertext နဲ့ Associated Data ကို Authentication Tag နဲ့ စစ်ဆေးပါတယ်။ Ciphertext တစ်ခုခု ပြောင်းလဲသွားရင် Tag စစ်ဆေးမှု မအောင်မြင်တော့ပါဘူး။ မှန်ကန်တဲ့ Application က စစ်ဆေးမှုမအောင်မြင်တဲ့ စာသားကို လက်မခံသင့်ပါဘူး။</p></div>
      </section>

      <section className="security-section integrity-limit">
        <span className="section-index">SCOPE · LIMITATIONS · SAFETY</span>
        <h2>A real browser operation, not a product security test.</h2>
        <ul>
          <li>This page performs actual Web Crypto AES-256-GCM operations locally using generated synthetic data.</li>
          <li>The temporary key is non-extractable and held only in page memory; it is not a Vault key and is not persisted.</li>
          <li>No real account data, passwords, tokens, backend APIs, network targets, or production services are involved.</li>
          <li>This demonstrates one browser API behavior. It does not audit, certify, or prove the security of the Vault application.</li>
        </ul>
        <p lang="my">ဒါဟာ Browser ရဲ့ Web Crypto API ကို အသုံးပြုတဲ့ တကယ့် Local Operation ဖြစ်ပေမယ့် Product Security Test မဟုတ်ပါဘူး။ Vault ရဲ့ လုံခြုံရေးကို အတည်ပြုထားခြင်း မဟုတ်ပါဘူး။</p>
        <p className="integrity-reference">Technical reference: <a href="https://csrc.nist.gov/pubs/sp/800/38/d/final" target="_blank" rel="noreferrer">NIST SP 800-38D — Galois/Counter Mode (GCM)</a></p>
        <Link href="/security/research-stories">← Back to Story 01: One nonce, one use</Link><p><Link href="/security/puzzle-arena">Continue learning · Try five safe defensive puzzles ↗</Link></p>
      </section>

      <footer className="security-footer"><div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT</strong></div><p>Learn by exploring. Verify before concluding.</p></footer>

      <style jsx>{`
        .integrity-process{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:24px}
        .integrity-stage{display:grid;grid-template-columns:28px 1fr;gap:3px 9px;align-items:center;min-width:0;padding:12px;border:1px solid #29434e;border-radius:9px;background:linear-gradient(145deg,#0c202b,#091722)}
        .integrity-stage>span{grid-row:span 2;display:grid;place-items:center;width:27px;height:27px;border:1px solid #36545d;border-radius:7px;color:#7da7a5;font:800 9px ui-monospace,monospace}
        .integrity-stage>b{color:#9bb5ba;font:800 8px ui-monospace,monospace;letter-spacing:.08em}.integrity-stage>small{color:#718f98;font-size:8px}
        .integrity-stage.active,.integrity-stage.complete{border-color:#3d806d;background:linear-gradient(145deg,#12352f,#0a2028)}.integrity-stage.active>span,.integrity-stage.complete>span{border-color:#58b996;color:#b5f4d9}.integrity-stage.active>b,.integrity-stage.complete>b{color:#a4efd0}
        .integrity-stage.alert{border-color:#a46d42;background:#30251b}.integrity-stage.alert>span,.integrity-stage.alert>b{color:#f1c18b}
        .integrity-stage.active{box-shadow:0 0 22px #57d7b414}
        .integrity-lab,.integrity-limit{border:1px solid #24414c;border-radius:12px;background:#0b1b27;padding:clamp(16px,3vw,28px)}
        .integrity-heading{display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap}
        .integrity-heading h2,.integrity-limit h2{font-size:clamp(24px,4vw,36px);margin:12px 0}
        .integrity-state,.integrity-heading small{font-size:9px;letter-spacing:.12em;color:#9cebd0;border:1px solid #35675b;padding:8px;border-radius:5px}
        .integrity-explain,.integrity-limit p,.integrity-limit li{font-size:13px;line-height:1.8;color:#a3b8c2}
        .integrity-message,.integrity-data{padding:16px;margin-top:18px;border:1px solid #294b57;border-radius:8px;background:#0d202c}
        .integrity-message small,.integrity-data small{display:block;font-size:9px;letter-spacing:.12em;color:#79cdb2;margin-bottom:10px}
        .integrity-message code,.integrity-data code{font:12px/1.8 ui-monospace,monospace;color:#d5f9eb;overflow-wrap:anywhere}
        .integrity-actions{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}
        .integrity-actions button{border:1px solid #397666;border-radius:6px;padding:12px 16px;background:#12332f;color:#baf5df;font-size:10px;font-weight:800;letter-spacing:.07em;cursor:pointer}
        .integrity-actions button:disabled{opacity:.35;cursor:not-allowed}
        .integrity-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.integrity-data{margin:0;min-width:0}.integrity-data span{display:block;color:#77939c;font-size:9px;margin-top:10px}
        .integrity-result{margin-top:14px;padding:16px;border:1px solid #31505b;border-radius:8px;background:#0d202c}
        .integrity-result>span{font-size:10px;font-weight:900;letter-spacing:.12em;color:#a9c1c9}.integrity-result p{font-size:13px;line-height:1.7;color:#c4d7dc}
        .integrity-result.verified{border-color:#3a8068;background:#102b29}.integrity-result.verified>span{color:#80e1bb}
        .integrity-result.tampered{border-color:#a46d42;background:#30251b}.integrity-result.tampered>span{color:#f1c18b}
        .integrity-result.error{border-color:#98545b;background:#301d25}.integrity-result.error>span{color:#ffadb6}
        .integrity-explanation{margin-top:20px;padding-top:18px;border-top:1px solid #203b47}.integrity-explanation b{color:#c9f3e3}.integrity-explanation p{font-size:12px;line-height:1.8;color:#9eb4be}
        .integrity-limit{margin-top:22px}.integrity-limit ul{padding-left:20px}.integrity-limit li{margin:7px 0}.integrity-limit a{color:#9cebd0}.integrity-reference{font-size:11px!important}
        @media(max-width:640px){.integrity-process{grid-template-columns:1fr;gap:8px}.integrity-stage{grid-template-columns:28px minmax(0,1fr);padding:11px 12px}.integrity-stage>small{grid-column:2}.integrity-grid{grid-template-columns:1fr}.integrity-actions button{flex:1 1 100%}}
      `}</style>
    </main>
  );
}
