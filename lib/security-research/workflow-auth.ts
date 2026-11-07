import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResearchActor = { id: string; isOwner: boolean; isReviewer: boolean };

export async function getResearchActor(): Promise<ResearchActor | null> {
  const ownerId = process.env.SECURITY_RESEARCH_OWNER_USER_ID;
  if (!ownerId || !/^[0-9a-f-]{36}$/i.test(ownerId)) return null;

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const reviewers = (process.env.SECURITY_RESEARCH_REVIEWER_USER_IDS ?? "")
    .split(",").map((value) => value.trim()).filter((value) => /^[0-9a-f-]{36}$/i.test(value));

  return {
    id: user.id,
    isOwner: user.id === ownerId,
    isReviewer: reviewers.includes(user.id)
  };
}
