import "server-only";

import type { VerifiedWorkflowRunEvent } from "./github-webhook";

const REPOSITORY = "zinlinna071-lgtm/private-gmail-vault";
const API_ROOT = "https://api.github.com";
const MAX_JOBS = 100;

type JsonRecord = Record<string, unknown>;

export type GitHubApiVerification = {
  verifiedAt: string;
  workflowId: number;
  jobCount: number;
  jobsSha256: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function equalString(a: unknown, b: string): boolean {
  return typeof a === "string" && a === b;
}

async function githubGet(path: string, token: string): Promise<unknown> {
  const response = await fetch(`${API_ROOT}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error("GitHub authoritative verification failed.");
  const body: unknown = await response.json();
  return body;
}

/**
 * Re-fetches the workflow, run attempt and jobs from GitHub's canonical API.
 * Fails closed on missing credentials, mismatches, incomplete job data,
 * pagination overflow, unexpected redirects, or provider errors.
 */
export async function verifyWorkflowRunWithGitHubApi(
  event: VerifiedWorkflowRunEvent,
  token = process.env.GITHUB_API_TOKEN
): Promise<GitHubApiVerification> {
  if (typeof token !== "string" || token.length < 20) {
    throw new Error("GitHub API verification is not configured.");
  }
  if (event.repository !== REPOSITORY || !isPositiveSafeInteger(event.workflowId)) {
    throw new Error("GitHub event identity is invalid.");
  }

  const ownerRepo = "zinlinna071-lgtm/private-gmail-vault";
  const [runValue, workflowValue, jobsValue] = await Promise.all([
    githubGet(`/repos/${ownerRepo}/actions/runs/${event.runId}`, token),
    githubGet(`/repos/${ownerRepo}/actions/workflows/${event.workflowId}`, token),
    githubGet(
      `/repos/${ownerRepo}/actions/runs/${event.runId}/attempts/${event.runAttempt}/jobs?per_page=${MAX_JOBS}`,
      token
    )
  ]);

  if (!isRecord(runValue) || !isRecord(workflowValue) || !isRecord(jobsValue)) {
    throw new Error("GitHub authoritative response is invalid.");
  }
  const run = runValue;
  const workflow = workflowValue;
  const jobs = jobsValue.jobs;

  if (
    run.id !== event.runId ||
    run.run_attempt !== event.runAttempt ||
    run.workflow_id !== event.workflowId ||
    !isRecord(run.repository) ||
    !equalString(run.repository.full_name, REPOSITORY) ||
    !equalString(run.head_branch, event.headBranch) ||
    !equalString(run.head_sha, event.headSha) ||
    !equalString(run.status, event.status) ||
    (event.status === "completed" && !equalString(run.conclusion, event.conclusion)) ||
    (event.status !== "completed" && run.conclusion !== null) ||
    !equalString(run.html_url, event.htmlUrl) ||
    !isIsoDate(run.created_at) ||
    !isIsoDate(run.updated_at) ||
    Date.parse(run.created_at) !== Date.parse(event.createdAt) ||
    Date.parse(run.updated_at) < Date.parse(event.updatedAt) ||
    workflow.id !== event.workflowId ||
    !equalString(workflow.path, ".github/workflows/ci.yml") ||
    !Array.isArray(jobs) ||
    jobs.length > MAX_JOBS ||
    jobsValue.total_count !== jobs.length ||
    (event.status !== "queued" && jobs.length < 1)
  ) {
    throw new Error("GitHub canonical run metadata does not match the signed event.");
  }

  const normalizedJobs: Array<{
    id: number;
    run_id: number;
    run_attempt: number;
    name: string;
    status: string;
    conclusion: string | null;
    started_at: string | null;
    completed_at: string | null;
  }> = [];

  for (const value of jobs) {
    if (!isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        value.run_id !== event.runId ||
        value.run_attempt !== event.runAttempt ||
        typeof value.name !== "string" ||
        !["queued", "in_progress", "completed"].includes(String(value.status)) ||
        (value.conclusion !== null && typeof value.conclusion !== "string") ||
        (value.started_at !== null && !isIsoDate(value.started_at)) ||
        (value.completed_at !== null && !isIsoDate(value.completed_at))) {
      throw new Error("GitHub canonical job metadata is invalid.");
    }
    if (event.status === "completed" && value.status !== "completed") {
      throw new Error("GitHub reports an incomplete job for a completed run.");
    }
    normalizedJobs.push({
      id: value.id,
      run_id: value.run_id as number,
      run_attempt: value.run_attempt as number,
      name: value.name,
      status: value.status as string,
      conclusion: typeof value.conclusion === "string" ? value.conclusion : null,
      started_at: typeof value.started_at === "string" ? value.started_at : null,
      completed_at: typeof value.completed_at === "string" ? value.completed_at : null
    });
  }

  normalizedJobs.sort((a, b) => a.id - b.id);
  const serialized = new TextEncoder().encode(JSON.stringify(normalizedJobs));
  const digest = await crypto.subtle.digest("SHA-256", serialized);
  const jobsSha256 = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    verifiedAt: new Date().toISOString(),
    workflowId: event.workflowId,
    jobCount: normalizedJobs.length,
    jobsSha256
  };
}
