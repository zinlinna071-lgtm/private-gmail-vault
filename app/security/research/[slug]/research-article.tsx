"use client";

import { useState } from "react";
import type { ResearchPublication, ResearchLanguage } from "@/lib/security-research/publications";

export function ResearchArticle({ publication }: { publication: ResearchPublication }) {
  const [language, setLanguage] = useState<ResearchLanguage>("en");
  const edition = publication.editions[language];
  const isBurmese = language === "my";

  return (
    <article className="research-article" lang={language}>
      <div className="research-article-toolbar">
        <span>{publication.publicationId} · v{publication.version}</span>
        <div className="research-language-switch" aria-label="Choose article language">
          <button type="button" aria-pressed={!isBurmese} onClick={() => setLanguage("en")}>English</button>
          <button type="button" aria-pressed={isBurmese} onClick={() => setLanguage("my")}>မြန်မာ</button>
        </div>
      </div>
      <p className="research-abstract-label">{isBurmese ? "အနှစ်ချုပ်" : "ABSTRACT"}</p>
      <p className="research-abstract">{edition.abstract}</p>
      <div className="research-provenance">
        <span><b>{isBurmese ? "စမ်းသပ်မှု" : "TEST RUN"}</b> #{publication.testRunId}</span>
        <span><b>COMMIT</b> <code>{publication.commit}</code></span>
        <span><b>{isBurmese ? "ထုတ်ဝေသည့်ရက်" : "PUBLISHED"}</b> {publication.publishedAt}</span>
      </div>
      {edition.sections.map((section, index) => (
        <section className="research-paper-section" key={section.heading}>
          <span className="section-index">{String(index + 1).padStart(2, "0")}</span>
          <div><h2>{section.heading}</h2><p>{section.body}</p></div>
        </section>
      ))}
      <section className="research-paper-section">
        <span className="section-index">REF</span>
        <div><h2>{isBurmese ? "ကိုးကားရင်းမြစ်များ" : "References"}</h2>
          <ul>{publication.references.map((reference) => <li key={reference.href}><a href={reference.href} target="_blank" rel="noreferrer">{reference.label}</a></li>)}</ul>
        </div>
      </section>
      <p className="research-disclaimer">{isBurmese ? "ဤစာတမ်း၏ ရလဒ်များသည် ဖော်ပြထားသော စမ်းသပ်မှုအတိုင်းအတာအတွင်းသာ အကျုံးဝင်သည်။ လုံခြုံရေးအသိအမှတ်ပြုလက်မှတ် မဟုတ်ပါ။" : "Results apply only to the stated test scope. This paper is not a security certification."}</p>
    </article>
  );
}
