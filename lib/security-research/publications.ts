import { z } from "zod";

/**
 * Runtime-validated public research registry.
 *
 * Only owner-approved, reviewed publications belong here.
 * Drafts and raw test evidence must remain in the private lab.
 */
const localizedText = z.object({
  en: z.string().trim().min(1),
  my: z.string().trim().min(1)
}).strict();

const editionSchema = z.object({
  abstract: z.string().trim().min(1),
  sections: z.array(z.object({
    heading: z.string().trim().min(1),
    body: z.string().trim().min(1)
  }).strict()).min(1)
}).strict();

export const researchPublicationSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  publicationId: z.string().regex(/^PAV-SEC-\d{4}-\d{3}$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().trim().min(1),
  title: localizedText,
  summary: localizedText,
  testRunId: z.string().regex(/^\d{6,}$/),
  commit: z.string().regex(/^[a-f0-9]{40}$/i),
  status: z.literal("published"),
  editions: z.object({
    en: editionSchema,
    my: editionSchema
  }).strict(),
  references: z.array(z.object({
    label: z.string().trim().min(1),
    href: z.string().url().refine((value) => value.startsWith("https://"), "References must use HTTPS")
  }).strict()).min(1)
}).strict();

export const researchRegistrySchema = z.array(researchPublicationSchema).superRefine((papers, context) => {
  const slugs = new Set<string>();
  const publicationIds = new Set<string>();

  papers.forEach((paper, index) => {
    if (slugs.has(paper.slug)) {
      context.addIssue({ code: "custom", path: [index, "slug"], message: "Publication slugs must be unique" });
    }
    if (publicationIds.has(paper.publicationId)) {
      context.addIssue({ code: "custom", path: [index, "publicationId"], message: "Publication IDs must be unique" });
    }
    slugs.add(paper.slug);
    publicationIds.add(paper.publicationId);
  });
});

export type ResearchLanguage = "en" | "my";
export type ResearchPublication = z.infer<typeof researchPublicationSchema>;

/**
 * Intentionally empty until a complete paper passes technical review,
 * security/privacy review, bilingual review, and explicit owner approval.
 *
 * Parsing at module load means malformed metadata, unsafe reference URLs,
 * duplicate IDs, or non-published statuses fail the build rather than leak.
 */
export const publishedResearch: ResearchPublication[] = researchRegistrySchema.parse([]);
