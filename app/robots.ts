import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl();
  return {
    rules: {
      userAgent: "*",
      // Keep the root login page crawlable so Google can observe its noindex
      // metadata. Public research pages remain indexable; API routes are not.
      allow: ["/"],
      disallow: ["/api/"]
    },
    ...(siteUrl ? { sitemap: new URL("/sitemap.xml", siteUrl).toString() } : {})
  };
}
