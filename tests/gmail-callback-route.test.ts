import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getUser: vi.fn(),
  encryptRefreshToken: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient
}));
vi.mock("@/lib/gmail/token-encryption", () => ({
  encryptRefreshToken: mocks.encryptRefreshToken
}));

import { GET } from "@/app/api/gmail/callback/route";

const originalEnv = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
  encryptionKey: process.env.VAULT_ENCRYPTION_KEY
};

function signedState(userId = "vault-user-1") {
  const nonce = "synthetic-state-nonce";
  const key = Buffer.from(process.env.VAULT_ENCRYPTION_KEY ?? "", "hex");
  const signature = createHmac("sha256", key)
    .update(`gmail-oauth:${nonce}:${userId}`)
    .digest("hex");
  return { nonce, cookie: `${nonce}.${signature}` };
}

function makeRequest(query = "", cookie = "") {
  const headers = cookie ? { cookie: `gmail_oauth_state=${cookie}` } : undefined;
  return new NextRequest(`https://vault.example/api/gmail/callback${query}`, { headers });
}

describe("GET /api/gmail/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser }
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "vault-user-1" } } });
    process.env.GOOGLE_CLIENT_ID = "synthetic-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "synthetic-google-client-secret";
    process.env.GOOGLE_REDIRECT_URI = "https://vault.example/api/gmail/callback";
    process.env.VAULT_ENCRYPTION_KEY = "a".repeat(64);
  });

  afterEach(() => {
    if (originalEnv.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalEnv.clientId;
    if (originalEnv.clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = originalEnv.clientSecret;
    if (originalEnv.redirectUri === undefined) delete process.env.GOOGLE_REDIRECT_URI;
    else process.env.GOOGLE_REDIRECT_URI = originalEnv.redirectUri;
    if (originalEnv.encryptionKey === undefined) delete process.env.VAULT_ENCRYPTION_KEY;
    else process.env.VAULT_ENCRYPTION_KEY = originalEnv.encryptionKey;
  });

  it("requires an authenticated Vault user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await GET(makeRequest());

    expect(response.headers.get("location")).toContain("/vault?gmail_error=sign_in_required");
    expect(response.cookies.get("gmail_oauth_state")?.maxAge).toBe(0);
  });

  it("rejects a missing or mismatched OAuth state before contacting Google", async () => {
    const response = await GET(makeRequest("?state=attacker-state", "different-state.invalid-signature"));

    expect(response.headers.get("location")).toContain("/vault?gmail_error=invalid_oauth_state");
    expect(response.cookies.get("gmail_oauth_state")?.maxAge).toBe(0);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a state signature bound to a different Vault user", async () => {
    const otherUserState = signedState("another-vault-user");
    const response = await GET(makeRequest(`?state=${otherUserState.nonce}`, otherUserState.cookie));

    expect(response.headers.get("location")).toContain("/vault?gmail_error=invalid_oauth_state");
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("handles Google authorization denial without exchanging a code", async () => {
    const state = signedState();
    const response = await GET(makeRequest(`?state=${state.nonce}&error=access_denied`, state.cookie));

    expect(response.headers.get("location")).toContain("/vault?gmail_error=authorization_denied");
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("fails safely when the callback has no authorization code", async () => {
    const state = signedState();
    const response = await GET(makeRequest(`?state=${state.nonce}`, state.cookie));

    expect(response.headers.get("location")).toContain("/vault?gmail_error=oauth_not_configured");
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
