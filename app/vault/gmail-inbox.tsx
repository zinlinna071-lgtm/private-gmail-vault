"use client";

import { useCallback, useEffect, useState } from "react";

type Message = { id: string; from: string; subject: string; date: string; snippet: string };
type InboxResponse = { account?: string; messages?: Message[]; error?: string };
type MessageDetail = {
  id: string;
  account: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  bodyText: string;
  attachments: Array<{ filename: string; mimeType: string; size: number }>;
};

export default function GmailInbox() {
  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<MessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/gmail/messages", { cache: "no-store" });
      const result = await response.json() as InboxResponse;
      if (!response.ok) throw new Error(result.error ?? "inbox_load_failed");
      setData(result);
      setSelected(null);
      setDetailError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replaceAll("_", " ") : "Unable to load inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  const openMessage = async (id: string) => {
    setDetailLoading(true);
    setDetailError("");
    setSelected(null);
    try {
      const response = await fetch(`/api/gmail/messages/${encodeURIComponent(id)}`, { cache: "no-store" });
      const result = await response.json() as MessageDetail & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "message_load_failed");
      setSelected(result);
    } catch (cause) {
      setDetailError(cause instanceof Error ? cause.message.replaceAll("_", " ") : "Unable to open message");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="notice" aria-labelledby="inbox-heading">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <strong id="inbox-heading">Inbox preview</strong>
        <button className="secondary-button" type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh inbox"}
        </button>
      </div>
      <p>Showing up to 20 recent Inbox messages. Open a message to read its text content.</p>
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
                  <button className="secondary-button" type="button" onClick={() => void openMessage(message.id)} disabled={detailLoading}>
                    {detailLoading ? "Opening…" : "Read email"}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p>Your Inbox has no messages to display.</p>}
        </>
      )}
      {detailError && <p className="feedback error" role="alert">{detailError}</p>}
      {selected && (
        <article className="notice" aria-label="Email details" style={{ marginTop: 20, overflowWrap: "anywhere" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <strong>Email details</strong>
            <button className="secondary-button" type="button" onClick={() => setSelected(null)}>Close</button>
          </div>
          <h2 style={{ fontSize: 20, margin: "14px 0" }}>{selected.subject}</h2>
          <p><strong>From:</strong> {selected.from || "—"}</p>
          <p><strong>To:</strong> {selected.to || "—"}</p>
          {selected.cc && <p><strong>CC:</strong> {selected.cc}</p>}
          <p><strong>Date:</strong> {selected.date || "—"}</p>
          <hr style={{ borderColor: "#34445f", margin: "16px 0" }} />
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit", lineHeight: 1.65 }}>{selected.bodyText || "No readable text content in this email."}</pre>
          {!!selected.attachments.length && (
            <div style={{ marginTop: 18 }}>
              <strong>Attachments (details only)</strong>
              <ul>{selected.attachments.map((file, index) => <li key={index}>{file.filename} · {file.mimeType} · {file.size} bytes</li>)}</ul>
              <p style={{ fontSize: 12 }}>Attachment downloads are not enabled yet.</p>
            </div>
          )}
        </article>
      )}
    </section>
  );
}
