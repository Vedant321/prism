export type UserRole = "patient" | "coordinator";
export type BudgetType = "Economy" | "Balanced" | "Luxury" | "Elite";
export type TravelPriority = "Quickest" | "Standard" | "Slow";
export type TransportPreference = "Ambulance" | "Cab" | "Train" | "Own vehicle";
export type CareNeed =
  | "Dialysis"
  | "Trauma"
  | "Cardiology"
  | "Maternity"
  | "Oncology"
  | "General medicine"
  | "Unknown";

export interface UserProfile {
  name: string;
  dateOfBirth: string;
  location: string;
  currentProblems: string;
  medicalHistory: string;
  insuranceNumber: string;
  governmentHealthCard: string;
  budgetType: BudgetType;
  travelTime: TravelPriority;
  preferredTransportation: TransportPreference;
  role: UserRole;
}

export interface EvidenceItem {
  label: string;
  source: string;
  freshness: string;
  confidence: number;
}

export interface HotelOption {
  name: string;
  distanceKm: number;
  tier: BudgetType;
  nightlyEstimate: number;
}

export interface Facility {
  id: string;
  name: string;
  facilityType: string;
  region: string;
  city: string;
  distanceKm: number;
  services: CareNeed[];
  priceIndex: 1 | 2 | 3 | 4;
  averageVisitCost: number;
  waitMinutes: number;
  evidenceConfidence: number;
  availability: string;
  phone: string;
  booking: string;
  evidence: EvidenceItem[];
  missingEvidence: string[];
  suspiciousSignals: string[];
  travelTimes: Record<TransportPreference, number | null>;
  hotels: HotelOption[];
}

export interface Recommendation {
  facility: Facility;
  score: number;
  confidence: number;
  careNeed: CareNeed;
  matchExplanation: string;
  supportingEvidence: EvidenceItem[];
  missingEvidence: string[];
  suspiciousEvidence: string[];
  estimatedTravelTime: number;
  pricingSignal: string;
  rankDrivers: {
    label: string;
    value: number;
    detail: string;
  }[];
}

export interface JourneyPlan {
  facilityId: string;
  transportMode: TransportPreference;
  travelMinutes: number;
  estimatedTransportCost: number;
  hotel: HotelOption;
  instructions: string[];
  documents: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: string[];
  trace?: string[];
}
