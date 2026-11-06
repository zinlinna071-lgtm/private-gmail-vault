import { describe, expect, it } from "vitest";
import {
  researchPublicationSchema,
  researchRegistrySchema
} from "../lib/security-research/publications";

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
    testRunId: "42281411743",
    commit: "a".repeat(40),
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
  it("accepts a complete bilingual, evidence-linked publication", () => {
    expect(researchPublicationSchema.parse(validPaper())).toEqual(validPaper());
  });

  it("rejects a draft or any status other than published", () => {
    expect(() => researchPublicationSchema.parse({ ...validPaper(), status: "draft" })).toThrow();
  });

  it("requires English and Burmese editions with at least one section", () => {
    const paper = validPaper();
    expect(() => researchPublicationSchema.parse({
      ...paper,
      editions: { ...paper.editions, my: { abstract: "", sections: [] } }
    })).toThrow();
  });

  it("rejects non-HTTPS references", () => {
    const paper = validPaper();
    expect(() => researchPublicationSchema.parse({
      ...paper,
      references: [{ label: "Unsafe", href: "http://example.com/paper" }]
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

  it("rejects duplicate slugs and publication IDs", () => {
    const paper = validPaper();
    expect(() => researchRegistrySchema.parse([paper, { ...paper, publicationId: "PAV-SEC-2026-002" }])).toThrow();
    expect(() => researchRegistrySchema.parse([paper, { ...paper, slug: "another-paper" }])).toThrow();
  });

  it("keeps the public registry empty until a paper is approved", () => {
    expect(researchRegistrySchema.parse([])).toEqual([]);
  });
});
