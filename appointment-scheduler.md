---

name: "appointment-scheduler"
description: "Use this skill to help a patient book an OPD appointment at a recommended hospital — covers online, phone, walk-in, and government hospital queuing."
---

# Appointment Scheduler

## 1. When to Use

Use this skill after a hospital or specialist has been recommended and the patient or caregiver is ready to book an outpatient (OPD) appointment. This skill does not apply when the patient needs emergency care — see the Emergency Note section below.

## 2. Information Gathering

Before proceeding, confirm the following details:

- Hospital name and city
- Department or specialist needed (e.g., cardiology, orthopaedics, neurology)
- Patient full name and age
- Preferred day(s) and time slot (morning / afternoon)
- Insurance type (private insurance, Ayushman Bharat / PMJAY, CGHS, ECHS, or out-of-pocket)
- Language preference for consultation (Hindi, English, regional language)
- Whether this is an OPD visit or a follow-up to an existing case
- Whether the condition is routine or urgent (but not an emergency)

## 3. Booking Channels by Hospital Type

### Government Hospitals (AIIMS, PGIMER, JIPMER, large state hospitals)

- Most government OPDs operate on a walk-in token basis. No prior booking is required.
- Arrive early: 6–7 AM is recommended to secure a token; counters often reach capacity by mid-morning.
- AIIMS Delhi and select AIIMS branches offer online registration at aiimsonline.com or the national ORS portal (ors.gov.in). Patients must register once and can then book slots online.
- PGIMER Chandigarh and JIPMER Puducherry have their own portals; check the hospital website for current availability.
- e-Sanjeevani teleconsultation (esanjeevani.in) is available at many government health centres and for hub-and-spoke specialist consults — suitable for patients in rural areas or those with limited mobility.
- Ayushman Bharat beneficiaries should carry their PM-JAY card; government hospitals are empanelled.

### Private Hospitals (Apollo, Fortis, Max, Manipal, Narayana, local chains)

- Online booking through the hospital's own website or mobile app is the preferred channel and typically offers shortest wait times.
- Practo (practo.com) integration is common across most major private chains; appointments can be booked and confirmed digitally.
- Phone booking via the hospital's OPD helpline is also available; ask for the direct OPD desk number, not the general enquiry line.
- Walk-in is accepted at most private hospitals but usually results in longer waiting times compared to pre-booked slots.

### Clinic or Polyclinic

- Most standalone clinics and polyclinics work on phone booking or walk-in basis.
- Many individual doctors are listed on Practo (practo.com) or Lybrate (lybrate.com) for digital appointment booking.

## 4. Online Booking Platforms

- Practo (practo.com): Covers private hospitals and individual doctors across most Indian cities; supports instant booking and teleconsult.
- eSanjeevani (esanjeevani.in): Government teleconsultation platform; free of charge; available for both AB-HWC and specialist OPD consults.
- Apollo 24|7 app: For Apollo Hospitals and Apollo Clinics; also covers teleconsult and pharmacy.
- Max My Health app: For Max Healthcare hospitals in Delhi NCR.
- Fortis Healthcare app: For Fortis network hospitals.
- ORS Portal (ors.gov.in): Online Registration System for AIIMS, PGIMER, JIPMER, and select central government hospitals.
- NHA ABDM Health ID (ABHA): Patients with an Ayushman Bharat Health Account can link their digital health records and share them with doctors across empanelled facilities.

## 5. What to Say on the Phone

Use this script when calling a hospital OPD helpline:

"I would like to book an OPD appointment in the [department] department for [patient name], aged [X]. I am looking for an appointment on [day/time preference]. My insurance is [name] / I will be paying out of pocket."

Follow-up questions to ask the helpline:

- What is the earliest available slot?
- Which doctor will be seeing the patient on that date?
- What is the OPD registration fee and accepted payment methods?
- Is there a specific counter or wing to report to on arrival?

## 6. What to Bring on Appointment Day

- Aadhaar card: original and one photocopy (required for registration at most hospitals)
- Insurance card, Ayushman Bharat / PM-JAY card, CGHS card, or ECHS card if applicable
- All previous medical reports, lab results, imaging (X-ray, MRI, CT) on a USB drive or physical copies
- Referral letter if the patient is being referred from another doctor or facility
- Complete list of current medications with dosages
- Payment for OPD registration fee: cash or UPI accepted at most hospitals; some private hospitals accept cards

## 7. Emergency Note

If the patient's condition is urgent or shows any red-flag symptoms — such as chest pain, difficulty breathing, sudden weakness or paralysis, loss of consciousness, severe bleeding, or signs of stroke — do not wait for an OPD appointment. Direct the patient or caregiver to go immediately to the hospital's Casualty or Emergency department. Emergency care does not require a prior appointment. Waiting for an OPD slot in such situations can be life-threatening.

## 8. Guardrails

- Never recommend booking a specialist appointment without confirming the correct department for the patient's condition.
- Always verify that the hospital has the required specialist available on the requested date before confirming the booking.
- Warn patients about long wait times at government hospital OPDs, especially at AIIMS and PGIMER; arriving late can mean no token for that day.
- Never suggest that a patient postpone or skip emergency care in order to wait for a scheduled OPD appointment.
- Do not share or store patient personal details (Aadhaar number, insurance ID) beyond what is needed to complete booking guidance.
- Confirm insurance empanelment at the chosen hospital before the appointment to avoid unexpected out-of-pocket costs.

## 9. Verify

- [ ] Hospital name, city, and department confirmed with patient
- [ ] Correct booking channel identified based on hospital type (government / private / clinic)
- [ ] Appointment slot confirmed and reference number or token noted
- [ ] Patient informed of documents to bring on appointment day
- [ ] Insurance empanelment at the hospital confirmed if applicable
- [ ] Emergency pathway communicated if patient has any red-flag symptoms
- [ ] Patient has the OPD helpline number saved in case of last-minute changes
