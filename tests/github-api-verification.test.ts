import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  verifyWorkflowRunWithGitHubApi
} from "../lib/security-research/github-api-verification";
import type { VerifiedWorkflowRunEvent } from "../lib/security-research/github-webhook";

const event: VerifiedWorkflowRunEvent = {
  deliveryId: "9a5f81a2-6f27-4f7a-8a65-3f91d6d50a91",
  action: "completed",
  repository: "zinlinna071-lgtm/private-gmail-vault",
  workflowPath: ".github/workflows/ci.yml",
  workflowId: 408741606,
  runId: 42301937504,
  runAttempt: 1,
  headBranch: "feature/vault-authentication",
  headSha: "a".repeat(40),
  status: "completed",
  conclusion: "success",
  createdAt: "2026-11-07T01:00:00Z",
  runStartedAt: "2026-11-07T01:00:02Z",
  updatedAt: "2026-11-07T01:02:00Z",
  htmlUrl: "https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42301937504"
};

const run = {
  id: event.runId,
  run_attempt: event.runAttempt,
  workflow_id: event.workflowId,
  repository: { full_name: event.repository },
  head_branch: event.headBranch,
  head_sha: event.headSha,
  status: event.status,
  conclusion: event.conclusion,
  created_at: event.createdAt,
  updated_at: event.updatedAt,
  html_url: event.htmlUrl
};
const workflow = { id: event.workflowId, path: event.workflowPath };
const jobs = {
  total_count: 1,
  jobs: [{
    id: 991,
    run_id: event.runId,
    run_attempt: event.runAttempt,
    name: "verify",
    status: "completed",
    conclusion: "success",
    started_at: event.runStartedAt,
    completed_at: event.updatedAt
  }]
};

function mockGitHubApi(input: { run: unknown; workflow: unknown; jobs: unknown } = { run, workflow, jobs }) {
  const responses = [input.run, input.workflow, input.jobs];
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const value = responses.shift();
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("authoritative GitHub run/job verification", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("re-fetches canonical run, workflow and attempt jobs with a server token", async () => {
    const fetchMock = mockGitHubApi();
    const result = await verifyWorkflowRunWithGitHubApi(event, "ghp_" + "x".repeat(36));
    expect(result).toMatchObject({
      workflowId: event.workflowId,
      jobCount: 1
    });
    expect(result.jobsSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [url, options] of fetchMock.mock.calls) {
      expect(String(url)).toContain("api.github.com/repos/zinlinna071-lgtm/private-gmail-vault/");
      expect((options as RequestInit).headers).toMatchObject({
        Authorization: "Bearer ghp_" + "x".repeat(36),
        "X-GitHub-Api-Version": "2022-11-28"
      });
      expect(options).toMatchObject({ cache: "no-store", redirect: "error" });
    }
  });

  it("fails closed when canonical run identity or state differs", async () => {
    mockGitHubApi({
      run: { ...run, head_sha: "b".repeat(40) },
      workflow,
      jobs
    });
    await expect(
      verifyWorkflowRunWithGitHubApi(event, "ghp_" + "x".repeat(36))
    ).rejects.toThrow("GitHub canonical run metadata does not match the signed event.");
  });

  it("fails closed when workflow path or job attempt is not canonical", async () => {
    mockGitHubApi({
      run,
      workflow: { ...workflow, path: ".github/workflows/unexpected.yml" },
      jobs
    });
    await expect(
      verifyWorkflowRunWithGitHubApi(event, "ghp_" + "x".repeat(36))
    ).rejects.toThrow("GitHub canonical run metadata does not match the signed event.");

    mockGitHubApi({
      run,
      workflow,
      jobs: { total_count: 1, jobs: [{ ...jobs.jobs[0], run_attempt: 2 }] }
    });
    await expect(
      verifyWorkflowRunWithGitHubApi(event, "ghp_" + "x".repeat(36))
    ).rejects.toThrow("GitHub canonical job metadata is invalid.");
  });

  it("fails closed for completed runs with incomplete jobs or pagination overflow", async () => {
    mockGitHubApi({
      run,
      workflow,
      jobs: { total_count: 1, jobs: [{ ...jobs.jobs[0], status: "in_progress" }] }
    });
    await expect(
      verifyWorkflowRunWithGitHubApi(event, "ghp_" + "x".repeat(36))
    ).rejects.toThrow("GitHub reports an incomplete job for a completed run.");

    mockGitHubApi({
      run,
      workflow,
      jobs: { total_count: 101, jobs: Array.from({ length: 101 }, (_, i) => ({ ...jobs.jobs[0], id: i + 1 })) }
    });
    await expect(
      verifyWorkflowRunWithGitHubApi(event, "ghp_" + "x".repeat(36))
    ).rejects.toThrow("GitHub canonical run metadata does not match the signed event.");
  });

  it("accepts a queued run whose job list has not been created yet", async () => {
    const queuedEvent: VerifiedWorkflowRunEvent = {
      ...event,
      action: "requested",
      status: "queued",
      conclusion: null,
      runStartedAt: null
    };
    mockGitHubApi({
      run: { ...run, status: "queued", conclusion: null },
      workflow,
      jobs: { total_count: 0, jobs: [] }
    });
    const result = await verifyWorkflowRunWithGitHubApi(queuedEvent, "ghp_" + "x".repeat(36));
    expect(result.jobCount).toBe(0);
  });

  it("requires a server-only GitHub API token", async () => {
    await expect(verifyWorkflowRunWithGitHubApi(event, undefined)).rejects.toThrow(
      "GitHub API verification is not configured."
    );
  });
});
