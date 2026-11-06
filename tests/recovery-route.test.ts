import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  allowAuthAttempt: vi.fn(),
  isSameOriginRequest: vi.fn(),
  normalizeLoginId: vi.fn(),
  validatePassword: vi.fn(),
  verifyRecoveryCode: vi.fn(),
  authEmailForLoginId: vi.fn(),
  createRecoveryCode: vi.fn(),
  hashRecoveryCode: vi.fn(),
  encryptPendingRecoveryCode: vi.fn(),
  decryptPendingRecoveryCode: vi.fn(),
  signInWithPassword: vi.fn(),
  cookies: vi.fn()
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  allowAuthAttempt: mocks.allowAuthAttempt
}));
vi.mock("@/lib/auth/vault", () => ({
  isSameOriginRequest: mocks.isSameOriginRequest,
  normalizeLoginId: mocks.normalizeLoginId,
  validatePassword: mocks.validatePassword,
  verifyRecoveryCode: mocks.verifyRecoveryCode,
  authEmailForLoginId: mocks.authEmailForLoginId,
  createRecoveryCode: mocks.createRecoveryCode,
  hashRecoveryCode: mocks.hashRecoveryCode
}));
vi.mock("@/lib/auth/recovery-encryption", () => ({
  encryptPendingRecoveryCode: mocks.encryptPendingRecoveryCode,
  decryptPendingRecoveryCode: mocks.decryptPendingRecoveryCode
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { signInWithPassword: mocks.signInWithPassword }
  })
}));
vi.mock("next/headers", () => ({
  cookies: mocks.cookies
}));

import { POST } from "@/app/api/auth/recovery/route";

const activeProfile = {
  user_id: "user-123",
  recovery_code_hash: "active-hash",
  recovery_code_salt: "active-salt",
  pending_recovery_code_hash: null,
  pending_recovery_code_salt: null,
  pending_recovery_code_ciphertext: null,
  pending_recovery_code_iv: null,
  pending_recovery_code_auth_tag: null,
  pending_recovery_code_expires_at: null
};

function makeRequest(body: Record<string, unknown>, origin = "https://vault.example") {
  return new Request("https://vault.example/api/auth/recovery", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "Sec-Fetch-Site": "same-origin"
    },
    body: JSON.stringify(body)
  });
}

