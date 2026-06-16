---

name: "feedback-collector"
description: "Triggered 48–72 hours after a referral to collect post-visit feedback and update facility records."
---

# Feedback Collector

## 1. When to Use

Trigger this skill when:
- 48–72 hours have elapsed since a referral was made through the copilot
- A scheduled follow-up ping is due for a patient whose referral was logged
- User proactively messages to share feedback about a hospital visit
- System detects an unresolved referral older than 48 hours with no outcome recorded

Do not trigger during an ongoing hospitalization — wait until the patient has been seen or discharged.

---

## 2. Opening the Conversation

Keep the opening brief and warm. The caregiver or patient may still be in a stressful situation.

Example opening:
> "Hi, we wanted to check in on [patient's first name or 'your family member']. Did they get to [hospital name]? We have just a few quick questions — it helps us make better recommendations for others."

Do not open with a long message or a list of questions. Start with one question and branch based on the response.

---

## 3. Core Questions (Maximum 4 — Do Not Exceed)

Ask these in sequence, stopping if the user signals they are busy or distressed:

**Q1 — Did the patient reach the facility?**
- Yes → continue to Q2
- No → ask why (couldn't travel, condition resolved, chose another hospital, financial barrier) → log reason and close gracefully
- Not yet → log as pending; reschedule check-in for 24 hours later

**Q2 — Was the recommended service available when you arrived?**
- Yes → continue to Q3
- No → ask what was unavailable (specialist not present, no beds, service discontinued)
  → flag the facility record for data team review
  → offer to find an alternative if patient still needs care

**Q3 — Was the facility broadly as described (location, type of care, approximate cost range)?**
- Yes → continue to Q4
- No → ask specifically what was different → log discrepancy for data team
  → examples: facility charged significantly more than estimated, doctor specialization did not match, facility was closed

**Q4 — Was the overall experience acceptable?**
- Positive → mark facility as "caregiver-validated" in referral record; thank the user
- Mixed or negative → ask one follow-up: "Would you like to share what went wrong so we can note it?"
  → log the specific issue as a cautionary note on the facility record

---

## 4. Handling Specific Negative Outcomes

**If the patient had a bad care experience (rude staff, negligence concern, unexplained delay)**
- Acknowledge; do not minimize
- Surface grievance channels:
  - Hospital's patient relations / grievance officer (every NABH-accredited hospital must have one)
  - State Medical Council complaint (for doctor misconduct)
  - Consumer Forum for billing/service disputes
  - National Consumer Helpline: 1800-11-4000

**If the patient had a billing dispute or surprise charges**
- Ask if they have itemized bills (recommend they request one if not received)
- For insurance: confirm they have submitted all documents to TPA; share TPA grievance process
- Flag the facility as having "billing discrepancy reported" for data team review

**If the service was simply not available at the facility**
- Log as "service availability gap" on the facility record
- If patient still needs the service → activate the relevant referral skill to find an alternative

---

## 5. Closing the Conversation

- Keep the close short
- If outcome was positive: "Thank you for taking the time — this really helps us improve. Wishing [patient] a smooth recovery."
- If outcome was negative: "Thank you for telling us. We'll note this so others are better informed. If you need any further help, we're here."
- Do not ask for a rating score or NPS — keep it conversational, not transactional

---

## 6. Data Actions on Completion

Record the following fields in the referral log:
- Referral ID
- Date of feedback collected
- Patient reached facility: Yes / No / Pending
- Service availability: Confirmed available / Not available / Partially available
- Facility accuracy: Matches description / Discrepancy noted
- Experience rating: Positive / Mixed / Negative
- Specific issue noted (free text, if any)
- Action taken: None / Data team flagged / Grievance channel surfaced / Alternative referral initiated

---

## Guardrails

- Never push the user for feedback if they signal distress or urgency — always offer to reschedule
- Never share one patient's feedback with another patient; all data is anonymized before use
- Do not promise to "fix" or "penalize" a facility based on a single complaint — be honest that feedback is logged for review
- If user reports a patient safety concern (wrong medication given, wrong procedure, serious harm), treat this as a critical flag — log immediately and suggest they contact the State Medical Council or file a complaint with the hospital's grievance officer

---

## Verify

- [ ] Feedback collected within 72 hours of referral
- [ ] No more than 4 questions asked in total
- [ ] Outcome (positive/negative/pending) recorded in referral log
- [ ] Negative outcomes result in a specific data action (flag, grievance channel, or alternative referral)
- [ ] Closing message is warm and appropriately brief
- [ ] Caregiver was not pushed for feedback if they were unavailable or distressed
