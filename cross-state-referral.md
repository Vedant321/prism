---

name: "cross-state-referral"
description: "Use this skill when the user searching for a hospital is in a different state from the patient who needs care. Triggers on: 'I am in Delhi but my friend is in Chennai', 'searching for my mother in another state', 'he is admitted in a different city', 'can Ayushman Bharat work in another state', 'I want to find a hospital far from where I am', or when location-resolver detects is_cross_state = true."
---

# Cross-State Referral Workflow

## 1. When to Use

Apply this skill when:

* `is_cross_state = true` from the location-resolver skill
* The user explicitly mentions being in a different state or city from the patient
* The user asks about insurance portability across states
* The user needs to coordinate care remotely for someone in another location

This skill works alongside all other skills — it does not replace them. It adds the cross-state layer on top of the standard referral workflow.

---

## 2. Establish the Two Locations Clearly

At the start, confirm and display both locations explicitly so there is no confusion throughout the conversation.

```
Searching for:   [Care need]
Patient is in:   [Patient city, state]
You are in:      [User city, state]

All hospital results will be based on the patient's location.
```

Never mix up the two locations at any point in the workflow.

---

## 3. Anchor All Searches to Patient Location

Every hospital search, every distance calculation, and every travel estimate must be relative to the patient's location — not the user's.

If the user asks "how far is it?" — the answer is distance from the patient, not from the user.

If the user asks "how long will it take?" — travel time is for the patient to reach the hospital, not for the user.

Exception: If the user is travelling to be with the patient, they may also need travel information to reach the patient's city. Handle this as a separate request after the hospital referral is complete.

---

## 4. Assess Whether the Patient Should Travel

Before recommending the nearest hospital in the patient's location, check whether the patient would benefit more from travelling to a better-equipped facility.

### Recommend staying local if:
* Condition is emergency or acute — patient cannot safely travel
* Adequate verified care exists within the patient's city or district
* The patient is elderly, immobile, or has limited support for travel

### Suggest travel to a better facility if:
* No strong-evidence facility exists in the patient's city for the requested care need
* The care need is complex or rare (oncology, neurosurgery, organ transplant)
* A significantly better facility exists within 100–300 km
* The patient is stable enough to travel

If suggesting travel: be specific — name the recommended destination city, the facility, and provide travel estimates using the travel-estimator skill.

---

## 5. Government Scheme Portability

Surface applicable schemes and confirm whether they work across state lines.

### Ayushman Bharat / PMJAY
* Portable across all states in India
* Patient can use PMJAY entitlement at any empanelled hospital in any state
* Ask: "Is the patient a PMJAY beneficiary?" If yes, confirm the hospital is empanelled
* Action: Suggest the patient ask for the PMJAY / Ayushman desk at the receiving hospital

### CGHS (Central Government Health Scheme)
* Valid across India for central government employees and pensioners
* Patient can seek cashless treatment at CGHS-empanelled hospitals nationwide
* Action: Check if the recommended hospital is CGHS-empanelled

### ESI (Employees State Insurance)
* Generally state-specific but has referral provisions for specialist care in other states
* Action: Suggest the patient carry their ESI card and ask about referral procedures

### State Government Schemes
* State-specific schemes (e.g., Atal Amrit Abhiyan in Assam, Dr. YSR Aarogyasri in Andhra Pradesh) generally do not apply outside the originating state
* However, many states have reciprocal referral agreements for tertiary care
* Action: Flag this limitation and suggest the patient confirm with the district health office

### No Scheme
* If no scheme applies: flag that treatment will be out-of-pocket and provide cost context with the hospital rating

---

## 6. What the Remote User Can Do

The user searching is in a different state and may feel helpless. Provide specific actions they can take remotely.

Remote actions the user can take:
1. **Call ahead** — Contact the hospital on behalf of the patient to check bed availability and OPD timings
2. **Book OPD online** — Many hospitals offer online appointment booking; guide the user to do this
3. **Arrange documents** — Request the patient or local family to gather Aadhaar, medical records, and insurance cards before travelling
4. **Share the referral summary** — Generate a shareable summary the user can send to the patient or local contact via WhatsApp/SMS
5. **Contact local support** — If the patient has no one nearby, suggest NGO helplines or district health officers who may assist

---

## 7. Generate a Shareable Summary

Produce a version of the recommendation formatted for sharing — short, clear, and actionable for someone receiving it on a phone.

Format (designed for WhatsApp or SMS):

```
HOSPITAL REFERRAL
─────────────────
Patient needs: [Care need]
Go to: [Hospital Name]
Address: [Full address]
Distance from you: [X km]
Travel: [Mode, ~time, ~₹cost]
Contact: [Phone number]
Ask for: [Relevant department or desk]
Bring: [Aadhaar / insurance card / medical records]

Insurance: [PMJAY / CGHS / ESI note if applicable]

If emergency: Call 108 immediately.

Sent via Healthcare Referral Copilot.
```

Always include this shareable summary in cross-state referrals.

---

## 8. User Travelling to Join the Patient

If the user indicates they are also travelling to be with the patient:

1. Acknowledge this separately from the hospital referral
2. Provide travel information for the user from their location to the patient's city
3. Suggest coordinating arrival times with the patient or local contact
4. Do not mix user travel with patient travel — keep them separate in the output

---

## 9. Time Zone and Communication Note

India operates in a single time zone (IST) — no time zone complexity.

However, if the patient is in a remote or rural area:
* Phone connectivity may be limited — flag this if the hospital is in a remote district
* Suggest confirming the hospital appointment before the patient travels

---

## 10. Guardrails

* Never anchor a hospital search to the user's location in a cross-state scenario
* Never confuse distance from user with distance from patient
* Never recommend that a critically ill patient travel without flagging the risk
* Never assume a state government scheme applies outside its originating state without verification
* Never skip the shareable summary in a cross-state referral

---

## 11. Verify

Before completing the cross-state referral:

* [ ] Both user location and patient location confirmed and displayed
* [ ] All hospital searches anchored to patient location
* [ ] Patient travel assessed — stay local or travel to better facility
* [ ] Government scheme portability checked and communicated
* [ ] Remote actions listed for the user
* [ ] Shareable summary generated
* [ ] User travel handled separately if they are also travelling
* [ ] Emergency escalation included if condition is urgent
