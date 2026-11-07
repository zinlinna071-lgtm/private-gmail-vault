import Link from "next/link";
import type { Metadata } from "next";
import styles from "./guide.module.css";

export const metadata: Metadata = {
  title: "Cybersecurity, Explained Simply | Private Account Vault",
  description:
    "A plain-language English and Burmese guide to passwords, encryption, security tests, and what a passed result really means.",
  alternates: { canonical: "/security/guide" },
  openGraph: {
    type: "article",
    title: "Cybersecurity, Explained Simply",
    description:
      "Understand the security work without needing a technical background."
  }
};

const steps = [
  {
    number: "01",
    label: "IDENTITY",
    title: "Signing in answers: who are you?",
    body:
      "A sign-in check confirms which account is asking to enter. It is like showing your identity card at a reception desk. It does not, by itself, prove that every stored record is protected from every kind of attack.",
    myanmar:
      "Login ဝင်ခြင်းက ဘယ်သူက ဝင်ရောက်ခွင့်တောင်းနေသလဲဆိုတာ စစ်ဆေးပေးတာပါ။ ဒါတစ်ခုတည်းနဲ့ သိမ်းထားတဲ့အချက်အလက်အားလုံး လုံခြုံပြီလို့ မဆိုနိုင်ပါဘူး။"
  },
  {
    number: "02",
    label: "ENCRYPTION",
    title: "Encryption makes information unreadable without the right key.",
    body:
      "Think of placing a letter inside a sealed container. The information is changed into an unreadable form, and the correct cryptographic key is needed to turn it back into readable information.",
    myanmar:
      "Encryption ဆိုတာ ဖတ်လို့ရတဲ့အချက်အလက်ကို သင့်တော်တဲ့ key မရှိဘဲ နားလည်ဖတ်ရှုမရတဲ့ပုံစံအဖြစ် ပြောင်းထားခြင်းပါ။ စာတစ်စောင်ကို သော့ခတ်ထားတဲ့အိတ်ထဲ ထည့်ထားသလို ဥပမာပေးနိုင်ပါတယ်။"
  },
  {
    number: "03",
    label: "A SECURITY TEST",
    title: "A test checks one promise at a time.",
    body:
      "A known-answer test gives a cryptographic algorithm a published sample and checks whether the result matches the expected answer exactly. A tamper test changes part of protected data and checks whether the change is rejected.",
    myanmar:
      "Known-answer test က စံနှုန်းမှာ ဖော်ပြထားတဲ့ နမူနာအချက်အလက်ကို ထည့်ပြီး ထွက်လာတဲ့အဖြေ မှန်မမှန် တိုက်စစ်တာပါ။ Tamper test က ကာကွယ်ထားတဲ့ဒေတာကို နည်းနည်းပြောင်းကြည့်ပြီး စနစ်က လက်မခံဘဲ ပယ်ချနိုင်မနိုင် စစ်တာပါ။"
  },
  {
    number: "04",
    label: "THE RESULT",
    title: "A green tick is not a guarantee for the whole app.",
    body:
      "PASS means that this named check worked for this code revision and test environment. It does not mean that every part of the app was tested, that no attack is possible, or that the product has been independently certified.",
    myanmar:
      "PASS ဆိုတာ ဖော်ပြထားတဲ့ စမ်းသပ်ချက်တစ်ခုက သတ်မှတ်ထားတဲ့ code version နဲ့ စမ်းသပ်ပတ်ဝန်းကျင်မှာ အောင်မြင်ခဲ့တယ်လို့သာ ဆိုလိုပါတယ်။ App တစ်ခုလုံး လုံးဝလုံခြုံတယ်ဆိုတဲ့ အာမခံချက် မဟုတ်ပါဘူး။"
  }
];

