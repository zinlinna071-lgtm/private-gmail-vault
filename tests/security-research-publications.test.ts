import { describe, expect, it } from "vitest";
import {
  researchPublicationSchema,
  researchRegistrySchema
} from "../lib/security-research/publications";

const commit = "a".repeat(40);

function validPaper() {
  return {
    slug: "argon2id-browser-validation",
    publicationId: "PAV-SEC-2026-001",
    version: "1.0.0",
    publishedAt: "2026-11-07",
    category: "Cryptography",
    title: {
      en: "Browser validation of Argon2id",
      my: "Browser ပေါ်တွင် Argon2id ကို စမ်းသပ်အတည်ပြုခြင်း"
    },
    summary: {
      en: "A reproducible compatibility study.",
      my: "ပြန်လည်စမ်းသပ်နိုင်သော ကိုက်ညီမှုလေ့လာချက်။"
    },
    researchQuestion: {
      en: "Does the implementation match the published test vector?",
      my: "Implementation သည် ထုတ်ပြန်ထားသော Test Vector နှင့် ကိုက်ညီသလား။"
    },
    objective: {
      en: "Verify compatibility in controlled environments.",
      my: "ထိန်းချုပ်ထားသော ပတ်ဝန်းကျင်တွင် ကိုက်ညီမှုကို စစ်ဆေးရန်။"
    },
    scope: {
      authorizedAssets: ["Repository-owned Argon2id test harness"],
      exclusions: ["Production accounts", "Third-party systems"]
    },
    environment: {
      kind: "ci",
      runtime: "GitHub-hosted Linux",
      harness: "Node.js test harness v1",
      dataClassification: "synthetic"
    },
    testRunId: "42281411743",
    commit,
    result: "pass",
    evidence: [{
      id: "rfc-vector-run",
      kind: "ci-run",
      summary: {
        en: "Hosted CI record for the named compatibility checks.",
        my: "သတ်မှတ်ထားသော ကိုက်ညီမှုစစ်ဆေးမှုများ၏ CI မှတ်တမ်း။"
      },
      href: "https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42281411743"
    }],
    findings: [{
      classification: "confirmed",
      severity: "informational",
      confidence: "high",
      title: {
        en: "Published vector matched",
        my: "ထုတ်ပြန်ထားသော Vector နှင့် ကိုက်ညီမှုရှိသည်"
      },
      details: {
        en: "The candidate matched the named RFC vector in this test scope.",
        my: "ဤစမ်းသပ်မှုအတိုင်းအတာအတွင်း Candidate သည် သတ်မှတ်ထားသော RFC Vector နှင့် ကိုက်ညီခဲ့သည်။"
      },
      evidenceIds: ["rfc-vector-run"]
    }],
    remediation: {
      status: "not-required",
      summary: {
        en: "No remediation was required for this compatibility check.",
        my: "ဤကိုက်ညီမှုစစ်ဆေးမှုအတွက် ပြုပြင်ရန် မလိုအပ်ခဲ့ပါ။"
      }
    },
    retest: {
      status: "not-performed",
      summary: {
        en: "No separate retest is claimed.",
        my: "သီးခြားပြန်လည်စမ်းသပ်မှု ပြုလုပ်ထားကြောင်း မဆိုထားပါ။"
      }
    },
    limitations: {
      en: "This does not establish end-to-end Vault security.",
      my: "ဤစမ်းသပ်မှုတစ်ခုတည်းဖြင့် Vault တစ်ခုလုံး၏ လုံခြုံမှုကို အတည်မပြုနိုင်ပါ။"
    },
    review: {
      technical: { approvedAt: "2026-11-07" },
      securityPrivacy: { approvedAt: "2026-11-07" },
      bilingual: { approvedAt: "2026-11-07" },
      owner: { approvedAt: "2026-11-07" }
    },
    status: "published" as const,
    editions: {
      en: {
        abstract: "A complete English abstract.",
        sections: [{ heading: "Method", body: "A reproducible test method." }]
      },
      my: {
        abstract: "မြန်မာဘာသာ အနှစ်ချုပ် အပြည့်အစုံ။",
        sections: [{ heading: "စမ်းသပ်နည်း", body: "ပြန်လည်စမ်းသပ်နိုင်သော နည်းလမ်း။" }]
      }
    },
    references: [{ label: "RFC 9106", href: "https://www.rfc-editor.org/rfc/rfc9106" }]
  };
}

