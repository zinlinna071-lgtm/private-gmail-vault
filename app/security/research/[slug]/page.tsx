import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { publishedResearch } from "@/lib/security-research/publications";
import { ResearchArticle } from "./research-article";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return publishedResearch.map((paper) => ({ slug: paper.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const paper = publishedResearch.find((item) => item.slug === slug);
  if (!paper) return { title: "Research paper not found | Private Account Vault" };
  return {
    title: `${paper.title.en} | Security Research`,
    description: paper.summary.en
  };
}

export default async function ResearchPaperPage({ params }: Props) {
  const { slug } = await params;
  const paper = publishedResearch.find((item) => item.slug === slug);
  if (!paper || paper.status !== "published") notFound();

  return (
    <main className="security-shell">
      <header className="security-nav">
        <Link className="security-brand" href="/security/research">
          <span className="security-brand-mark">V</span>
          <span>PRIVATE ACCOUNT VAULT <small>RESEARCH PUBLICATION</small></span>
        </Link>
        <Link href="/security/research">← Research Library</Link>
      </header>
      <section className="security-hero research-paper-hero">
        <div className="security-kicker">{paper.category} · {paper.publicationId}</div>
        <h1>{paper.title.en}</h1>
        <p className="security-lead">{paper.summary.en}</p>
        <p className="security-lead" lang="my">{paper.title.my} — {paper.summary.my}</p>
        <div className="security-hero-meta">
          <span><b>VERSION</b> {paper.version}</span>
          <span><b>LANGUAGES</b> EN · MY</span>
          <span><b>STATUS</b> PUBLISHED</span>
        </div>
      </section>
      <ResearchArticle publication={paper} />
      <footer className="security-footer">
        <div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT</strong></div>
        <p>Evidence-backed research for public learning.</p>
        <Link href="/security/research">Back to Research Library ↗</Link>
      </footer>
    </main>
  );
}
