---

name: "child-care-referral"
description: "Triggered when the patient is under 18 years old and needs pediatric-specific referral routing."
---

# Child Care Referral

## 1. When to Use

Trigger this skill when:
- Patient age is stated as under 18 years
- User mentions "my child," "my baby," "my son/daughter," "bachcha," or similar
- Query involves neonatal, infant, or adolescent-specific conditions
- User is asking about a pediatric specialist (pediatric surgeon, pediatric cardiologist, neonatologist, etc.)

Always confirm patient age at the start. Pediatric referral rules differ significantly from adult referral workflows.

---

## 2. Why Pediatric Referral Is Different

- Children are not small adults: drug dosing, normal vital signs, and clinical thresholds differ by age and weight
- Always route to a pediatric specialist, not the adult equivalent (e.g., pediatric cardiologist, not adult cardiologist, for a 5-year-old with a heart condition)
- Pediatric wards have different visiting rules, different equipment, and different staffing ratios — adult wards are not equivalent substitutes for young children
- Guardian consent is mandatory for all procedures; the child's assent should also be sought where age-appropriate (typically 7+ years)
- Pediatric dosing is based on weight (mg/kg) — never assume an adult dose is appropriate

---

## 3. Age-Based Routing

| Age Group | Clinical Label | Routing Guidance |
|---|---|---|
| 0–28 days | Neonatal | Level 3 NICU; refer to hospital with neonatologist on site 24/7 |
| 1–12 months | Infant | Pediatric hospital or strong pediatric department; PICU access preferred |
| 1–12 years | Child | Pediatric department with dedicated pediatric ward; pediatric specialist required |
| 13–17 years | Adolescent | Can use pediatric or adult facilities; prefer pediatric if available; flag if adult-only |

**For neonates (0–28 days):** This is a critical age group. Confirm that the referral hospital has:
- A functioning Level 3 NICU (ventilator support, TPN capability)
- A neonatologist available on site, not on-call from home
- Transport incubator if transfer is required

**For adolescents (13–17 years):** Adult hospitals are acceptable when pediatric facilities are unavailable, but flag the gap clearly. Ensure the treating doctor is informed of the patient's age.

---

## 4. Specialist Routing Examples

| Condition | Correct Specialist |
|---|---|
| Heart murmur / congenital heart disease | Pediatric cardiologist |
| Appendicitis / hernia | Pediatric surgeon |
| Epilepsy / developmental delay | Pediatric neurologist |
| Leukemia / lymphoma | Pediatric oncologist |
| Diabetes (Type 1) | Pediatric endocrinologist |
| Kidney disease | Pediatric nephrologist |
| Premature birth complications | Neonatologist |
| Autism / ADHD | Child psychiatrist or developmental pediatrician |

---

## 5. Guardian Consent

- All clinical procedures require written consent from a parent or legal guardian
- If neither parent is available, the legal guardian must provide documented proof of guardianship
- Emergency exception: in a life-threatening emergency where no guardian is reachable, the treating doctor may proceed and document the emergency basis — this is legally permitted under Indian law (Guardians and Wards Act)
- For adolescents (13–17), explain the procedure to the child in age-appropriate language as well; their understanding and cooperation matter clinically

---

## 6. Immunization Check

When a child is being treated for any condition, flag if the child may be due for routine immunizations:

- Check the child's age against the National Immunization Schedule (NIS)
- Common missed vaccines during illness: BCG (at birth), Pentavalent, OPV, Measles-Rubella, JE, HPV (10–12 years girls)
- Do not recommend live vaccines (MMR, OPV) during acute illness or while on immunosuppressants — flag to treating doctor
- If child is behind on vaccines, note this in the referral so the pediatrician can address it during the visit

---

## 7. Practical Considerations

- **Pediatric pharmacy**: confirm the referral hospital's pharmacy stocks pediatric formulations (liquid suspensions, dispersible tablets); many rural pharmacies stock adult formulations only
- **Pediatric nutrition**: admitted children need age-appropriate nutrition; confirm hospital has pediatric dietician or at minimum pediatric-appropriate meals
- **Schooling during long admissions**: for admissions over 2 weeks, government hospitals are required to provide access to education support; ask hospital social worker

---

## Guardrails

- Never recommend an adult-only facility for a patient under 12 without explicitly flagging it and explaining the risk
- Never recommend adult drug dosing or adult-dose medications for pediatric patients
- For neonates (0–28 days) always confirm Level 3 NICU availability before completing the referral
- Always confirm pediatric specialist (not just "pediatrics department") is available at the facility for the specific condition
- Adolescent patients (13–17) being routed to adult facilities must be flagged in the referral note

---

## Verify

- [ ] Patient age confirmed and age group (neonatal/infant/child/adolescent) established
- [ ] Referral routed to pediatric specialist, not adult equivalent
- [ ] For neonates: Level 3 NICU and neonatologist availability confirmed
- [ ] Guardian consent process understood by accompanying adult
- [ ] Immunization status flagged if child appears behind on NIS schedule
- [ ] Pediatric formulations available at facility pharmacy (for prescribed medications)
- [ ] No adult-only facility recommended for patients under 12 without explicit flag
