import type { Metadata } from "next";
import Link from "next/link";
import { getResearchActor } from "@/lib/security-research/workflow-auth";
import { ResearchWorkbench } from "./research-workbench";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private Research Workbench | Private Account Vault",
  robots: { index: false, follow: false },
  description: "Private authoring and staged review workspace for security research."
};

export default async function ResearchWorkbenchPage() {
  const actor = await getResearchActor();
  return (
    <main className="security-shell">
      <header className="security-nav">
        <Link className="security-brand" href="/security/research">
          <span className="security-brand-mark">V</span>
          <span>PRIVATE ACCOUNT VAULT <small>PRIVATE RESEARCH WORKBENCH</small></span>
        </Link>
        <Link href="/security/research">Public Research Library ↗</Link>
      </header>
      <section className="security-hero">
        <div className="security-kicker">PRIVATE AUTHORING · REVIEW CONTROL</div>
        <h1>Research deserves<br /><em>evidence before release.</em></h1>
        <p className="security-lead">Draft, revise, and route a bilingual paper through independent technical, security/privacy, and language review before final owner approval.</p>
        <p className="security-lead" lang="my">သုတေသနစာတမ်းတစ်စောင်ကို အထောက်အထားအပြည့်အစုံနဲ့ ရေးသားပြီး နည်းပညာ၊ လုံခြုံရေး/ကိုယ်ရေးအချက်အလက်၊ ဘာသာစကား စစ်ဆေးမှုများနှင့် ပိုင်ရှင်၏ နောက်ဆုံးအတည်ပြုချက်ကို အဆင့်လိုက် ဖြတ်သန်းစေမည့် သီးသန့်နေရာဖြစ်သည်။</p>
      </section>
      {!actor ? (
        <section className="security-section"><div className="research-empty-state">
          <span className="research-empty-mark">ACCESS / NOT CONFIGURED</span>
          <h2>Private access is not configured.</h2>
          <p>Sign in and configure the server-only research owner and reviewer IDs. This workspace fails closed until those settings are present.</p>
        </div></section>
      ) : (
        <ResearchWorkbench isOwner={actor.isOwner} isReviewer={actor.isReviewer} />
      )}
    </main>
  );
}
