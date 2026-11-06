import "server-only";

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;
const SIGNATURE_PATTERN = /^sha256=[a-f0-9]{64}$/i;

/**
 * Verifies GitHub's X-Hub-Signature-256 against the exact raw request body.
 * Call this before parsing JSON or trusting any event fields.
 */
export async function verifyGitHubWebhookSignature(input: {
  rawBody: string;
  signature: string | null;
  secret: string;
}): Promise<boolean> {
  const { rawBody, signature, secret } = input;

  if (!signature || !SIGNATURE_PATTERN.test(signature)) return false;
  if (typeof secret !== "string" || secret.length < 32) return false;
  if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BODY_BYTES) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const digest = signature.slice("sha256=".length);
    const signatureBytes = Uint8Array.from(
      digest.match(/.{2}/g) ?? [],
      (byte) => Number.parseInt(byte, 16)
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(rawBody)
    );
  } catch {
    return false;
  }
}

export type VerifiedWorkflowRunEvent = {
  deliveryId: string;
  action: "requested" | "in_progress" | "completed";
  repository: string;
  workflowPath: string;
  runId: number;
  runAttempt: number;
  headBranch: string;
  headSha: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  createdAt: string;
  runStartedAt: string | null;
  updatedAt: string;
  htmlUrl: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const SHA = /^[a-f0-9]{40}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extracts a minimal, non-secret workflow_run projection from an already
 * signature-verified webhook payload. Persistence and replay protection are
 * separate mandatory steps before any record can be published.
 */
export function parseVerifiedWorkflowRunEvent(
  payload: unknown,
  deliveryId: string,
  expectedRepository: string
): VerifiedWorkflowRunEvent | null {
  if (!/^[a-f0-9-]{16,80}$/i.test(deliveryId)) return null;
  if (!isRecord(payload) || payload.action === undefined) return null;
  if (!["requested", "in_progress", "completed"].includes(String(payload.action))) return null;
  if (!isRecord(payload.repository) || !isRecord(payload.workflow) || !isRecord(payload.workflow_run)) return null;

  const repository = payload.repository.full_name;
  const workflowPath = payload.workflow.path;
  const run = payload.workflow_run;

  if (repository !== expectedRepository) return null;
  if (workflowPath !== ".github/workflows/ci.yml") return null;
  if (run.repository && isRecord(run.repository) && run.repository.full_name !== expectedRepository) return null;
  if (typeof run.id !== "number" || !Number.isSafeInteger(run.id) || run.id <= 0) return null;
  if (typeof run.run_attempt !== "number" || !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) return null;
  if (typeof run.head_branch !== "string" || !/^feature\/[a-z0-9._/-]{1,80}$/i.test(run.head_branch)) return null;
  if (typeof run.head_sha !== "string" || !SHA.test(run.head_sha)) return null;
  if (!["queued", "in_progress", "completed"].includes(String(run.status))) return null;
  if (typeof run.created_at !== "string" || !ISO_DATE.test(run.created_at)) return null;
  if (typeof run.updated_at !== "string" || !ISO_DATE.test(run.updated_at)) return null;
  if (run.run_started_at !== null && (typeof run.run_started_at !== "string" || !ISO_DATE.test(run.run_started_at))) return null;
  if (typeof run.html_url !== "string") return null;

  let url: URL;
  try {
    url = new URL(run.html_url);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "github.com" ||
      url.pathname !== `/${expectedRepository}/actions/runs/${run.id}`) return null;

  const action = payload.action as VerifiedWorkflowRunEvent["action"];
  const status = run.status as VerifiedWorkflowRunEvent["status"];
  if (action === "completed" && status !== "completed") return null;
  if (action !== "completed" && status === "completed") return null;

  const conclusion = run.conclusion;
  if (status === "completed" && typeof conclusion !== "string") return null;
  if (status !== "completed" && conclusion !== null) return null;

  return {
    deliveryId,
    action,
    repository,
    workflowPath,
    runId: run.id,
    runAttempt: run.run_attempt,
    headBranch: run.head_branch,
    headSha: run.head_sha.toLowerCase(),
    status,
    conclusion: typeof conclusion === "string" ? conclusion : null,
    createdAt: run.created_at,
    runStartedAt: typeof run.run_started_at === "string" ? run.run_started_at : null,
    updatedAt: run.updated_at,
    htmlUrl: url.toString()
  };
}
