import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase URL and publishable key must be configured.");
  }

  const createResponse = () => {
    const nextResponse = NextResponse.next({ request });
    // Vault responses can contain account metadata or refreshed auth cookies.
    // Never allow a shared cache to reuse them across visitors.
    nextResponse.headers.set("Cache-Control", "private, no-store");
    nextResponse.headers.set("Pragma", "no-cache");
    return nextResponse;
  };

  let response = createResponse();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Keep the refreshed session visible to downstream Server Components
        // and Route Handlers during this same request.
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        // Persist the rotated session in the browser for the next request.
        response = createResponse();
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  // Verify the JWT and refresh it when it is close to expiry. Never use
  // getSession() here: it only reads cookie state and does not verify claims.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // Public research, SEO, and support pages do not use Supabase Auth.
  // Limit refresh work to the private Vault UI and its authenticated API.
  matcher: ["/vault/:path*", "/api/vault/:path*"]
};
