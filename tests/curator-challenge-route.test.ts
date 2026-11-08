import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createOpaqueToken: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies
}));
vi.mock("@/lib/auth/curator-claim", () => ({
  CURATOR_CHALLENGE_COOKIE: "vault_curator_challenge",
  CURATOR_CHALLENGE_TTL_SECONDS: 600,
  CURATOR_SESSION_COOKIE: "vault_curator_session",
  createOpaqueToken: mocks.createOpaqueToken
}));

import { GET } from "@/app/api/curator/challenge/route";

describe("Curator challenge bootstrap API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createOpaqueToken
      .mockReturnValueOnce("new-session-token")
      .mockReturnValueOnce("new-challenge-token");
    mocks.cookies.mockResolvedValue({
      get: () => undefined
    });
    process.env.NODE_ENV = "test";
  });

  it("rejects an explicitly cross-site bootstrap request", async () => {
    const response = await GET(new Request("https://vault.example/api/curator/challenge", {
      headers: { "Sec-Fetch-Site": "cross-site" }
    }));

    expect(response.status).toBe(403);
    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.createOpaqueToken).not.toHaveBeenCalled();
  });

  it("issues no-store response and strict HttpOnly session/challenge cookies", async () => {
    const response = await GET(new Request("https://vault.example/api/curator/challenge", {
      headers: { "Sec-Fetch-Site": "same-origin" }
    }));
    const body = await response.json();
    const sessionCookie = response.cookies.get("vault_curator_session");
    const challengeCookie = response.cookies.get("vault_curator_challenge");

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, challenge: "curator-fourfold-v1" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(sessionCookie?.value).toBe("new-session-token");
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe("strict");
    expect(sessionCookie?.path).toBe("/");
    expect(challengeCookie?.value).toBe("new-challenge-token");
    expect(challengeCookie?.httpOnly).toBe(true);
    expect(challengeCookie?.sameSite).toBe("strict");
    expect(challengeCookie?.path).toBe("/api/curator");
    expect(challengeCookie?.maxAge).toBe(600);
  });

  it("reuses an existing browser session and rotates only the challenge marker", async () => {
    mocks.cookies.mockResolvedValue({
      get: (name: string) => name === "vault_curator_session"
        ? { value: "existing-session-token" }
        : undefined
    });

    const response = await GET(new Request("https://vault.example/api/curator/challenge"));
    const sessionCookie = response.cookies.get("vault_curator_session");
    const challengeCookie = response.cookies.get("vault_curator_challenge");

    expect(sessionCookie?.value).toBe("existing-session-token");
    expect(challengeCookie?.value).toBe("new-session-token");
    expect(mocks.createOpaqueToken).toHaveBeenCalledOnce();
  });
});
