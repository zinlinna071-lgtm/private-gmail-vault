"use client";

import { useState } from "react";

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function CryptographyLearningLab() {
  const [message, setMessage] = useState("");
  const [digest, setDigest] = useState("");
  const [byteLength, setByteLength] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "working" | "ready" | "error">("idle");
  const [copied, setCopied] = useState(false);

  async function calculateDigest() {
    if (!message.length || state === "working") return;
    setState("working");
    setCopied(false);
    try {
      if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable in this browser context.");
      const bytes = new TextEncoder().encode(message);
      const result = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      setDigest(toHex(result));
      setByteLength(bytes.byteLength);
      setState("ready");
    } catch {
      setDigest("");
      setByteLength(null);
      setState("error");
    }
  }

  async function copyDigest() {
    if (!digest || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(digest);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function updateMessage(value: string) {
    setMessage(value);
    setDigest("");
    setByteLength(null);
    setCopied(false);
    setState("idle");
  }

  return (
    <section className="crypto-lab-section" id="interactive-lab" aria-labelledby="crypto-lab-title">
      <div className="security-section-heading">
        <div><span className="section-index">03 / INTERACTIVE CRYPTOGRAPHY</span><h2 id="crypto-lab-title">One message. One real fingerprint.</h2></div>
        <span className="section-aside">BROWSER-NATIVE · SHA-256</span>
      </div>
      <p className="security-lead">Explore how a cryptographic hash turns text into a fixed-length digest. This lab calculates the actual SHA-256 result in your browser using the Web Crypto API. Your text is not uploaded or stored by this component.</p>

      <div className="crypto-lab">
        <div className="crypto-lab-head"><span>LOCAL CRYPTOGRAPHY WORKBENCH</span><span><i /> COMPUTED ON THIS DEVICE</span></div>
        <label className="crypto-input-label" htmlFor="crypto-message">INPUT MESSAGE <small>UTF-8 TEXT</small></label>
        <textarea id="crypto-message" value={message} onChange={(event) => updateMessage(event.target.value)} maxLength={4000} placeholder="Type a message to calculate its SHA-256 digest…" rows={4} spellCheck={false} />
        <div className="crypto-controls"><span>{new TextEncoder().encode(message).byteLength} bytes · {message.length}/4000 characters</span><button type="button" onClick={calculateDigest} disabled={!message.length || state === "working"}>{state === "working" ? "CALCULATING…" : "CALCULATE SHA-256 ↗"}</button></div>

        <div className={state === "ready" ? "crypto-result is-ready" : "crypto-result"} aria-live="polite">
          <div className="crypto-result-label"><span>OUTPUT / 256-BIT DIGEST</span><span>{state === "ready" ? "COMPUTED" : state === "error" ? "UNAVAILABLE" : "AWAITING INPUT"}</span></div>
          {state === "ready" ? (
            <>
              <div className="crypto-digest" aria-label={"SHA-256 digest: " + digest}>{digest.match(/.{1,8}/g)?.map((chunk, index) => <span key={index}>{chunk}</span>)}</div>
              <div className="crypto-result-meta"><span>ACTUAL INPUT SIZE <b>{byteLength} BYTES</b></span><button type="button" onClick={copyDigest} >{copied ? "COPIED ✓" : "COPY DIGEST"}</button></div>
            </>
          ) : (
            <div className="crypto-empty">{state === "error" ? "Web Crypto is unavailable here. Open this page in a supported secure browser context." : "Your digest will appear here after calculation. No example hash is substituted."}</div>
          )}
        </div>
      </div>

      <div className="crypto-learning-notes">
        <article><span>01 / DETERMINISTIC</span><strong>Same input, same digest</strong><p>For the same bytes and algorithm, SHA-256 produces the same 256-bit output.</p></article>
        <article><span>02 / FIXED LENGTH</span><strong>Always 256 bits</strong><p>The digest is 32 bytes, regardless of the input message length.</p></article>
        <article><span>03 / NOT ENCRYPTION</span><strong>One-way fingerprint</strong><p>Hashing does not conceal data with a reversible key. SHA-256 alone is not suitable for storing passwords.</p></article>
      </div>
      <p className="crypto-safety-note">Privacy note: the text is processed locally by the browser API and is not sent to this application's server by this lab. Do not enter passwords, recovery phrases, API keys, or other secrets into public demonstrations.</p>
    </section>
  );
}
