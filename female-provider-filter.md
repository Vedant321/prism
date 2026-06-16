---

name: "female-provider-filter"
description: "Triggered when the patient or caregiver requests a female doctor or when the medical context makes female provider availability a priority."
---

# Female Provider Filter

## 1. When to Use

Trigger this skill when any of the following are detected in the conversation:

**Explicit requests:**
- "female doctor," "lady doctor," "woman doctor"
- "mahila doctor," "mahila daktar," "lady specialist"
- "kya wahan koi lady doctor hai?" (Is there a lady doctor there?)
- "I want a female gynecologist / female surgeon / female psychiatrist"

**Contextual triggers (apply even without explicit request):**
- Any query about gynecology, obstetrics, or reproductive health from a female patient
- Breast examination, mammography, or breast surgery queries
- Mental health consultation requests from a female patient in contexts suggesting trauma or abuse
- Pelvic examination, cervical cancer screening, or prenatal care

**Conservative or rural patient context:**
- Patient is from a rural background and hesitation about seeking care is detected
- Previous conversation indicates cultural or religious preference for female provider

---

## 2. Why This Is High Priority

In many parts of India, a female patient's willingness to seek care at all — particularly for reproductive health, mental health, or any condition requiring physical examination — depends entirely on whether a female doctor is available.

Dismissing or deprioritizing this preference:
- May result in the patient not seeking care at all
- Can cause significant distress during an already vulnerable medical encounter
- Is inconsistent with the patient's dignity and autonomy

Treat this filter with the same priority as clinical criteria, not as a secondary preference.

---

## 3. What to Check and Surface

For every recommended facility, attempt to confirm:

| Check | How to Surface |
|---|---|
| Female specialist in requested department | "This hospital has female gynecologists on staff — please call to confirm availability on your preferred day." |
| Female-only OPD timing | "Apollo Clinic [X location] has a ladies-only OPD on Tuesday and Thursday mornings." |
| Female doctor on duty in general medicine | Often available at larger hospitals; suggest calling the OPD desk to confirm |

If the information is not in the database:
> "We don't have confirmed information on female doctor availability at this facility. We recommend calling the OPD desk before your visit and asking specifically for a female [specialist type]."

Do not assume female doctor availability at any facility without confirmation.

---

## 4. Department-Specific Guidance

**Gynecology and Obstetrics**
- Default to female provider at every facility unless patient states otherwise
- For delivery and labor, most women in India expect and prefer female attendants — confirm female OB-GYN or midwife availability

**Breast Examination and Breast Surgery**
- Always apply female provider filter; flag if facility has only male breast surgeons
- Suggest facilities with female surgical oncology teams when available in the city

**Mental Health**
- For female patients raising topics of trauma, domestic violence, or sexual assault — female psychiatrist or psychologist is strongly preferred
- If female mental health provider is unavailable, confirm the facility has at minimum a private consultation room and trained counseling support

**General Medicine and Internal Medicine**
- If patient requests a female GP or internist, note this in the referral
- Many large OPDs have both male and female doctors on rotation; patient should request at registration

**Physiotherapy**
- For post-surgery or musculoskeletal physiotherapy, patients may prefer a female physiotherapist — surface this option if requested

---

## 5. When No Female Provider Is Found

Be honest. Do not force a recommendation that does not meet the patient's stated need.

> "I was not able to find a confirmed female [specialist type] at facilities near you right now. Here are the options:
> 1. [Facility A] — I could not verify; please call ahead.
> 2. [Facility B] — further away but has a confirmed female [specialist].
> 3. [Facility C] — female specialist available on [day only]."

Always offer at least one alternative or a path to verification. Never simply say "no female doctor available" and close the referral.

---

## 6. Documenting the Preference

Log the female provider preference in the referral record so:
- The receiving facility's admission team can note it at registration
- Follow-up contacts respect the preference
- Feedback collection checks whether the preference was honored

---

## Guardrails

- Never override a patient's stated female provider preference for the sake of closer location, lower cost, or convenience
- Never assume a patient does not care about provider gender unless they explicitly state so
- Do not ask invasive questions about why the patient prefers a female provider — accept the preference and act on it
- If no female provider is found after a genuine search, say so clearly and offer alternatives; never present an unverified facility as having female staff when unknown
- This filter applies regardless of the patient's religion, background, or the clinical specialty — it is the patient's right to state a preference

---

## Verify

- [ ] Female provider preference detected and logged in referral record
- [ ] At least one facility with confirmed or likely female provider surfaced
- [ ] If confirmed data is unavailable, patient directed to call facility OPD desk directly
- [ ] Female-only OPD timings surfaced where available
- [ ] Referral note includes the female provider preference for the receiving facility
- [ ] No recommendation made that ignores the stated preference without explicit patient consent
