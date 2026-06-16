---

name: "government-scheme-finder"
description: "Use this skill to surface all applicable central and state government health schemes for a patient based on their occupation, state, income, and family profile."

---

# Government Scheme Finder

## 1. When to Use

Trigger this skill when a patient or caregiver is:

- Asking whether the government can help pay for a hospital stay or surgery
- Uninsured or without any private health insurance, and seeking financial assistance
- Asking what benefits they are entitled to as a government employee, defence veteran, or organised sector worker
- Facing a high medical bill at a private hospital and looking for reimbursement options
- About to deliver a baby and asking about maternity-related cash incentives or free institutional delivery schemes

## 2. Information Gathering

Collect all of the following before matching to any scheme:

- **State of residence**: The state where the patient normally lives and where treatment is sought
- **Occupation category**: Central government employee, organised sector private employee, agricultural worker, unorganised sector worker (daily wage, domestic worker, street vendor), or self-employed
- **BPL/APL status**: Whether the household holds a Below Poverty Line ration card or appears in the SECC 2011 socioeconomic census
- **Annual household income**: Required for income-ceiling schemes at state level
- **Family size**: Number of members covered under one household for per-family coverage limits
- **Special categories**: Ex-serviceman or defence veteran, central government pensioner, person with disability, senior citizen
- **Nature of treatment**: Whether the need is maternity-related, for a chronic condition such as dialysis or cancer, or for a planned surgery

## 3. National Schemes

**PMJAY / Ayushman Bharat**
- Eligibility: BPL households and families listed in the SECC 2011 database
- Coverage: Rs. 5 lakh per family per year; more than 1,500 procedure packages
- Hospitals: Empanelled private and government hospitals across India
- Verify eligibility at: beneficiary.nha.gov.in or the PMJAY app

**CGHS — Central Government Health Scheme**
- Eligibility: Central government employees, pensioners, and their dependents
- Coverage: OPD consultations, IPD hospitalisation, specialist referrals, medicines
- Valid at CGHS-empanelled hospitals and wellness centres in covered cities

**ESIS — Employees' State Insurance Scheme**
- Eligibility: Organised sector workers earning up to Rs. 21,000 per month; covers worker and family
- Coverage: Full medical care including hospitalisation, maternity, and rehabilitation through ESI dispensaries and hospitals

**ECHS — Ex-Servicemen Contributory Health Scheme**
- Eligibility: Retired defence personnel and their dependents holding a valid ECHS card
- Coverage: OPD and IPD at ECHS polyclinics and empanelled hospitals

**Rashtriya Arogya Nidhi**
- Eligibility: BPL patients suffering from serious or rare diseases requiring tertiary care at a central government hospital
- Coverage: One-time financial assistance for treatment costs; applied through the treating hospital's medical superintendent

**PM National Dialysis Programme**
- Eligibility: BPL patients with chronic kidney disease
- Coverage: Free dialysis sessions at government hospitals under public-private partnership; check district hospital for enrolment

**Janani Suraksha Yojana**
- Eligibility: Pregnant women from BPL households opting for institutional delivery
- Coverage: Cash incentive of Rs. 1,400 for rural beneficiaries and Rs. 1,000 for urban beneficiaries; paid directly to the mother post-delivery at an accredited facility

## 4. State Schemes (Key Examples)

**Andhra Pradesh**: Aarogyasri / YSR Aarogyasri — coverage up to Rs. 5–10 lakh per family for listed procedures at empanelled hospitals

**Assam**: Atal Amrit Abhiyan — Rs. 2 lakh per family per year across six disease categories including cancer, kidney, and heart diseases

**Gujarat**: Mukhyamantri Amrutum (MA) Yojana — Rs. 3 lakh per family for BPL households; covers hospitalisation at empanelled facilities

**Karnataka**: Arogya Karnataka scheme integrated with Ayushman Bharat for APL and BPL families at government hospitals

**Maharashtra**: Mahatma Jyotiba Phule Jan Arogya Yojana — Rs. 1.5–2.5 lakh per family per year; covers yellow and orange ration card holders

**Rajasthan**: Mukhyamantri Chiranjeevi Yojana — Rs. 25 lakh per family per year; one of the highest coverage limits among state schemes

**Tamil Nadu**: Chief Minister's Comprehensive Health Insurance Scheme — Rs. 5 lakh per family; covers families earning below Rs. 72,000 annually

**Telangana**: Aarogyasri — similar to Andhra Pradesh scheme; up to Rs. 5 lakh per family for serious illnesses

**West Bengal**: Swasthya Sathi — Rs. 5 lakh per family per year; covers all residents of the state irrespective of BPL status

## 5. Matching Logic

Use the following decision flow to narrow to the most applicable schemes:

1. If the patient is a central government employee or pensioner — recommend CGHS first
2. If an organised sector worker earning up to Rs. 21,000/month — recommend ESIS first
3. If a defence veteran — recommend ECHS first
4. If BPL or SECC-listed — recommend PMJAY and the applicable state scheme for the patient's state
5. If maternity-related and BPL — add Janani Suraksha Yojana
6. If dialysis needed and BPL — add PM National Dialysis Programme
7. If serious/rare disease and BPL with no scheme coverage — add Rashtriya Arogya Nidhi

Present the top one to three matching schemes, list the eligibility criteria for each, and provide the exact step or portal to verify or apply.

## 6. Guardrails

- Never assume a patient is ineligible without verification; many patients are unaware of their SECC listing
- Always direct the patient to the official portal, the nearest Jan Seva Kendra (Common Service Centre), or the hospital's Ayushman Mitra desk for final eligibility verification
- Do not dismiss a patient who appears to be APL — several state schemes such as Swasthya Sathi cover all residents regardless of BPL status
- Inform patients about the PMJAY Mera Arogya Mera Adhikar portal for self-verification and grievance redressal
- State scheme names, coverage limits, and eligibility criteria change; always instruct the patient to confirm current terms at the official state health authority website
- Never present scheme coverage as a guarantee of cashless treatment without confirming that the specific hospital and procedure are empanelled and listed

## 7. Verify

- [ ] State of residence and occupation category captured before matching
- [ ] BPL/SECC status and annual income collected where scheme has income ceiling
- [ ] Special categories checked: ex-serviceman, central govt employee, maternity case
- [ ] Top matching schemes listed with eligibility criteria stated clearly
- [ ] Patient directed to official portal or CSC for verification, not just told about the scheme
- [ ] Maternity patients informed about Janani Suraksha Yojana if applicable
- [ ] Patient informed that scheme rates and empanelment lists are subject to change