describe("public research publication registry", () => {
  it("accepts a complete bilingual paper with provenance and all approval gates", () => {
    expect(researchPublicationSchema.parse(validPaper())).toEqual(validPaper());
  });

  it("rejects a draft or any status other than published", () => {
    expect(() => researchPublicationSchema.parse({ ...validPaper(), status: "draft" })).toThrow();
  });

  it("requires complete English and Burmese editions", () => {
    const paper = validPaper();
    expect(() => researchPublicationSchema.parse({
      ...paper,
      editions: { ...paper.editions, my: { abstract: "", sections: [] } }
    })).toThrow();
  });

  it("requires an isolated or otherwise explicitly classified test environment and scope", () => {
    const paper = validPaper();
    expect(() => researchPublicationSchema.parse({
      ...paper,
      environment: { ...paper.environment, dataClassification: "real-production" }
    })).toThrow();
    expect(() => researchPublicationSchema.parse({
      ...paper,
      scope: { ...paper.scope, exclusions: [] }
    })).toThrow();
  });

  it("rejects findings that point to missing evidence", () => {
    const paper = validPaper();
    expect(() => researchPublicationSchema.parse({
      ...paper,
      findings: [{ ...paper.findings[0], evidenceIds: ["missing-evidence"] }]
    })).toThrow();
  });

  it("requires exact provenance for a completed retest", () => {
    const paper = validPaper();
    expect(() => researchPublicationSchema.parse({
      ...paper,
      retest: { status: "passed", summary: paper.retest.summary }
    })).toThrow();
  });

  it("requires a commit for remediation marked implemented", () => {
    const paper = validPaper();
    expect(() => researchPublicationSchema.parse({
      ...paper,
      remediation: { ...paper.remediation, status: "implemented" }
    })).toThrow();
  });

  it("rejects non-HTTPS references and evidence links", () => {
    const paper = validPaper();
    expect(() => researchPublicationSchema.parse({
      ...paper,
      references: [{ label: "Unsafe", href: "http://example.com/paper" }]
    })).toThrow();
    expect(() => researchPublicationSchema.parse({
      ...paper,
      evidence: [{ ...paper.evidence[0], href: "http://example.com/run" }]
    })).toThrow();
  });

  it("rejects malformed provenance and impossible dates", () => {
    const paper = validPaper();
    expect(() => researchPublicationSchema.parse({ ...paper, commit: "abc" })).toThrow();
    expect(() => researchPublicationSchema.parse({ ...paper, testRunId: "run-123" })).toThrow();
    expect(() => researchPublicationSchema.parse({ ...paper, publishedAt: "2026-99-99" })).toThrow();
  });

  it("rejects unknown fields instead of silently publishing them", () => {
    expect(() => researchPublicationSchema.parse({ ...validPaper(), internalNote: "private" })).toThrow();
  });

  it("rejects duplicate evidence IDs, slugs, and publication IDs", () => {
    const paper = validPaper();
    expect(() => researchPublicationSchema.parse({
      ...paper,
      evidence: [paper.evidence[0], paper.evidence[0]]
    })).toThrow();
    expect(() => researchRegistrySchema.parse([paper, { ...paper, publicationId: "PAV-SEC-2026-002" }])).toThrow();
    expect(() => researchRegistrySchema.parse([paper, { ...paper, slug: "another-paper" }])).toThrow();
  });

  it("keeps the public registry empty until a fully approved paper exists", () => {
    expect(researchRegistrySchema.parse([])).toEqual([]);
  });
});
