"use client";

import { useCallback, useEffect, useState } from "react";

type Message = { id: string; from: string; subject: string; date: string; snippet: string };
type InboxResponse = { account?: string; messages?: Message[]; error?: string };

export default function GmailInbox() {
  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/gmail/messages", { cache: "no-store" });
      const result = await response.json() as InboxResponse;
      if (!response.ok) throw new Error(result.error ?? "inbox_load_failed");
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replaceAll("_", " ") : "Unable to load inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="notice" aria-labelledby="inbox-heading">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <strong id="inbox-heading">Inbox preview</strong>
        <button className="secondary-button" type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh inbox"}
        </button>
      </div>
      <p>Showing up to 20 recent Inbox messages. Only sender, subject, date and preview are displayed.</p>
      {error && <p className="feedback error" role="alert">{error}</p>}
      {loading && !data && <p>Loading Gmail messages…</p>}
      {data && (
        <>
          <p>Connected account: <strong>{data.account}</strong></p>
          {data.messages?.length ? (
            <ul style={{ paddingLeft: 20 }}>
              {data.messages.map((message) => (
                <li key={message.id} style={{ margin: "18px 0", overflowWrap: "anywhere" }}>
                  <strong>{message.subject}</strong>
                  <p style={{ margin: "5px 0", color: "#c5d4f4" }}>{message.from}</p>
                  <p style={{ margin: "5px 0", color: "#71809a", fontSize: 12 }}>{message.date}</p>
                  <p style={{ margin: "5px 0", color: "#aab9d2", fontSize: 13, lineHeight: 1.6 }}>{message.snippet}</p>
                </li>
              ))}
            </ul>
          ) : <p>Your Inbox has no messages to display.</p>}
        </>
      )}
    </section>
  );
}
