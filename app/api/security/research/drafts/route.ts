import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/auth/vault";
import { isJsonContentType } from "@/lib/auth/content-type";
import { readBoundedJson } from "@/lib/auth/bounded-json";
import { createResearchDraftSchema } from "@/lib/security-research/workflow";
import { getResearchActor } from "@/lib/security-research/workflow-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } });
}

export async function GET() {
  try {
    const actor = await getResearchActor();
    if (!actor) return reply({ error: "Research authoring is not configured or you are not signed in." }, 401);
    if (!actor.isOwner && !actor.isReviewer) return reply({ error: "Assigned reviewer access required." }, 403);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("security_research_drafts")
      .select("id,title_en,title_my,category,workflow_state,created_at,updated_at,ready_at,reviews")
      .order("updated_at", { ascending: false }).limit(50);
    const visible = actor.isOwner ? (data ?? []) : (data ?? []).filter((draft) => ["DRAFT", "SECURITY_PRIVACY_REVIEW", "BILINGUAL_REVIEW"].includes(draft.workflow_state));
    if (error) return reply({ error: "Research drafts are not available. Check the database migration." }, 503);
    return reply({ drafts: visible });
  } catch {
    return reply({ error: "Could not load research drafts." }, 503);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return reply({ error: "Invalid request origin." }, 403);
  if (!isJsonContentType(request.headers.get("content-type"))) return reply({ error: "JSON is required." }, 415);
  const actor = await getResearchActor();
  if (!actor) return reply({ error: "Research authoring is not configured or you are not signed in." }, 401);
  if (!actor.isOwner) return reply({ error: "Owner access required." }, 403);

  const body = await readBoundedJson(request, 128 * 1024);
  if (!body.ok) return reply({ error: body.reason === "too_large" ? "Request is too large." : "Invalid JSON." }, body.reason === "too_large" ? 413 : 400);
  const parsed = createResearchDraftSchema.safeParse(body.value);
  if (!parsed.success) return reply({ error: "Please complete the required research fields.", issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, 400);

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("security_research_drafts").insert({
      owner_user_id: actor.id,
      title_en: parsed.data.title.en,
      title_my: parsed.data.title.my,
      category: parsed.data.category,
      content: parsed.data.content,
      workflow_state: "DRAFT",
      reviews: {}
    }).select("id,title_en,title_my,category,workflow_state,created_at,updated_at").single();
    if (error || !data) return reply({ error: "Could not save the research draft. Confirm the workflow migration is applied." }, 503);
    return reply({ draft: data }, 201);
  } catch {
    return reply({ error: "Could not save the research draft." }, 503);
  }
}
