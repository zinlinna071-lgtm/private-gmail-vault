import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  parseVerifiedWorkflowRunEvent,
  readBoundedWebhookBody,
  verifyGitHubWebhookSignature
} from "../lib/security-research/github-webhook";

const secret = randomBytes(32).toString("hex");
const rawBody = JSON.stringify({ action: "completed", workflow_run: { id: 12345678 } });
const delivery = "9a5f81a2-6f27-4f7a-8a65-3f91d6d50a91";
const repository = "zinlinna071-lgtm/private-gmail-vault";

function sign(body: string, key = secret) {
  return `sha256=${createHmac("sha256", key).update(body).digest("hex")}`;
}

const payload = {
  action: "completed",
  repository: { full_name: repository },
  workflow: { path: ".github/workflows/ci.yml" },
  workflow_run: {
    id: 42298920558,
    run_attempt: 1,
    head_branch: "feature/vault-authentication",
    head_sha: "a".repeat(40),
    status: "completed",
    conclusion: "success",
    created_at: "2026-11-07T01:00:00Z",
    run_started_at: "2026-11-07T01:00:02.123Z",
    updated_at: "2026-11-07T01:02:00Z",
    html_url: `https://github.com/${repository}/actions/runs/42298920558`,
    repository: { full_name: repository }
  }
};

describe("GitHub workflow webhook verification", () => {
  it("reads bounded request bodies and rejects oversized or invalid UTF-8 streams", async () => {
    const valid = new Request("https://example.test/webhook", {
      method: "POST",
      body: rawBody
    });
    expect(await readBoundedWebhookBody(valid)).toBe(rawBody);

    const oversized = new Request("https://example.test/webhook", {
      method: "POST",
      body: "x".repeat(256 * 1024 + 1)
    });
    expect(await readBoundedWebhookBody(oversized)).toBeNull();

    const invalidUtf8 = new Request("https://example.test/webhook", {
      method: "POST",
      body: new Uint8Array([0xc3, 0x28])
    });
    expect(await readBoundedWebhookBody(invalidUtf8)).toBeNull();
  });
  it("accepts a valid HMAC over the exact raw body", async () => {
    expect(await verifyGitHubWebhookSignature({
      rawBody,
      signature: sign(rawBody),
      secret
    })).toBe(true);
  });

  it("rejects tampering, malformed signatures, short secrets, and oversized bodies", async () => {
    expect(await verifyGitHubWebhookSignature({
      rawBody: rawBody + " ",
      signature: sign(rawBody),
      secret
    })).toBe(false);
    expect(await verifyGitHubWebhookSignature({ rawBody, signature: "sha1=abc", secret })).toBe(false);
    expect(await verifyGitHubWebhookSignature({ rawBody, signature: sign(rawBody), secret: "short" })).toBe(false);
    expect(await verifyGitHubWebhookSignature({
      rawBody: "x".repeat(256 * 1024 + 1),
      signature: sign(rawBody),
      secret
    })).toBe(false);
  });

  it("projects only allowlisted workflow metadata and accepts fractional UTC timestamps", () => {
    const parsed = parseVerifiedWorkflowRunEvent(payload, delivery, repository);
    expect(parsed).toMatchObject({
      runId: 42298920558,
      status: "completed",
      conclusion: "success",
      headBranch: "feature/vault-authentication",
      headSha: "a".repeat(40),
      runStartedAt: "2026-11-07T01:00:02.123Z"
    });
    expect(parsed).not.toHaveProperty("rawBody");
    expect(parsed).not.toHaveProperty("secrets");
  });

  it("rejects malformed delivery IDs and invalid calendar timestamps", () => {
    expect(parseVerifiedWorkflowRunEvent(payload, "not-a-delivery-id", repository)).toBeNull();
    expect(parseVerifiedWorkflowRunEvent({
      ...payload,
      workflow_run: { ...payload.workflow_run, created_at: "2026-99-99T99:99:99Z" }
    }, delivery, repository)).toBeNull();
    expect(parseVerifiedWorkflowRunEvent({
      ...payload,
      workflow_run: { ...payload.workflow_run, created_at: "2026-02-30T01:00:00Z" }
    }, delivery, repository)).toBeNull();
  });

  it("rejects wrong repository, workflow, branch, commit, and forged run URLs", () => {
    expect(parseVerifiedWorkflowRunEvent(payload, delivery, "someone/else")).toBeNull();
    expect(parseVerifiedWorkflowRunEvent({
      ...payload, workflow: { path: ".github/workflows/other.yml" }
    }, delivery, repository)).toBeNull();
    expect(parseVerifiedWorkflowRunEvent({
      ...payload, workflow_run: { ...payload.workflow_run, head_branch: "main" }
    }, delivery, repository)).toBeNull();
    expect(parseVerifiedWorkflowRunEvent({
      ...payload, workflow_run: { ...payload.workflow_run, head_sha: "not-a-sha" }
    }, delivery, repository)).toBeNull();
    expect(parseVerifiedWorkflowRunEvent({
      ...payload, workflow_run: { ...payload.workflow_run, html_url: "https://evil.example/run" }
    }, delivery, repository)).toBeNull();
    expect(parseVerifiedWorkflowRunEvent({
      ...payload,
      workflow_run: { ...payload.workflow_run, html_url: `https://user@github.com/${repository}/actions/runs/42298920558` }
    }, delivery, repository)).toBeNull();
    expect(parseVerifiedWorkflowRunEvent({
      ...payload,
      workflow_run: { ...payload.workflow_run, html_url: `https://github.com/${repository}/actions/runs/42298920558?redirect=1` }
    }, delivery, repository)).toBeNull();
  });

  it("rejects inconsistent action/status pairs and malformed nested repositories", () => {
    expect(parseVerifiedWorkflowRunEvent({
      ...payload, action: "in_progress"
    }, delivery, repository)).toBeNull();
    expect(parseVerifiedWorkflowRunEvent({
      ...payload,
      action: "requested",
      workflow_run: { ...payload.workflow_run, status: "queued", conclusion: null }
    }, delivery, repository)).not.toBeNull();
    expect(parseVerifiedWorkflowRunEvent({
      ...payload,
      workflow_run: { ...payload.workflow_run, repository: "unexpected" }
    }, delivery, repository)).toBeNull();
  });
});
