---

name: "recommendation-summary"
description: "Use this skill as the final step of every referral search to produce one clear, actionable recommendation the user can act on immediately. Triggers on: completion of hospital search and rating, 'which one should I choose', 'give me your best recommendation', 'what do I do now', 'which hospital should we go to', or automatically after every completed referral workflow."
---

# Recommendation Summary Workflow

## 1. When to Use

Apply this skill as the last step of every referral search.

Run automatically after:
* Hospital search is complete
* Ratings have been computed
* Travel estimates have been calculated

Also trigger explicitly when the user asks:
* "Which one should I choose?"
* "What is your recommendation?"
* "Which hospital should we go to?"
* "What do I do now?"

---

## 2. Purpose

The recommendation summary exists to answer one question for the user:

**"What should I do right now?"**

It is not a repeat of the full shortlist. It is a single, clear, confident recommendation with a backup — plus the immediate next steps.

---

## 3. Select the Top Recommendation

From the rated and ranked shortlist, select the top hospital using this priority order:

1. Highest capability match for the specific care need
2. Highest rating and confidence level
3. Shortest travel time (as a tiebreaker only — never override a better-rated hospital for a closer but weaker one)
4. Public vs private preference (if the user stated one)

If two hospitals are very close in rating:
* Prefer the one with stronger capability evidence
* If still tied, prefer the one with better data completeness
* Surface both as co-recommendations and explain why

---

## 4. Select the Backup Recommendation

Always include one backup option.

The backup should be:
* The second-ranked hospital from the shortlist
* Meaningfully different from the top pick (e.g., public if top is private, or closer if top is further)
* Explained — tell the user why it is the backup and in what situation they should use it

Backup use cases to describe:
* "If the top hospital has no beds available"
* "If the patient cannot afford private care"
* "If travel to the top hospital is not possible in time"

---

## 5. Output Structure

Produce the recommendation in this format:

```
TOP RECOMMENDATION
──────────────────────────────────────────────────
Hospital:       [Hospital Name]
Address:        [Full address]
Care Match:     [✅ Strong Evidence / ⚠️ Partial Evidence] for [care need]
Rating:         [⭐⭐⭐⭐⭐] ([confidence level])
Distance:       [X km from patient]
Travel:         ~[time] by [mode], ~₹[cost range]
Contact:        [Phone number]
Ask for:        [Department / desk / doctor specialty]

WHY THIS HOSPITAL
[2–3 sentences explaining the specific evidence for this recommendation.
What confirms this facility can handle the care need. Be specific — name
the equipment, procedure, or source that supports the claim.]

BACKUP OPTION
──────────────────────────────────────────────────
Hospital:       [Hospital Name]
Address:        [Full address]
Care Match:     [Evidence level] for [care need]
Rating:         [⭐⭐⭐] ([confidence level])
Distance:       [X km from patient]
Travel:         ~[time] by [mode], ~₹[cost range]
Contact:        [Phone number]
Use this if:    [Specific reason — e.g., top hospital is full / patient
                 needs a public facility / travel to top is not possible]

WHAT TO DO RIGHT NOW
──────────────────────────────────────────────────
1. Call [Hospital Name] at [phone] to confirm [department] is available today
2. Carry [Aadhaar card / insurance card / previous medical records / referral letter]
3. [Insurance note: if PMJAY beneficiary, ask for the Ayushman desk on arrival]
4. Travel by [recommended mode] — approximately [time] from patient location
5. [Emergency note if applicable: Call 108 if condition worsens before reaching]

⚠️  IMPORTANT NOTE
──────────────────────────────────────────────────
[If confidence is moderate or low]: This recommendation is based on available
data which may be incomplete. Call the hospital before travelling to confirm
the required service is available.

[If no strong evidence exists]: No facility with strong evidence was found
for this care need in this area. The recommendation above is the best
available option — please verify directly with the hospital.
```

---

## 6. Adapting the Summary by Scenario

### Routine Care (planned visit)
* Lead with rating and capability match
* Include travel options including train or cab
* Suggest booking an appointment in advance

### Emergency
* Lead with the closest verified facility
* Surface 108 / 102 ambulance immediately — before any other information
* Travel section shows only fastest mode
* "What to do now" section is just two steps: call 108 and go to [hospital]

### Cross-State
* Include the shareable summary block from cross-state-referral skill
* Add a remote coordination section for the user who is in another state
* Include government scheme note if applicable

### No Strong Evidence Available
* Be honest — do not pretend confidence that does not exist
* State clearly: "No facility with confirmed evidence for [care need] was found within [X km]"
* Recommend the best available option with an explicit low-confidence flag
* Suggest: nearest city with known coverage, telemedicine option, and district health officer contact

---

## 7. Tone and Language

* Be direct. Do not hedge every sentence.
* Be honest. Do not inflate confidence to sound more helpful.
* Be actionable. Every section must lead to something the user can do.
* Be specific. Name the department, the doctor specialty, the equipment — do not say "good hospital" without saying why.
* Be brief. The user needs to act, not read. Keep the summary scannable.

---

## 8. What to Do When There Is No Good Option

If no hospital in the shortlist has adequate evidence for the care need:

1. Say so clearly — do not bury this fact
2. Show the best available option with a very low confidence flag
3. Provide the nearest city where strong evidence exists (even if far)
4. Suggest telemedicine for interim consultation:
   * eSanjeevani (free government telemedicine platform)
   * State-specific teleconsult services
5. Surface the district health officer or nearest government hospital as a fallback
6. Flag this as a medical desert situation — care gap detected in this region

---

## 9. Guardrails

* Never recommend a hospital without stating the evidence behind it
* Never omit the backup option
* Never omit the "what to do now" steps
* Never present low-confidence ratings as reliable
* Never hide a no-results situation — surface it honestly
* Never include medical advice in the recommendation (what treatment to receive, what medication to take)
* Never invent contact numbers — if not in the data, say "contact number not available — search online or call district health office"

---

## 10. Verify

Before delivering the recommendation summary:

* [ ] Top recommendation selected using correct priority order
* [ ] Capability match evidence stated explicitly
* [ ] Rating and confidence level shown
* [ ] Travel time and cost included
* [ ] Contact number included or flagged as unavailable
* [ ] "Ask for" department or desk included
* [ ] Why this hospital — specific evidence cited
* [ ] Backup option included with use case
* [ ] "What to do right now" steps listed (3–5 steps maximum)
* [ ] Important note added if confidence is moderate or low
* [ ] Emergency escalation included if urgency is emergency
* [ ] No-coverage response included if no strong evidence found
* [ ] Cross-state shareable summary included if applicable
