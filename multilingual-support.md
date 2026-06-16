---

name: "multilingual-support"
description: "Detects the user's preferred language, responds in that language, and flags whether the recommended hospital has staff who speak it."
---

# Multilingual Support

## 1. When to Use

Trigger this skill when:
- User writes in a language other than English
- User asks "Hindi mein batao," "Tamil la sollu," "Kannada alli hellu," or similar
- Language of the user's messages is inconsistent with English-only responses being appropriate
- Patient is being referred to a hospital in a different linguistic region (e.g., Tamil patient traveling to Delhi)

This skill runs in parallel with other referral skills — it does not replace them. It adjusts language delivery and adds a hospital language-capability check.

---

## 2. Supported Languages

The copilot supports the following languages for conversation:

| Language | Script | Notes |
|---|---|---|
| Hindi | Devanagari | Lingua franca; widest reach across northern India |
| Tamil | Tamil script | Tamil Nadu, parts of Sri Lanka diaspora |
| Telugu | Telugu script | Andhra Pradesh, Telangana |
| Kannada | Kannada script | Karnataka |
| Malayalam | Malayalam script | Kerala |
| Bengali | Bengali script | West Bengal, Bangladesh diaspora |
| Marathi | Devanagari | Maharashtra |
| Gujarati | Gujarati script | Gujarat, diaspora communities |
| Punjabi | Gurmukhi | Punjab, Haryana |
| Odia | Odia script | Odisha |
| Assamese | Bengali/Assamese script | Assam, northeast India |
| English | Latin | Default |

When the user's language is detected, respond in that language for the remainder of the conversation unless the user switches.

---

## 3. Language Detection Logic

- **Explicit request**: "Hindi mein baat karo" → switch to Hindi immediately
- **Script detection**: If the user types in Devanagari, Tamil, Telugu, or other regional scripts → respond in the corresponding language
- **Mixed code (Hinglish, Tanglish)**: respond in the dominant language; do not force pure Hindi or pure English if the user is mixing
- **Ambiguous cases**: if the script is ambiguous (e.g., Bengali and Assamese share script) → respond in the more likely language based on geographic context or ask once: "Apni bhasha Bengali hai ya Assamese?" / "Are you writing in Bengali or Assamese?"

Do not ask the user to confirm their language repeatedly — detect and adapt.

---

## 4. Hospital Language Capability Flag

When making a referral, surface whether the recommended hospital has staff who can communicate with the patient in their language. This is especially important when:

- Patient is traveling from a different linguistic state to a city hospital
- Patient is a rural patient visiting a large urban hospital
- Patient has limited English or Hindi proficiency

**Example flags to surface:**
- "This hospital is in Delhi — please confirm when booking that a Tamil-speaking coordinator or interpreter is available for your appointment."
- "AIIMS Delhi has patient counselors fluent in several Indian languages — ask for a language support coordinator at the patient helpdesk."
- "Cauvery Hospital, Bengaluru has staff fluent in Kannada and Tamil."

If hospital language capability is unknown, flag it honestly:
> "We don't have information on [language]-speaking staff at this facility. Recommend calling ahead and asking."

---

## 5. Medical Term Translation Reference

Provide medical terms in the patient's language when technical terms may cause confusion. Prioritize accuracy over simplification — include the English term alongside the translation.

**Hindi translations of common terms:**

| English | Hindi | Pronunciation guide |
|---|---|---|
| Dialysis | डायलिसिस | Dialysis |
| Kidney | गुर्दा | Gurda |
| Heart | दिल / हृदय | Dil / Hriday |
| Blood pressure | रक्तचाप | Raktachaap |
| Surgery | शल्य चिकित्सा / ऑपरेशन | Operation |
| Discharge | छुट्टी / डिस्चार्ज | Chutti |
| Biopsy | बायोप्सी | Biopsy |
| Chemotherapy | कीमोथेरेपी | Chemotherapy |
| Insulin | इंसुलिन | Insulin |
| Fracture | हड्डी टूटना | Haddi tutna |

For other languages, provide an equivalent table or individual term translation as needed. When uncertain of a clinical translation, always keep the English medical term and add a plain-language explanation in the patient's language.

---

## 6. Rural-to-City Referral Language Note

When a patient from a rural linguistic region is being referred to a metro hospital:

1. Flag the linguistic gap explicitly in the referral summary
2. Suggest the caregiver write down the key questions in the patient's language and have them translated before the appointment if possible
3. Note that many large hospitals in metro cities have patient liaison staff who speak regional languages — advise the caregiver to request this service at the reception desk
4. Suggest the caregiver confirm by phone before travel that a language-appropriate consultation can be arranged

---

## Guardrails

- Medical information must be accurate in every language — never simplify to the point of omitting critical safety information (e.g., drug dosage, red flag symptoms)
- When uncertain of a clinical term's translation, use the English medical term with a plain-language explanation in the patient's language — do not guess
- Do not mix languages within a single sentence if it can be avoided — it can be confusing for patients with low literacy
- Respect that some patients may be literate in their language but not in English — do not default to English for responses just because the interface is in English
- Never assume a patient's language based on their name or geography alone — always verify from their own messages

---

## Verify

- [ ] User's preferred language detected from conversation input
- [ ] Responses delivered in the user's detected or stated language
- [ ] Hospital language capability flagged when patient travels across linguistic regions
- [ ] Medical terms translated accurately with English term retained for precision
- [ ] No critical safety information lost due to translation or simplification
- [ ] Language preference logged in referral record for follow-up contacts
