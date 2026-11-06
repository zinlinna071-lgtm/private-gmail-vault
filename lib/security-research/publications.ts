/**
 * Public research registry.
 *
 * Only owner-approved, reviewed publications belong here.
 * Drafts and raw test evidence must remain in the private lab.
 */
export type ResearchLanguage = "en" | "my";

export type ResearchPublication = {
  slug: string;
  publicationId: string;
  version: string;
  publishedAt: string;
  category: string;
  title: Record<ResearchLanguage, string>;
  summary: Record<ResearchLanguage, string>;
  testRunId: string;
  commit: string;
  status: "published";
  editions: {
    en: {
      abstract: string;
      sections: Array<{ heading: string; body: string }>;
    };
    my: {
      abstract: string;
      sections: Array<{ heading: string; body: string }>;
    };
  };
  references: Array<{ label: string; href: string }>;
};

/**
 * Intentionally empty until a complete paper passes technical review,
 * security/privacy review, bilingual review, and explicit owner approval.
 */
export const publishedResearch: ResearchPublication[] = [];
