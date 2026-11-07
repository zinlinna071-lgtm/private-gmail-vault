import { describe, expect, it } from "vitest";
import {
  createResearchDraftSchema,
  hasPriorApprovalByActor,
  nextResearchWorkflowState,
  researchDraftContentSchema,
  reviewSubmissionSchema
} from "../lib/security-research/workflow";

const commit = "b".repeat(40);
const localized = { en: "A verified statement.", my: "အတည်ပြုထားသော အချက်အလက်။" };

function content() {
  return {
    researchQuestion: localized,
    objective: localized,
    scope: { authorizedAssets: ["Owner-controlled isolated test harness"], exclusions: ["Third-party systems"] },
    environment: { kind: "isolated-lab", runtime: "Node.js 22", harness: "Vault test harness", dataClassification: "synthetic" },
    testRunId: "42326674300",
    commit,
    result: "pass",
    evidence: [{ id: "ci-proof", kind: "ci-run", summary: localized, href: "https://github.com/owner/repo/actions/runs/42326674300" }],
    findings: [{ classification: "confirmed", severity: "informational", confidence: "high", title: localized, details: localized, evidenceIds: ["ci-proof"] }],
    remediation: { status: "not-required", summary: localized },
    retest: { status: "not-performed", summary: localized },
    limitations: localized,
    editions: {
      en: { abstract: "A substantive English abstract.", sections: [{ heading: localized, body: localized }] },
      my: { abstract: "မြန်မာဘာသာ အနှစ်ချုပ်။", sections: [{ heading: localized, body: localized }] }
    },
    references: [{ label: "Example standard", href: "https://www.rfc-editor.org/" }]
  };
}

describe("private research workflow", () => {
  it("accepts a complete bilingual draft with evidence provenance", () => {
    expect(researchDraftContentSchema.parse(content())).toEqual(content());
  });

  it("accepts numeric CI run IDs and rejects malformed run IDs", () => {
    const value = content();
    value.testRunId = "42326674300";
    expect(researchDraftContentSchema.safeParse(value).success).toBe(true);
    value.testRunId = "run-42326674300";
    expect(researchDraftContentSchema.safeParse(value).success).toBe(false);
  });

  it("rejects evidence references that do not exist", () => {
    const value = content();
    value.findings[0].evidenceIds = ["not-present"];
    expect(() => researchDraftContentSchema.parse(value)).toThrow();
  });

  it("rejects non-HTTPS evidence and references", () => {
    const value = content();
    value.evidence[0].href = "http://example.com/run";
    expect(() => researchDraftContentSchema.parse(value)).toThrow();
  });

  it("requires a run identifier and commit for completed retests", () => {
    const value = content();
    value.retest = { status: "passed", summary: localized };
    expect(() => researchDraftContentSchema.parse(value)).toThrow();
  });

  it("requires an exact commit for implemented remediation", () => {
    const value = content();
    value.remediation = { status: "implemented", summary: localized };
    expect(() => researchDraftContentSchema.parse(value)).toThrow();
  });

  it("requires substantive English and Burmese editions", () => {
    const value = content();
    value.editions.my.sections = [];
    expect(() => researchDraftContentSchema.parse(value)).toThrow();
  });

  it("rejects duplicate evidence identifiers", () => {
    const value = content();
    value.evidence.push({ ...value.evidence[0] });
    expect(() => researchDraftContentSchema.parse(value)).toThrow();
  });

  it("validates draft metadata and rejects unexpected fields", () => {
    const draft = { title: { en: "A research paper", my: "သုတေသနစာတမ်း" }, category: "Authentication", content: content() };
    expect(createResearchDraftSchema.parse(draft)).toEqual(draft);
    expect(() => createResearchDraftSchema.parse({ ...draft, isPublished: true })).toThrow();
  });

  it("requires review decisions to include meaningful notes", () => {
    expect(reviewSubmissionSchema.safeParse({
      draftId: "d8c87e34-4f4d-4c5f-9a91-2fbd1f7a0f11",
      stage: "technical", decision: "approved", notes: "Verified test methodology and evidence."
    }).success).toBe(true);
    expect(reviewSubmissionSchema.safeParse({
      draftId: "d8c87e34-4f4d-4c5f-9a91-2fbd1f7a0f11",
      stage: "technical", decision: "approved", notes: "ok"
    }).success).toBe(false);
  });

  it("advances only to the next sequential approval gate", () => {
    expect(nextResearchWorkflowState("technical")).toBe("SECURITY_PRIVACY_REVIEW");
    expect(nextResearchWorkflowState("securityPrivacy")).toBe("BILINGUAL_REVIEW");
    expect(nextResearchWorkflowState("bilingual")).toBe("OWNER_APPROVAL");
    expect(nextResearchWorkflowState("owner")).toBe("READY_TO_PUBLISH");
  });

  it("prevents the same reviewer account from approving multiple stages", () => {
    const reviews = {
      technical: [{ decision: "approved", reviewerUserId: "reviewer-a" }],
      securityPrivacy: [{ decision: "changes-requested", reviewerUserId: "reviewer-b" }]
    };
    expect(hasPriorApprovalByActor(reviews, ["technical"], "reviewer-a")).toBe(true);
    expect(hasPriorApprovalByActor(reviews, ["technical"], "reviewer-b")).toBe(false);
  });

  it("requires final owner approval to be independent of reviewer approvals", () => {
    const reviews = {
      technical: [{ decision: "approved", reviewerUserId: "owner-a" }],
      securityPrivacy: [{ decision: "approved", reviewerUserId: "reviewer-b" }],
      bilingual: [{ decision: "approved", reviewerUserId: "reviewer-c" }]
    };
    expect(hasPriorApprovalByActor(reviews, ["technical", "securityPrivacy", "bilingual"], "owner-a")).toBe(true);
    expect(hasPriorApprovalByActor(reviews, ["technical", "securityPrivacy", "bilingual"], "owner-z")).toBe(false);
  });
});
