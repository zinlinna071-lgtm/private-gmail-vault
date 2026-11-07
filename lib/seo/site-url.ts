/**
 * Canonical public origin for search metadata and sitemap generation.
 * Configure NEXT_PUBLIC_SITE_URL for a custom domain, or let Vercel provide
 * VERCEL_PROJECT_PRODUCTION_URL. Preview deployment URLs are never used.
 */
export function getPublicSiteUrl(): URL | undefined {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const candidate = configured || (vercelProductionHost ? `https://${vercelProductionHost}` : undefined);
  if (!candidate) return undefined;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return undefined;
    return url;
  } catch {
    return undefined;
  }
}
