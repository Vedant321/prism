import { analyticsSnapshot, careNeeds, facilities } from "../data";
import type {
  BudgetType,
  CareNeed,
  Facility,
  JourneyPlan,
  Recommendation,
  TransportPreference,
  UserProfile,
} from "../types";
import { clamp, formatCurrency } from "./utils";

const careLexicon: Record<CareNeed, string[]> = {
  Dialysis: ["dialysis", "kidney", "renal", "ckd", "nephrology", "creatinine"],
  Trauma: ["trauma", "accident", "injury", "fracture", "bleeding", "emergency", "head injury"],
  Cardiology: ["heart", "chest pain", "cardiac", "cardiology", "ecg", "breathless"],
  Maternity: ["pregnancy", "maternity", "labor", "antenatal", "delivery", "obstetric"],
  Oncology: ["cancer", "oncology", "chemo", "radiation", "tumor", "biopsy"],
  "General medicine": ["fever", "infection", "medicine", "general", "weakness", "pain"],
  Unknown: [],
};

const budgetToIndex: Record<BudgetType, number> = {
  Economy: 1,
  Balanced: 2,
  Luxury: 3,
  Elite: 4,
};

const transportCostPerKm: Record<TransportPreference, number> = {
  Ambulance: 95,
  Cab: 34,
  Train: 12,
  "Own vehicle": 22,
};

export function detectCareNeed(text: string): { careNeed: CareNeed; confidence: number; matches: string[] } {
  const normalized = text.toLowerCase();
  const scores = careNeeds.map((careNeed) => {
    const matches = careLexicon[careNeed].filter((word) => normalized.includes(word));
    return { careNeed, matches, score: matches.length };
  });
  const winner = scores.sort((a, b) => b.score - a.score)[0];

  if (!winner || winner.score === 0) {
    return { careNeed: "Unknown", confidence: 0, matches: [] };
  }

  return {
    careNeed: winner.careNeed,
    confidence: clamp(55 + winner.score * 18, 0, 96),
    matches: winner.matches,
  };
}

export function extractLocation(text: string, profile: UserProfile) {
  const normalized = text.toLowerCase();
  if (normalized.includes("jaipur")) return "Jaipur, Rajasthan";
  if (normalized.includes("near me") || normalized.includes("nearest")) return profile.location;
  return profile.location;
}

export function getMissingInputs(prompt: string, profile: UserProfile) {
  const detected = detectCareNeedForTurn(prompt, profile);
  const missing: string[] = [];
  if (detected.careNeed === "Unknown") missing.push("symptoms or confirmed diagnosis");
  if (!profile.location.trim()) missing.push("current location");
  if (!profile.dateOfBirth.trim()) missing.push("date of birth");
  if (!profile.budgetType) missing.push("budget type");
  return missing;
}

