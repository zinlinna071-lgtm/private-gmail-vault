import { z } from "zod";

export const researchWorkflowStates = [
  "DRAFT",
  "TECHNICAL_REVIEW",
  "SECURITY_PRIVACY_REVIEW",
  "BILINGUAL_REVIEW",
  "OWNER_APPROVAL",
  "READY_TO_PUBLISH",
  "WITHDRAWN"
] as const;

export const reviewStages = [
  "technical",
  "securityPrivacy",
  "bilingual",
  "owner"
] as const;

const localized = z.object({
  en: z.string().trim().min(1).max(4000),
  my: z.string().trim().min(1).max(4000)
}).strict();

const section = z.object({
  heading: localized,
  body: localized
}).strict();

const evidence = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  kind: z.enum(["ci-run", "test-log", "sanitized-artifact", "measurement", "source-review"]),
  summary: localized,
  href: z.string().url().refine((value) => value.startsWith("https://")),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional()
}).strict();

export const researchDraftContentSchema = z.object({
  researchQuestion: localized,
  objective: localized,
  scope: z.object({
    authorizedAssets: z.array(z.string().trim().min(1).max(180)).min(1).max(20),
    exclusions: z.array(z.string().trim().min(1).max(180)).min(1).max(20)
  }).strict(),
  environment: z.object({
    kind: z.enum(["isolated-lab", "ci", "authorized-device"]),
    runtime: z.string().trim().min(1).max(160),
    harness: z.string().trim().min(1).max(160),
    dataClassification: z.enum(["synthetic", "sanitized", "non-production"])
  }).strict(),
  testRunId: z.string().regex(/^\\d{6,}$/),
  commit: z.string().regex(/^[a-f0-9]{40}$/i),
  result: z.enum(["pass", "fail", "blocked"]),
  evidence: z.array(evidence).min(1).max(40),
  findings: z.array(z.object({
    classification: z.enum(["confirmed", "observation", "hypothesis", "not-tested"]),
    severity: z.enum(["critical", "high", "medium", "low", "informational", "not-assessed"]),
    confidence: z.enum(["high", "medium", "low", "not-assessed"]),
    title: localized,
    details: localized,
    evidenceIds: z.array(z.string().min(1)).min(1)
  }).strict()).min(1).max(40),
  remediation: z.object({
    status: z.enum(["implemented", "planned", "not-required", "not-started"]),
    summary: localized,
    commit: z.string().regex(/^[a-f0-9]{40}$/i).optional()
  }).strict(),
  retest: z.object({
    status: z.enum(["passed", "failed", "blocked", "not-performed"]),
    testRunId: z.string().regex(/^\\d{6,}$/).optional(),
    commit: z.string().regex(/^[a-f0-9]{40}$/i).optional(),
    summary: localized
  }).strict(),
  limitations: localized,
  editions: z.object({
    en: z.object({ abstract: z.string().trim().min(1).max(8000), sections: z.array(section).min(1).max(30) }).strict(),
    my: z.object({ abstract: z.string().trim().min(1).max(8000), sections: z.array(section).min(1).max(30) }).strict()
  }).strict(),
  references: z.array(z.object({
    label: z.string().trim().min(1).max(180),
    href: z.string().url().refine((value) => value.startsWith("https://"))
  }).strict()).min(1).max(40)
}).strict().superRefine((value, context) => {
  const ids = new Set(value.evidence.map((item) => item.id));
  if (ids.size !== value.evidence.length) {
    context.addIssue({ code: "custom", path: ["evidence"], message: "Evidence identifiers must be unique." });
  }
  value.findings.forEach((finding, index) => {
    finding.evidenceIds.forEach((id) => {
      if (!ids.has(id)) context.addIssue({
        code: "custom", path: ["findings", index, "evidenceIds"],
        message: "Every finding must reference an existing evidence item."
      });
    });
  });
  if (value.retest.status === "passed" || value.retest.status === "failed") {
    if (!value.retest.testRunId || !value.retest.commit) context.addIssue({
      code: "custom", path: ["retest"], message: "A completed retest requires a run ID and exact commit."
    });
  }
  if (value.remediation.status === "implemented" && !value.remediation.commit) {
    context.addIssue({ code: "custom", path: ["remediation", "commit"], message: "Implemented remediation requires an exact commit." });
  }
});

export const createResearchDraftSchema = z.object({
  title: z.object({ en: z.string().trim().min(1).max(180), my: z.string().trim().min(1).max(240) }).strict(),
  category: z.string().trim().min(1).max(80),
  content: researchDraftContentSchema
}).strict();

export const reviewSubmissionSchema = z.object({
  draftId: z.string().uuid(),
  stage: z.enum(reviewStages),
  decision: z.enum(["approved", "changes-requested"]),
  notes: z.string().trim().min(4).max(2000)
}).strict();

export function hasPriorApprovalByActor(
  reviews: Record<string, unknown>,
  stages: readonly string[],
  actorId: string
) {
  return stages.some((stage) => {
    const history = reviews[stage];
    return Array.isArray(history) && history.some((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const record = entry as { decision?: unknown; reviewerUserId?: unknown };
      return record.decision === "approved" && record.reviewerUserId === actorId;
    });
  });
}

export function nextResearchWorkflowState(stage: typeof reviewStages[number]) {
  const next: Record<typeof reviewStages[number], typeof researchWorkflowStates[number]> = {
    technical: "SECURITY_PRIVACY_REVIEW",
    securityPrivacy: "BILINGUAL_REVIEW",
    bilingual: "OWNER_APPROVAL",
    owner: "READY_TO_PUBLISH"
  };
  return next[stage];
}

export function requiredStageForState(state: typeof researchWorkflowStates[number]) {
  const required: Partial<Record<typeof researchWorkflowStates[number], typeof reviewStages[number]>> = {
    TECHNICAL_REVIEW: "technical",
    SECURITY_PRIVACY_REVIEW: "securityPrivacy",
    BILINGUAL_REVIEW: "bilingual",
    OWNER_APPROVAL: "owner"
  };
  return required[state];
}
