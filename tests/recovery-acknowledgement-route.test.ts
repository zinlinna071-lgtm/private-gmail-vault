import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  isSameOriginRequest: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  cookies: vi.fn()
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient
}));
vi.mock("@/lib/auth/vault", () => ({
  isSameOriginRequest: mocks.isSameOriginRequest
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: mocks.getUser }
  })
}));
vi.mock("next/headers", () => ({
  cookies: mocks.cookies
}));

import { POST } from "@/app/api/auth/recovery/acknowledge/route";

function makeRequest(origin = "https://vault.example") {
  return new Request("https://vault.example/api/auth/recovery/acknowledge", {
    method: "POST",
    headers: {
      Origin: origin,
      "Sec-Fetch-Site": "same-origin"
    }
  });
}

describe("POST /api/auth/recovery/acknowledge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null
    });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.createSupabaseAdminClient.mockReturnValue({ rpc: mocks.rpc });
    mocks.cookies.mockResolvedValue({ getAll: () => [], set: vi.fn() });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";
  });

  it("rejects cross-origin requests before checking authentication", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    const response = await POST(makeRequest("https://attacker.example"));

    expect(response.status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated Vault session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("no session") });
    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("acknowledges the pending code only for the authenticated user", async () => {
    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("acknowledge_vault_recovery_code", {
      p_user_id: "user-123"
    });
  });

  it("does not report success when no valid pending code can be promoted", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("pending Recovery Code has expired or was already confirmed");
  });
});
