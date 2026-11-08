import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readBoundedJson: vi.fn(),
  isJsonContentType: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  rpc: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  insert: vi.fn(),
  allowAuthAttempt: vi.fn(),
  encryptPendingRecoveryCode: vi.fn(),
  authEmailForLoginId: vi.fn(),
  createRecoveryCode: vi.fn(),
  hashRecoveryCode: vi.fn(),
  isSameOriginRequest: vi.fn(),
  normalizeLoginId: vi.fn(),
  validatePassword: vi.fn(),
  hashOpaqueToken: vi.fn(),
  cookies: vi.fn(),
  signInWithPassword: vi.fn(),
  cookieDelete: vi.fn()
}));

vi.mock("@/lib/auth/bounded-json", () => ({ readBoundedJson: mocks.readBoundedJson }));
vi.mock("@/lib/auth/content-type", () => ({ isJsonContentType: mocks.isJsonContentType }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("@/lib/auth/rate-limit", () => ({
  allowAuthAttempt: mocks.allowAuthAttempt,
  AuthRateLimitError: class AuthRateLimitError extends Error {}
}));
vi.mock("@/lib/auth/recovery-encryption", () => ({ encryptPendingRecoveryCode: mocks.encryptPendingRecoveryCode }));
vi.mock("@/lib/auth/vault", () => ({
  authEmailForLoginId: mocks.authEmailForLoginId,
  createRecoveryCode: mocks.createRecoveryCode,
  hashRecoveryCode: mocks.hashRecoveryCode,
  isSameOriginRequest: mocks.isSameOriginRequest,
  normalizeLoginId: mocks.normalizeLoginId,
  validatePassword: mocks.validatePassword
}));
vi.mock("@/lib/auth/curator-claim", () => ({
  CURATOR_CLAIM_COOKIE: "vault_curator_claim",
  CURATOR_SESSION_COOKIE: "vault_curator_session",
  hashOpaqueToken: mocks.hashOpaqueToken
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { signInWithPassword: mocks.signInWithPassword } })
}));

import { POST } from "@/app/api/auth/register/route";

const registrationBody = {
  loginId: "secondary-user",
  password: "a-strong-test-password-123",
  responsibilityAccepted: true,
  role: "owner",
  isOwner: true
};

function request() {
  return new Request("https://vault.example/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://vault.example",
      "Sec-Fetch-Site": "same-origin"
    },
    body: JSON.stringify(registrationBody)
  });
}

describe("Secondary account registration boundary", () => {
  let cookieValues: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    cookieValues = {
      vault_curator_claim: "one-time-claim-token",
      vault_curator_session: "browser-session-token"
    };
    mocks.readBoundedJson.mockResolvedValue({ ok: true, value: registrationBody });
    mocks.isJsonContentType.mockReturnValue(true);
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.allowAuthAttempt.mockResolvedValue(true);
    mocks.normalizeLoginId.mockReturnValue("secondary-user");
    mocks.authEmailForLoginId.mockReturnValue("secondary-user@vault.invalid");
    mocks.validatePassword.mockReturnValue(undefined);
    mocks.createRecoveryCode.mockReturnValue("synthetic-recovery-code");
    mocks.hashRecoveryCode.mockReturnValue({ hash: "recovery-hash", salt: "recovery-salt" });
    mocks.encryptPendingRecoveryCode.mockReturnValue({
      ciphertext: "encrypted-pending-code", iv: "recovery-iv", authTag: "recovery-tag"
    });
    mocks.hashOpaqueToken.mockImplementation((value: string) => "digest-" + value);
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.createUser.mockResolvedValue({ data: { user: { id: "secondary-user-id" } }, error: null });
    mocks.deleteUser.mockResolvedValue({ error: null });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.cookies.mockResolvedValue({
      get: (name: string) => cookieValues[name] ? { value: cookieValues[name] } : undefined,
      delete: mocks.cookieDelete
    });
    mocks.createSupabaseAdminClient.mockReturnValue({
      rpc: mocks.rpc,
      auth: { admin: { createUser: mocks.createUser, deleteUser: mocks.deleteUser } },
      from: () => ({ insert: mocks.insert })
    });
  });

  it("blocks direct registration when the Curator claim is absent", async () => {
    delete cookieValues.vault_curator_claim;

    const response = await POST(request());

    expect(response.status).toBe(428);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("rejects invalid or replayed claims before creating any account", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.rpc).toHaveBeenCalledWith("consume_curator_registration_claim", {
      p_claim_hash: "digest-one-time-claim-token",
      p_session_hash: "digest-browser-session-token"
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("creates a Secondary account only after consuming the session-bound claim", async () => {
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: "secondary-user@vault.invalid",
      email_confirm: true,
      user_metadata: { vault_login_id: "secondary-user" }
    }));
    const metadata = mocks.createUser.mock.calls[0][0].user_metadata;
    expect(metadata).not.toHaveProperty("role");
    expect(metadata).not.toHaveProperty("isOwner");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "secondary-user-id",
      display_name: "secondary-user",
      login_id: "secondary-user"
    }));
    expect(mocks.cookieDelete).toHaveBeenCalledWith("vault_curator_claim");
  });
});
