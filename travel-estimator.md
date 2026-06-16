---

name: "travel-estimator"
description: "Use this skill after hospitals have been shortlisted to calculate travel time, travel cost, and recommended mode of transport from the patient location to each hospital. Triggers on: 'how far is it', 'how long will it take', 'how much will it cost to get there', 'can they travel by train', 'is there a cab available', or automatically after every hospital shortlist is generated."
---

# Travel Estimator Workflow

## 1. When to Use

Apply this skill after a hospital shortlist has been produced.

Run automatically for every shortlisted hospital — the user should not have to ask for travel information separately.

Also trigger on explicit user questions:
* "How long will it take to get there?"
* "How much will it cost?"
* "Is there a train from here?"
* "Can they drive?"
* "How far is Apollo from the patient?"

---

## 2. Inputs Required

* `patient_location` — from the location-resolver skill
* `hospital_location` — address of each shortlisted hospital
* `urgency_level` — emergency or routine (affects mode recommendation)
* `patient_condition` — if known (affects whether self-travel is advised)

---

## 3. Distance Buckets and Mode Logic

Calculate approximate distance from patient location to each hospital.
Apply the following mode logic:

### Under 5 km — Local Travel
Recommended modes:
* Auto-rickshaw
* Cab (Ola / Uber)
* Walking (only if patient condition allows)

Provide:
* Estimated time: 5–20 minutes depending on traffic
* Estimated cost: ₹30–₹150 by auto / ₹60–₹200 by cab

### 5–50 km — City or Nearby Town
Recommended modes:
* Cab (Ola / Uber / local taxi)
* Bus (if available and patient condition allows)

Provide:
* Estimated time: 20 minutes to 1.5 hours depending on distance and traffic
* Estimated cost: ₹200–₹800 by cab

### 50–300 km — Inter-City
Recommended modes:
* Cab (for distances up to ~150 km)
* Train (preferred for longer distances)
* State transport bus

Provide:
* Train options: express or superfast trains on the route, approximate journey time
* Train fare estimate: Sleeper ₹100–₹400 / AC 3-tier ₹300–₹900
* Cab estimate: ₹1,500–₹6,000 depending on distance
* Nearest railway station to patient and to hospital

### 300–800 km — Long Distance
Recommended modes:
* Train (overnight or day express)
* Flight (if condition is serious or travel time matters)

Provide:
* Train journey time and fare estimate (Sleeper and AC)
* Flight time and approximate fare range
* Nearest airport to patient and to hospital
* Note if overnight travel is involved

### Over 800 km — Long Distance / Cross-State
Recommended modes:
* Flight (primary recommendation)
* Train (if flight is unaffordable or unavailable)

Provide:
* Flight time and fare estimate
* Train journey time (note: may be 12–30 hours)
* Nearest airport to patient and to hospital
* Flag that distance may impact time-sensitive conditions

---

## 4. Urgency Override

If urgency is emergency:

1. Do not recommend train or flight as primary option
2. Recommend the nearest hospital regardless of evidence rating
3. Surface ambulance options immediately:
   * 108 — National Emergency Ambulance Service (free)
   * 102 — National Ambulance Service (maternity focused)
   * Private ambulance if 108 response time is uncertain
4. Add note: "Do not wait for transport — call 108 now if the patient cannot move safely"

---

## 5. Ambulance Flag

Flag ambulance as the recommended transport if any of the following are true:
* Urgency level is emergency
* Patient is unconscious, immobile, or in severe pain
* Condition involves chest pain, stroke symptoms, severe trauma, or difficulty breathing
* Distance is under 50 km and condition is critical

Ambulance contacts to surface:
* **108** — Free emergency ambulance (all states)
* **102** — Free maternity ambulance (most states)
* State-specific services if known (e.g., CATS in Delhi, GVK EMRI in multiple states)

---

## 6. Travel Cost Guidance

Always present cost as an estimate range, not a fixed number.

Be honest about uncertainty:
* Cab fares vary by city, time of day, and surge pricing
* Train fares depend on class and availability
* Flight fares change daily

Add a note: "Costs shown are approximate estimates. Verify current fares before travel."

If patient is an Ayushman Bharat / PMJAY beneficiary:
* Flag that some state schemes include transport reimbursement
* Suggest asking at the hospital's PMJAY desk about travel support

---

## 7. Nearest Transport Hubs

For distances over 50 km, always include:
* Nearest railway station to the patient (with approximate distance)
* Nearest railway station to the hospital (with approximate distance)
* Nearest airport to the patient (if distance is over 300 km)
* Nearest airport to the hospital (if distance is over 300 km)

---

## 8. Output Format

For each hospital in the shortlist, produce:

```
TRAVEL TO [Hospital Name]
─────────────────────────────────────
Distance:       [X km from patient]
Recommended:    [Mode of transport]
Travel Time:    [Estimated time]
Estimated Cost: [₹ range]
Nearest Station: [Station name, X km from patient]
Ambulance:      [Flag if applicable — call 108]

Alternative options:
  - [Second mode]: [time], [cost estimate]
  - [Third mode if applicable]: [time], [cost estimate]
```

---

## 9. Cross-State Travel

If `is_cross_state` is true:

1. Default to train or flight for primary recommendation
2. Surface IRCTC booking note for train travel
3. Flag that border crossing adds no complications within India
4. Note the state the hospital is in and whether the patient is familiar with the area
5. Suggest the user arrange local contact near the hospital city if patient is travelling alone

---

## 10. Guardrails

* Never give a single fixed cost — always give a range
* Never recommend self-driving for emergency conditions
* Never omit ambulance option when urgency is emergency
* Never assume a patient can travel independently without confirming condition
* Always note that estimates should be verified before travel
* Never recommend a farther hospital purely for travel convenience if it has weaker evidence

---

## 11. Verify

Before completing travel estimates:

* [ ] Distance calculated for every shortlisted hospital
* [ ] Mode of transport recommended based on distance and urgency
* [ ] Travel time estimated
* [ ] Travel cost estimated as a range
* [ ] Ambulance option surfaced if urgency is emergency
* [ ] Nearest transport hubs included for distances over 50 km
* [ ] Cross-state travel flagged and handled if applicable
* [ ] Cost uncertainty disclosed