const glossary = [
  {
    term: "Encryption",
    meaning: "Changing readable information into protected data that needs a key to read.",
    myanmar: "Key မှန်ကန်မှသာ ပြန်ဖတ်နိုင်မယ့်ပုံစံသို့ အချက်အလက်ကို ပြောင်းထားခြင်း။"
  },
  {
    term: "Cryptographic key",
    meaning: "A secret value used by an encryption system to protect or unlock information.",
    myanmar: "အချက်အလက်ကို ကာကွယ်ရန် သို့မဟုတ် ပြန်ဖွင့်ရန် အသုံးပြုတဲ့ လျှို့ဝှက်တန်ဖိုး။"
  },
  {
    term: "Known-answer test",
    meaning: "A check that compares a result with a trusted, published expected answer.",
    myanmar: "စံနှုန်းအရ ကြိုတင်သိထားတဲ့ အဖြေနဲ့ တကယ့်ရလဒ်ကို နှိုင်းယှဉ်ခြင်း။"
  },
  {
    term: "Tamper detection",
    meaning: "Rejecting protected data when someone changes it without the correct key.",
    myanmar: "ခွင့်ပြုချက်မရှိဘဲ ပြောင်းလဲထားတဲ့ ဒေတာကို စနစ်က ပယ်ချနိုင်ခြင်း။"
  },
  {
    term: "Zero-knowledge",
    meaning: "An architecture where the service provider is designed not to receive the user's readable secrets or unlock keys.",
    myanmar: "ဝန်ဆောင်မှုပေးသူဘက်ကလည်း အသုံးပြုသူရဲ့ မူရင်းလျှို့ဝှက်အချက်အလက်နဲ့ ဖွင့်ရန် key ကို မရရှိစေဖို့ ဒီဇိုင်းလုပ်ထားတဲ့ စနစ်။ ဒီ Vault prototype မှာ မပြီးစီးသေးပါ။"
  }
];

