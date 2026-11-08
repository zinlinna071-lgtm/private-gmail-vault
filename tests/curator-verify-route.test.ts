import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  insert: vi.fn(),
  cookies: vi.fn(),
  isSameOriginRequest: vi.fn(),
  allowAuthAttempt: vi.fn(),
  createOpaqueToken: vi.fn(),
  hashOpaqueToken: vi.fn()
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient
}));
vi.mock("@/lib/auth/vault", () => ({
  isSameOriginRequest: mocks.isSameOriginRequest
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  allowAuthAttempt: mocks.allowAuthAttempt,
  AuthRateLimitError: class AuthRateLimitError extends Error {}
}));
vi.mock("@/lib/auth/curator-claim", () => ({
  CURATOR_CHALLENGE_COOKIE: "vault_curator_challenge",
  CURATOR_CLAIM_COOKIE: "vault_curator_claim",
  CURATOR_CLAIM_TTL_SECONDS: 600,
  CURATOR_SESSION_COOKIE: "vault_curator_session",
  createOpaqueToken: mocks.createOpaqueToken,
  hashOpaqueToken: mocks.hashOpaqueToken
}));
vi.mock("next/headers", () => ({
  cookies: mocks.cookies
}));

import { POST } from "@/app/api/curator/verify/route";

function request(body: unknown) {
  return new Request("https://vault.example/api/curator/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://vault.example",
      "Sec-Fetch-Site": "same-origin"
    },
    body: JSON.stringify(body)
  });
}

describe("Curator verification API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.allowAuthAttempt.mockResolvedValue(true);
    mocks.createOpaqueToken.mockReturnValue("opaque-claim-token");
    mocks.hashOpaqueToken.mockImplementation((value: string) => "sha256-" + value);
    mocks.insert.mockResolvedValue({ error: null });
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: () => ({ insert: mocks.insert })
    });
    mocks.cookies.mockResolvedValue({
      get: (name: string) => name === "vault_curator_session"
        ? { value: "browser-session-token" }
        : name === "vault_curator_challenge" ? { value: "challenge-token" } : undefined
    });
  });

  it("rejects an incorrect puzzle without issuing a claim", async () => {
    const response = await POST(request({
      found: ["margin", "shelf", "note"],
      order: ["email", "password", "backup", "note"]
    }));

    expect(response.status).toBe(422);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects duplicate or additional marks without issuing a claim", async () => {
    const response = await POST(request({
      found: ["margin", "margin", "note", "shelf"],
      order: ["email", "backup", "note", "password"]
    }));

    expect(response.status).toBe(422);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("issues only hashed claim and session values for the exact solution", async () => {
    const response = await POST(request({
      found: ["margin", "shelf", "note"],
      order: ["email", "backup", "note", "password"]
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      claim_hash: "sha256-opaque-claim-token",
      session_hash: "sha256-browser-session-token"
    }));
    expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain("opaque-claim-token");
    expect(response.headers.get("set-cookie")).toContain("vault_curator_claim");
  });

  it("fails closed when the database cannot store the claim", async () => {
    mocks.insert.mockResolvedValue({ error: new Error("database unavailable") });
    const response = await POST(request({
      found: ["margin", "shelf", "note"],
      order: ["email", "backup", "note", "password"]
    }));

    expect(response.status).toBe(503);
    expect(mocks.insert).toHaveBeenCalledOnce();
  });
});
