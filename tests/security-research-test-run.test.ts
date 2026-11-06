import { describe, expect, it } from "vitest";
import {
  securityRunRecordSchema,
  toPublicSecurityRun,
  type SecurityRunRecord
} from "../lib/security-research/test-run";

const approvedRun: SecurityRunRecord = {
  schemaVersion: 1,
  runId: "ci-auth-boundary-0001",
  title: "Synthetic login boundary regression checks",
  category: "AUTHENTICATION",
  state: "COMPLETED",
  outcome: "PASS",
  source: "GITHUB_ACTIONS",
  repository: "owner/repository",
  commitSha: "a".repeat(40),
  environment: "GitHub-hosted Ubuntu runner · Node.js 20",
  scope: "Local route tests with synthetic identities and mocked provider responses",
  startedAt: "2026-11-07T01:00:00Z",
  completedAt: "2026-11-07T01:02:00Z",
  evidenceUrl: "https://github.com/owner/repository/actions/runs/123456789",
  evidenceLabel: "Original CI workflow run",
  publicSummary: "The named synthetic login boundary checks completed successfully.",
  limitations: ["This does not test live provider authentication or production sessions."],
  sanitized: true,
  publication: "APPROVED"
};

describe("security test run publication contract", () => {
  it("accepts a complete, well-formed evidence record", () => {
    expect(securityRunRecordSchema.safeParse(approvedRun).success).toBe(true);
  });

  it("publishes only terminal, explicitly approved and sanitized records", () => {
    expect(toPublicSecurityRun(approvedRun)).toEqual(approvedRun);
    expect(toPublicSecurityRun({ ...approvedRun, publication: "PENDING_REVIEW" })).toBeNull();
    expect(toPublicSecurityRun({ ...approvedRun, sanitized: false })).toBeNull();
    expect(toPublicSecurityRun({ ...approvedRun, state: "RUNNING", outcome: undefined, completedAt: undefined })).toBeNull();
  });

  it("rejects unknown properties so secrets and raw payloads cannot enter the public contract", () => {
    expect(securityRunRecordSchema.safeParse({
      ...approvedRun,
      password: "synthetic-secret"
    }).success).toBe(false);
    expect(securityRunRecordSchema.safeParse({
      ...approvedRun,
      rawRequestBody: "{ credentials: ... }"
    }).success).toBe(false);
  });

  it("requires completion timestamps and outcomes for terminal states", () => {
    expect(securityRunRecordSchema.safeParse({
      ...approvedRun,
      completedAt: undefined
    }).success).toBe(false);
    expect(securityRunRecordSchema.safeParse({
      ...approvedRun,
      outcome: undefined
    }).success).toBe(false);
  });

  it("does not allow a PASS result on a failed, blocked, or running run", () => {
    expect(securityRunRecordSchema.safeParse({
      ...approvedRun,
      state: "FAILED",
      outcome: "PASS"
    }).success).toBe(false);
    expect(securityRunRecordSchema.safeParse({
      ...approvedRun,
      state: "RUNNING",
      completedAt: undefined
    }).success).toBe(false);
  });

  it("rejects non-HTTPS evidence and completion timestamps before start", () => {
    expect(securityRunRecordSchema.safeParse({
      ...approvedRun,
      evidenceUrl: "http://github.com/owner/repository/actions/runs/123456789"
    }).success).toBe(false);
    expect(securityRunRecordSchema.safeParse({
      ...approvedRun,
      completedAt: "2026-11-06T23:59:00Z"
    }).success).toBe(false);
  });

  it("keeps private and pending-review records out of the public projection", () => {
    expect(toPublicSecurityRun({ ...approvedRun, publication: "PRIVATE" })).toBeNull();
    expect(toPublicSecurityRun({ ...approvedRun, publication: "PENDING_REVIEW" })).toBeNull();
    expect(toPublicSecurityRun({ ...approvedRun, publication: "WITHDRAWN" })).toBeNull();
  });
});
