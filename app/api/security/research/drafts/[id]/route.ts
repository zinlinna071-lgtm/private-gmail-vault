import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/auth/vault";
import { isJsonContentType } from "@/lib/auth/content-type";
import { readBoundedJson } from "@/lib/auth/bounded-json";
import { createResearchDraftSchema } from "@/lib/security-research/workflow";
import { getResearchActor } from "@/lib/security-research/workflow-auth";
import { hasActiveResearchReviewAssignment, reviewStageForWorkflowState } from "@/lib/security-research/review-assignments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } });
}

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const actor = await getResearchActor();
  if (!actor || (!actor.isOwner && !actor.isReviewer)) return reply({ error: "Research review access required." }, 401);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return reply({ error: "Invalid draft ID." }, 400);
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("security_research_drafts")
      .select("id,owner_user_id,title_en,title_my,category,workflow_state,content,reviews,created_at,updated_at,ready_at")
      .eq("id", id).maybeSingle();
    if (error || !data) return reply({ error: "Draft not found." }, 404);
    if (!actor.isOwner) {
      const stage = reviewStageForWorkflowState(data.workflow_state);
      if (!actor.isReviewer || !stage) return reply({ error: "This draft is not assigned for your review." }, 403);
      if (data.owner_user_id === actor.id) return reply({ error: "Authors cannot review their own draft." }, 403);
      if (!(await hasActiveResearchReviewAssignment(id, stage, actor.id))) {
        return reply({ error: "No active assignment grants access to this draft at its current review stage." }, 403);
      }
    }
    const { owner_user_id: _ownerId, ...safe } = data;
    return reply({ draft: safe });
  } catch {
    return reply({ error: "Could not load the research draft." }, 503);
  }
}

export async function PATCH(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return reply({ error: "Invalid request origin." }, 403);
  if (!isJsonContentType(request.headers.get("content-type"))) return reply({ error: "JSON is required." }, 415);
  const actor = await getResearchActor();
  if (!actor) return reply({ error: "Research authoring is not configured or you are not signed in." }, 401);
  if (!actor.isOwner) return reply({ error: "Owner access required." }, 403);

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return reply({ error: "Invalid draft ID." }, 400);
  const body = await readBoundedJson(request, 128 * 1024);
  if (!body.ok) return reply({ error: "Invalid or oversized JSON request." }, body.reason === "too_large" ? 413 : 400);
  const parsed = createResearchDraftSchema.safeParse(body.value);
  if (!parsed.success) return reply({ error: "Please complete the required research fields." }, 400);

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("security_research_drafts").update({
      title_en: parsed.data.title.en,
      title_my: parsed.data.title.my,
      category: parsed.data.category,
      content: parsed.data.content
    }).eq("id", id).eq("owner_user_id", actor.id).eq("workflow_state", "DRAFT")
      .select("id,title_en,title_my,category,workflow_state,updated_at").maybeSingle();
    if (error) return reply({ error: "Could not update this draft." }, 503);
    if (!data) return reply({ error: "Draft not found or it is no longer editable." }, 404);
    return reply({ draft: data });
  } catch {
    return reply({ error: "Could not update this draft." }, 503);
  }
}
