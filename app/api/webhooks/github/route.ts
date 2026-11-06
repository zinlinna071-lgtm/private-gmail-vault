import { NextResponse } from "next/server";
import {
  parseVerifiedWorkflowRunEvent,
  readBoundedWebhookBody,
  verifyGitHubWebhookSignature
} from "@/lib/security-research/github-webhook";
import { persistVerifiedWorkflowRunEvent } from "@/lib/security-research/github-webhook-store";
import { verifyWorkflowRunWithGitHubApi } from "@/lib/security-research/github-api-verification";

export const runtime = "nodejs";

const EXPECTED_REPOSITORY = "zinlinna071-lgtm/private-gmail-vault";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

/**
 * GitHub Actions workflow_run receiver.
 *
 * Disabled unless an operator explicitly sets
 * GITHUB_WEBHOOK_INGESTION_ENABLED=true and configures a strong server-only
 * GITHUB_WEBHOOK_SECRET. No public projection or feed is exposed here.
 */
export async function POST(request: Request) {
  if (process.env.GITHUB_WEBHOOK_INGESTION_ENABLED !== "true") {
    return json(404, { error: "Not found." });
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (typeof secret !== "string" || secret.length < 32) {
    return json(503, { error: "Webhook ingestion is not configured." });
  }

  if (request.headers.get("x-github-event") !== "workflow_run") {
    return json(400, { error: "Unsupported webhook event." });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return json(415, { error: "Unsupported content type." });
  }

  const deliveryId = request.headers.get("x-github-delivery");
  const signature = request.headers.get("x-hub-signature-256");
  const rawBody = await readBoundedWebhookBody(request);
  if (rawBody === null) {
    return json(413, { error: "Invalid webhook body." });
  }

  const signatureValid = await verifyGitHubWebhookSignature({
    rawBody,
    signature,
    secret
  });
  if (!signatureValid) {
    return json(401, { error: "Invalid webhook signature." });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "Invalid webhook payload." });
  }

  const event = parseVerifiedWorkflowRunEvent(
    payload,
    deliveryId ?? "",
    EXPECTED_REPOSITORY
  );
  if (!event) {
    return json(400, { error: "Invalid workflow event." });
  }

  try {
    // A valid webhook HMAC authenticates the delivery, but GitHub API re-fetch
    // is required before its run/job metadata can enter the private ledger.
    await verifyWorkflowRunWithGitHubApi(event);
    const result = await persistVerifiedWorkflowRunEvent({ event, rawBody });
    if (result === "DELIVERY_ID_CONFLICT") {
      return json(409, { error: "Webhook delivery conflict." });
    }
    if (result === "DUPLICATE") {
      return json(200, { accepted: true, duplicate: true });
    }
    if (result === "STALE") {
      return json(202, { accepted: true, stale: true });
    }
    return json(202, { accepted: true });
  } catch {
    // Provider/database errors must not disclose infrastructure details.
    return json(503, { error: "Unable to process webhook." });
  }
}