describe("POST /api/auth/recovery", () => {
  let profile: Record<string, any>;
  let rpc: ReturnType<typeof vi.fn>;
  let updateUserById: ReturnType<typeof vi.fn>;
  let maybeSingle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    profile = { ...activeProfile };
    maybeSingle = vi.fn(async () => ({ data: profile, error: null }));
    const query: any = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.maybeSingle = maybeSingle;
    rpc = vi.fn(async (name: string) => {
      if (name === "claim_vault_recovery") return { data: true, error: null };
      if (name === "finish_vault_recovery") return { data: true, error: null };
      return { data: true, error: null };
    });
    updateUserById = vi.fn(async () => ({ error: null }));
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: vi.fn(() => query),
      rpc,
      auth: { admin: { updateUserById } }
    });
    mocks.allowAuthAttempt.mockResolvedValue(true);
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.normalizeLoginId.mockReturnValue("myvault");
    mocks.validatePassword.mockImplementation(() => undefined);
    mocks.verifyRecoveryCode.mockReturnValue(true);
    mocks.authEmailForLoginId.mockReturnValue("internal@vault-login.invalid");
    mocks.createRecoveryCode.mockReturnValue("ABCDE-12345-ABCDE-12345-ABCDE-12345-ABCDE-12345");
    mocks.hashRecoveryCode.mockReturnValue({ hash: "new-hash", salt: "new-salt" });
    mocks.encryptPendingRecoveryCode.mockReturnValue({
      ciphertext: "encrypted-code",
      iv: "iv-value",
      authTag: "tag-value"
    });
    mocks.decryptPendingRecoveryCode.mockReturnValue("ABCDE-12345-ABCDE-12345-ABCDE-12345-ABCDE-12345");
    mocks.cookies.mockResolvedValue({ getAll: () => [], set: vi.fn() });
    mocks.signInWithPassword.mockResolvedValue({ error: null });
  });

  it("rejects a cross-origin request before touching account data", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    const response = await POST(makeRequest({
      loginId: "myvault",
      recoveryCode: "old-code",
      newPassword: "a-strong-new-password"
    }, "https://attacker.example"));

    expect(response.status).toBe(403);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns the same unexpired pending code without resetting the password again", async () => {
    profile.pending_recovery_code_hash = "pending-hash";
    profile.pending_recovery_code_salt = "pending-salt";
    profile.pending_recovery_code_ciphertext = "ciphertext";
    profile.pending_recovery_code_iv = "iv";
    profile.pending_recovery_code_auth_tag = "tag";
    profile.pending_recovery_code_expires_at = new Date(Date.now() + 60_000).toISOString();

    const response = await POST(makeRequest({
      loginId: "myvault",
      recoveryCode: "old-code",
      newPassword: "a-strong-new-password"
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requiresAcknowledgement).toBe(true);
    expect(body.recoveryCode).toBe("ABCDE-12345-ABCDE-12345-ABCDE-12345-ABCDE-12345");
    expect(updateUserById).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("claims recovery, changes the password, and stages a new code for acknowledgement", async () => {
    const response = await POST(makeRequest({
      loginId: "myvault",
      recoveryCode: "old-code",
      newPassword: "a-strong-new-password"
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith("user-123", { password: "a-strong-new-password" });
    expect(rpc).toHaveBeenCalledWith("claim_vault_recovery", expect.objectContaining({
      p_user_id: "user-123",
      p_expected_hash: "active-hash",
      p_expected_salt: "active-salt"
    }));
    expect(rpc).toHaveBeenCalledWith("finish_vault_recovery", expect.objectContaining({
      p_user_id: "user-123",
      p_pending_hash: "new-hash",
      p_pending_salt: "new-salt",
      p_ciphertext: "encrypted-code"
    }));
    expect(body.requiresAcknowledgement).toBe(true);
    expect(body.recoveryCode).toBe("ABCDE-12345-ABCDE-12345-ABCDE-12345-ABCDE-12345");
    expect(rpc).not.toHaveBeenCalledWith("release_vault_recovery", expect.anything());
  });

  it("releases the claim if staging fails after the password update", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "claim_vault_recovery") return { data: true, error: null };
      if (name === "finish_vault_recovery") return { data: false, error: null };
      return { data: true, error: null };
    });

    const response = await POST(makeRequest({
      loginId: "myvault",
      recoveryCode: "old-code",
      newPassword: "a-strong-new-password"
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("Master Password may have changed");
    expect(updateUserById).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("release_vault_recovery", {
      p_user_id: "user-123",
      p_claim_token: expect.any(String)
    });
  });

  it("cleans up an expired pending code and starts a fresh recovery", async () => {
    profile.pending_recovery_code_hash = "expired-hash";
    profile.pending_recovery_code_salt = "expired-salt";
    profile.pending_recovery_code_ciphertext = "expired-ciphertext";
    profile.pending_recovery_code_iv = "expired-iv";
    profile.pending_recovery_code_auth_tag = "expired-tag";
    profile.pending_recovery_code_expires_at = new Date(Date.now() - 60_000).toISOString();

    const response = await POST(makeRequest({
      loginId: "myvault",
      recoveryCode: "old-code",
      newPassword: "a-strong-new-password"
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requiresAcknowledgement).toBe(true);
    expect(updateUserById).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("claim_vault_recovery", expect.any(Object));
    expect(mocks.decryptPendingRecoveryCode).not.toHaveBeenCalled();
  });

  it("does not change the password when another recovery claim is active", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "claim_vault_recovery") return { data: false, error: null };
      return { data: true, error: null };
    });

    const response = await POST(makeRequest({
      loginId: "myvault",
      recoveryCode: "old-code",
      newPassword: "a-strong-new-password"
    }));

    expect(response.status).toBe(409);
    expect(updateUserById).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("releases its claim when the Supabase password update fails", async () => {
    updateUserById.mockResolvedValue({ error: new Error("password update failed") });

    const response = await POST(makeRequest({
      loginId: "myvault",
      recoveryCode: "old-code",
      newPassword: "a-strong-new-password"
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("existing Recovery Code remains valid");
    expect(rpc).toHaveBeenCalledWith("release_vault_recovery", {
      p_user_id: "user-123",
      p_claim_token: expect.any(String)
    });
  });


  it("returns the staged Recovery Code when automatic sign-in fails after reset", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: new Error("temporary sign-in failure") });

    const response = await POST(makeRequest({
      loginId: "myvault",
      recoveryCode: "old-code",
      newPassword: "a-strong-new-password"
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.signedIn).toBe(false);
    expect(body.recoveryCode).toBe("ABCDE-12345-ABCDE-12345-ABCDE-12345-ABCDE-12345");
    expect(body.requiresAcknowledgement).toBe(false);
    expect(rpc).toHaveBeenCalledWith("finish_vault_recovery", expect.any(Object));
    expect(rpc).not.toHaveBeenCalledWith("release_vault_recovery", expect.anything());
  });
});
