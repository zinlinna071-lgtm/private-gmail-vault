import type { MetadataRoute } from "next";
import { publishedResearch } from "@/lib/security-research/publications";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicSiteUrl();
  // Do not emit preview or guessed canonical URLs. Configure the production
  // origin before submitting this sitemap to Google Search Console.
  if (!siteUrl) return [];

  const publicPages: MetadataRoute.Sitemap = [
    { url: new URL("/security", siteUrl).toString(), changeFrequency: "weekly", priority: 1.0 },
    { url: new URL("/security/research", siteUrl).toString(), changeFrequency: "weekly", priority: 0.9 },
    { url: new URL("/support", siteUrl).toString(), changeFrequency: "monthly", priority: 0.6 }
  ];

  const publishedPapers: MetadataRoute.Sitemap = publishedResearch
    .filter((paper) => paper.status === "published")
    .map((paper) => ({
      url: new URL(`/security/research/${encodeURIComponent(paper.slug)}`, siteUrl).toString(),
      changeFrequency: "yearly",
      priority: 0.8
    }));

  return [...publicPages, ...publishedPapers];
}
