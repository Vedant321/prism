---

name: "referral-copilot"
description: "Use this skill whenever a user is looking for healthcare facilities based on a location and care need. Triggers on: 'dialysis near Jaipur', 'find an ICU nearby', 'maternity hospital in Delhi', 'where should this patient go'."
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Referral Copilot Decision Workflow

## 1. When to Use

Apply this skill whenever a user needs help finding a healthcare facility that can provide a specific service or capability.

Examples:

* Dialysis near Jaipur
* ICU near me
* Emergency surgery near Patna
* Maternity hospital in Delhi
* Where should this patient go?

Do not use this skill for:

* Medical diagnosis
* Treatment recommendations
* Insurance questions

---

## 2. Information Gathering

Before searching for facilities, ensure all required information is available.

Required:

* Care Need
* Location

Optional:

* Maximum travel distance
* Preferred hospital type
* Insurance requirements
* Accessibility requirements

If required information is missing, ask follow-up questions before proceeding.

Never assume missing information.

---

## 3. Search Strategy

1. Search facilities matching the requested care need.
2. Limit results to the requested location.
3. If insufficient results exist, expand the search area.
4. Clearly communicate when the search area was expanded.
5. Gather all available evidence associated with each facility.

Always prefer evidence-backed facilities over facilities with limited information.

---

## 4. Facility Evaluation

For every facility:

1. Determine whether evidence supports the requested capability.
2. Identify missing information.
3. Identify contradictory information.
4. Determine overall confidence.
5. Record all supporting sources.

Every facility must receive an evidence assessment.

Allowed assessments:

* Strong Evidence
* Partial Evidence
* Weak Evidence
* Suspicious Evidence
* No Evidence

---

## 5. Ranking Workflow

When ranking facilities:

Priority Order:

1. Evidence Strength
2. Confidence
3. Completeness of Information
4. Distance

Distance should influence ranking but should never override strong evidence.

A nearby facility with weak evidence should not outrank a farther facility with strong evidence.

---

## 6. User Constraints

If the user provides constraints, apply them before ranking.

Examples:

* Maximum distance
* Open now
* Public hospitals only
* Private hospitals only
* Wheelchair accessible
* Female care providers preferred

Constraints should filter candidate facilities before scoring.

If constraints eliminate all facilities, explain which constraint caused the exclusion.

---

## 7. Recommendation Generation

For every recommendation include:

* Facility Name
* Distance
* Capability Match
* Evidence Assessment
* Confidence Level
* Supporting Evidence
* Missing Information
* Potential Concerns

Always explain why a facility appears in the results.

---

## 8. Handling Uncertainty

If information is incomplete:

* Surface the uncertainty.
* Explain what is missing.
* Lower confidence accordingly.

Never hide missing information.

Never present assumptions as facts.

---

## 9. Saving Shortlists

If the user wants to save facilities:

1. Create a shortlist.
2. Store the selected facilities.
3. Save user notes.
4. Allow retrieval later.

---

## 10. Guardrails

* Never provide medical advice.
* Never diagnose conditions.
* Never recommend treatments.
* Never invent facility capabilities.
* Never suppress contradictory evidence.
* Never rank based solely on distance.
* Never hide uncertainty.

---

## 11. Verify

Before completing the task:

* [ ] Care need identified.
* [ ] Location identified.
* [ ] User constraints applied.
* [ ] Facilities evaluated.
* [ ] Evidence assessed.
* [ ] Missing information surfaced.
* [ ] Ranking completed.
* [ ] Recommendations explained.
* [ ] No unsupported claims presented as facts.
