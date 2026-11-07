"use client";

import { useEffect, useState } from "react";

type LabEvent = {
  id: number;
  time: string;
  level: "INFO" | "PASS" | "WATCH";
  source: string;
  message: string;
  trace: string;
};

const scenarios = [
  { level: "INFO" as const, source: "EDGE-GATEWAY", message: "Synthetic request accepted by isolated lab gateway", trace: "REQ-7A2F" },
  { level: "PASS" as const, source: "IDENTITY-LAB", message: "Test identity challenge completed", trace: "AUTH-19C4" },
  { level: "INFO" as const, source: "API-SANDBOX", message: "Schema validation completed for fixture payload", trace: "API-84D1" },
  { level: "WATCH" as const, source: "RATE-LIMITER", message: "Controlled burst fixture reached observation threshold", trace: "RATE-3B90" },
  { level: "PASS" as const, source: "CRYPTO-HARNESS", message: "AES-GCM fixture integrity check passed", trace: "CRYPTO-2E61" },
  { level: "INFO" as const, source: "SESSION-LAB", message: "Synthetic session lifecycle event recorded", trace: "SESS-61A8" },
  { level: "PASS" as const, source: "POLICY-ENGINE", message: "Cross-tenant fixture access denied as expected", trace: "ACL-0F32" },
  { level: "INFO" as const, source: "EVIDENCE-STORE", message: "Demo trace attached to local scenario timeline", trace: "EVD-5D77" }
];

const initialEvents: LabEvent[] = scenarios.slice(0, 4).map((event, index) => ({
  ...event,
  id: index,
  time: new Date(Date.now() - (3 - index) * 1700).toLocaleTimeString("en-GB", { hour12: false })
}));