export function rankFacilities(careNeed: CareNeed, profile: UserProfile): Recommendation[] {
  if (careNeed === "Unknown") return [];

  return facilities
    .map((facility) => {
      const hasExactCare = facility.services.includes(careNeed);
      const hasGeneralFallback = facility.services.includes("General medicine");
      const serviceScore = hasExactCare ? 42 : hasGeneralFallback ? 16 : 0;
      const distanceScore = clamp(22 - facility.distanceKm * 1.35, 0, 22);
      const desiredBudget = budgetToIndex[profile.budgetType];
      const budgetGap = Math.abs(facility.priceIndex - desiredBudget);
      const budgetScore = clamp(14 - budgetGap * 5, 0, 14);
      const preferredMinutes = facility.travelTimes[profile.preferredTransportation];
      const bestMinutes = Math.min(
        ...Object.values(facility.travelTimes).filter((value): value is number => typeof value === "number"),
      );
      const travelMinutes = preferredMinutes ?? bestMinutes;
      const travelScore =
        profile.travelTime === "Quickest"
          ? clamp(15 - travelMinutes / 5, 0, 15)
          : profile.travelTime === "Standard"
            ? clamp(13 - travelMinutes / 7, 0, 13)
            : clamp(12 - facility.averageVisitCost / 1800, 0, 12);
      const evidenceScore = facility.evidenceConfidence / 6.5;
      const uncertaintyPenalty = facility.suspiciousSignals.length * 3 + facility.missingEvidence.length * 1.4;
      const score = clamp(
        serviceScore + distanceScore + budgetScore + travelScore + evidenceScore - uncertaintyPenalty,
        0,
        100,
      );
      const confidence = clamp(
        facility.evidenceConfidence - facility.missingEvidence.length * 4 - facility.suspiciousSignals.length * 7,
        0,
        99,
      );
      const estimatedTravelTime = travelMinutes;
      const pricingSignal = `${formatCurrency(facility.averageVisitCost)} typical first-visit estimate; source quality ${facility.evidenceConfidence}%.`;

      return {
        facility,
        careNeed,
        score: Math.round(score),
        confidence: Math.round(confidence),
        matchExplanation: buildMatchExplanation(facility, careNeed, profile, hasExactCare, travelMinutes),
        supportingEvidence: facility.evidence,
        missingEvidence: facility.missingEvidence,
        suspiciousEvidence: facility.suspiciousSignals,
        estimatedTravelTime,
        pricingSignal,
        rankDrivers: [
          {
            label: "Care match",
            value: Math.round(serviceScore),
            detail: hasExactCare ? `${careNeed} appears in the service taxonomy.` : "Only a general-care fallback was found.",
          },
          {
            label: "Distance",
            value: Math.round(distanceScore),
            detail: `${facility.distanceKm.toFixed(1)} km from ${extractLocation("", profile)}.`,
          },
          {
            label: "Budget fit",
            value: Math.round(budgetScore),
            detail: `Facility tier ${facility.priceIndex} vs ${profile.budgetType} preference.`,
          },
          {
            label: "Evidence",
            value: Math.round(evidenceScore),
            detail: `${facility.evidenceConfidence}% source confidence before penalties.`,
          },
        ],
      } satisfies Recommendation;
    })
    .filter((recommendation) => recommendation.rankDrivers[0].value > 0)
    .sort((a, b) => b.score - a.score);
}

export function planJourney(
  recommendation: Recommendation,
  profile: UserProfile,
  urgent = recommendation.careNeed === "Trauma",
): JourneyPlan {
  const facility = recommendation.facility;
  const requestedMode = urgent ? "Ambulance" : profile.preferredTransportation;
  const transportMode = facility.travelTimes[requestedMode] ? requestedMode : getFastestTransport(facility);
  const travelMinutes = facility.travelTimes[transportMode] ?? recommendation.estimatedTravelTime;
  const estimatedTransportCost = Math.round(facility.distanceKm * transportCostPerKm[transportMode]);
  const hotel =
    facility.hotels.find((option) => option.tier === profile.budgetType) ??
    facility.hotels.find((option) => option.tier === "Balanced") ??
    facility.hotels[0];

  return {
    facilityId: facility.id,
    transportMode,
    travelMinutes,
    estimatedTransportCost,
    hotel,
    documents: [
      "Government health card",
      "Insurance number or policy card",
      "Existing prescriptions and lab reports",
      recommendation.careNeed === "Dialysis" ? "Recent creatinine, potassium, and dialysis prescription" : "",
      urgent ? "Emergency contact and any incident details" : "",
    ].filter(Boolean),
    instructions: [
      `Call ${facility.phone} before travel to confirm ${recommendation.careNeed.toLowerCase()} availability.`,
      `Use ${transportMode.toLowerCase()} for an estimated ${travelMinutes} minute trip.`,
      `Ask booking desk: ${facility.booking}.`,
      `Closest ${hotel.tier.toLowerCase()} stay: ${hotel.name}, ${hotel.distanceKm} km away.`,
    ],
  };
}

