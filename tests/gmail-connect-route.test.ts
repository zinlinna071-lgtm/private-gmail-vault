import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getUser: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient
}));

import { GET } from "@/app/api/gmail/connect/route";

const originalEnv = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
  encryptionKey: process.env.VAULT_ENCRYPTION_KEY,
  oauthStateHmacKey: process.env.GMAIL_OAUTH_STATE_HMAC_KEY
};

function makeRequest() {
  return new Request("https://vault.example/api/gmail/connect");
}

describe("GET /api/gmail/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser }
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "vault-user-1" } } });
    process.env.GOOGLE_CLIENT_ID = "synthetic-google-client-id";
    process.env.GOOGLE_REDIRECT_URI = "https://vault.example/api/gmail/callback";
    process.env.VAULT_ENCRYPTION_KEY = "f".repeat(64);
    process.env.GMAIL_OAUTH_STATE_HMAC_KEY = "a".repeat(64);
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    if (originalEnv.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalEnv.clientId;
    if (originalEnv.redirectUri === undefined) delete process.env.GOOGLE_REDIRECT_URI;
    else process.env.GOOGLE_REDIRECT_URI = originalEnv.redirectUri;
    if (originalEnv.encryptionKey === undefined) delete process.env.VAULT_ENCRYPTION_KEY;
    else process.env.VAULT_ENCRYPTION_KEY = originalEnv.encryptionKey;
    if (originalEnv.oauthStateHmacKey === undefined) delete process.env.GMAIL_OAUTH_STATE_HMAC_KEY;
    else process.env.GMAIL_OAUTH_STATE_HMAC_KEY = originalEnv.oauthStateHmacKey;
    vi.unstubAllEnvs();
  });

  it("redirects unauthenticated visitors to the app root", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await GET(makeRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://vault.example/");
  });

  it("returns a safe error redirect when Google OAuth is not configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    const response = await GET(makeRequest());

    expect(response.headers.get("location")).toContain("/vault?gmail_error=oauth_not_configured");
  });

  it("rejects a redirect URI outside the callback route", async () => {
    process.env.GOOGLE_REDIRECT_URI = "https://vault.example/unexpected";

    const response = await GET(makeRequest());

    expect(response.headers.get("location")).toContain("/vault?gmail_error=invalid_redirect_uri");
  });

  it("creates a signed short-lived state cookie and requests read-only Gmail scope", async () => {
    const response = await GET(makeRequest());
    const destination = new URL(response.headers.get("location") ?? "");
    const stateCookie = response.cookies.get("gmail_oauth_state");

    expect(destination.origin).toBe("https://accounts.google.com");
    expect(destination.searchParams.get("scope")).toContain("https://www.googleapis.com/auth/gmail.readonly");
    expect(destination.searchParams.get("access_type")).toBe("offline");
    expect(destination.searchParams.get("prompt")).toBe("select_account consent");
    expect(destination.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(stateCookie?.value).toMatch(/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/);
    expect(stateCookie?.httpOnly).toBe(true);
    expect(stateCookie?.sameSite).toBe("lax");
    expect(stateCookie?.path).toBe("/api/gmail/callback");
    expect(stateCookie?.maxAge).toBe(600);
  });

  it("fails closed when the OAuth state signing key is invalid", async () => {
    process.env.GMAIL_OAUTH_STATE_HMAC_KEY = "invalid";

    await expect(GET(makeRequest())).rejects.toThrow("OAuth state signing is not configured.");
  });
});
