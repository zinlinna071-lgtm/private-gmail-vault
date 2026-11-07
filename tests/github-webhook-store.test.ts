import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc })
}));

import { persistVerifiedWorkflowRunEvent } from "../lib/security-research/github-webhook-store";
import type { VerifiedWorkflowRunEvent } from "../lib/security-research/github-webhook";

const verification = { verifiedAt: "2026-11-07T01:02:01Z", workflowId: 408741606, jobCount: 2, jobsSha256: "e".repeat(64) };

const event: VerifiedWorkflowRunEvent = {
  deliveryId: "9a5f81a2-6f27-4f7a-8a65-3f91d6d50a91",
  action: "completed",
  repository: "zinlinna071-lgtm/private-gmail-vault",
  workflowPath: ".github/workflows/ci.yml",
  workflowId: 408741606,
  runId: 42298920558,
  runAttempt: 1,
  headBranch: "feature/vault-authentication",
  headSha: "a".repeat(40),
  status: "completed",
  conclusion: "success",
  createdAt: "2026-11-07T01:00:00Z",
  runStartedAt: "2026-11-07T01:00:02Z",
  updatedAt: "2026-11-07T01:02:00Z",
  htmlUrl: "https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42298920558"
};

describe("GitHub webhook event store adapter", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("sends only the SHA-256 body fingerprint and allowlisted metadata", async () => {
    rpc.mockResolvedValue({ data: "APPLIED", error: null });

    const result = await persistVerifiedWorkflowRunEvent({
      event,
      verification,
      rawBody: '{"signed":"payload"}'
    });

    expect(result).toBe("APPLIED");
    expect(rpc).toHaveBeenCalledTimes(1);
    const [functionName, args] = rpc.mock.calls[0];
    expect(functionName).toBe("ingest_github_workflow_event");
    expect(args.p_payload_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(args.p_payload_sha256).toBe(
      "f6a13d99585a00d82c6896606f9a379cf15f90b42f9f4285f13fd8d6f401da0e"
    );
    expect(args.p_delivery_id).toBe(event.deliveryId);
    expect(args.p_workflow_id).toBe(408741606);
    expect(args.p_authoritative_verified_at).toBe(verification.verifiedAt);
    expect(args.p_verified_job_count).toBe(2);
    expect(args.p_verified_jobs_sha256).toBe("e".repeat(64));
    expect(args).not.toHaveProperty("rawBody");
    expect(args).not.toHaveProperty("signature");
  });

  it.each(["DUPLICATE", "DELIVERY_ID_CONFLICT", "STALE"] as const)(
    "returns the database's %s idempotency result",
    async (data) => {
      rpc.mockResolvedValue({ data, error: null });
      await expect(persistVerifiedWorkflowRunEvent({ event, verification, rawBody: "body" })).resolves.toBe(data);
    }
  );

  it("rejects mismatched or malformed canonical verification evidence before RPC", async () => {
    await expect(
      persistVerifiedWorkflowRunEvent({
        event,
        verification: { ...verification, workflowId: 123 },
        rawBody: "body"
      })
    ).rejects.toThrow("Canonical GitHub verification evidence is invalid.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not disclose database error details", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "sensitive database connection detail" }
    });

    await expect(
      persistVerifiedWorkflowRunEvent({ event, verification, rawBody: "body" })
    ).rejects.toThrow("Unable to persist the verified workflow event.");
  });

  it("rejects unexpected RPC result values", async () => {
    rpc.mockResolvedValue({ data: "PUBLIC", error: null });
    await expect(
      persistVerifiedWorkflowRunEvent({ event, verification, rawBody: "body" })
    ).rejects.toThrow("The workflow event store returned an invalid result.");
  });
});
