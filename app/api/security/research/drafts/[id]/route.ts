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

type Context = { params: Promise<{ id: string }> };

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