export default function LabActivityConsole() {
  const [events, setEvents] = useState<LabEvent[]>(initialEvents);
  const [pulse, setPulse] = useState(0);
  const [ticks, setTicks] = useState([32, 54, 41, 68, 47, 76, 38, 59, 45, 71, 52, 64]);

  useEffect(() => {
    let sequence = 4;
    const timer = window.setInterval(() => {
      const next = scenarios[sequence % scenarios.length];
      setEvents(current => [{
        ...next,
        id: sequence,
        time: new Date().toLocaleTimeString("en-GB", { hour12: false })
      }, ...current].slice(0, 7));
      setTicks(current => [...current.slice(1), 24 + Math.floor(Math.random() * 68)]);
      setPulse(value => value + 1);
      sequence += 1;
    }, 1900);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="lab-console-section" aria-labelledby="lab-console-title">
      <div className="lab-console-heading">
        <div>
          <span className="section-index">LIVE LAB EXPERIENCE / 02</span>
          <h2 id="lab-console-title">Inside the security workstation.</h2>
          <p>Explore a controlled visual walkthrough of how security signals, test events, and evidence can move through an isolated research environment.</p>
        </div>
        <span className="lab-console-state"><i /> DEMO STREAM RUNNING</span>
      </div>

      <div className="lab-console">
        <div className="lab-console-topbar">
          <div className="lab-window-dots"><i /><i /><i /></div>
          <span>SECURITY LAB / OBSERVABILITY CONSOLE</span>
          <span className="lab-topbar-right">SESSION DEMO-{String(pulse + 41).padStart(4, "0")}</span>
        </div>

        <div className="lab-console-grid">
          <div className="lab-network-panel">
            <div className="lab-panel-label"><span>01 / NETWORK TOPOLOGY</span><small>ISOLATED TEST MODEL</small></div>
            <div className="lab-topology" aria-label="Animated conceptual network topology for a simulated lab environment">
              <svg viewBox="0 0 520 310" role="img" aria-label="Gateway connected to identity, API, cryptography and evidence test nodes">
                <defs>
                  <linearGradient id="labLine" x1="0" x2="1"><stop offset="0" stopColor="#3b8e89" stopOpacity=".18" /><stop offset="1" stopColor="#77f0ce" stopOpacity=".9" /></linearGradient>
                  <filter id="labGlow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <path className="lab-link" d="M260 148 L112 70 M260 148 L408 70 M260 148 L112 238 M260 148 L408 238" />
                <path className="lab-link lab-link-dash" d="M112 70 L408 70 M112 238 L408 238" />
                <circle className="lab-flow-dot flow-one" r="4"><animateMotion dur="3.6s" repeatCount="indefinite" path="M260 148 L112 70" /></circle>
                <circle className="lab-flow-dot flow-two" r="4"><animateMotion dur="4.2s" repeatCount="indefinite" path="M260 148 L408 70" /></circle>
                <circle className="lab-flow-dot flow-three" r="4"><animateMotion dur="3.9s" repeatCount="indefinite" path="M260 148 L112 238" /></circle>
                <circle className="lab-flow-dot flow-four" r="4"><animateMotion dur="4.5s" repeatCount="indefinite" path="M260 148 L408 238" /></circle>
                <g className="lab-node lab-node-core" filter="url(#labGlow)"><circle cx="260" cy="148" r="37" /><text x="260" y="144">LAB</text><text x="260" y="160" className="lab-svg-small">CORE</text></g>
                <g className="lab-node"><circle cx="112" cy="70" r="26" /><text x="112" y="74">ID</text><text x="112" y="112" className="lab-svg-label">IDENTITY</text></g>
                <g className="lab-node"><circle cx="408" cy="70" r="26" /><text x="408" y="74">API</text><text x="408" y="112" className="lab-svg-label">GATEWAY</text></g>
                <g className="lab-node"><circle cx="112" cy="238" r="26" /><text x="112" y="242">CR</text><text x="112" y="280" className="lab-svg-label">CRYPTO</text></g>
                <g className="lab-node"><circle cx="408" cy="238" r="26" /><text x="408" y="242">EV</text><text x="408" y="280" className="lab-svg-label">EVIDENCE</text></g>
              </svg>
            </div>
            <div className="lab-network-legend"><span><i /> CONTROLLED NODE</span><span><i /> SIMULATED DATA PATH</span></div>
          </div>

          <div className="lab-telemetry-panel">
            <div className="lab-panel-label"><span>02 / SIGNAL TELEMETRY</span><small>SYNTHETIC FIXTURES</small></div>
            <div className="lab-metric-row">
              <div><small>EVENT RATE</small><strong>{(18 + (pulse % 9) * 3).toString()}<em> / min</em></strong></div>
              <div><small>ACTIVE NODES</small><strong>05<em> / 05</em></strong></div>
            </div>
            <div className="lab-chart" aria-label="Animated synthetic event-rate chart">
              {ticks.map((height, index) => <i key={index} style={{ height: height + "%" }} />)}
            </div>
            <div className="lab-chart-scale"><span>−12s</span><span>NOW</span></div>
            <div className="lab-status-list">
              <div><span><i className="status-good" /> Gateway</span><b>READY</b></div>
              <div><span><i className="status-good" /> Identity harness</span><b>READY</b></div>
              <div><span><i className="status-watch" /> Rate-limit fixture</span><b>OBSERVING</b></div>
              <div><span><i className="status-good" /> Evidence capture</span><b>READY</b></div>
            </div>
          </div>
        </div>

        <div className="lab-event-panel">
          <div className="lab-panel-label"><span>03 / EVENT STREAM</span><small>LOCAL DEMO EVENTS · NO PRODUCTION DATA</small></div>
          <div className="lab-event-list" aria-live="polite" aria-relevant="additions">
            {events.map(event => (
              <div className="lab-event-row" key={event.id}>
                <time>{event.time}</time>
                <b className={"lab-event-level level-" + event.level.toLowerCase()}>{event.level}</b>
                <strong>{event.source}</strong>
                <span>{event.message}</span>
                <code>{event.trace}</code>
              </div>
            ))}
          </div>
        </div>
        <div className="lab-console-disclaimer"><span>SIMULATED WALKTHROUGH</span><p>This animated console uses synthetic fixture events generated in your browser. It is not connected to real network traffic, production accounts, or an active penetration test. Verified test results are published separately with their original evidence links.</p></div>
      </div>
    </section>
  );
}
