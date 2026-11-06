# Google Search Readiness

**Status:** Technical SEO foundation in code; production indexing not yet submitted or verified.

## Public pages intended for search

- `/security` — public security operations, test scope, verified evidence, limitations.
- `/security/research` — bilingual research library and publication standards.
- `/security/research/{published-slug}` — only owner-approved published papers.
- `/support` — personal research-fund disclosure and verified accounting status.

The Vault entry page is an authentication gateway and must remain `noindex`. API routes and private lab surfaces must never be exposed as public search content. Search visibility is not access control: private routes and data must remain protected by authentication and server-side authorization.

## Implemented in this branch

- Unique page titles and descriptions on public pages.
- Canonical metadata base sourced only from `NEXT_PUBLIC_SITE_URL` or Vercel's `VERCEL_PROJECT_PRODUCTION_URL`; preview deployment URLs are not used.
- `robots.txt` allows only public security and support sections and disallows the root entry route and API path.
- XML sitemap contains only the public security, research, support, and validated published-paper URLs.
- The root Vault entry page is marked `noindex, nofollow`.
- Sitemap generation returns an empty list rather than guessing a canonical domain when no production origin is configured.

## Before production launch

1. Confirm the exact public production domain and set `NEXT_PUBLIC_SITE_URL=https://YOUR-PRODUCTION-DOMAIN` in Vercel Production environment variables. Do not set it to a preview URL.
2. Verify that the production deployment is publicly accessible without Vercel authentication for the public routes.
3. Open `/robots.txt` and `/sitemap.xml` on the production domain and confirm the sitemap contains only the intended public URLs.
4. Create/verify the property in Google Search Console using DNS ownership verification where possible.
5. Submit the sitemap in Search Console.
6. Use URL Inspection for `/security`, `/security/research`, and `/support`; confirm Google can fetch and render the visible content and sees the intended canonical URL.
7. Request indexing for the important public pages after the production deployment is live.
8. Recheck Page Indexing and sitemap reports for crawl errors, accidental noindex, duplicate/canonical issues, and blocked resources.
9. When a research paper is approved and published, ensure it appears in the registry, sitemap, and research-library links. Drafts must never enter the public registry.

## Content and trust requirements

- Publish original, useful research with clear objectives, authorized scope, methodology, environment, evidence provenance, findings, remediation, retest, limitations, and references.
- Clearly distinguish confirmed findings from observations and hypotheses.
- Never claim independent certification, an external audit, zero-knowledge encryption, or an unhackable system unless independently established by appropriate evidence.
- Do not manufacture live attack activity, test results, author credentials, reviewer identities, donor figures, or publication dates.
- Keep English and Burmese editions aligned under one publication ID and version.
- Use descriptive internal links and readable page headings; do not stuff keywords or create thin pages solely for search traffic.

## Search topic direction

Use natural phrases that accurately describe the actual content, such as:

- cybersecurity research lab
- vault authentication security testing
- account vault encryption architecture
- application security testing methodology
- Myanmar cybersecurity research
- Burmese cybersecurity education

The words should appear only where they naturally describe the page. Search ranking is not guaranteed and can take time; indexing and ranking must be checked in Search Console after launch.

## Important Google indexing distinction

`robots.txt` controls crawler access; it is not a confidentiality mechanism and does not reliably remove a URL from search results. Sensitive content must be password-protected or otherwise access-controlled. Use `noindex` on accessible pages that should not appear in results, and do not rely on robots blocking to protect secrets.
