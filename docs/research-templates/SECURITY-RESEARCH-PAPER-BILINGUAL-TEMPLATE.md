# Bilingual Security Research Paper Template

**Publication ID:** [SRP-YYYY-NNN]  
**Version:** 0.1-draft  
**Publication status:** Draft / Technical review / Security review / Approved / Published  
**Languages:** English (en) + Burmese (my)  
**Test run:** [verified run ID]  
**Application commit:** [full commit SHA]  
**Date:** [YYYY-MM-DD]

> Publication rule: This template is not evidence of a completed test. Fill factual fields only from a verified test run. Keep the English and Burmese editions substantively equivalent. If one language is not yet reviewed, label that edition as a translation draft.

---

# English Edition

## Title
[Research title]

## Abstract
[Research question, scope, method, principal verified result, and limitations.]

## 1. Objective and background
[Why this control or security property is being studied.]

## 2. Authorization, scope, and exclusions
[Owner-authorized assets and explicit exclusions. Confirm isolated lab and synthetic data.]

## 3. Environment and provenance
- Repository:
- Commit:
- Test harness/version:
- Test-run ID:
- Runtime/browser/device:
- Configuration identifier (never include secrets):
- Test data: Synthetic / Isolated

## 4. Methodology
[Safe, reproducible description. Do not include instructions that enable attacks against third-party systems.]

## 5. Expected behavior
[What the security control should do.]

## 6. Observed evidence
[Sanitized telemetry summary, event IDs, metrics, and evidence references.]

## 7. Findings
For each finding, state:
- Classification: Confirmed / Observation / Hypothesis / Not tested
- Severity and rationale:
- Confidence:
- Evidence:
- Scope and limitations:

## 8. Remediation
[Defensive change, implementation reference, and rationale.]

## 9. Retest
[Retest run ID, commit, environment, expected outcome, observed outcome. Use Not performed if no retest exists.]

## 10. Limitations and unresolved questions
[What this test does not establish.]

## 11. References
[Standards, official documentation, and relevant research.]

---

# မြန်မာဘာသာမူ

## ခေါင်းစဉ်
[သုတေသနစာတမ်းခေါင်းစဉ်]

## အနှစ်ချုပ်
[သုတေသနမေးခွန်း၊ စမ်းသပ်မှုအတိုင်းအတာ၊ နည်းလမ်း၊ အတည်ပြုနိုင်ခဲ့သော ရလဒ်နှင့် ကန့်သတ်ချက်များကို အကျဉ်းချုပ်ဖော်ပြပါ။]

## ၁။ ရည်ရွယ်ချက်နှင့် နောက်ခံအကြောင်းအရာ
[ဒီလုံခြုံရေးစနစ် သို့မဟုတ် ကာကွယ်ရေးနည်းပညာကို ဘာကြောင့် လေ့လာစမ်းသပ်ရသလဲ။]

## ၂။ ခွင့်ပြုချက်၊ စမ်းသပ်မှုအတိုင်းအတာနှင့် ချန်လှပ်ထားသည့်အရာများ
[ပိုင်ရှင်၏ ခွင့်ပြုချက်ရရှိထားသော စနစ်များကိုသာ ဖော်ပြပါ။ သီးခြား Lab နှင့် စမ်းသပ်ရန်ဖန်တီးထားသော အချက်အလက်များကို အသုံးပြုထားကြောင်း အတည်ပြုပါ။]

## ၃။ စမ်းသပ်မှုပတ်ဝန်းကျင်နှင့် အထောက်အထားလမ်းကြောင်း
- Repository:
- Commit:
- Test Harness / Version:
- Test Run ID:
- Runtime / Browser / Device:
- Configuration ID (လျှို့ဝှက်တန်ဖိုးများ မထည့်ရ):
- စမ်းသပ်ဒေတာ: Synthetic / Isolated

## ၄။ စမ်းသပ်နည်းလမ်း
[အခြားသူပိုင်စနစ်များကို တိုက်ခိုက်နိုင်စေမည့် လုပ်ဆောင်ချက်အသေးစိတ်များမပါဘဲ ပြန်လည်စစ်ဆေးနိုင်သည့် လုံခြုံသောနည်းလမ်းကို ရှင်းပြပါ။]

## ၅။ မျှော်မှန်းထားသော အပြုအမူ
[စမ်းသပ်ခံ Security Control က ဘယ်လိုတုံ့ပြန်သင့်သလဲ။]