export function answerPrompt(
  prompt: string,
  profile: UserProfile,
  existingRecommendations: Recommendation[],
): {
  text: string;
  recommendations: Recommendation[];
  journeyPlan?: JourneyPlan;
  trace: string[];
  citations: string[];
} {
  if (isGreetingOnly(prompt)) {
    return {
      text:
        profile.role === "patient"
          ? "Hi, I am Prism. Tell me your care need or symptoms, location, budget, travel priority, transport preference, pricing concerns, availability urgency, and booking needs. I will compare options with evidence, missing information, what to expect during the visit, and next steps."
          : "Hi, I am Prism. Share the referral need, location, budget, travel constraints, transport options, pricing concerns, availability urgency, and booking requirements. I will compare facilities with source quality, uncertainty, evidence, and logistics.",
      recommendations: existingRecommendations,
      trace: ["intake_check: greeting detected", "safety_check: waiting for care need"],
      citations: [analyticsSnapshot.source],
    };
  }

  const detected = detectCareNeedForTurn(prompt, profile);
  const missing = getMissingInputs(prompt, profile);
  const wantsNearest = /nearest|nearby|near me|closest|near|center|centre|hospital|clinic/i.test(prompt);
  const wantsTrip = /trip|transport|hotel|book|plan|route|cab|ambulance|train/i.test(prompt);
  const wantsCheapest = /cheap|cheapest|economy|low cost|budget/i.test(prompt);
  const wantsWhy = /why|rank|evidence|confidence|explain/i.test(prompt);
  const trace = [
    "data_fetch: loaded facility, pricing, availability, and referral demo tables",
    "search_internet: represented by indexed source citations in the demo fixture",
    "evidence_ranker: scored care match, distance, budget, travel, evidence, and uncertainty",
  ];

  if (wantsNearest && !profile.location.trim()) {
    return {
      text: "Share your current location first, and I will show the nearest care centers from the demo directory.",
      recommendations: existingRecommendations,
      trace: ["intake_check: missing current location"],
      citations: [analyticsSnapshot.source],
    };
  }

  if (wantsNearest) {
    const nearestCareNeed =
      detected.careNeed !== "Unknown" ? detected.careNeed : existingRecommendations[0]?.careNeed ?? "General medicine";
    const nearest = rankFacilities(nearestCareNeed, profile).sort((a, b) => a.facility.distanceKm - b.facility.distanceKm);
    if (nearest.length === 0) {
      return {
        text: "I could not find a nearby center with enough matching evidence in the demo data. Share the care need or symptom, and I will rerun the search.",
        recommendations: existingRecommendations,
        trace,
        citations: [analyticsSnapshot.source],
      };
    }

    const topThree = nearest.slice(0, 3);
    const top = topThree[0];
    const options = topThree
      .map(
        (item, index) =>
          `${index + 1}. ${item.facility.name} - ${item.facility.distanceKm.toFixed(1)} km away, about ${
            item.estimatedTravelTime
          } minutes by ${profile.preferredTransportation.toLowerCase()}`,
      )
      .join("; ");

    return {
      text: `The nearest center I found is ${top.facility.name}, ${top.facility.distanceKm.toFixed(
        1,
      )} km from ${profile.location}. It appears suitable for ${nearestCareNeed.toLowerCase()} in this demo dataset. Nearby options: ${options}. Please call before travel to confirm availability and pricing.`,
      recommendations: nearest,
      journeyPlan: planJourney(top, profile),
      trace,
      citations: top.supportingEvidence.map((item) => item.source),
    };
  }

  if (missing.length > 0) {
    return {
      text: `I need ${missing.join(", ")} before I can rank facilities responsibly. Prism avoids guessing for high-stakes care decisions. Share the missing detail, and tell me whether this is a confirmed diagnosis or symptoms you are currently feeling.`,
      recommendations: existingRecommendations,
      trace: ["intake_check: missing critical information"],
      citations: [analyticsSnapshot.source],
    };
  }

  const activeCareNeed = detected.careNeed !== "Unknown" ? detected.careNeed : existingRecommendations[0]?.careNeed ?? "Unknown";

  if (wantsTrip && existingRecommendations.length > 0) {
    const plan = planJourney(existingRecommendations[0], profile);
    return {
      text: `${profile.role === "patient" ? "Here is the next step-by-step journey plan." : "Journey plan prepared for referral coordination."} I would use ${plan.transportMode.toLowerCase()} to ${existingRecommendations[0].facility.name}, confirm by phone first, and hold ${plan.hotel.name} as the nearest ${plan.hotel.tier.toLowerCase()} hotel option. Estimated transport is ${formatCurrency(plan.estimatedTransportCost)} and ${plan.travelMinutes} minutes.`,
      recommendations: existingRecommendations,
      journeyPlan: plan,
      trace: [...trace, "travel_planning: selected transport and hotel from persona fit", "booking_assistant: generated call and document checklist"],
      citations: existingRecommendations[0].supportingEvidence.map((item) => item.source),
    };
  }

  const ranked = rankFacilities(activeCareNeed, profile);
  if (ranked.length === 0) {
    return {
      text: "I could not find a facility with enough care-match evidence in the demo data. Please provide a clearer diagnosis or symptom set, and I will rerun the ranking.",
      recommendations: existingRecommendations,
      trace,
      citations: [analyticsSnapshot.source],
    };
  }

  const list = wantsCheapest ? [...ranked].sort((a, b) => a.facility.averageVisitCost - b.facility.averageVisitCost) : ranked;
  const top = list[0];
  const patientTone =
    profile.role === "patient"
      ? `The strongest option is ${top.facility.name}. It is ${top.facility.distanceKm.toFixed(1)} km away, appears able to handle ${top.careNeed.toLowerCase()}, and should take about ${top.estimatedTravelTime} minutes by ${profile.preferredTransportation.toLowerCase()}.`
      : `${top.facility.name} ranks first for ${top.careNeed}: service taxonomy match, ${top.facility.distanceKm.toFixed(1)} km proximity, ${top.confidence}% post-penalty evidence confidence, and ${top.facility.availability.toLowerCase()}.`;

  const uncertainty = [
    top.missingEvidence.length ? `Missing evidence: ${top.missingEvidence.join("; ")}.` : "No major missing evidence in the current demo snapshot.",
    top.suspiciousEvidence.length ? `Potential conflict: ${top.suspiciousEvidence.join("; ")}.` : "No suspicious conflict was flagged for the top option.",
  ].join(" ");

  const why = wantsWhy
    ? ` Ranking drivers: ${top.rankDrivers.map((driver) => `${driver.label} ${driver.value}`).join(", ")}.`
    : "";

  return {
    text: `${patientTone} ${uncertainty}${why} Before travel, call to confirm availability and pricing. I can now plan transport and a nearby hotel from your persona.`,
    recommendations: list,
    trace,
    citations: top.supportingEvidence.map((item) => item.source),
  };
}

