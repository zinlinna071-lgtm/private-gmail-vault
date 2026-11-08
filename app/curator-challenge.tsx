"use client";

import { useEffect, useMemo, useState } from "react";

const marks = [
  { id: "margin", title: "The Margin", location: "CHART EDGE", fragment: "The oldest story is written first.", glyph: "Ⅰ" },
  { id: "shelf", title: "The Empty Shelf", location: "COLLECTION", fragment: "Four forms belong to one archive.", glyph: "Ⅱ" },
  { id: "note", title: "The Curator's Note", location: "FOOTNOTE", fragment: "The seam remembers the fourth.", glyph: "Ⅳ" }
] as const;

const records = [
  { id: "email", label: "EMAIL", symbol: "✉" },
  { id: "backup", label: "BACKUP CODE", symbol: "⌑" },
  { id: "note", label: "NOTE", symbol: "≋" },
  { id: "password", label: "PASSWORD", symbol: "◇" }
] as const;

const solution = ["email", "backup", "note", "password"];

export default function CuratorChallenge() {
  const [found, setFound] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>(["email", "password", "backup", "note"]);
  const [revealed, setRevealed] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [challengeReady, setChallengeReady] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/curator/challenge", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("The archive challenge could not be started.");
        return response.json();
      })
      .then(() => { if (active) setChallengeReady(true); })
      .catch(error => { if (active) setVerificationError(error instanceof Error ? error.message : "The archive challenge could not be started."); });
    return () => { active = false; };
  }, []);

  async function verifyChallenge() {
    if (!complete || !challengeReady || verifying) return;
    setVerifying(true);
    setVerificationError("");
    setVerificationMessage("");
    try {
      const response = await fetch("/api/curator/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ found, order })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The archive could not be verified.");
      setRevealed(true);
      setVerificationMessage(data.message ?? "The Curator's Signal is verified.");
    } catch (error) {
      setVerificationError(error instanceof Error ? error.message : "The archive could not be verified.");
    } finally {
      setVerifying(false);
    }
  }

  const complete = useMemo(
    () => found.length === marks.length && order.every((value, index) => value === solution[index]),
    [found, order]
  );

  function move(index: number, direction: -1 | 1) {
    setOrder(current => {
      const next = [...current];
      const target = (index + direction + next.length) % next.length;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <main className="curator-shell">
      <div className="curator-grain" aria-hidden="true" />
      <header className="curator-header">
        <a className="curator-brand" href="/">
          <span className="curator-brand-mark">V</span>
          <span>PRIVATE ACCOUNT VAULT<small>THE CURATOR'S ARCHIVE</small></span>
        </a>
        <span className="curator-header-note"><i /> DISCOVERY EXPERIENCE</span>
      </header>

      <section className="curator-intro">
        <span className="curator-kicker">A QUIET ANOMALY / AN INVITATION</span>
        <h1>The Curator's <em>Signal.</em></h1>
        <p>Some archives reveal themselves only to those who notice what is almost ordinary. Explore the margins, collect the marks, and discover the shape hidden beneath the surface.</p>
        <div className="curator-meta"><span>NO TIMER</span><span>SERVER-VERIFIED CHALLENGE</span><span>THREE ARCHIVE MARKS</span></div>
      </section>

      <section className="curator-panel" aria-labelledby="marks-title">
        <div className="curator-section-head">
          <div><span className="curator-kicker">01 / OBSERVATION</span><h2 id="marks-title">The archive marks</h2></div>
          <span className="curator-progress">{found.length.toString().padStart(2, "0")} / 03 FOUND</span>
        </div>
        <div className="curator-mark-grid">
          {marks.map(mark => {
            const active = found.includes(mark.id);
            return (
              <button key={mark.id} type="button" className={active ? "curator-mark is-found" : "curator-mark"} onClick={() => setFound(current => current.includes(mark.id) ? current : [...current, mark.id])} aria-pressed={active}>
                <span className="curator-mark-location">{mark.location}</span>
                <span className="curator-mark-glyph">{active ? mark.glyph : "·"}</span>
                <strong>{mark.title}</strong>
                <span className="curator-mark-action">{active ? mark.fragment : "EXAMINE THE DETAIL ↗"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="curator-panel" aria-labelledby="lock-title">
        <div className="curator-section-head">
          <div><span className="curator-kicker">02 / RECONSTRUCTION</span><h2 id="lock-title">The Fourfold Lock</h2></div>
          <span className="curator-progress">FOUR ARCHIVE RINGS</span>
        </div>
        <p className="curator-lock-copy">The marks describe an order, not a password. Arrange the archive categories from first to last. Use the arrows or the controls with a keyboard.</p>
        <div className="curator-lock">
          <div className="curator-lock-orbit orbit-a" />
          <div className="curator-lock-orbit orbit-b" />
          <div className="curator-lock-core"><span>V</span><small>ARCHIVE</small></div>
          {order.map((id, index) => {
            const record = records.find(item => item.id === id)!;
            return (
              <div className={"curator-ring ring-" + index} key={id}>
                <button type="button" className="curator-ring-step" onClick={() => move(index, -1)} aria-label={"Move " + record.label + " earlier"}>‹</button>
                <span className="curator-ring-symbol" aria-hidden="true">{record.symbol}</span>
                <strong>{record.label}</strong>
                <span className="curator-ring-position">0{index + 1}</span>
                <button type="button" className="curator-ring-step" onClick={() => move(index, 1)} aria-label={"Move " + record.label + " later"}>›</button>
              </div>
            );
          })}
        </div>
        <div className="curator-lock-actions">
          <button type="button" className="curator-hint-button" onClick={() => setShowHints(value => !value)} aria-expanded={showHints}>{showHints ? "HIDE THE CURATOR'S NOTE" : "ASK FOR A HINT"}</button>
          <button type="button" className="curator-unlock-button" disabled={!complete || !challengeReady || verifying} onClick={verifyChallenge}>{verifying ? "VERIFYING…" : "ALIGN THE ARCHIVE"} <span>↗</span></button>
        </div>
        {showHints && <p className="curator-hint" role="status">Begin with the oldest record. The fragments point to an order of categories, not to any personal information.</p>}
        {verificationError && <p className="curator-hint" role="alert">{verificationError}</p>}
        {revealed && <div className="curator-reveal" role="status"><span className="curator-reveal-mark">✧</span><div><strong>The archive has answered.</strong><p>{verificationMessage} Your one-time registration claim is valid for ten minutes and is bound to this browser session. No account has been created yet.</p><a href="/#create-vault">Continue to account creation ↗</a></div></div>}
      </section>

      <footer className="curator-footer"><span>THE CURATOR'S SIGNAL</span><span>PUBLIC DISCOVERY · SECONDARY REGISTRATION GATE · NO MASTER ACCESS</span><a href="/">RETURN TO THE VAULT</a></footer>
    </main>
  );
}
