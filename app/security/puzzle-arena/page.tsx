"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Option = { id: string; label: string; myLabel: string };
type Puzzle = {
  id: string;
  category: string;
  title: string;
  prompt: string;
  myPrompt: string;
  options: Option[];
  answer: string;
  explanation: string;
  myExplanation: string;
  hint: string;
};

const puzzles: Puzzle[] = [
  {
    id: "nonce",
    category: "CRYPTOGRAPHIC DESIGN",
    title: "The repeated nonce",
    prompt: "Two records are encrypted with the same AES-GCM key. The second operation is about to reuse the exact 96-bit nonce from the first. What should the system do?",
    myPrompt: "AES-GCM Key တစ်ခုတည်းနဲ့ Record နှစ်ခုကို စာဝှက်ရာမှာ ဒုတိယအကြိမ်က ပထမ Nonce အဟောင်းကို ပြန်သုံးတော့မယ်။ System က ဘာလုပ်သင့်သလဲ။",
    options: [
      { id: "reuse", label: "Continue. A nonce is public, so reuse is harmless.", myLabel: "Nonce က Public ဖြစ်လို့ ပြန်သုံးလည်း ပြဿနာမရှိဘူး။" },
      { id: "stop", label: "Reject the reuse and obtain a fresh unique nonce.", myLabel: "ပြန်သုံးခြင်းကို ပယ်ချပြီး မတူညီတဲ့ Nonce အသစ် ရယူပါ။" },
      { id: "hide", label: "Keep the repeated nonce secret from the user.", myLabel: "Nonce အဟောင်းကို User ဆီက လျှို့ဝှက်ထားပါ။" }
    ],
    answer: "stop",
    explanation: "Correct: stop the operation and obtain a nonce that has not been used with this key. AES-GCM nonce uniqueness is a per-key requirement; secrecy is not the protection.",
    myExplanation: "မှန်ပါတယ်။ ဒီ Key နဲ့ မသုံးဖူးသေးတဲ့ Nonce အသစ်တစ်ခု ရယူပြီးမှ ဆက်လုပ်ရပါမယ်။ Nonce ကို လျှို့ဝှက်ထားခြင်းက ပြန်သုံးမိတဲ့ ပြဿနာကို မဖြေရှင်းနိုင်ပါဘူး။",
    hint: "Ask whether the nonce has already appeared under this same key."
  },
  {
    id: "tamper",
    category: "INTEGRITY & AUTHENTICATION",
    title: "The changed ciphertext",
    prompt: "A stored AES-GCM ciphertext is changed by one bit before decryption. The authentication check fails. What is the safest application behavior?",
    myPrompt: "သိမ်းထားတဲ့ AES-GCM Ciphertext ကို Decrypt မလုပ်ခင် Bit တစ်ခု ပြောင်းထားပြီး Authentication စစ်ဆေးမှု မအောင်မြင်ဘူး။ Application က ဘာလုပ်သင့်သလဲ။",
    options: [
      { id: "show", label: "Show partially decrypted text and continue.", myLabel: "တစ်စိတ်တစ်ပိုင်း Decrypt ဖြစ်တဲ့ စာသားကို ပြပြီး ဆက်လုပ်ပါ။" },
      { id: "ignore", label: "Ignore the tag error because the record still exists.", myLabel: "Record ရှိနေသေးတာကြောင့် Tag Error ကို လျစ်လျူရှုပါ။" },
      { id: "reject", label: "Reject the record and surface a safe integrity error.", myLabel: "Record ကို ပယ်ချပြီး လုံခြုံတဲ့ Integrity Error ကို ပြပါ။" }
    ],
    answer: "reject",
    explanation: "Correct: authenticated decryption must fail closed. Do not release unauthenticated plaintext or silently ignore the error. Preserve safe diagnostic context without exposing secrets.",
    myExplanation: "မှန်ပါတယ်။ Authentication မအောင်မြင်တဲ့အခါ Plaintext ကို မပြသဘဲ Record ကို ငြင်းပယ်ရပါမယ်။ Error ကို လျစ်လျူမရှုပါနဲ့။",
    hint: "An authentication tag is a gate: no verified tag, no trusted plaintext."
  },
  {
    id: "salt",
    category: "PASSWORD STORAGE",
    title: "The shared salt",
    prompt: "A service stores password verifiers using a password-based KDF. A developer proposes one fixed salt for every account. Which design is better?",
    myPrompt: "Password Verifier တွေ သိမ်းဖို့ Password-based KDF သုံးနေတယ်။ Developer က Account အားလုံးအတွက် Salt တစ်ခုတည်းကို သုံးဖို့ အကြံပြုတယ်။ ဘယ် Design က ပိုကောင်းသလဲ။",
    options: [
      { id: "unique", label: "Generate a unique random salt for each password record.", myLabel: "Password Record တစ်ခုစီအတွက် Random Salt သီးခြားထုတ်ပါ။" },
      { id: "fixed", label: "Use one global salt so every record is consistent.", myLabel: "Record အားလုံးအတွက် Global Salt တစ်ခုတည်း သုံးပါ။" },
      { id: "secret", label: "Use the username as a secret salt.", myLabel: "Username ကို လျှို့ဝှက် Salt အဖြစ် သုံးပါ။" }
    ],
    answer: "unique",
    explanation: "Correct: generate a cryptographically random, unique salt for each password record and store it alongside the verifier. The salt is not a password and does not need to be secret.",
    myExplanation: "မှန်ပါတယ်။ Password Record တစ်ခုစီအတွက် Cryptographically Secure Random Salt အသစ် သုံးပြီး Verifier နဲ့အတူ သိမ်းပါ။ Salt ကို Password လို လျှို့ဝှက်ထားဖို့ မလိုပါဘူး။",
    hint: "A salt should prevent identical passwords from producing identical stored verifiers across accounts."
  },
  {
    id: "aad",
    category: "CONTEXT BINDING",
    title: "The misplaced record",
    prompt: "An encrypted record was created with authenticated additional data (AAD) containing Vault ID A and Record ID 17. Someone copies the ciphertext into Record ID 42. During decryption, which context should the application supply?",
    myPrompt: "Encrypted Record တစ်ခုကို Vault ID A နဲ့ Record ID 17 ပါတဲ့ AAD ဖြင့် ဖန်တီးထားတယ်။ တစ်ယောက်ယောက်က Ciphertext ကို Record ID 42 ထဲ ကူးထည့်လိုက်တယ်။ Decrypt လုပ်တဲ့အခါ ဘယ် Context ကို အသုံးပြုသင့်သလဲ။",
    options: [
      { id: "original", label: "Use the original bound context and verify the record identity.", myLabel: "မူလချိတ်ဆက်ထားတဲ့ Context ကိုသုံးပြီး Record Identity ကို စစ်ဆေးပါ။" },
      { id: "new", label: "Use Record ID 42 and accept the ciphertext if it decrypts.", myLabel: "Record ID 42 ကိုသုံးပြီး Decrypt ဖြစ်ရင် လက်ခံပါ။" },
      { id: "none", label: "Omit AAD so records can be moved freely.", myLabel: "Record တွေကို လွယ်လွယ်ကူကူ ရွှေ့နိုင်ဖို့ AAD ကို မသုံးပါနဲ့။" }
    ],
    answer: "original",
    explanation: "Correct: reconstruct the expected AAD from the trusted record context and require authentication to pass. A ciphertext copied into a different record context should fail authentication. AAD does not encrypt its contents; it binds context to the authenticated operation.",
    myExplanation: "မှန်ပါတယ်။ ယုံကြည်ရတဲ့ Record Context ကနေ မျှော်မှန်းထားတဲ့ AAD ကို ပြန်တည်ဆောက်ပြီး Authentication စစ်ဆေးရပါမယ်။ Ciphertext ကို Record တခြားတစ်ခုထဲ ကူးထည့်ထားရင် Context မကိုက်ညီမှုကြောင့် Authentication မအောင်မြင်သင့်ပါဘူး။ AAD ကိုယ်တိုင်က Encrypt လုပ်ထားတာမဟုတ်ပါဘူး။",
    hint: "AAD is authenticated, not encrypted. Ask which trusted record identity the ciphertext was originally bound to."
  },
  {
    id: "kdf",
    category: "KEY DERIVATION",
    title: "The forgotten KDF settings",
    prompt: "A password-derived key is needed again months later. The verifier metadata stores only the salt, not the KDF algorithm or cost parameters. What should a robust design do?",
    myPrompt: "လအနည်းငယ်ကြာပြီးနောက် Password ကနေ Key ပြန်ထုတ်ဖို့ လိုလာတယ်။ သိမ်းထားတဲ့ Metadata မှာ Salt ပဲရှိပြီး KDF Algorithm နဲ့ Cost Parameters မပါဘူး။ ကောင်းမွန်တဲ့ Design က ဘာလုပ်သင့်သလဲ။",
    options: [
      { id: "guess", label: "Guess the original algorithm and parameters from the output.", myLabel: "Output ကိုကြည့်ပြီး မူလ Algorithm နဲ့ Parameters ကို ခန့်မှန်းပါ။" },
      { id: "store", label: "Store a versioned KDF identifier and its parameters with the salt.", myLabel: "Salt နဲ့အတူ Version ပါတဲ့ KDF Identifier နဲ့ Parameters တွေကို သိမ်းပါ။" },
      { id: "default", label: "Always use whatever parameters the newest release defaults to.", myLabel: "Release အသစ်ရဲ့ Default Parameters ကို အမြဲသုံးပါ။" }
    ],
    answer: "store",
    explanation: "Correct: persist a versioned algorithm identifier and the parameters required to reproduce derivation, alongside the salt. Review and migrate parameters deliberately as hardware and threat models change; do not silently reinterpret old records.",
    myExplanation: "မှန်ပါတယ်။ Salt နဲ့အတူ Version ပါတဲ့ KDF Algorithm အမည်နဲ့ ပြန်လည်တွက်ချက်ရန်လိုအပ်တဲ့ Parameters တွေကို သိမ်းထားရပါမယ်။ Hardware နဲ့ Threat Model ပြောင်းလဲလာတဲ့အခါ Parameters ကို စနစ်တကျ ပြန်လည်သုံးသပ်ပြီး Migration လုပ်ပါ။",
    hint: "A future verifier must know exactly which algorithm and work factors produced the stored value."
  },
];