function isGreetingOnly(prompt: string) {
  return /^(hi|hello|hey|good morning|good afternoon|good evening|namaste|hola)[\s!.?]*$/i.test(prompt.trim());
}

function detectCareNeedForTurn(prompt: string, profile: UserProfile) {
  const promptDetected = detectCareNeed(prompt);
  if (promptDetected.careNeed !== "Unknown") return promptDetected;
  return detectCareNeed(profile.currentProblems);
}

function buildMatchExplanation(
  facility: Facility,
  careNeed: CareNeed,
  profile: UserProfile,
  hasExactCare: boolean,
  travelMinutes: number,
) {
  const match = hasExactCare
    ? `matches the requested ${careNeed.toLowerCase()} care need`
    : "has only partial capability evidence";
  return `${facility.name} ${match}, is ${facility.distanceKm.toFixed(1)} km from ${profile.location}, fits a ${profile.budgetType.toLowerCase()} budget at tier ${facility.priceIndex}, and has an estimated ${travelMinutes} minute trip by ${profile.preferredTransportation.toLowerCase()}.`;
}

function getFastestTransport(facility: Facility) {
  return (Object.entries(facility.travelTimes) as Array<[TransportPreference, number | null]>)
    .filter((entry): entry is [TransportPreference, number] => typeof entry[1] === "number")
    .sort((a, b) => a[1] - b[1])[0][0];
}
