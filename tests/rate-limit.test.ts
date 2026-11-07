import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn()
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient
}));

import { allowAuthAttempt } from "@/lib/auth/rate-limit";

describe("Vault authentication rate-limit identity", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: true, error: null });
    mocks.createSupabaseAdminClient.mockReturnValue({ rpc });
  });

  it("does not trust a client-supplied x-forwarded-for value", async () => {
    const request = new Request("https://vault.example/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.77" }
    });

    await allowAuthAttempt(request, "login", "myvault", 10);

    const expectedUnknownIpBucket = createHash("sha256")
      .update("login|ip|unknown")
      .digest("hex");
    expect(rpc).toHaveBeenNthCalledWith(1, "consume_vault_auth_attempt", expect.objectContaining({
      p_bucket_hash: expectedUnknownIpBucket
    }));
  });

  it("uses the trusted x-real-ip header when present", async () => {
    const request = new Request("https://vault.example/api/auth/login", {
      headers: {
        "x-real-ip": "203.0.113.8",
        "x-forwarded-for": "203.0.113.77"
      }
    });

    await allowAuthAttempt(request, "login", "myvault", 10);

    const expectedIpBucket = createHash("sha256")
      .update("login|ip|203.0.113.8")
      .digest("hex");
    expect(rpc).toHaveBeenNthCalledWith(1, "consume_vault_auth_attempt", expect.objectContaining({
      p_bucket_hash: expectedIpBucket
    }));
  });
});