## ၆။ တွေ့ရှိခဲ့သော အထောက်အထား
[လျှို့ဝှက်အချက်အလက်များ ဖယ်ရှားထားသော Telemetry အကျဉ်းချုပ်၊ Event ID၊ Metrics နှင့် Evidence Reference များ။]

## ၇။ တွေ့ရှိချက်များ
တွေ့ရှိချက်တစ်ခုချင်းစီအတွက် အောက်ပါတို့ကို ဖော်ပြပါ။
- အမျိုးအစား: အတည်ပြုတွေ့ရှိချက် / သတိပြုမိချက် / ယူဆချက် / မစမ်းသပ်ရသေး
- ပြင်းထန်မှုအဆင့်နှင့် သတ်မှတ်ရသည့်အကြောင်းရင်း:
- ယုံကြည်စိတ်ချရမှု:
- အထောက်အထား:
- စမ်းသပ်မှုအတိုင်းအတာနှင့် ကန့်သတ်ချက်များ:

## ၈။ ပြုပြင်ကာကွယ်မှု
[အသုံးပြုခဲ့သော ကာကွယ်ရေးပြောင်းလဲမှု၊ Code Reference နှင့် ပြောင်းလဲရသည့်အကြောင်းရင်း။]

## ၉။ ပြန်လည်စမ်းသပ်မှု
[ပြန်လည်စမ်းသပ်သည့် Run ID၊ Commit၊ ပတ်ဝန်းကျင်၊ မျှော်မှန်းရလဒ်နှင့် တကယ်ရရှိသည့်ရလဒ်။ မစမ်းသပ်ရသေးလျှင် ထိုအတိုင်း ဖော်ပြပါ။]

## ၁၀။ ကန့်သတ်ချက်များနှင့် မဖြေရှင်းရသေးသော မေးခွန်းများ
[ဒီစမ်းသပ်မှုတစ်ခုတည်းဖြင့် ဘာတွေကို အတည်မပြုနိုင်သေးသလဲ။]

## ၁၁။ ကိုးကားစာရင်း
[တရားဝင်စံနှုန်းများ၊ နည်းပညာစာတမ်းများနှင့် သက်ဆိုင်ရာ သုတေသနရင်းမြစ်များ။]

---

## Editorial and release checklist / ထုတ်ဝေမီ စစ်ဆေးရန်

- [ ] Every factual claim maps to a verified test run and exact commit.
- [ ] English and Burmese editions are technically equivalent.
- [ ] A fluent Burmese technical reviewer checked terminology and meaning.
- [ ] Confirmed findings are separated from hypotheses and observations.
- [ ] Credentials, personal data, private endpoints, raw sensitive logs, and key material are absent.
- [ ] Unpatched vulnerability details are not actionable.
- [ ] Technical review is complete.
- [ ] Security and privacy review is complete.
- [ ] Owner approval is recorded.
- [ ] Web and PDF editions carry the same publication ID and version.
- [ ] Corrections and retests are versioned; prior versions remain traceable.

## Translation glossary / ဘာသာပြန်ဝေါဟာရ

| English | မြန်မာ |
|---|---|
| Authentication | အထောက်အထားအတည်ပြုခြင်း |
| Authorization | ဝင်ရောက်အသုံးပြုခွင့် စစ်ဆေးခြင်း |
| Encryption | ဒေတာစာဝှက်ခြင်း |
| Decryption | စာဝှက်ဖြည်ခြင်း |
| Vulnerability | လုံခြုံရေးအားနည်းချက် |
| Exploit | အားနည်းချက်ကို အသုံးချသည့် နည်းလမ်း |
| Mitigation | အန္တရာယ်လျှော့ချကာကွယ်ခြင်း |
| Remediation | အားနည်းချက်ကို ပြုပြင်ဖြေရှင်းခြင်း |
| Telemetry | စနစ်ဖြစ်ရပ်နှင့် တိုင်းတာချက်ဒေတာ |
| Evidence | သက်သေအထောက်အထား |
| Retest | ပြန်လည်စမ်းသပ်ခြင်း |
| Scope | စမ်းသပ်မှုအတိုင်းအတာ |
| Synthetic data | စမ်းသပ်ရန် ဖန်တီးထားသော ဒေတာ |
| Zero-Knowledge | ဝန်ဆောင်မှုပေးသူက မူရင်းလျှို့ဝှက်ဒေတာကို မသိရှိနိုင်သော ပုံစံ |
