"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type DraftSummary = {
  id: string;
  title_en: string;
  title_my: string;
  category: string;
  workflow_state: string;
  updated_at: string;
  ready_at?: string | null;
};
type DraftDetail = DraftSummary & { content: unknown; reviews: Record<string, { decision: string; notes: string; reviewerUserId: string; reviewedAt: string }> };

const contentTemplate = {
  researchQuestion: { en: "", my: "" },
  objective: { en: "", my: "" },
  scope: { authorizedAssets: [], exclusions: [] },
  environment: { kind: "isolated-lab", runtime: "", harness: "", dataClassification: "synthetic" },
  testRunId: "",
  commit: "",
  result: "not-run",
  evidence: [],
  findings: [],
  remediation: { status: "not-started", summary: { en: "", my: "" } },
  retest: { status: "not-performed", summary: { en: "", my: "" } },
  limitations: { en: "", my: "" },
  editions: {
    en: { abstract: "", sections: [] },
    my: { abstract: "", sections: [] }
  },
  references: []
};

function stateLabel(state: string) {
  return state.replaceAll("_", " ");
}

export function ResearchWorkbench({ isOwner, isReviewer }: { isOwner: boolean; isReviewer: boolean }) {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [selected, setSelected] = useState<DraftDetail | null>(null);
  const [titleEn, setTitleEn] = useState("");
  const [titleMy, setTitleMy] = useState("");
  const [category, setCategory] = useState("Authentication");
  const [contentText, setContentText] = useState(JSON.stringify(contentTemplate, null, 2));
  const [reviewNotes, setReviewNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadDrafts = useCallback(async () => {
    const response = await fetch("/api/security/research/drafts", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Could not load drafts.");
    setDrafts(payload.drafts ?? []);
  }, []);

  const loadDraft = useCallback(async (id: string) => {
    const response = await fetch(`/api/security/research/drafts/${id}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Could not load this draft.");
    setSelected(payload.draft);
    setTitleEn(payload.draft.title_en);
    setTitleMy(payload.draft.title_my);
    setCategory(payload.draft.category);
    setContentText(JSON.stringify(payload.draft.content, null, 2));
  }, []);

  useEffect(() => {
    loadDrafts().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load drafts."));
  }, [loadDrafts]);

  const currentStage = useMemo(() => {
    if (!selected) return null;
    if (selected.workflow_state === "DRAFT") return "technical";
    if (selected.workflow_state === "SECURITY_PRIVACY_REVIEW") return "securityPrivacy";
    if (selected.workflow_state === "BILINGUAL_REVIEW") return "bilingual";
    if (selected.workflow_state === "OWNER_APPROVAL") return "owner";
    return null;
  }, [selected]);

  async function createDraft() {
    setBusy(true); setMessage("");
    try {
      const content = JSON.parse(contentText);
      const response = await fetch("/api/security/research/drafts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: { en: titleEn, my: titleMy }, category, content })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Draft could not be created.");
      await loadDrafts();
      await loadDraft(payload.draft.id);
      setMessage("Draft saved privately. It has not been published.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Check the JSON content and try again.");
    } finally { setBusy(false); }
  }

  async function saveDraft() {
    if (!selected) return;
    setBusy(true); setMessage("");
    try {
      const content = JSON.parse(contentText);
      const response = await fetch(`/api/security/research/drafts/${selected.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: { en: titleEn, my: titleMy }, category, content })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Draft could not be updated.");
      await loadDrafts(); await loadDraft(selected.id);
      setMessage("Draft updated. Review approvals have not been granted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Check the JSON content and try again.");
    } finally { setBusy(false); }
  }

  async function submitReview(decision: "approved" | "changes-requested") {
    if (!selected || !currentStage) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/security/research/review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: selected.id, stage: currentStage, decision, notes: reviewNotes })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Review could not be recorded.");
      setReviewNotes("");
      await loadDrafts(); await loadDraft(selected.id);
      setMessage(decision === "approved" ? "Review recorded. The next approval gate is now active." : "Changes requested. The author must revise the draft.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review could not be recorded.");
    } finally { setBusy(false); }
  }

  const canReview = Boolean(selected && currentStage && (currentStage === "owner" ? isOwner : isReviewer));

  return (
    <section className="security-section research-workbench">
      <div className="security-section-heading">
        <div><span className="section-index">01 / PRIVATE QUEUE</span><h2>Research workspace</h2></div>
        <span className="section-aside">{isOwner ? "OWNER ACCESS" : "REVIEWER ACCESS"}</span>
      </div>
      {message && <p className="research-workbench-message" role="status">{message}</p>}
      <div className="research-workbench-grid">
        <aside className="research-workbench-queue">
          <h3>Draft & review queue</h3>
          {drafts.length === 0 ? <p>No drafts or assigned reviews are available.</p> : drafts.map((draft) => (
            <button className={selected?.id === draft.id ? "research-workbench-draft active" : "research-workbench-draft"} key={draft.id} onClick={() => loadDraft(draft.id).catch((error) => setMessage(error.message))}>
              <strong>{draft.title_en}</strong>
              <span>{draft.category} · {stateLabel(draft.workflow_state)}</span>
              <small>{new Date(draft.updated_at).toLocaleString()}</small>
            </button>
          ))}
        </aside>
        <div className="research-workbench-editor">
          {isOwner && (
            <div className="research-workbench-form">
              <h3>{selected ? "Edit selected draft" : "Create a research draft"}</h3>
              <label>English title<input value={titleEn} onChange={(event) => setTitleEn(event.target.value)} maxLength={180} /></label>
              <label>မြန်မာခေါင်းစဉ်<input value={titleMy} onChange={(event) => setTitleMy(event.target.value)} maxLength={240} /></label>
              <label>Category<input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} /></label>
              <label>Structured research record (JSON)<textarea value={contentText} onChange={(event) => setContentText(event.target.value)} rows={22} spellCheck={false} /></label>
              <p className="research-workbench-hint">Use verified test-run data and sanitized evidence only. The schema requires complete English and Burmese editions, scope, findings, references, and retest/remediation provenance.</p>
              <div className="research-workbench-actions">
                <button disabled={busy || !titleEn.trim() || !titleMy.trim()} onClick={() => selected ? saveDraft() : createDraft()}>{busy ? "SAVING…" : selected ? "SAVE DRAFT" : "CREATE PRIVATE DRAFT"}</button>
                {selected && <button className="secondary" disabled={busy || selected.workflow_state !== "DRAFT"} onClick={() => { setSelected(null); setTitleEn(""); setTitleMy(""); setContentText(JSON.stringify(contentTemplate, null, 2)); }}>NEW DRAFT</button>}
              </div>
            </div>
          )}
          {selected && (
            <div className="research-workbench-review">
              <span className="research-empty-mark">WORKFLOW / {stateLabel(selected.workflow_state)}</span>
              <h3>{selected.title_en}</h3>
              <p lang="my">{selected.title_my}</p>
              <p>Category: {selected.category}</p>
              <p>Reviews recorded: {Object.keys(selected.reviews ?? {}).length} / 4</p>
              {Object.entries(selected.reviews ?? {}).map(([stage, review]) => (
                <div className="research-workbench-review-record" key={stage}>
                  <strong>{stateLabel(stage)} · {review.decision}</strong>
                  <p>{review.notes}</p>
                </div>
              ))}
              {canReview && (
                <div className="research-workbench-form">
                  <label>Review notes<textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={4} maxLength={2000} /></label>
                  <div className="research-workbench-actions">
                    <button disabled={busy || reviewNotes.trim().length < 4} onClick={() => submitReview("approved")}>APPROVE THIS STAGE</button>
                    <button className="secondary" disabled={busy || reviewNotes.trim().length < 4} onClick={() => submitReview("changes-requested")}>REQUEST CHANGES</button>
                  </div>
                </div>
              )}
              {selected.workflow_state === "READY_TO_PUBLISH" && <p className="research-workbench-hint">All review gates are recorded. This is not yet public: final evidence verification and a reviewed feature-branch publication commit are still required.</p>}
            </div>
          )}
          {!selected && !isOwner && <p>Select an assigned draft from the queue to review.</p>}
        </div>
      </div>
    </section>
  );
}
