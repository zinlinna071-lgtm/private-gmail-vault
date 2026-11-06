import "server-only";

import { createSupabaseAdminClient } from "../supabase/admin";
import type { VerifiedWorkflowRunEvent } from "./github-webhook";

export type WebhookIngestionResult =
  | "APPLIED"
  | "DUPLICATE"
  | "DELIVERY_ID_CONFLICT"
  | "STALE";

/**
 * Persists only a SHA-256 fingerprint and the allowlisted event projection.
 * Call only after raw-body HMAC verification and strict payload parsing.
 *
 * The database RPC is defined by migration
 * 202611070001_github_webhook_ingestion.sql. Until that migration is applied
 * to an isolated database, this adapter must remain unused by request routes.
 */
export async function persistVerifiedWorkflowRunEvent(input: {
  event: VerifiedWorkflowRunEvent;
  rawBody: string;
}): Promise<WebhookIngestionResult> {
  const bodyBytes = new TextEncoder().encode(input.rawBody);
  const digest = await crypto.subtle.digest("SHA-256", bodyBytes);
  const payloadSha256 = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const event = input.event;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("ingest_github_workflow_event", {
    p_delivery_id: event.deliveryId,
    p_payload_sha256: payloadSha256,
    p_action: event.action,
    p_repository: event.repository,
    p_workflow_path: event.workflowPath,
    p_run_id: event.runId,
    p_run_attempt: event.runAttempt,
    p_head_branch: event.headBranch,
    p_head_sha: event.headSha,
    p_status: event.status,
    p_conclusion: event.conclusion,
    p_created_at: event.createdAt,
    p_run_started_at: event.runStartedAt,
    p_updated_at: event.updatedAt,
    p_html_url: event.htmlUrl
  });

  if (error) {
    // Do not forward provider/database details into route responses or logs.
    throw new Error("Unable to persist the verified workflow event.");
  }

  if (
    data !== "APPLIED" &&
    data !== "DUPLICATE" &&
    data !== "DELIVERY_ID_CONFLICT" &&
    data !== "STALE"
  ) {
    throw new Error("The workflow event store returned an invalid result.");
  }

  return data;
}
