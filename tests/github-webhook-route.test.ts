import { createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { persist, verify } = vi.hoisted(() => ({ persist: vi.fn(), verify: vi.fn() }));
vi.mock("../lib/security-research/github-webhook-store", () => ({
  persistVerifiedWorkflowRunEvent: persist
}));
vi.mock("../lib/security-research/github-api-verification", () => ({
  verifyWorkflowRunWithGitHubApi: verify
}));

import { POST } from "../app/api/webhooks/github/route";

const secret = randomBytes(32).toString("hex");
const deliveryId = "9a5f81a2-6f27-4f7a-8a65-3f91d6d50a91";
const repository = "zinlinna071-lgtm/private-gmail-vault";
const payload = {
  action: "completed",
  repository: { full_name: repository },
  workflow: { id: 408741606, path: ".github/workflows/ci.yml" },
  workflow_run: {
    id: 42301937504,
    run_attempt: 1,
    head_branch: "feature/vault-authentication",
    head_sha: "a".repeat(40),
    status: "completed",
    conclusion: "success",
    created_at: "2026-11-07T01:00:00Z",
    run_started_at: "2026-11-07T01:00:02Z",
    updated_at: "2026-11-07T01:02:00Z",
    html_url: `https://github.com/${repository}/actions/runs/42301937504`,
    repository: { full_name: repository }
  }
};
const rawBody = JSON.stringify(payload);

function request(body = rawBody, overrides: Record<string, string> = {}) {
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return new Request("https://vault.example/api/webhooks/github", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": "workflow_run",
      "x-github-delivery": deliveryId,
      "x-hub-signature-256": signature,
      ...overrides
    },
    body
  });
}

describe("GitHub webhook route", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_WEBHOOK_INGESTION_ENABLED", "true");
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", secret);
    persist.mockReset();
    persist.mockResolvedValue("APPLIED");
    verify.mockReset();
    verify.mockResolvedValue({ verifiedAt: "2026-11-07T01:02:01Z", workflowId: 408741606, jobCount: 1, jobsSha256: "b".repeat(64) });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when the feature flag is disabled without reading or persisting the event", async () => {
    vi.stubEnv("GITHUB_WEBHOOK_INGESTION_ENABLED", "false");
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(persist).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("fails closed when the feature flag is enabled but the secret is missing or weak", async () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "too-short");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(persist).not.toHaveBeenCalled();
  });

  it("persists only a valid, signed workflow_run event", async () => {
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify.mock.calls[0][0]).toMatchObject({ workflowId: 408741606 });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][0].event).toMatchObject({
      runId: 42301937504,
      status: "completed",
      conclusion: "success"
    });
    expect(persist.mock.calls[0][0].rawBody).toBe(rawBody);
    expect(persist.mock.calls[0][0].verification).toMatchObject({ workflowId: 408741606, jobCount: 1 });
  });

  it("rejects an invalid HMAC before parsing or persistence", async () => {
    const response = await POST(request(rawBody, {
      "x-hub-signature-256": `sha256=${"0".repeat(64)}`
    }));
    expect(response.status).toBe(401);
    expect(persist).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects wrong event types and non-JSON content types", async () => {
    const wrongEvent = await POST(request(rawBody, { "x-github-event": "push" }));
    expect(wrongEvent.status).toBe(400);
    const wrongType = await POST(request(rawBody, { "content-type": "text/plain" }));
    expect(wrongType.status).toBe(415);
    expect(persist).not.toHaveBeenCalled();
  });

  it("rejects malformed signed JSON and invalid event projections", async () => {
    const malformedBody = "{not-json";
    const malformed = await POST(request(malformedBody));
    expect(malformed.status).toBe(400);
    const invalidEvent = await POST(request(JSON.stringify({ action: "push" })));
    expect(invalidEvent.status).toBe(400);
    expect(persist).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("fails closed when authoritative GitHub verification fails", async () => {
    verify.mockRejectedValueOnce(new Error("canonical run mismatch"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("canonical run mismatch");
    expect(persist).not.toHaveBeenCalled();
  });

  it("maps idempotency outcomes without disclosing internal details", async () => {
    persist.mockResolvedValueOnce("DUPLICATE");
    expect((await POST(request())).status).toBe(200);
    persist.mockResolvedValueOnce("STALE");
    expect((await POST(request())).status).toBe(202);
    persist.mockResolvedValueOnce("DELIVERY_ID_CONFLICT");
    expect((await POST(request())).status).toBe(409);
    persist.mockRejectedValueOnce(new Error("private database host detail"));
    const failed = await POST(request());
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("private database host detail");
  });
});
