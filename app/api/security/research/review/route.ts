import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/auth/vault";
import { isJsonContentType } from "@/lib/auth/content-type";
import { readBoundedJson } from "@/lib/auth/bounded-json";
import { hasPriorApprovalByActor, reviewSubmissionSchema, nextResearchWorkflowState } from "@/lib/security-research/workflow";
import { getResearchActor } from "@/lib/security-research/workflow-auth";
import { hasActiveResearchReviewAssignment, type ResearchReviewStage } from "@/lib/security-research/review-assignments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return reply({ error: "Invalid request origin." }, 403);
  if (!isJsonContentType(request.headers.get("content-type"))) return reply({ error: "JSON is required." }, 415);
  const actor = await getResearchActor();
  if (!actor) return reply({ error: "Research review is not configured or you are not signed in." }, 401);
  const body = await readBoundedJson(request, 8 * 1024);
  if (!body.ok) return reply({ error: "Invalid or oversized JSON request." }, body.reason === "too_large" ? 413 : 400);
  const parsed = reviewSubmissionSchema.safeParse(body.value);
  if (!parsed.success) return reply({ error: "Invalid review submission." }, 400);
  const { draftId, stage, decision, notes } = parsed.data;

  if (stage === "owner" ? !actor.isOwner : !actor.isReviewer) {
    return reply({ error: stage === "owner" ? "Owner approval is required." : "An assigned reviewer account is required." }, 403);
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: draft, error } = await admin.from("security_research_drafts")
      .select("id,owner_user_id,workflow_state,reviews")
      .eq("id", draftId).maybeSingle();
    if (error || !draft) return reply({ error: "Draft not found." }, 404);
    if (stage !== "owner" && draft.owner_user_id === actor.id) {
      return reply({ error: "Authors cannot approve their own technical, security/privacy, or bilingual review." }, 403);
    }

    const expectedState = stage === "technical" ? "DRAFT"
      : stage === "securityPrivacy" ? "SECURITY_PRIVACY_REVIEW"
      : stage === "bilingual" ? "BILINGUAL_REVIEW" : "OWNER_APPROVAL";
    if (draft.workflow_state !== expectedState) return reply({ error: "This review stage is not currently open." }, 409);

    if (stage !== "owner") {
      const assignmentStage: ResearchReviewStage = stage === "securityPrivacy" ? "security_privacy" : stage;
      if (!(await hasActiveResearchReviewAssignment(draftId, assignmentStage, actor.id))) {
        return reply({ error: "An active assignment for this draft and review stage is required." }, 403);
      }
    }

    const reviews = (draft.reviews && typeof draft.reviews === "object" && !Array.isArray(draft.reviews))
      ? draft.reviews as Record<string, unknown> : {};
    const priorStages = stage === "technical" ? []
      : stage === "securityPrivacy" ? ["technical"]
      : stage === "bilingual" ? ["technical", "securityPrivacy"]
      : ["technical", "securityPrivacy", "bilingual"];
    if (hasPriorApprovalByActor(reviews, priorStages, actor.id)) {
      return reply({
        error: stage === "owner"
          ? "Final owner approval must be independent of all reviewer approvals."
          : "Technical, security/privacy, and bilingual approvals must come from different reviewer accounts."
      }, 403);
    }

    const record = { decision, notes, reviewerUserId: actor.id, reviewedAt: new Date().toISOString() };
    const history = Array.isArray(reviews[stage]) ? reviews[stage] as unknown[] : [];
    const updatedReviews = { ...reviews, [stage]: [...history, record] };
    const nextState = decision === "approved" ? nextResearchWorkflowState(stage) : "DRAFT";
    const { data: updated, error: updateError } = await admin.from("security_research_drafts").update({
      reviews: updatedReviews,
      workflow_state: nextState,
      ready_at: nextState === "READY_TO_PUBLISH" ? new Date().toISOString() : null
    }).eq("id", draftId).eq("workflow_state", expectedState)
      .select("id,workflow_state,reviews,ready_at").maybeSingle();
    if (updateError) return reply({ error: "Could not record the review." }, 503);
    if (!updated) return reply({ error: "The draft changed during review. Reload and retry." }, 409);
    return reply({ draft: updated });
  } catch {
    return reply({ error: "Could not complete the review." }, 503);
  }
}
