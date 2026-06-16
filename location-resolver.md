---

name: "location-resolver"
description: "Use this skill at the start of every referral search to identify whose location matters — the user or the patient. Triggers on: 'for my friend in Jaipur', 'my mother is in Patna', 'near Sector 15 Noida', 'I am in Delhi but he is in Surat', any vague or landmark-based location, or any mention of a third person needing care."
---

# Location Resolver Workflow

## 1. When to Use

Apply this skill before any hospital search begins.

Always run this skill first when:

* The user mentions a third person needing care (friend, mother, brother, patient)
* The user provides a vague or landmark-based location
* The user is in a different city or state from the patient
* It is unclear whose location should anchor the search

Do not skip this skill and assume the user's location is the patient's location.

---

## 2. Core Rule

The search must always be anchored to the **patient's location**, not the user's location.

The person searching and the person needing care are often different people in different places.

---

## 3. Detect the Relationship

Identify who is asking and who needs care.

### User = Patient
Signals:
* "Find a hospital near me"
* "I need dialysis"
* "Where should I go for cardiac care"

Action: User location is the patient location. Proceed.

### User ≠ Patient
Signals:
* "for my friend / mother / brother / father / sister / colleague / patient"
* "he is in / she is in / they are in"
* "I am in X but the patient is in Y"
* "searching on behalf of"
* Any third-person reference to the person needing care

Action: Extract the patient's location. Do not use the user's location for the search.

---

## 4. Extract Patient Location

Once the relationship is identified, extract the patient location.

### Explicit location given
Examples:
* "My friend is in Jaipur" → patient location = Jaipur
* "My mother is in Patna, Bihar" → patient location = Patna, Bihar
* "He had an accident near Surat" → patient location = Surat

Action: Use the stated location directly.

### Vague or landmark-based location
Examples:
* "near Sector 15 Noida"
* "near Connaught Place"
* "near the railway station in Coimbatore"
* "around Andheri West"

Action:
1. Acknowledge the landmark
2. Resolve it to the nearest city and approximate area
3. Confirm with the user before searching: "I'll search near Andheri West, Mumbai — is that correct?"

### Location missing entirely
If no patient location is provided at all:

Action:
1. Ask for the patient's location directly
2. Do not assume, do not use the user's location
3. Ask: "Where is the patient currently located? Please share the city, area, or pincode."

---

## 5. Detect Cross-State Situations

Compare the user's location and the patient's location.

If they are in different states:
1. Flag the cross-state situation explicitly
2. Store both locations separately:
   * `user_location` — where the person searching is
   * `patient_location` — where the patient is
3. Hand off to the `cross-state-referral` skill for scheme and coordination logic
4. Continue anchoring all hospital searches to `patient_location`

Example:
> "I'm in Delhi, my brother had an accident in Surat"
> → user_location = Delhi, patient_location = Surat
> → Search near Surat
> → Trigger cross-state-referral skill

---

## 6. Resolve Ambiguous Locations

Some locations need clarification before searching.

### Multiple cities with the same name
Example: "Aurangabad" exists in Maharashtra and Bihar.

Action: Ask — "Did you mean Aurangabad in Maharashtra or Bihar?"

### Pincode given
Action: Accept as-is. Use pincode as the search anchor.

### District or village name given
Action: Map to the nearest major town or district headquarters and confirm with the user.

### Foreign location given
Action: Out of scope. Politely inform the user this service covers India only.

---

## 7. Confirm Before Searching

Before triggering any hospital search, confirm the resolved location with the user.

Format:
> "I'll search for [care need] near [resolved patient location]. Is that correct?"

Allow the user to correct it before proceeding.

Do not search without confirmation if the location was vague, inferred, or cross-state.

---

## 8. Output

Produce a structured location object to pass to the next skill:

* `patient_location` — resolved city, area, or pincode
* `user_location` — where the user is (if different)
* `is_cross_state` — true or false
* `relationship` — self / friend / family / patient (professional context)
* `location_confidence` — high (explicit) / medium (inferred from landmark) / low (vague or missing)
* `needs_confirmation` — true or false

---

## 9. Guardrails

* Never use the user's location as the patient's location without confirmation
* Never assume a city from a partial name without verifying
* Never proceed to hospital search if patient location is unresolved
* Never ask for more information than is needed to resolve the location

---

## 10. Verify

Before handing off to the next skill:

* [ ] Patient location identified and resolved
* [ ] User location and patient location distinguished if different
* [ ] Cross-state situation detected and flagged if applicable
* [ ] Vague locations resolved or clarification requested
* [ ] Location confirmed with user if inferred
* [ ] Location object produced with confidence level
