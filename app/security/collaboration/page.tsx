import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Human × AI Collaboration | Private Security Lab",
  description: "A human-led research and learning project built with ChatGPT and informed by perspectives from Claude, DeepSeek, Gemini, Grok, and Meta AI.",
  alternates: { canonical: "/security/collaboration" },
  openGraph: {
    type: "website",
    title: "Human × AI — Building, Learning, Discovering",
    description: "An evolving experiment in human direction and AI collaboration."
  }
};

const contributors = [
  { name: "Claude", role: "Contributing AI perspective", note: "Ideas and critique requested during research and planning." },
  { name: "DeepSeek", role: "Contributing AI perspective", note: "Additional reasoning and suggestions considered during development." },
  { name: "Gemini", role: "Contributing AI perspective", note: "Another perspective invited into the design process." },
  { name: "Grok", role: "Contributing AI perspective", note: "Ideas and alternative viewpoints requested for consideration." },
  { name: "Meta AI", role: "Contributing AI perspective", note: "Additional suggestions welcomed as part of the wider AI conversation." }
];

export default function CollaborationPage() {
  return (
    <main className="security-shell collaboration-shell">
      <header className="security-nav">
        <Link className="security-brand" href="/security"><span className="security-brand-mark">V</span><span>PRIVATE ACCOUNT VAULT <small>HUMAN × AI COLLABORATION</small></span></Link>
        <nav className="security-nav-links" aria-label="Collaboration navigation"><Link href="/security">Security lab</Link><Link href="/security/research">Research library</Link><Link href="/security/architecture">UI/UX architecture</Link></nav>
        <span className="security-nav-status">HUMAN-LED · AI-ASSISTED</span>
      </header>

      <section className="collab-hero">
        <div className="security-kicker">A HUMAN × AI EXPERIMENT · လူသားနှင့် AI ပူးပေါင်းဖန်တီးမှု</div>
        <h1>One human vision.<br/><em>Many minds. New possibilities.</em></h1>
        <p className="security-lead">This project is a living experiment in what can happen when human curiosity, judgment, and responsibility work together with artificial intelligence—not just to read about technology, but to build, test, question, and share it.</p>
        <p className="security-lead" lang="my">ဒီ Project ဟာ လူသားရဲ့ စူးစမ်းလိုစိတ်၊ ဆုံးဖြတ်နိုင်စွမ်းနဲ့ တာဝန်ယူမှုတို့ကို AI နည်းပညာတွေနဲ့ ပေါင်းစပ်ပြီး စာဖတ်လေ့လာရုံမက ကိုယ်တိုင်တည်ဆောက်၊ စမ်းသပ်၊ မေးခွန်းထုတ်ကာ အသိပညာမျှဝေတဲ့ လက်တွေ့စမ်းသပ်မှုတစ်ခုပါ။</p>
        <div className="collab-principles"><span>BUILD</span><i>→</i><span>TEST</span><i>→</i><span>LEARN</span><i>→</i><span>SHARE</span></div>
      </section>

      <section className="collab-main-role">
        <div className="collab-orbit" aria-hidden="true"><span>HUMAN<br/>VISION</span><i>×</i><b>AI</b></div>
        <div>
          <span className="section-index">01 / MAIN AI COLLABORATOR</span>
          <h2>Built together with ChatGPT.</h2>
          <p>ChatGPT is the primary AI collaborator in this project. In our working process, it helps translate the project direction into architecture, write and revise code, inspect implementation details, plan tests, interpret results, and carry approved work forward.</p>
          <p lang="my">ဒီ Project မှာ ChatGPT က အဓိက ပူးပေါင်းလုပ်ဆောင်တဲ့ AI ဖြစ်ပါတယ်။ Architecture စီစဉ်ခြင်း၊ Code ရေးသားပြင်ဆင်ခြင်း၊ Implementation စစ်ဆေးခြင်း၊ Test အစီအစဉ်ချခြင်းနဲ့ ရလဒ်တွေကို သုံးသပ်ပြီး အတည်ပြုထားတဲ့ အလုပ်တွေကို ဆက်လက်အကောင်အထည်ဖော်ခြင်းတို့မှာ အဓိကကူညီပေးပါတယ်။</p>
          <div className="collab-credit-note">PRIMARY IMPLEMENTATION PARTNER · AI-ASSISTED DEVELOPMENT</div>
        </div>
      </section>

      <section className="security-section">
        <div className="security-section-heading"><div><span className="section-index">02 / CONTRIBUTING PERSPECTIVES</span><h2>Different perspectives make better questions.</h2></div><span className="section-aside">AI ECOSYSTEM</span></div>
        <p className="security-lead">The following AI assistants have also been asked for ideas or perspectives during the journey. Their role here is to be acknowledged for the suggestions the project owner sought—not to imply that they built, reviewed, endorsed, or officially partnered on this project.</p>
        <div className="collab-ai-grid">
          {contributors.map((item, index) => <article className="collab-ai-card" key={item.name}><span className="module-number">{String(index + 1).padStart(2, "0")}</span><h3>{item.name}</h3><strong>{item.role}</strong><p>{item.note}</p></article>)}
        </div>
      </section>

      <section className="security-section collab-human">
        <div className="security-section-heading"><div><span className="section-index">03 / HUMAN DIRECTION & RESPONSIBILITY</span><h2>AI can assist. Humans remain accountable.</h2></div><span className="section-aside">CORE PRINCIPLE</span></div>
        <div className="collab-responsibility-grid">
          <article><b>01</b><h3>Set the direction</h3><p>The human project owner defines goals, boundaries, priorities, and intended public benefit.</p></article>
          <article><b>02</b><h3>Question the output</h3><p>AI suggestions are options to examine—not facts or instructions to accept automatically.</p></article>
          <article><b>03</b><h3>Verify before publishing</h3><p>Code, security claims, test evidence, and research findings require appropriate checks and approval.</p></article>
          <article><b>04</b><h3>Own the consequences</h3><p>Human decisions govern what is built, tested, released, and shared with the public.</p></article>
        </div>
      </section>

      <section className="collab-thanks">
        <span className="section-index">04 / WITH GRATITUDE</span>
        <h2>Thank you to the people building these tools.</h2>
        <p>We offer our respect and gratitude to the founders, researchers, engineers, designers, safety teams, and many contributors at OpenAI who helped create and improve ChatGPT. We are also grateful to the teams and communities behind Claude, DeepSeek, Gemini, Grok, and Meta AI for expanding the range of tools and perspectives available to curious people.</p>
        <p lang="my">ChatGPT ကို ဖန်တီးတည်ဆောက်ပြီး တိုးတက်အောင် ဆက်လက်လုပ်ဆောင်နေကြတဲ့ OpenAI တည်ထောင်သူများ၊ သုတေသီများ၊ အင်ဂျင်နီယာများ၊ ဒီဇိုင်နာများ၊ Safety အဖွဲ့များနဲ့ ပါဝင်ကူညီသူအားလုံးကို လေးစားဂုဏ်ပြု ကျေးဇူးတင်ပါတယ်။ Claude၊ DeepSeek၊ Gemini၊ Grok နဲ့ Meta AI တို့ကို ဖန်တီးတိုးတက်အောင် လုပ်ဆောင်နေကြတဲ့ အဖွဲ့များနဲ့ ပါဝင်သူများကိုလည်း အသိပညာရှာဖွေသူတွေအတွက် အမြင်မျိုးစုံနဲ့ ကိရိယာတွေ ပံ့ပိုးပေးတဲ့အတွက် ကျေးဇူးတင်ပါတယ်။</p>
        <p className="collab-disclaimer">Names are used for factual acknowledgment only. This is an independent project and does not claim sponsorship, endorsement, employment, or official affiliation with any named organization.</p>
      </section>

      <section className="security-section">
        <div className="security-section-heading"><div><span className="section-index">05 / THE LEARNING PROMISE</span><h2>Learning should be something we do.</h2></div><span className="section-aside">OPEN KNOWLEDGE</span></div>
        <p className="security-lead">The goal is to make advanced topics approachable through real demonstrations, interactive research stories, safe puzzles, visual explanations, and honest evidence. The public learning experience is intended to remain freely accessible; no one needs to donate, subscribe, or pay to learn.</p>
        <p className="security-lead" lang="my">အဆင့်မြင့်နည်းပညာတွေကို လက်တွေ့ပြသမှု၊ Interactive Research Story၊ လုံခြုံတဲ့ Puzzle၊ ရုပ်ပုံနဲ့ရှင်းပြချက်တွေအပြင် အထောက်အထားအစစ်တွေကတစ်ဆင့် စိတ်ဝင်စားဖွယ် လေ့လာနိုင်အောင် ဖန်တီးဖို့ ရည်ရွယ်ပါတယ်။ အများပြည်သူရဲ့ ပညာသင်ယူခွင့်ကို အခမဲ့ဖွင့်ထားမယ်။ လှူဒါန်းဖို့၊ Subscribe လုပ်ဖို့၊ ငွေပေးဖို့ မလိုအပ်ပါဘူး။</p>
        <div className="collab-next-links"><Link href="/security/live">Explore the Live Research Theater ↗</Link><Link href="/security/research">Read the research library ↗</Link><Link href="/security">Return to the Security Lab ↗</Link></div>
      </section>

      <footer className="security-footer"><div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT · PRIVATE SECURITY LAB</strong></div><p>Human-led. AI-assisted. Evidence-first. Open to everyone.</p><div className="security-footer-links"><Link href="/security">Security dashboard ↗</Link><Link href="/">Return to Vault</Link></div></footer>
    </main>
  );
}
