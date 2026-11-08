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
type DraftDetail = DraftSummary & { content: unknown; reviews: Record<string, Array<{ decision: string; notes: string; reviewerUserId: string; reviewedAt: string }>> };
type ReviewerAssignment = { id: string; draft_id: string; stage: string; reviewer_user_id: string; assigned_at: string; expires_at: string; revoked_at: string | null; revoked_by_owner_user_id?: string | null };

const contentTemplate = {
  researchQuestion: { en: "", my: "" },
  objective: { en: "", my: "" },
  scope: { authorizedAssets: [], exclusions: [] },
  environment: { kind: "isolated-lab", runtime: "", harness: "", dataClassification: "synthetic" },
  testRunId: "",
  commit: "",
  result: "",
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
  const [reviewerUserId, setReviewerUserId] = useState("");
  const [assignments, setAssignments] = useState<ReviewerAssignment[]>([]);
  const [assignmentDays, setAssignmentDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadDrafts = useCallback(async () => {
    const response = await fetch("/api/security/research/drafts", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Could not load drafts.");
    setDrafts(payload.drafts ?? []);
  }, []);

  const loadAssignments = useCallback(async (draftId: string) => {
    const response = await fetch(`/api/security/research/assignments?draftId=${encodeURIComponent(draftId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Could not load reviewer assignments.");
    setAssignments(payload.assignments ?? []);
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

  async function assignReviewer() {
    if (!selected || !currentStage || currentStage === "owner") return;
    const days = Number(assignmentDays);
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      setMessage("Choose an assignment duration from 1 to 30 days.");
      return;
    }
    setBusy(true); setMessage("");
    try {
      const stage = currentStage === "securityPrivacy" ? "security_privacy" : currentStage;
      const response = await fetch("/api/security/research/assignments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: selected.id,
          reviewerUserId: reviewerUserId.trim(),
          stage,
          expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Reviewer assignment could not be created.");
      setReviewerUserId("");
      setMessage("Reviewer assigned to this draft and stage. The grant expires automatically.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reviewer assignment could not be created.");
    } finally { setBusy(false); }
  }

  async function revokeAssignment(assignmentId: string) {
    if (!selected) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/security/research/assignments", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Assignment could not be revoked.");
      await loadAssignments(selected.id);
      setMessage("Reviewer assignment revoked. Access is denied on the next request.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Assignment could not be revoked.");
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
              <p>Review stages with records: {Object.keys(selected.reviews ?? {}).length} / 4</p>
              {isOwner && currentStage && currentStage !== "owner" && (
                <div className="research-workbench-form">
                  <h4>Assign an independent reviewer</h4>
                  <label>Reviewer account UUID<input value={reviewerUserId} onChange={(event) => setReviewerUserId(event.target.value)} autoComplete="off" spellCheck={false} /></label>
                  <label>Assignment validity (days)<input type="number" min={1} max={30} value={assignmentDays} onChange={(event) => setAssignmentDays(event.target.value)} /></label>
                  <p className="research-workbench-hint">Only accounts already present in the server-side reviewer allowlist can be assigned. This grant applies only to the selected draft and its current review stage.</p>
                  <div className="research-workbench-actions">
                    <button disabled={busy || !reviewerUserId.trim()} onClick={assignReviewer}>ASSIGN TO CURRENT STAGE</button>
                  </div>
                </div>
              )}
              {isOwner && (
                <div className="research-workbench-form">
                  <h4>Reviewer assignment history</h4>
                  {assignments.length === 0 ? <p>No assignments recorded for this draft.</p> : assignments.map((assignment) => {
                    const status = assignment.revoked_at ? "REVOKED" : Date.parse(assignment.expires_at) <= Date.now() ? "EXPIRED" : "ACTIVE";
                    return (
                      <div className="research-workbench-review-record" key={assignment.id}>
                        <strong>{assignment.stage.replaceAll("_", " ")} · {status}</strong>
                        <p>Reviewer: <code>{assignment.reviewer_user_id}</code></p>
                        <p>Assigned: {new Date(assignment.assigned_at).toLocaleString()} · Expires: {new Date(assignment.expires_at).toLocaleString()}</p>
                        {assignment.revoked_at && <p>Revoked: {new Date(assignment.revoked_at).toLocaleString()}</p>}
                        {status === "ACTIVE" && <button className="secondary" disabled={busy} onClick={() => revokeAssignment(assignment.id)}>REVOKE ACCESS</button>}
                      </div>
                    );
                  })}
                </div>
              )}
              {Object.entries(selected.reviews ?? {}).flatMap(([stage, history]) =>
                (Array.isArray(history) ? history : []).map((review, index) => (
                  <div className="research-workbench-review-record" key={`${stage}-${index}`}>
                    <strong>{stateLabel(stage)} · {review.decision} · {new Date(review.reviewedAt).toLocaleString()}</strong>
                    <p>{review.notes}</p>
                  </div>
                ))
              )}
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
