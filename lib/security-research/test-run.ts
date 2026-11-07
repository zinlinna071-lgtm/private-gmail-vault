import { z } from "zod";

/**
 * Public security evidence contract.
 *
 * This validates metadata only; it does not prove that a test ran or that
 * evidence is authentic. The trusted ingestion layer must verify provenance
 * against the CI provider/private lab before constructing a public record.
 * Raw logs, request bodies, credentials, tokens, and key material are not
 * accepted by this strict schema.
 */
export const securityRunStateSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "BLOCKED",
  "NEEDS_REVIEW"
]);

export const securityRunOutcomeSchema = z.enum([
  "PASS",
  "FAIL",
  "BLOCKED",
  "NOT_RUN"
]);

export const securityRunCategorySchema = z.enum([
  "AUTHENTICATION",
  "SESSION",
  "CRYPTOGRAPHY",
  "AUTHORIZATION",
  "API",
  "BROWSER",
  "STORAGE",
  "RECOVERY",
  "SUPPLY_CHAIN",
  "OTHER"
]);

const httpsUrlSchema = z.string().url().refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "Evidence URLs must use HTTPS");

export const securityRunRecordSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().min(8).max(96).regex(/^[a-zA-Z0-9._:-]+$/),
  title: z.string().trim().min(4).max(140),
  category: securityRunCategorySchema,
  state: securityRunStateSchema,
  outcome: securityRunOutcomeSchema.optional(),
  source: z.enum(["GITHUB_ACTIONS", "PRIVATE_LAB"]),
  repository: z.string().regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/i),
  environment: z.string().trim().min(3).max(160),
  scope: z.string().trim().min(8).max(500),
  startedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).optional(),
  evidenceUrl: httpsUrlSchema,
  evidenceLabel: z.string().trim().min(3).max(100),
  publicSummary: z.string().trim().min(12).max(600),
  limitations: z.array(z.string().trim().min(8).max(240)).max(12),
  sanitized: z.literal(true),
  publication: z.enum(["PRIVATE", "PENDING_REVIEW", "APPROVED", "WITHDRAWN"])
}).strict().superRefine((record, context) => {
  const terminal = ["COMPLETED", "FAILED", "BLOCKED"].includes(record.state);
  if (terminal && !record.completedAt) {
    context.addIssue({
      code: "custom",
      path: ["completedAt"],
      message: "Terminal runs require a completion timestamp"
    });
  }
  if (!terminal && record.completedAt) {
    context.addIssue({
      code: "custom",
      path: ["completedAt"],
      message: "Non-terminal runs cannot have a completion timestamp"
    });
  }
  if (record.state === "COMPLETED" && !record.outcome) {
    context.addIssue({
      code: "custom",
      path: ["outcome"],
      message: "Completed runs require an outcome"
    });
  }
  if (record.state !== "COMPLETED" && record.outcome === "PASS") {
    context.addIssue({
      code: "custom",
      path: ["outcome"],
      message: "Only completed runs may report PASS"
    });
  }
  if (record.state === "FAILED" && record.outcome !== "FAIL") {
    context.addIssue({
      code: "custom",
      path: ["outcome"],
      message: "Failed runs must report FAIL"
    });
  }
  if (record.state === "BLOCKED" && record.outcome !== "BLOCKED") {
    context.addIssue({
      code: "custom",
      path: ["outcome"],
      message: "Blocked runs must report BLOCKED"
    });
  }
  if (record.completedAt && Date.parse(record.completedAt) < Date.parse(record.startedAt)) {
    context.addIssue({
      code: "custom",
      path: ["completedAt"],
      message: "Completion cannot precede the start time"
    });
  }
});

export type SecurityRunRecord = z.infer<typeof securityRunRecordSchema>;

/**
 * Public projection gate. A valid record remains private unless it is
 * terminal, explicitly sanitized, and owner-approved. This function does
 * not perform provenance verification or redact raw evidence.
 */
export function toPublicSecurityRun(input: unknown): SecurityRunRecord | null {
  const parsed = securityRunRecordSchema.safeParse(input);
  if (!parsed.success) return null;

  const record = parsed.data;
  const terminal = ["COMPLETED", "FAILED", "BLOCKED"].includes(record.state);
  if (!terminal || !record.completedAt || record.publication !== "APPROVED") {
    return null;
  }
  return record;
}