export default function SecurityGuidePage() {
  return (
    <main className="security-shell">
      <header className="security-nav">
        <Link className="security-brand" href="/">
          <span className="security-brand-mark">V</span>
          <span>PRIVATE ACCOUNT VAULT <small>SECURITY EXPLAINED</small></span>
        </Link>
        <nav className="security-nav-links" aria-label="Security guide navigation">
          <Link href="/security">Security overview</Link>
          <Link href="/security/architecture">UI/UX architecture</Link>
          <Link href="/security/research">Research</Link>
        </nav>
        <span className="security-nav-status"><i /> PUBLIC · READ ONLY</span>
      </header>

      <div className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.kicker}><span /> A FRIENDLY STARTING POINT · NO TECHNICAL BACKGROUND NEEDED</div>
          <h1>Cybersecurity,<br /><em>without the jargon.</em></h1>
          <p className={styles.lead}>
            You do not need to be a programmer to understand whether a security claim is meaningful.
            This guide explains the ideas, the tests, and the limits in everyday language.
          </p>
          <p className={styles.myanmarLead}>
            နည်းပညာကျွမ်းကျင်သူ မဟုတ်လည်း လုံခြုံရေးစမ်းသပ်မှုတစ်ခုရဲ့ အဓိပ္ပာယ်ကို နားလည်နိုင်ပါတယ်။
            အရေးကြီးတဲ့အချက်တွေကို ရိုးရိုးရှင်းရှင်း ရှင်းပြထားပါတယ်။
          </p>
          <div className={styles.heroLinks}>
            <Link href="/security">Explore the Security Operations page ↗</Link>
            <Link href="/security/research">Read research papers ↗</Link>
          </div>
        </section>

        <section className={styles.explainer} aria-labelledby="steps-title">
          <div className={styles.sectionHeading}>
            <span>THE BIG PICTURE</span>
            <h2 id="steps-title">Four things worth understanding.</h2>
            <p>Start with the meaning. Technical details and source evidence are available on the other pages.</p>
          </div>
          <div className={styles.stepGrid}>
            {steps.map((step) => (
              <article className={styles.step} key={step.number}>
                <div className={styles.stepTop}><span>{step.number}</span><small>{step.label}</small></div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <p className={styles.myanmar}>{step.myanmar}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.resultSection} aria-labelledby="result-title">
          <div className={styles.sectionHeading}>
            <span>READING THE STATUS</span>
            <h2 id="result-title">What does the label actually mean?</h2>
          </div>
          <div className={styles.statusGrid}>
            <article>
              <span className={styles.statusPass}>PASS</span>
              <h3>This exact check succeeded.</h3>
              <p>The named test produced the expected result in the recorded environment. Open the original run to inspect its scope and details.</p>
              <p className={styles.myanmar}>ဖော်ပြထားတဲ့ စမ်းသပ်ချက်တစ်ခု အောင်မြင်ခဲ့တာပါ။ အခြားစမ်းသပ်ချက်အားလုံး အောင်မြင်တယ်လို့ မဆိုလိုပါဘူး။</p>
            </article>
            <article>
              <span className={styles.statusPending}>NOT RUN</span>
              <h3>No test result is available yet.</h3>
              <p>The check may be planned or implemented, but there is no execution evidence to report. It must not be shown as a success.</p>
              <p className={styles.myanmar}>စမ်းသပ်ချက်ကို မလုပ်ရသေးတာ သို့မဟုတ် ရလဒ်အထောက်အထား မရှိသေးတာပါ။ အောင်မြင်တယ်လို့ မပြသရပါဘူး။</p>
            </article>
            <article>
              <span className={styles.statusLimited}>LIMITED</span>
              <h3>Only part of the question was checked.</h3>
              <p>A source review, a single test vector, or one browser run can provide useful evidence, but each has a limited scope.</p>
              <p className={styles.myanmar}>စစ်ဆေးမှုတစ်စိတ်တစ်ပိုင်းသာ ပြီးစီးသေးတာပါ။ ကန့်သတ်ချက်နဲ့အတူ ဖော်ပြရပါမယ်။</p>
            </article>
          </div>
        </section>

        <section className={styles.glossarySection} aria-labelledby="glossary-title">
          <div className={styles.sectionHeading}>
            <span>SMALL GLOSSARY</span>
            <h2 id="glossary-title">Words you may see on the dashboard.</h2>
          </div>
          <dl className={styles.glossary}>
            {glossary.map((item) => (
              <div key={item.term}>
                <dt>{item.term}</dt>
                <dd>{item.meaning}</dd>
                <dd className={styles.myanmar}>{item.myanmar}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.transparency} aria-labelledby="transparency-title">
          <span className={styles.transparencyLabel}>IMPORTANT · CURRENT PROTOTYPE STATUS</span>
          <h2 id="transparency-title">We will show what is real — including what is not finished.</h2>
          <p>
            The current Vault prototype still decrypts records on its server before returning readable
            values to an authenticated browser. That means this version is <strong>not zero-knowledge</strong>.
            The new client-key architecture is a design proposal, not a completed feature. Do not store
            high-value real credentials in this prototype.
          </p>
          <p className={styles.myanmar}>
            လက်ရှိ prototype မှာ server က Vault ဒေတာကို ပြန်ဖတ်လို့ရတဲ့ပုံစံအဖြစ် ဖွင့်ပြီးမှ browser ဆီ ပို့နေဆဲပါ။
            ဒါကြောင့် zero-knowledge စနစ် မဖြစ်သေးပါဘူး။ နောက်ထပ် client-key design ကလည်း အကောင်အထည်မဖော်ရသေးတဲ့
            အစီအစဉ်သာ ဖြစ်ပါတယ်။ အရေးကြီးတဲ့ တကယ့် password တွေကို လက်ရှိ prototype ထဲ မသိမ်းပါနဲ့။
          </p>
          <div className={styles.truthGrid}>
            <div><b>REAL TESTS</b><span>Only recorded, authorized checks with inspectable evidence.</span></div>
            <div><b>NO FAKE ATTACKS</b><span>No invented packet streams, attack counters, or fabricated activity.</span></div>
            <div><b>HONEST LIMITS</b><span>Untested and unfinished areas stay clearly labelled.</span></div>
          </div>
        </section>

        <section className={styles.nextSteps}>
          <div>
            <span>KEEP EXPLORING</span>
            <h2>Understand the idea. Then inspect the evidence.</h2>
            <p>The public dashboard shows scope and published test records. The architecture page explains how the interface itself is built.</p>
          </div>
          <div className={styles.nextLinks}>
            <Link href="/security">Security Operations ↗</Link>
            <Link href="/security/architecture">UI/UX engineering notes ↗</Link>
            <Link href="/security/research">Research library ↗</Link>
          </div>
        </section>
      </div>

      <footer className="security-footer">
        <div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT</strong></div>
        <p>Security is a process of evidence, review, and improvement — not a promise that nothing can ever go wrong.</p>
        <div className="security-footer-links"><Link href="/security">Back to Security Operations</Link><Link href="/">Return to Vault</Link></div>
      </footer>
    </main>
  );
}
