"use client";

import { useEffect, useState } from "react";

const architectureNodes = [
  { code: "01", name: "Identity", detail: "Authentication boundary" },
  { code: "02", name: "Gateway", detail: "Request boundary" },
  { code: "03", name: "Cryptography", detail: "Key and data boundary" },
  { code: "04", name: "Evidence", detail: "Audit record boundary" }
];

export default function LabActivityConsole() {
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    setCheckedAt(new Date().toLocaleTimeString("en-GB", { hour12: false }));
  }, []);

  return (
    <section id="live-theater" className="lab-console-section" aria-labelledby="lab-console-title">
      <div className="lab-console-heading">
        <div>
          <span className="section-index">OBSERVABILITY / SOURCE STATUS</span>
          <h2 id="lab-console-title">The workstation is ready for real signals.</h2>
          <p>A high-resolution view of the system boundaries and evidence channels. Live telemetry will appear only after a verified source is connected.</p>
        </div>
        <span className="lab-console-state is-disconnected"><i /> TELEMETRY NOT CONNECTED</span>
      </div>

      <div className="lab-console">
        <div className="lab-console-topbar">
          <div className="lab-window-dots" aria-hidden="true"><i /><i /><i /></div>
          <span>PRIVATE SECURITY LAB / OBSERVABILITY</span>
          <span className="lab-topbar-right">SOURCE STATUS: UNBOUND</span>
        </div>

        <div className="lab-console-grid">
          <div className="lab-network-panel">
            <div className="lab-panel-label"><span>01 / SYSTEM BOUNDARIES</span><small>REFERENCE ARCHITECTURE</small></div>
            <div className="lab-topology">
              <div className="lab-architecture-map" role="img" aria-label="Reference architecture diagram showing four security boundaries around the application core. This is not a live network map.">
                <div className="architecture-orbit orbit-outer" />
                <div className="architecture-orbit orbit-inner" />
                <div className="architecture-core"><span>PSL</span><small>LAB CORE</small></div>
                {architectureNodes.map((node, index) => (
                  <div className={"architecture-node architecture-node-" + index} key={node.code}>
                    <span>{node.code}</span><strong>{node.name}</strong><small>{node.detail}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="lab-network-legend"><span><i /> DEFINED BOUNDARY</span><span><i /> REFERENCE ONLY · NOT CONNECTED</span></div>
            <p className="lab-architecture-note">This diagram documents intended security boundaries. It does not assert that these components are deployed, online, or exchanging traffic.</p>
          </div>

          <div className="lab-telemetry-panel">
            <div className="lab-panel-label"><span>02 / LIVE TELEMETRY</span><small>VERIFIED SOURCE REQUIRED</small></div>
            <div className="lab-source-state">
              <span className="source-state-icon" aria-hidden="true"><i /><i /><i /></span>
              <strong>Awaiting a trusted event source</strong>
              <p>No live metrics are available because an authenticated telemetry source has not been connected.</p>
            </div>
            <div className="lab-status-list">
              <div><span>Event stream</span><b className="status-unavailable">NOT CONNECTED</b></div>
              <div><span>Network measurements</span><b className="status-unavailable">NOT REPORTED</b></div>
              <div><span>Active test session</span><b className="status-unavailable">NONE RECORDED</b></div>
              <div><span>Evidence pipeline</span><b className="status-unavailable">NOT CONNECTED</b></div>
            </div>
            <div className="lab-source-foot"><span>LAST LOCAL RENDER</span><strong>{checkedAt ?? "Waiting for browser clock"}</strong></div>
          </div>
        </div>

        <div className="lab-event-panel">
          <div className="lab-panel-label"><span>03 / VERIFIED EVENT JOURNAL</span><small>NO SOURCE EVENTS</small></div>
          <div className="lab-empty-journal">
            <div className="journal-mark" aria-hidden="true">∅</div>
            <div><strong>No events received</strong><p>When a real, authenticated lab source is connected, original events will be listed here with their source ID, timestamp, trace reference, and evidence link. Nothing is generated to fill this space.</p></div>
          </div>
        </div>
        <div className="lab-session-viewer">
          <div className="lab-panel-label"><span>04 / SESSION VIEWER</span><small>PUBLIC-SAFE EVENT PROJECTION</small></div>
          <div className="lab-session-empty">
            <div className="lab-session-screen" aria-hidden="true">
              <div className="lab-screen-top"><i /><i /><i /><span>SESSION / NOT SELECTED</span></div>
              <div className="lab-screen-lines"><i /><i /><i /><i /></div>
              <div className="lab-screen-center"><span>NO SESSION</span><small>WAITING FOR VERIFIED SOURCE</small></div>
            </div>
            <div className="lab-session-copy">
              <strong>No research session is available to watch yet.</strong>
              <p>When an authorized test is running and its event source has passed verification, this area can present a sanitized, read-only session view. Until then, no playback or activity is fabricated.</p>
              <p lang="my">ခွင့်ပြုထားတဲ့ Lab Test တကယ်လုပ်ဆောင်နေပြီး Event Source ကို အတည်ပြုပြီးမှသာ ဒီနေရာမှာ အများပြည်သူကြည့်ရှုနိုင်တဲ့ အချက်အလက်တွေ ပြသမယ်။ လက်ရှိမှာ ကြည့်ရှုနိုင်တဲ့ Session မရှိသေးပါဘူး။</p>
            </div>
          </div>
          <div className="lab-session-contract">
            <div><span>PUBLIC EVENT FIELDS</span><strong>Timestamp · Source ID · Trace reference · Sanitized summary · Evidence link</strong></div>
            <div><span>NEVER EXPOSED</span><strong>Credentials · Cookies · Tokens · Private keys · Raw exploit payloads</strong></div>
          </div>
          <div className="lab-state-legend">
            <div className="lab-panel-label"><span>05 / SESSION STATE DEFINITIONS</span><small>LABELS DESCRIBE DATA PROVENANCE</small></div>
            <div className="lab-state-grid">
              <article><b className="state-live">LIVE</b><p>Verified source; an authorized test is happening now.</p></article>
              <article><b className="state-delayed">DELAYED</b><p>Verified events are shown after a deliberate safety delay.</p></article>
              <article><b className="state-recorded">RECORDED</b><p>A completed session with a preserved evidence trail.</p></article>
              <article><b className="state-illustrative">ILLUSTRATIVE</b><p>A clearly labeled conceptual explanation, not test telemetry.</p></article>
              <article><b className="state-simulated">SIMULATED</b><p>A controlled simulation using non-production fixtures.</p></article>
              <article><b className="state-unavailable">UNAVAILABLE</b><p>No verified source or session can currently be shown.</p></article>
            </div>
            <p className="lab-state-note">These are defined display states, not a report that any session is currently active. The current state remains UNAVAILABLE.</p>
          </div>
        </div>

        <div className="lab-console-disclaimer"><span>DATA INTEGRITY</span><p>No synthetic events, random metrics, fabricated timestamps, or simulated traffic are displayed. A missing source is shown as unavailable; verified test history remains linked to its original CI evidence.</p></div>
      </div>
    </section>
  );
}
