---

name: "hospital-rater"
description: "Use this skill to evaluate and display a trust-worthy quality rating for each shortlisted hospital. Triggers on: 'which hospital is better', 'is this hospital good', 'what is the rating of this hospital', 'how reliable is this facility', or automatically as part of every hospital shortlist to show quality signals alongside distance and travel information."
---

# Hospital Rater Workflow

## 1. When to Use

Apply this skill for every hospital in a shortlist.

Run automatically — every recommendation must include a rating.

Also trigger on explicit user questions:
* "Which hospital is better?"
* "Is Apollo good for cardiac surgery?"
* "What is the rating of this hospital?"
* "How reliable is this facility?"
* "Is this a well-known hospital?"

---

## 2. What a Rating Is Not

A rating here is NOT:
* A star rating from Google or Practo (not available in our data)
* A government accreditation score (only partially available)
* A patient satisfaction score

A rating IS:
* An evidence-based trust signal derived from what we actually know about the facility
* An honest reflection of data completeness and claim reliability
* A signal that must clearly communicate its own uncertainty

---

## 3. Rating Dimensions

Evaluate each hospital across six dimensions.

### Dimension 1: Capability Match (40% weight)
Does the evidence confirm the specific care need the patient has?

* Strong Evidence (4 points) — Capability confirmed across multiple sources with specific details (equipment named, procedure described, specialist mentioned)
* Partial Evidence (3 points) — Capability mentioned but vaguely, or confirmed in only one source
* Weak Evidence (2 points) — Capability implied or mentioned in passing without supporting detail
* Suspicious Evidence (1 point) — Capability claimed but contradicted by other information (e.g., 5-bed clinic claiming full ICU)
* No Evidence (0 points) — Capability not mentioned anywhere

### Dimension 2: Facility Size (20% weight)
* Over 200 beds: 4 points
* 100–200 beds: 3 points
* 50–100 beds: 2 points
* Under 50 beds: 1 point
* Unknown: 0 points — flag as missing

### Dimension 3: Facility Type (15% weight)
* Tertiary care / super-specialty: 4 points
* Secondary care / multi-specialty: 3 points
* Primary care / general clinic: 2 points
* Single specialty (relevant to need): 2 points
* Unknown: 0 points

### Dimension 4: Data Completeness (15% weight)
How much do we actually know about this facility?

* All key fields present (name, address, coords, description, capability, equipment, contact): 4 points
* Most fields present, minor gaps: 3 points
* Moderate gaps (missing equipment or procedure detail): 2 points
* Major gaps (description thin, capability vague): 1 point
* Critical gaps (no contact, no description, no evidence): 0 points

### Dimension 5: Operational Signals (10% weight)
Signals that the facility is active and operating:

* Recent social media activity + contact info verified: 4 points
* Has contact info and website: 3 points
* Has contact info only: 2 points
* Has website only: 1 point
* No operational signals: 0 points

---

## 4. Compute the Rating

Calculate a weighted score out of 4.0.

Map to star rating:
* 3.5 – 4.0 → ⭐⭐⭐⭐⭐ Excellent
* 3.0 – 3.4 → ⭐⭐⭐⭐ Good
* 2.0 – 2.9 → ⭐⭐⭐ Moderate
* 1.0 – 1.9 → ⭐⭐ Low
* Under 1.0 → ⭐ Very Low — not recommended without verification

---

## 5. Confidence Level

Every rating must include a confidence level — the rating means nothing without it.

### High Confidence
* Multiple fields are populated
* Capability claim is specific and detailed
* Evidence comes from more than one source
* Contact information present

Label: "High confidence — well-documented facility"

### Moderate Confidence
* Some fields are present but incomplete
* Capability mentioned in only one source
* Limited equipment or procedure detail

Label: "Moderate confidence — verify capability before referring"

### Low Confidence
* Few fields populated
* Capability is vague or implied
* Description is thin (under 50 characters)
* Only one source of information

Label: "Low confidence — limited data available, call ahead to confirm"

### Very Low Confidence
* Critical fields missing (no name, no address, no contact)
* No capability evidence for the requested care need
* Data bleed-over or suspicious entries detected

Label: "Very low confidence — not recommended without direct verification"

---

## 6. Special Flags

Surface these flags alongside the rating when applicable:

* 🔴 **Data Quality Flag** — Specialty field shows data artifact (repeated entries, copy-paste detected). Capability claims from specialty field are unreliable for this facility.
* 🔴 **Capacity Mismatch** — Facility claims advanced procedures but has very few beds. Verify independently.
* 🟡 **No Contact Info** — Cannot be called to confirm availability. Visit in person or verify through another source.
* 🟡 **No Coordinates** — Location on map could not be verified. Confirm address before travelling.
* 🟢 **Public Facility** — Government-run. Likely longer wait times but lower or zero cost. Ayushman Bharat / PMJAY accepted.
* 🟢 **Private Facility** — Typically faster access but out-of-pocket cost applies unless insured.

---

## 7. Output Format

For each hospital produce:

```
[Hospital Name]
Rating:      ⭐⭐⭐⭐ Good
Confidence:  High — well-documented facility

Capability:  Strong Evidence
             "Cardiac catheterisation lab confirmed. Cardiac ICU mentioned
              in 2 sources. Cardiothoracic surgery listed in procedures."

Size:        450 beds | 120+ doctors
Type:        Private, tertiary care
Established: 1993

Operational: Website active | Phone: 020-66455555
             Last social media activity: recent

Flags:       🟢 Private facility — cost applies
```

---

## 8. Honest Uncertainty Rules

* If a rating dimension cannot be scored due to missing data, do not guess. Score it 0 and flag it.
* Never show a high overall rating when the capability match dimension is low.
* Never suppress a red flag to make a rating look better.
* If data completeness is very low, add a prominent disclaimer: "This rating is based on limited available data. Call the facility directly before referring."
* If the specialty field has the data artifact (repeated internalMedicine entries), disregard specialty as an evidence source and note this explicitly.

---

## 9. Comparison Mode

When a user asks to compare two or more hospitals:

Produce a side-by-side table:

```
                    Hospital A          Hospital B
Rating              ⭐⭐⭐⭐              ⭐⭐⭐
Confidence          High                Moderate
Capability Match    Strong Evidence     Partial Evidence
Beds                450                 80
Type                Private             Public
Travel Time         12 min              25 min
Travel Cost         ₹80                 ₹150
Contact             Available           Available
Key Flag            —                   No equipment detail
```

Always conclude with a clear recommendation: which hospital is better for this specific care need, and why.

---

## 10. Guardrails

* Never assign a high rating based on only one data point
* Never hide a red flag to improve perceived rating
* Never compare hospitals without surfacing the confidence level of each rating
* Never present the rating as a patient satisfaction or government accreditation score
* Always show the evidence behind the rating, not just the stars

---

## 11. Verify

Before completing the rating for each hospital:

* [ ] All five dimensions scored
* [ ] Weighted rating calculated and mapped to stars
* [ ] Confidence level assigned and labelled
* [ ] Special flags checked and surfaced if applicable
* [ ] Evidence citations shown for capability match
* [ ] Uncertainty disclosed where data is thin
* [ ] Comparison table produced if user requested comparison