export default function SecurityPuzzleArenaPage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hints, setHints] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState(0);
  const current = puzzles[active];
  const answered = answers[current.id] !== undefined;
  const correct = answers[current.id] === current.answer;
  const score = useMemo(
    () => puzzles.reduce((total, puzzle) => total + (answers[puzzle.id] === puzzle.answer ? 1 : 0), 0),
    [answers]
  );
  const completed = puzzles.filter((puzzle) => answers[puzzle.id] !== undefined).length;

  function choose(optionId: string) {
    if (answers[current.id] !== undefined) return;
    setAnswers((previous) => ({ ...previous, [current.id]: optionId }));
  }

  function reset() {
    setAnswers({});
    setHints({});
    setActive(0);
  }

  return (
    <main className="security-shell">
      <header className="security-nav">
        <Link className="security-brand" href="/security/research">
          <span className="security-brand-mark">V</span>
          <span>PRIVATE ACCOUNT VAULT <small>SAFE PUZZLE ARENA</small></span>
        </Link>
        <nav className="security-nav-links" aria-label="Learning navigation">
          <Link href="/security/research">Research library</Link>
          <Link href="/security/research-stories">Research stories</Link>
          <Link href="/security">Security operations</Link>
        </nav>
        <span className="security-nav-status">SIMULATED · DEMO DATA</span>
      </header>

      <section className="security-hero puzzle-hero">
        <div>
          <div className="security-kicker">PUBLIC LEARNING STUDIO · 05 CHALLENGES</div>
          <h1>Think like a defender.<br /><em>Prove the reasoning.</em></h1>
          <p className="security-lead">Work through short security scenarios, choose a defensive decision, and read why it matters. These are deterministic learning puzzles—not attacks, scans, or live telemetry.</p>
          <p className="security-lead" lang="my">လုံခြုံရေးအခြေအနေတွေကို ဖတ်ရှုပြီး ကာကွယ်ရေးဆုံးဖြတ်ချက်ကို ကိုယ်တိုင်ရွေးချယ်ပါ။ အဖြေတစ်ခုစီမှာ ဘာကြောင့် မှန်/မှားသလဲဆိုတာ ရှင်းပြထားပါတယ်။ ဒါတွေဟာ သင်ခန်းစာ Puzzle တွေဖြစ်ပြီး တကယ့် Attack သို့မဟုတ် Live Telemetry မဟုတ်ပါဘူး။</p>
          <div className="puzzle-meta"><span>LOCAL INTERACTION</span><span>NO ANSWER SUBMISSIONS</span><span>NO PERSONAL DATA</span></div>
        </div>
        <aside className="puzzle-score" aria-label="Learning progress">
          <span className="section-index">YOUR PROGRESS</span>
          <strong>{score}<small> / {puzzles.length}</small></strong>
          <p>{completed} of {puzzles.length} challenges answered</p>
          <div className="puzzle-progress"><span style={{ width: (completed / puzzles.length * 100) + "%" }} /></div>
          <small>Score reflects correct first answers only.</small>
        </aside>
      </section>

      <section className="security-section puzzle-workspace" aria-labelledby="puzzle-title">
        <aside className="puzzle-index">
          <span className="section-index">CHALLENGE INDEX</span>
          {puzzles.map((puzzle, index) => {
            const done = answers[puzzle.id] !== undefined;
            const passed = answers[puzzle.id] === puzzle.answer;
            return (
              <button key={puzzle.id} type="button" className={active === index ? "puzzle-tab active" : "puzzle-tab"} onClick={() => setActive(index)} aria-current={active === index ? "step" : undefined}>
                <span>0{index + 1} · {puzzle.category}</span>
                <b>{puzzle.title}</b>
                <small>{done ? (passed ? "CORRECT" : "REVIEWED") : "NOT ANSWERED"}</small>
              </button>
            );
          })}
          <button type="button" className="puzzle-reset" onClick={reset}>RESET ALL CHALLENGES ↺</button>
        </aside>

        <article className="puzzle-card" aria-live="polite">
          <div className="puzzle-card-top"><span className="section-index">CHALLENGE 0{active + 1} / {puzzles.length}</span><span className="puzzle-sim-label">SYNTHETIC SCENARIO</span></div>
          <h2 id="puzzle-title">{current.title}</h2>
          <p>{current.prompt}</p>
          <p lang="my">{current.myPrompt}</p>
          <div className="puzzle-options" role="group" aria-label="Choose your answer">
            {current.options.map((option, index) => {
              const selected = answers[current.id] === option.id;
              const isCorrect = option.id === current.answer;
              return (
                <button key={option.id} type="button" onClick={() => choose(option.id)} disabled={answered} className={"puzzle-option" + (selected ? " selected" : "") + (answered && isCorrect ? " correct" : "") + (selected && !isCorrect ? " incorrect" : "")}>
                  <b>{String.fromCharCode(65 + index)}</b><span className="puzzle-option-copy"><span>{option.label}</span><small lang="my">{option.myLabel}</small></span>
                  {answered && isCorrect && <small>SAFE CHOICE</small>}
                  {selected && !isCorrect && <small>YOUR CHOICE</small>}
                </button>
              );
            })}
          </div>
          {!answered && (
            <div className="puzzle-hint-area">
              <button type="button" className="puzzle-hint-button" onClick={() => setHints((previous) => ({ ...previous, [current.id]: !previous[current.id] }))}>{hints[current.id] ? "HIDE HINT" : "REVEAL HINT"}</button>
              {hints[current.id] && <p>{current.hint}</p>}
            </div>
          )}
          {answered && (
            <div className={"puzzle-feedback " + (correct ? "is-correct" : "needs-review")}>
              <strong>{correct ? "DEFENSIVE DECISION CONFIRMED" : "NOT THE SAFEST DECISION — REVIEW THE PRINCIPLE"}</strong>
              <p>{current.explanation}</p>
              <p lang="my">{current.myExplanation}</p>
            </div>
          )}
          <div className="puzzle-controls">
            <button type="button" onClick={() => setActive((value) => Math.max(0, value - 1))} disabled={active === 0}>← PREVIOUS</button>
            <button type="button" onClick={() => setActive((value) => Math.min(puzzles.length - 1, value + 1))} disabled={active === puzzles.length - 1 || !answered}>NEXT CHALLENGE ↗</button>
          </div>
        </article>
      </section>

      <section className="security-section puzzle-boundary">
        <span className="section-index">SAFETY & LIMITATIONS</span>
        <h2>A learning fixture—not a security test.</h2>
        <div className="puzzle-boundary-grid">
          <p><b>What happens</b><br />The browser compares your selection with fixed expected answers and displays authored explanations. Answers and progress remain in page memory.</p>
          <p><b>What does not happen</b><br />No cryptographic attack, URL fetch, shell, code execution, account access, or telemetry collection occurs. Puzzle answers are checked in browser memory and are not submitted to an API; normal page delivery and navigation still use the website network.</p>
          <p lang="my"><b>သင်ယူရန်သာ</b><br />ရွေးချယ်ထားတဲ့ အဖြေကို Browser Memory ထဲမှာပဲ စစ်ဆေးပြီး ရှင်းပြချက်ပြသတာ ဖြစ်ပါတယ်။ အဖြေတွေကို API ဆီ မပို့ပါဘူး။ Website ကို ဖွင့်ခြင်းနဲ့ စာမျက်နှာကူးပြောင်းခြင်းမှာတော့ ပုံမှန် Network အသုံးပြုမှု ရှိပါတယ်။</p>
        </div>
        <p className="puzzle-note">All scenarios are fictional and deterministic. A correct puzzle answer does not certify this application or replace an independent security review.</p>
        <Link href="/security/research-stories/aes-gcm-integrity">Continue to Story 02 · Browser-local tamper demonstration ↗</Link>
      </section>

      <footer className="security-footer"><div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT</strong></div><p>Knowledge should be accessible. Evidence should be verifiable.</p></footer>

      <style jsx>{`
        .puzzle-hero{grid-template-columns:1.4fr .6fr;align-items:center}
        .puzzle-meta{display:flex;flex-wrap:wrap;gap:9px;margin-top:24px}
        .puzzle-meta span,.puzzle-sim-label{padding:7px 9px;border:1px solid #315261;border-radius:5px;color:#91b9bd;font-size:8px;font-weight:800;letter-spacing:.12em}
        .puzzle-score,.puzzle-index,.puzzle-card,.puzzle-boundary{border:1px solid #294454;border-radius:13px;background:#0b1b27;padding:clamp(17px,3vw,26px)}
        .puzzle-score strong{display:block;margin:18px 0 5px;color:#a6efd2;font-size:54px;letter-spacing:-.06em}
        .puzzle-score strong small{color:#658c8e;font-size:20px}
        .puzzle-score p,.puzzle-score>small{color:#91a8b4;font-size:11px;line-height:1.7}
        .puzzle-progress{height:5px;margin:18px 0;background:#1c3440;border-radius:9px;overflow:hidden}
        .puzzle-progress span{display:block;height:100%;background:#62c8a4;transition:width .25s ease}
        .puzzle-workspace{display:grid;grid-template-columns:minmax(220px,.65fr) 1.5fr;gap:16px;align-items:start}
        .puzzle-index{display:grid;gap:10px}
        .puzzle-tab{display:grid;gap:8px;text-align:left;padding:13px;border:1px solid #263f4b;border-radius:8px;background:#0c202c;color:#dce9ed;cursor:pointer}
        .puzzle-tab.active{border-color:#66c7a8;background:#102b31}
        .puzzle-tab span,.puzzle-tab small{color:#7898a2;font-size:8px;font-weight:800;letter-spacing:.1em}
        .puzzle-tab b{font-size:13px}
        .puzzle-reset,.puzzle-hint-button{border:1px solid #456b70;border-radius:6px;background:transparent;color:#a8d9cf;padding:10px;font-size:9px;font-weight:800;letter-spacing:.1em;cursor:pointer}
        .puzzle-card-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .puzzle-card h2,.puzzle-boundary h2{margin:20px 0 12px;font-size:clamp(25px,4vw,36px);letter-spacing:-.04em}
        .puzzle-card>p,.puzzle-boundary-grid p,.puzzle-note{color:#a5bac3;font-size:13px;line-height:1.8}
        .puzzle-options{display:grid;gap:10px;margin:24px 0}
        .puzzle-option{display:flex;align-items:center;gap:13px;width:100%;min-height:60px;padding:12px;text-align:left;border:1px solid #2d4a57;border-radius:8px;background:#0d202c;color:#d9e8ec;cursor:pointer}
        .puzzle-option:focus-visible,.puzzle-tab:focus-visible,.puzzle-reset:focus-visible,.puzzle-hint-button:focus-visible,.puzzle-controls button:focus-visible{outline:2px solid #9cebd0;outline-offset:3px}
        .puzzle-option>b{display:grid;place-items:center;flex:0 0 30px;height:30px;border:1px solid #42616a;border-radius:6px;color:#9dd8c7}
        .puzzle-option-copy{display:grid;gap:5px;min-width:0}.puzzle-option-copy>span{font-size:12px;line-height:1.6}.puzzle-option-copy>small{margin:0;color:#91a8b4;font-size:11px;line-height:1.6;letter-spacing:0;font-weight:500}.puzzle-option>small{margin-left:auto;color:#9cebd0;font-size:8px;font-weight:900;letter-spacing:.08em}
        .puzzle-option small{margin-left:auto;color:#9cebd0;font-size:8px;font-weight:900;letter-spacing:.08em}
        .puzzle-option:disabled{cursor:default;opacity:.85}
        .puzzle-option.correct{border-color:#4b9c7c;background:#102d2b}
        .puzzle-option.incorrect{border-color:#a36a55;background:#30231f}
        .puzzle-hint-area{padding:14px;border-top:1px solid #203b47}
        .puzzle-hint-area p{color:#e2c99a;font-size:12px;line-height:1.7}
        .puzzle-feedback{margin-top:18px;padding:17px;border:1px solid #8c6947;border-radius:8px;background:#2b241d}
        .puzzle-feedback.is-correct{border-color:#43866f;background:#102b29}
        .puzzle-feedback strong{color:#b8efd9;font-size:10px;letter-spacing:.1em}
        .puzzle-feedback p{color:#c1d2d1;font-size:12px;line-height:1.8}
        .puzzle-controls{display:flex;justify-content:space-between;gap:12px;margin-top:24px;padding-top:17px;border-top:1px solid #203b47}
        .puzzle-controls button{border:1px solid #3a7065;border-radius:6px;padding:11px 13px;background:#102a2c;color:#b9e9d9;font-size:9px;font-weight:900;letter-spacing:.08em;cursor:pointer}
        .puzzle-controls button:disabled{opacity:.35;cursor:not-allowed}
        .puzzle-boundary{margin-bottom:65px}
        .puzzle-boundary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .puzzle-boundary-grid p{padding:14px;border:1px solid #263f4b;border-radius:8px;background:#0d202c}
        .puzzle-boundary-grid b{color:#c3eadc}
        .puzzle-boundary>a{color:#9cebd0;font-size:11px;font-weight:800;text-decoration:none}
        .puzzle-note{font-size:11px}
        @media(max-width:760px){.puzzle-hero{grid-template-columns:1fr}.puzzle-workspace{grid-template-columns:1fr}.puzzle-boundary-grid{grid-template-columns:1fr}}
        @media(prefers-reduced-motion:reduce){.puzzle-progress span{transition:none}}
      `}</style>
    </main>
  );
}
