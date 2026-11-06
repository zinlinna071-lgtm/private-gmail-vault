import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  allowAuthAttempt: vi.fn(),
  isSameOriginRequest: vi.fn(),
  normalizeLoginId: vi.fn(),
  validatePassword: vi.fn(),
  authEmailForLoginId: vi.fn(),
  createRecoveryCode: vi.fn(),
  hashRecoveryCode: vi.fn(),
  encryptPendingRecoveryCode: vi.fn(),
  decryptPendingRecoveryCode: vi.fn(),
  signInWithPassword: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  insert: vi.fn(),
  maybeSingle: vi.fn(),
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

import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";

const recoveryCode = "ABCDE-12345-ABCDE-12345-ABCDE-12345-ABCDE-12345";

function request(path: string, body: Record<string, unknown>, origin = "https://vault.example") {
  return new Request(`https://vault.example${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "Sec-Fetch-Site": "same-origin"
    },
    body: JSON.stringify(body)
  });
}

describe("Vault registration and login API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseAdminClient.mockReturnValue({
      auth: { admin: { createUser: mocks.createUser, deleteUser: mocks.deleteUser } },
      from: () => ({ insert: mocks.insert, select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) })
    });
    mocks.allowAuthAttempt.mockResolvedValue(true);
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.normalizeLoginId.mockReturnValue("myvault");
    mocks.validatePassword.mockImplementation(() => undefined);
    mocks.authEmailForLoginId.mockReturnValue("internal@vault-login.invalid");
    mocks.createRecoveryCode.mockReturnValue(recoveryCode);
    mocks.hashRecoveryCode.mockReturnValue({ hash: "code-hash", salt: "code-salt" });
    mocks.encryptPendingRecoveryCode.mockReturnValue({
      ciphertext: "encrypted-code",
      iv: "iv-value",
      authTag: "tag-value"
    });
    mocks.decryptPendingRecoveryCode.mockReturnValue(recoveryCode);
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.createUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    mocks.deleteUser.mockResolvedValue({ error: null });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        pending_recovery_code_hash: "code-hash",
        pending_recovery_code_salt: "code-salt",
        pending_recovery_code_ciphertext: "encrypted-code",
        pending_recovery_code_iv: "iv-value",
        pending_recovery_code_auth_tag: "tag-value",
        pending_recovery_code_expires_at: null
      },
      error: null
    });
    mocks.cookies.mockResolvedValue({ getAll: () => [], set: vi.fn() });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";
  });

  it("rejects registration from another origin before creating an account", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    const response = await register(request("/api/auth/register", {
      loginId: "myvault",
      password: "a-strong-master-password"
    }, "https://attacker.example"));

    expect(response.status).toBe(403);
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("creates the profile with a pending, encrypted Recovery Code", async () => {
    const response = await register(request("/api/auth/register", {
      loginId: "myvault",
      password: "a-strong-master-password"
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.recoveryCode).toBe(recoveryCode);
    expect(body.requiresAcknowledgement).toBe(true);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-123",
      login_id: "myvault",
      pending_recovery_code_hash: "code-hash",
      pending_recovery_code_ciphertext: "encrypted-code",
      pending_recovery_code_expires_at: null
    }));
  });

  it("removes the newly created auth user if profile creation fails", async () => {
    mocks.insert.mockResolvedValue({ error: new Error("insert failed") });
    const response = await register(request("/api/auth/register", {
      loginId: "myvault",
      password: "a-strong-master-password"
    }));

    expect(response.status).toBe(500);
    expect(mocks.deleteUser).toHaveBeenCalledWith("user-123");
  });

  it("returns the same pending Recovery Code after a successful login", async () => {
    const response = await login(request("/api/auth/login", {
      loginId: "myvault",
      password: "a-strong-master-password"
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.recoveryCode).toBe(recoveryCode);
    expect(body.requiresAcknowledgement).toBe(true);
    expect(mocks.decryptPendingRecoveryCode).toHaveBeenCalledWith({
      ciphertext: "encrypted-code",
      iv: "iv-value",
      authTag: "tag-value"
    });
  });

  it("does not query recovery data when password authentication fails", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: new Error("invalid credentials") });
    const response = await login(request("/api/auth/login", {
      loginId: "myvault",
      password: "wrong-master-password"
    }));

    expect(response.status).toBe(401);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns a safe retry response when recovery status cannot be read", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error("database unavailable") });
    const response = await login(request("/api/auth/login", {
      loginId: "myvault",
      password: "a-strong-master-password"
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("Keep this session open and retry");
  });
});
