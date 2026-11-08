import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  insert: vi.fn(),
  consumeChallenge: vi.fn(),
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

const correctSolution = {
  found: ["margin", "shelf", "note"],
  order: ["email", "backup", "note", "password"]
};

describe("Curator verification API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.allowAuthAttempt.mockResolvedValue(true);
    mocks.createOpaqueToken.mockReturnValue("opaque-claim-token");
    mocks.hashOpaqueToken.mockImplementation((value: string) => "sha256-" + value);
    mocks.insert.mockResolvedValue({ error: null });
    mocks.consumeChallenge.mockResolvedValue({ data: true, error: null });
    mocks.createSupabaseAdminClient.mockReturnValue({
      rpc: mocks.consumeChallenge,
      from: () => ({ insert: mocks.insert })
    });
    mocks.cookies.mockResolvedValue({
      get: (name: string) => name === "vault_curator_session"
        ? { value: "browser-session-token" }
        : name === "vault_curator_challenge" ? { value: "challenge-token" } : undefined
    });
  });

  it("rejects an incorrect puzzle without consuming the challenge or issuing a claim", async () => {
    const response = await POST(request({
      found: ["margin", "shelf", "note"],
      order: ["email", "password", "backup", "note"]
    }));

    expect(response.status).toBe(422);
    expect(mocks.consumeChallenge).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects duplicate or additional marks without consuming the challenge", async () => {
    const response = await POST(request({
      found: ["margin", "margin", "note", "shelf"],
      order: ["email", "backup", "note", "password"]
    }));

    expect(response.status).toBe(422);
    expect(mocks.consumeChallenge).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects an expired, mismatched, or already-used challenge", async () => {
    mocks.consumeChallenge.mockResolvedValue({ data: false, error: null });
    const response = await POST(request(correctSolution));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("expired or was already used");
    expect(mocks.consumeChallenge).toHaveBeenCalledWith("consume_curator_challenge", {
      p_challenge_hash: "sha256-challenge-token",
      p_session_hash: "sha256-browser-session-token"
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("issues only hashed claim and session values after atomically consuming the challenge", async () => {
    const response = await POST(request(correctSolution));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.consumeChallenge).toHaveBeenCalledWith("consume_curator_challenge", {
      p_challenge_hash: "sha256-challenge-token",
      p_session_hash: "sha256-browser-session-token"
    });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      claim_hash: "sha256-opaque-claim-token",
      session_hash: "sha256-browser-session-token"
    }));
    expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain("opaque-claim-token");
    expect(response.headers.get("set-cookie")).toContain("vault_curator_claim");
  });

  it("fails closed when challenge consumption is unavailable", async () => {
    mocks.consumeChallenge.mockResolvedValue({ data: null, error: new Error("database unavailable") });
    const response = await POST(request(correctSolution));

    expect(response.status).toBe(503);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("fails closed when the database cannot store the claim", async () => {
    mocks.insert.mockResolvedValue({ error: new Error("database unavailable") });
    const response = await POST(request(correctSolution));

    expect(response.status).toBe(503);
    expect(mocks.consumeChallenge).toHaveBeenCalledOnce();
    expect(mocks.insert).toHaveBeenCalledOnce();
  });
});
