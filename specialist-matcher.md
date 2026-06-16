---

name: "specialist-matcher"
description: "Use this skill when a care need must be mapped to an exact specialist type rather than a general department — e.g. 'kidney failure' → nephrologist, 'child seizure' → pediatric neurologist."
---

# Specialist Matcher

## 1. When to Use

Use this skill whenever a patient's care need must be resolved to a specific sub-specialist
rather than a broad department. Triggers include:

- The patient describes a symptom or diagnosis that spans multiple specialist types within
  one department (e.g., "heart blockage" could mean interventional cardiologist or cardiac
  surgeon depending on severity and anatomy).
- A referring GP or family physician has written "refer to cardiology / neurology / oncology"
  without specifying the exact type.
- The patient is transferring from a smaller facility where only a general specialist was
  available and now needs tertiary-level expertise.
- The care need involves a paediatric patient, which typically requires a paediatric
  sub-specialist rather than the adult equivalent.

Do not use this skill for routine GP or general physician referrals where no sub-specialty
decision is required.

## 2. Information Gathering

Before mapping to a specialist, collect the following:

- **Care need / presenting complaint**: exact symptom or working diagnosis in plain language.
- **Existing diagnosis**: any confirmed diagnosis from a prior consultation or investigation.
- **Patient age**: determines whether a paediatric specialist is needed (generally under 18).
- **Urgency**: emergency (same day), urgent (within 48–72 hours), or routine (within weeks).
- **Prior treatment**: any surgery, chemotherapy, dialysis, or other intervention already done.
- **Location**: patient's city and willingness to travel to another city or state.
- **Insurance / scheme**: CGHS, ECHS, Ayushman Bharat PM-JAY, private TPA, or self-pay —
  affects which empanelled hospitals are in scope.

## 3. Specialty Mapping

Use the table below to resolve the patient's care need to the correct specialist type.

### Cardiology
| Care Need | Correct Specialist |
|---|---|
| Blocked coronary artery, angioplasty, stent placement | Interventional Cardiologist |
| Bypass surgery (CABG), valve replacement or repair | Cardiac Surgeon |
| Arrhythmia, pacemaker implant, ablation, ICD | Electrophysiologist |
| Heart failure management, echocardiography, general cardiology | Cardiologist |

### Oncology
| Care Need | Correct Specialist |
|---|---|
| Chemotherapy, immunotherapy, targeted therapy, systemic treatment | Medical Oncologist |
| Tumour removal, surgical biopsy, debulking | Surgical Oncologist |
| Radiotherapy, IMRT, SBRT, brachytherapy | Radiation Oncologist |

### Maternity and Gynaecology
| Care Need | Correct Specialist |
|---|---|
| Normal pregnancy monitoring and delivery | Obstetrician |
| Non-pregnancy gynaecological issues (fibroids, PCOS, menstrual) | Gynaecologist |
| High-risk pregnancy (twins, GDM, pre-eclampsia, previous losses) | Maternal-Fetal Medicine Specialist |

### Neurology and Neurosurgery
| Care Need | Correct Specialist |
|---|---|
| Stroke, epilepsy, migraine, Parkinson's, neuropathy | Neurologist |
| Brain tumour, spinal cord compression, cerebral haemorrhage surgery | Neurosurgeon |
| Seizures or neurological conditions in patients under 18 | Paediatric Neurologist |

### Nephrology
| Care Need | Correct Specialist |
|---|---|
| CKD stages 1–4, proteinuria, glomerulonephritis, medication management | Nephrologist |
| End-stage renal disease requiring haemodialysis or peritoneal dialysis | Dialysis Centre / Nephrologist with dialysis unit |
| Pre-transplant workup or post-transplant immunosuppression | Transplant Nephrologist |

### Pulmonology and Thoracic Surgery
| Care Need | Correct Specialist |
|---|---|
| Asthma, COPD, tuberculosis, ILD, sleep apnoea | Pulmonologist |
| Lung tumour resection, lobectomy, thoracotomy, VATS | Thoracic Surgeon |

### Orthopaedics
| Care Need | Correct Specialist |
|---|---|
| Fracture fixation, joint replacement (hip/knee), general bone surgery | Orthopaedic Surgeon |
| Disc herniation, spondylolisthesis, vertebral fracture, spinal fusion | Spine Surgeon |
| Ligament tear (ACL/PCL), tendon injury, sports-related musculoskeletal | Sports Medicine Specialist |

## 4. Facility Check

After identifying the correct specialist type:

1. Verify that the shortlisted hospital has the exact sub-specialist on staff or visiting
   roster — not just the parent department. A hospital may list "Cardiology" but have only
   a general cardiologist and no interventional cardiologist or electrophysiologist.
2. Check OPD availability and wait time for that specific specialist.
3. If the hospital has the department but not the exact specialist, flag this explicitly:
   "Apollo Indore has a Cardiology department but no listed Electrophysiologist — confirm
   before booking."
4. For paediatric sub-specialists, confirm the hospital has a dedicated paediatric wing
   or PICU if the condition may require admission.

## 5. Escalation

Escalate to a higher-tier facility when:

- No matching sub-specialist is available within the patient's city.
- The condition requires a multi-disciplinary tumour board, transplant programme, or
  advanced intervention not available at district or state level.
- Escalation pathway (in order of preference):
  1. Nearest private tertiary care hospital in the same state with the required specialist.
  2. State government medical college and hospital (e.g., JIPMER Puducherry, PGIMER
     Chandigarh, SGPGI Lucknow).
  3. Central institutes: AIIMS Delhi / AIIMS Bhopal / AIIMS Bhubaneswar / Tata Memorial
     Mumbai (oncology) / NIMHANS Bengaluru (neurology/psychiatry).
- Inform the patient of approximate travel cost and whether telemedicine pre-consultation
  is available before physical travel.

## 6. Guardrails

- Do not diagnose or confirm a diagnosis — mapping is done on the basis of the stated care
  need or existing diagnosis provided by the patient or referring doctor.
- Do not recommend a specific named doctor; recommend the specialist type and institution.
- Do not override an existing specialist's recommendation to change specialty type without
  flagging it clearly as a suggestion for the patient to verify with their doctor.
- Always confirm insurance empanelment before presenting a facility as an option under a
  government health scheme.
- For oncology referrals, note that treatment protocols should be discussed in a tumour
  board — do not suggest a single modality (surgery vs chemo vs radiation) as the answer.

## 7. Verify

- [ ] Care need has been mapped to a specific sub-specialist type, not just a department.
- [ ] Patient age has been checked; paediatric specialist selected if patient is under 18.
- [ ] Urgency level noted and appointment timeline communicated accordingly.
- [ ] Shortlisted facility confirmed to have the exact specialist (not just the department).
- [ ] Insurance scheme compatibility verified for each recommended facility.
- [ ] Escalation facility identified if no local match found.
- [ ] No diagnosis made or implied by the skill output.
