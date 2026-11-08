import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/auth/vault";
import { isJsonContentType } from "@/lib/auth/content-type";
import { readBoundedJson } from "@/lib/auth/bounded-json";
import { getResearchActor } from "@/lib/security-research/workflow-auth";
import { isConfiguredResearchReviewer, type ResearchReviewStage } from "@/lib/security-research/review-assignments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const stages = ["technical", "security_privacy", "bilingual"] as const;
const expectedStates: Record<ResearchReviewStage, string> = {
  technical: "DRAFT",
  security_privacy: "SECURITY_PRIVACY_REVIEW",
  bilingual: "BILINGUAL_REVIEW"
};

export async function GET(request: Request) {
  const actor = await getResearchActor();
  if (!actor) return reply({ error: "Research assignment access is not configured or you are not signed in." }, 401);
  if (!actor.isOwner) return reply({ error: "Owner access required." }, 403);

  const draftId = new URL(request.url).searchParams.get("draftId");
  if (draftId && !UUID.test(draftId)) return reply({ error: "Invalid draft ID." }, 400);

  try {
    const admin = createSupabaseAdminClient();
    let query = admin.from("security_research_review_assignments")
      .select("id,draft_id,stage,reviewer_user_id,assigned_by_owner_user_id,assigned_at,expires_at,revoked_at,revoked_by_owner_user_id")
      .order("assigned_at", { ascending: false })
      .limit(100);
    if (draftId) query = query.eq("draft_id", draftId);
    const { data, error } = await query;
    if (error) return reply({ error: "Could not load reviewer assignments." }, 503);
    return reply({ assignments: data ?? [] });
  } catch {
    return reply({ error: "Could not load reviewer assignments." }, 503);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return reply({ error: "Invalid request origin." }, 403);
  if (!isJsonContentType(request.headers.get("content-type"))) return reply({ error: "JSON is required." }, 415);

  const actor = await getResearchActor();
  if (!actor) return reply({ error: "Research assignment access is not configured or you are not signed in." }, 401);
  if (!actor.isOwner) return reply({ error: "Owner access required." }, 403);

  const body = await readBoundedJson(request, 8 * 1024);
  if (!body.ok || !body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
    return reply({ error: "Invalid or oversized JSON request." }, body.ok ? 400 : body.reason === "too_large" ? 413 : 400);
  }
  const assignmentId = (body.value as Record<string, unknown>).assignmentId;
  if (typeof assignmentId !== "string" || !UUID.test(assignmentId)) {
    return reply({ error: "A valid assignment ID is required." }, 400);
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("security_research_review_assignments")
      .update({ revoked_at: new Date().toISOString(), revoked_by_owner_user_id: actor.id })
      .eq("id", assignmentId)
      .is("revoked_at", null)
      .select("id,draft_id,stage,reviewer_user_id,assigned_at,expires_at,revoked_at,revoked_by_owner_user_id")
      .maybeSingle();
    if (error) return reply({ error: "Could not revoke the reviewer assignment." }, 503);
    if (!data) return reply({ error: "Assignment not found or already revoked." }, 404);
    return reply({ assignment: data });
  } catch {
    return reply({ error: "Could not revoke the reviewer assignment." }, 503);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return reply({ error: "Invalid request origin." }, 403);
  if (!isJsonContentType(request.headers.get("content-type"))) return reply({ error: "JSON is required." }, 415);

  const actor = await getResearchActor();
  if (!actor) return reply({ error: "Research assignment access is not configured or you are not signed in." }, 401);
  if (!actor.isOwner) return reply({ error: "Owner access required." }, 403);

  const body = await readBoundedJson(request, 8 * 1024);
  if (!body.ok || !body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
    return reply({ error: "Invalid or oversized JSON request." }, body.ok ? 400 : body.reason === "too_large" ? 413 : 400);
  }

  const input = body.value as Record<string, unknown>;
  const { draftId, reviewerUserId, stage, expiresAt } = input;
  if (
    typeof draftId !== "string" || !UUID.test(draftId) ||
    typeof reviewerUserId !== "string" || !UUID.test(reviewerUserId) ||
    typeof stage !== "string" || !stages.includes(stage as ResearchReviewStage) ||
    typeof expiresAt !== "string"
  ) return reply({ error: "A valid draft, configured reviewer, stage, and expiry are required." }, 400);

  if (reviewerUserId === actor.id || !isConfiguredResearchReviewer(reviewerUserId)) {
    return reply({ error: "The selected account is not an eligible independent reviewer." }, 403);
  }

  const expiry = Date.parse(expiresAt);
  const now = Date.now();
  if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 30 * 24 * 60 * 60 * 1000) {
    return reply({ error: "Assignment expiry must be within the next 30 days." }, 400);
  }

  try {
    const admin = createSupabaseAdminClient();
    const selectedStage = stage as ResearchReviewStage;
    const { data: draft, error: draftError } = await admin
      .from("security_research_drafts")
      .select("id,workflow_state")
      .eq("id", draftId)
      .maybeSingle();
    if (draftError || !draft) return reply({ error: "Draft not found." }, 404);
    if (draft.workflow_state !== expectedStates[selectedStage]) {
      return reply({ error: "Assignments can only be created for the draft's currently open review stage." }, 409);
    }

    const { data, error } = await admin
      .from("security_research_review_assignments")
      .insert({
        draft_id: draftId,
        stage: selectedStage,
        reviewer_user_id: reviewerUserId,
        assigned_by_owner_user_id: actor.id,
        expires_at: new Date(expiry).toISOString()
      })
      .select("id,draft_id,stage,reviewer_user_id,assigned_at,expires_at")
      .single();
    if (error || !data) return reply({ error: "Could not create the reviewer assignment." }, 503);
    return reply({ assignment: data }, 201);
  } catch {
    return reply({ error: "Could not create the reviewer assignment." }, 503);
  }
}
