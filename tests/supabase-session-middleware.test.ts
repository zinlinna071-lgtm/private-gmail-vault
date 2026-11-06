import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
  cookieMethods: { current: null as null | { getAll: () => unknown[]; setAll: (items: any[]) => void } }
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: any[]) => {
    mocks.cookieMethods.current = args[2].cookies;
    return { auth: { getClaims: mocks.getClaims } };
  }
}));

import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

describe("Supabase session middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookieMethods.current = null;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";
    mocks.getClaims.mockImplementation(async () => {
      mocks.cookieMethods.current?.setAll([{
        name: "sb-project-auth-token",
        value: "rotated-test-token",
        options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" }
      }]);
      return { data: { claims: { sub: "synthetic-user" } }, error: null };
    });
  });

  it("verifies claims and writes rotated cookies to the request and response", async () => {
    const request = new NextRequest("https://vault.example/vault");
    const response = await middleware(request);

    expect(mocks.getClaims).toHaveBeenCalledOnce();
    expect(request.cookies.get("sb-project-auth-token")?.value).toBe("rotated-test-token");
    expect(response.cookies.get("sb-project-auth-token")?.value).toBe("rotated-test-token");
    expect(response.cookies.get("sb-project-auth-token")?.httpOnly).toBe(true);
    expect(response.cookies.get("sb-project-auth-token")?.secure).toBe(true);
  });

  it("does not skip the session verification step when no refresh is needed", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "synthetic-user" } }, error: null });
    const request = new NextRequest("https://vault.example/security");

    await middleware(request);

    expect(mocks.getClaims).toHaveBeenCalledOnce();
  });

  it("fails closed when Supabase public configuration is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const request = new NextRequest("https://vault.example/vault");

    await expect(middleware(request)).rejects.toThrow(
      "Supabase URL and publishable key must be configured."
    );
    expect(mocks.getClaims).not.toHaveBeenCalled();
  });
});
