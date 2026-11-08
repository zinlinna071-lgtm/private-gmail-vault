import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ResearchReviewStage = "technical" | "security_privacy" | "bilingual";

export function reviewStageForWorkflowState(state: string): ResearchReviewStage | null {
  if (state === "DRAFT") return "technical";
  if (state === "SECURITY_PRIVACY_REVIEW") return "security_privacy";
  if (state === "BILINGUAL_REVIEW") return "bilingual";
  return null;
}

export function isConfiguredResearchReviewer(userId: string): boolean {
  return (process.env.SECURITY_RESEARCH_REVIEWER_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^[0-9a-f-]{36}$/i.test(value))
    .includes(userId);
}

export async function hasActiveResearchReviewAssignment(
  draftId: string,
  stage: ResearchReviewStage,
  reviewerUserId: string
): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("security_research_review_assignments")
      .select("id")
      .eq("draft_id", draftId)
      .eq("stage", stage)
      .eq("reviewer_user_id", reviewerUserId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    return !error && Boolean(data);
  } catch {
    return false;
  }
}
