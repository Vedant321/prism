---

name: "accessibility-checker"
description: "Triggered when the patient has a physical disability, mobility impairment, or sensory impairment that affects which facilities are appropriate."
---

# Accessibility Checker

## 1. When to Use

Trigger this skill when:
- User mentions "wheelchair," "can't walk," "crutches," "walker," "paralysis," "paraplegic"
- Patient is elderly with confirmed mobility impairment
- User mentions "visually impaired," "blind," "can't see"
- User mentions "hearing impaired," "deaf," "hearing aid"
- User mentions a condition that predictably involves mobility impairment (stroke, spinal cord injury, severe arthritis, lower limb amputation)
- Caregiver says the patient "can't manage stairs" or "needs to be carried"

Apply this skill in addition to the condition-specific referral — it is an overlay that filters and flags facilities, not a standalone skill.

---

## 2. Physical Access Checklist

For every recommended facility, attempt to verify or flag the following:

| Access Feature | Why It Matters |
|---|---|
| Ramp at main entrance (not just stairs) | Wheelchair user cannot enter without this |
| Lift to all clinical floors | Wheelchair user cannot access upper-floor OPD or ward without lift |
| Wheelchair-accessible OPD consultation room | Standard doorways may not accommodate wheelchairs |
| Wheelchair-accessible bathroom on the ward | Essential for in-patients with mobility impairment |
| Parking close to the entrance | Long distance from parking to entrance is a barrier |
| Wheelchair available at hospital entrance | Not all patients travel with their own |

If any of these is unknown, flag it explicitly:
> "We do not have confirmed accessibility information for this facility. Recommend calling and asking specifically about [ramp / lift / wheelchair access] before traveling."

---

## 3. Communication Access

**For patients with hearing impairment**
- Sign language interpreters are rare in Indian hospitals — flag if a facility has one; it is genuinely uncommon and worth noting
- Alternatives: written communication; hospital staff writing on paper; caregiver present to facilitate
- When surfacing a facility, note if they have a dedicated hearing-impaired patient service or if the staff has any sign language capability
- Hearing loop systems are not common in Indian hospital waiting areas; flag if present

**For patients with visual impairment**
- Sighted guide assistance at reception: confirm whether hospital reception staff are trained to guide visually impaired patients from entrance to OPD
- Large-print materials: uncommon in most Indian hospitals; digital accessibility on hospital apps varies
- Audio announcements in lifts and common areas: note if present

**For patients with cognitive or intellectual disability**
- Caregiver must be present for all appointments and procedures
- Confirm hospital has experience with patients who may have difficulty following instructions or waiting quietly

---

## 4. Patient Escort Services

Some larger hospitals offer internal patient escort services — a staff member who helps the patient move from reception to OPD to diagnostics and back. This is especially helpful for:
- Wheelchair users in multi-building hospital campuses
- Visually impaired patients
- Elderly patients attending alone

If the hospital offers this, surface it prominently — it can significantly reduce caregiver burden and patient distress.

---

## 5. Legal Framework — Rights of Persons with Disabilities Act 2016

Under the Rights of Persons with Disabilities (RPWD) Act 2016:
- **Government hospitals are legally required to be accessible** to persons with disabilities; non-compliance can be reported to the Chief Commissioner for Persons with Disabilities
- **Private hospitals with 50 or more beds** are expected to comply with accessibility norms; compliance is uneven and must be verified
- If a user reports a hospital is non-compliant with accessibility requirements, surface the grievance pathway:
  - State Commissioner for Persons with Disabilities (each state has one)
  - Chief Commissioner for Persons with Disabilities: ccpd.nic.in

Do not make legal claims about specific hospitals without verification — frame it as the patient's right to inquire and report.

---

## 6. Assistive Devices — ADIP Scheme

If the patient lacks an essential assistive device (wheelchair, hearing aid, crutches, white cane):
- **ADIP Scheme (Assistance to Disabled Persons)**: Government of India scheme providing assistive devices to persons with disabilities below income threshold
- Implemented through District Social Welfare offices and NGOs like ALIMCO
- Patient must produce disability certificate; contact district office for current camp schedule
- This is relevant at discharge planning stage: do not send a patient home without confirming they have necessary mobility aids

---

## 7. When Accessibility Cannot Be Confirmed

If a facility is clinically appropriate but accessibility cannot be confirmed:

1. Recommend calling the hospital before traveling (provide the general helpline number if available)
2. Suggest calling specifically and asking: "Main wheelchair par hoon — kya aapke yahaan ramp aur lift hai?" (I am in a wheelchair — do you have a ramp and lift?)
3. If travel is being arranged, recommend checking accessibility before the day of the appointment to avoid an inaccessible journey being wasted
4. Offer to search for an alternative facility if accessibility at the first choice cannot be confirmed

---

## Guardrails

- Never recommend a facility that requires stair climbing for a wheelchair user without explicitly flagging this as a critical access barrier
- Never assume a hospital is accessible because it is large, private, or NABH-accredited — accessibility compliance varies widely
- Surface accessibility uncertainty honestly — do not omit the caveat to make a recommendation look cleaner
- Do not recommend a patient "manage somehow" at an inaccessible facility — find an alternative or flag the gap
- Accessibility features are not optional add-ons; for a mobility-impaired patient they determine whether care is physically reachable at all

---

## Verify

- [ ] Nature of disability / impairment confirmed from user input
- [ ] Physical access checklist applied to every recommended facility
- [ ] Facilities with unconfirmed accessibility flagged with a call-ahead recommendation
- [ ] No facility requiring stair-climbing recommended for a wheelchair user without explicit flag
- [ ] Communication access features surfaced for hearing-impaired or visually impaired patients
- [ ] ADIP scheme mentioned if patient appears to lack an essential assistive device
- [ ] RPWD Act grievance pathway surfaced if patient reports an inaccessible government facility
