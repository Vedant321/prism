---

name: "elderly-care-referral"
description: "Triggered when the patient is 65 or older and needs a geriatric-aware referral with comorbidity and safety checks."
---

# Elderly Care Referral

## 1. When to Use

Trigger this skill when:
- Patient age is stated as 65 or older
- User mentions "my elderly parent," "senior citizen," "budhe hain," or similar
- Patient has multiple conditions being managed simultaneously (comorbidities)
- Query involves fall risk, cognitive impairment, mobility issues, or long-term admission planning
- Post-acute care planning is needed for an older patient being discharged

---

## 2. Why Geriatric Referral Is Different

Older patients present distinct challenges that standard adult referral workflows do not account for:

- **Comorbidity**: it is common for a patient aged 65+ to have diabetes, hypertension, chronic kidney disease, and a cardiac condition simultaneously — each adding complexity to treatment and medication choices
- **Polypharmacy risk**: patients on 5 or more medications have significantly higher risk of drug interactions, adverse events, and falls — this must be flagged at referral
- **Atypical presentations**: elderly patients may present with confusion, falls, or reduced appetite as the primary symptom of conditions like pneumonia, UTI, or myocardial infarction — clinicians must be aware
- **Cognitive impairment**: dementia or delirium may affect the patient's ability to give informed consent or report symptoms accurately — caregiver involvement is essential
- **Longer recovery**: recovery and rehabilitation timelines for elderly patients are longer; discharge planning should begin at admission, not on discharge day
- **Fall risk**: hospital environments are a common site of falls for elderly patients; this must be assessed and mitigated from day one

---

## 3. Hospital Capability Checks for Elderly Patients

Before completing a referral, confirm or flag the following:

| Capability | Why It Matters |
|---|---|
| Geriatric medicine department or geriatrician on staff | Holistic management of comorbidities and polypharmacy |
| Fall prevention protocol (bed rails, non-slip floors, call bell within reach) | Hospitalized elderly have high fall risk |
| Physiotherapy available in-ward | Early mobilization reduces complications in elderly patients |
| Social worker for discharge planning | Complex family situations and post-discharge needs are common |
| Lift access to all floors | Mobility-impaired patients cannot use stairs |
| Accessible bathrooms (grab bars, commode height) | Reduces fall risk during hospital stay |

If information on these capabilities is unavailable, flag it clearly: "We could not verify geriatric support at this facility — recommend calling ahead to confirm."

---

## 4. Polypharmacy Flag

Flag polypharmacy risk if the patient is on 5 or more regular medications.

Action on flag:
- Note in the referral: "Patient on [X] medications — medication reconciliation by a geriatrician or clinical pharmacist recommended at admission"
- Ask the caregiver to bring the complete, current medication list to the hospital (all medications including supplements and OTC drugs)
- Common high-risk combinations in Indian elderly patients:
  - Warfarin + NSAID (bleeding risk)
  - ACE inhibitor + potassium-sparing diuretic in CKD (hyperkalemia)
  - Multiple antihypertensives causing orthostatic hypotension → fall risk
  - Sedatives/benzodiazepines in elderly → fall and confusion risk

---

## 5. Consent and Cognitive Impairment

- If the patient has known dementia or is showing signs of confusion, the caregiver/family must be the primary point of consent alongside the patient
- Document who is providing consent and their relationship to the patient
- If no family member is present and patient lacks capacity, the treating doctor must follow the legal process for medical decision-making under the Mental Healthcare Act 2017 and general medical ethics guidelines
- Never assume cognitive impairment based on age alone; many 80+ year olds have full decision-making capacity

---

## 6. Practical Concerns for Long Stays

- **Transport**: elderly patients should not travel alone; confirm caregiver accompaniment is arranged
- **Diet**: confirm hospital provides soft food options (for patients with dental issues or dysphagia); alert the nursing team if the patient has specific dietary needs
- **Prayer and routine**: elderly patients, especially those with dementia or anxiety, benefit from routine; if the patient has specific prayer or daily rituals, let the nursing team know so accommodations can be made
- **Skin care**: bedbound elderly patients are at high risk of pressure sores; ask nursing team about turning schedule and pressure-relieving mattress availability

---

## 7. Discharge Planning — Start at Admission

For elderly patients with complex needs, discharge planning should be initiated within the first 48 hours of admission:

- What is the expected discharge destination? (Home with caregiver, son/daughter's home, elder care facility)
- Is the home environment safe for return? (Ground floor or lift access, caregiver able to manage, no safety hazards)
- What home care or community support will be needed post-discharge?
- Does the family need social worker support for care coordination or financial assistance?

---

## Guardrails

- Never recommend a facility that requires stair climbing for a mobility-impaired elderly patient without explicitly flagging this
- Always flag polypharmacy if patient is on 5 or more medications
- Do not assume that the "best" hospital for a condition is the right hospital for an elderly patient — accessibility, geriatric capability, and family proximity matter equally
- Cognitive impairment does not remove the patient's right to be involved in decisions to the extent they are able
- If caregiver reports the patient lives alone with no support, escalate to social worker referral before completing the referral

---

## Verify

- [ ] Patient age confirmed as 65+
- [ ] Comorbidity list collected (at minimum: diabetes, hypertension, cardiac, renal, respiratory)
- [ ] Polypharmacy flag raised if patient is on 5+ medications
- [ ] Facility checked for geriatric capability and lift/accessibility
- [ ] Caregiver accompaniment confirmed for transport
- [ ] Fall risk noted in referral
- [ ] Discharge planning initiation flagged to receiving facility or family
