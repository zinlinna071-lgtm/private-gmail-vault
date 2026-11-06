import { createHmac, randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  parseVerifiedWorkflowRunEvent,
  verifyGitHubWebhookSignature
} from "../lib/security-research/github-webhook";

const secret = randomBytes(32).toString("hex");
const rawBody = JSON.stringify({ action: "completed", workflow_run: { id: 12345678 } });

function sign(body: string, key = secret) {
  return `sha256=${createHmac("sha256", key).update(body).digest("hex")}`;
}

const payload = {
  action: "completed",
  repository: { full_name: "zinlinna071-lgtm/private-gmail-vault" },
  workflow: { path: ".github/workflows/ci.yml" },
  workflow_run: {
    id: 42298920558,
    run_attempt: 1,
    head_branch: "feature/vault-authentication",
    head_sha: "a".repeat(40),
    status: "completed",
    conclusion: "success",
    created_at: "2026-11-07T01:00:00Z",
    run_started_at: "2026-11-07T01:00:02Z",
    updated_at: "2026-11-07T01:02:00Z",
    html_url: "https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42298920558",
    repository: { full_name: "zinlinna071-lgtm/private-gmail-vault" }
  }
};

describe("GitHub workflow webhook verification", () => {
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

  it("projects only the allowlisted repository workflow metadata", () => {
    const parsed = parseVerifiedWorkflowRunEvent(
      payload,
      "9a5f81a2-6f27-4f7a-8a65-3f91d6d50a91",
      "zinlinna071-lgtm/private-gmail-vault"
    );
    expect(parsed).toMatchObject({
      runId: 42298920558,
      status: "completed",
      conclusion: "success",
      headBranch: "feature/vault-authentication",
      headSha: "a".repeat(40)
    });
    expect(parsed).not.toHaveProperty("rawBody");
    expect(parsed).not.toHaveProperty("secrets");
  });

  it("rejects wrong repository, workflow, branch, commit, and forged run URL", () => {
    const delivery = "9a5f81a2-6f27-4f7a-8a65-3f91d6d50a91";
    expect(parseVerifiedWorkflowRunEvent(payload, delivery, "someone/else")).toBeNull();
    expect(parseVerifiedWorkflowRunEvent({
      ...payload, workflow: { path: ".github/workflows/other.yml" }
    }, delivery, "zinlinna071-lgtm/private-gmail-vault")).toBeNull();
    expect(parseVerifiedWorkflowRunEvent({
      ...payload, workflow_run: { ...payload.workflow_run, head_branch: "main" }
    }, delivery, "zinlinna071-lgtm/private-gmail-vault")).toBeNull();
    expect(parseVerifiedWorkflowRunEvent({
      ...payload, workflow_run: { ...payload.workflow_run, head_sha: "not-a-sha" }
    }, delivery, "zinlinna071-lgtm/private-gmail-vault")).toBeNull();
    expect(parseVerifiedWorkflowRunEvent({
      ...payload, workflow_run: { ...payload.workflow_run, html_url: "https://evil.example/run" }
    }, delivery, "zinlinna071-lgtm/private-gmail-vault")).toBeNull();
  });

  it("rejects event action and run status mismatches", () => {
    expect(parseVerifiedWorkflowRunEvent({
      ...payload, action: "in_progress"
    }, "9a5f81a2-6f27-4f7a-8a65-3f91d6d50a91", "zinlinna071-lgtm/private-gmail-vault")).toBeNull();
  });
});
