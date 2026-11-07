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

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Date must be a real calendar date");

const commitSha = z.string().regex(/^[a-f0-9]{40}$/i);
const secureUrl = z.string().url().refine((value) => value.startsWith("https://"), "Links must use HTTPS");

const evidenceSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  kind: z.enum(["ci-run", "test-log", "sanitized-artifact", "measurement", "source-review"]),
  summary: localizedText,
  href: secureUrl,
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional()
}).strict();

const findingSchema = z.object({
  classification: z.enum(["confirmed", "observation", "hypothesis", "not-tested"]),
  severity: z.enum(["critical", "high", "medium", "low", "informational", "not-assessed"]),
  confidence: z.enum(["high", "medium", "low", "not-assessed"]),
  title: localizedText,
  details: localizedText,
  evidenceIds: z.array(z.string().min(1)).min(1)
}).strict();

const approvalSchema = z.object({
  approvedAt: calendarDate
}).strict();

export const researchPublicationSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  publicationId: z.string().regex(/^PAV-SEC-\d{4}-\d{3}$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  publishedAt: calendarDate,
  category: z.string().trim().min(1),
  title: localizedText,
  summary: localizedText,
  researchQuestion: localizedText,
  objective: localizedText,
  scope: z.object({
    authorizedAssets: z.array(z.string().trim().min(1)).min(1),
    exclusions: z.array(z.string().trim().min(1)).min(1)
  }).strict(),
  environment: z.object({
    kind: z.enum(["isolated-lab", "ci", "authorized-device"]),
    runtime: z.string().trim().min(1),
    harness: z.string().trim().min(1),
    dataClassification: z.enum(["synthetic", "sanitized", "non-production"])
  }).strict(),
  testRunId: z.string().regex(/^\d{6,}$/),
  commit: commitSha,
  result: z.enum(["pass", "fail", "blocked", "not-run"]),
  evidence: z.array(evidenceSchema).min(1),
  findings: z.array(findingSchema).min(1),
  remediation: z.object({
    status: z.enum(["implemented", "planned", "not-required", "not-started"]),
    summary: localizedText,
    commit: commitSha.optional()
  }).strict(),
  retest: z.object({
    status: z.enum(["passed", "failed", "blocked", "not-performed"]),
    testRunId: z.string().regex(/^\d{6,}$/).optional(),
    commit: commitSha.optional(),
    summary: localizedText
  }).strict(),
  limitations: localizedText,
  review: z.object({
    technical: approvalSchema,
    securityPrivacy: approvalSchema,
    bilingual: approvalSchema,
    owner: approvalSchema
  }).strict(),
  status: z.literal("published"),
  editions: z.object({
    en: editionSchema,
    my: editionSchema
  }).strict(),
  references: z.array(z.object({
    label: z.string().trim().min(1),
    href: secureUrl
  }).strict()).min(1)
}).strict().superRefine((paper, context) => {
  const evidenceIds = new Set<string>();
  paper.evidence.forEach((item, index) => {
    if (evidenceIds.has(item.id)) {
      context.addIssue({ code: "custom", path: ["evidence", index, "id"], message: "Evidence IDs must be unique" });
    }
    evidenceIds.add(item.id);
  });

  paper.findings.forEach((finding, index) => {
    if (finding.evidenceIds.length === 0) {
      context.addIssue({ code: "custom", path: ["findings", index, "evidenceIds"], message: "Every finding must cite at least one evidence item" });
    }
    finding.evidenceIds.forEach((id) => {
      if (!evidenceIds.has(id)) {
        context.addIssue({ code: "custom", path: ["findings", index, "evidenceIds"], message: `Unknown evidence reference: ${id}` });
      }
    });
  });

  if (paper.retest.status === "passed" || paper.retest.status === "failed") {
    if (!paper.retest.testRunId || !paper.retest.commit) {
      context.addIssue({ code: "custom", path: ["retest"], message: "A completed retest requires its run ID and exact commit" });
    }
  }

  if (paper.remediation.status === "implemented" && !paper.remediation.commit) {
    context.addIssue({ code: "custom", path: ["remediation", "commit"], message: "Implemented remediation requires an exact commit" });
  }
});

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
 * Parsing at module load means malformed metadata, unsafe links, duplicate IDs,
 * missing evidence provenance, incomplete approvals, or non-published statuses
 * fail the build rather than leak.
 */
export const publishedResearch: ResearchPublication[] = researchRegistrySchema.parse([]);
