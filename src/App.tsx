import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  Database,
  HeartPulse,
  Hotel,
  MapPin,
  MessageSquareText,
  Phone,
  Route,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrainFront,
  UserCog,
  UserRound,
  Volume2,
  Wallet,
  X,
} from "lucide-react";
import { analyticsSnapshot, careNeeds, defaultProfile, facilities } from "./data";
import { AnimatedVideoOnScroll } from "./components/blocks/animated-video-on-scroll";
import { PromptInputBox } from "./components/ui/ai-prompt-box";
import { OpenAIVoiceChat } from "./components/ui/openai-voice-chat";
import { TextHoverEffect } from "./components/ui/hover-text-effect";
import { GlowCard } from "./components/ui/spotlight-card";
import { WebGLShader } from "./components/ui/web-gl-shader";
import { answerPrompt, planJourney } from "./lib/ranking";
import { cn, formatCurrency, uid } from "./lib/utils";
import type {
  BudgetType,
  CareNeed,
  ChatMessage,
  Facility,
  JourneyPlan,
  Recommendation,
  TransportPreference,
  UserProfile,
  UserRole,
} from "./types";

type Tab = "insights" | "chat" | "recommendations";

type DatabricksNearestResponse = {
  ok?: boolean;
  source?: string;
  error?: string;
  recommendations?: Recommendation[];
};

const budgetOptions: BudgetType[] = ["Economy", "Balanced", "Luxury", "Elite"];
const travelOptions: UserProfile["travelTime"][] = ["Quickest", "Standard", "Slow"];
const transportOptions: TransportPreference[] = ["Ambulance", "Cab", "Train", "Own vehicle"];

export default function App() {
  const [entered, setEntered] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [profileOpen, setProfileOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [journeyPlan, setJourneyPlan] = useState<JourneyPlan | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [codexBusy, setCodexBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: uid("msg"),
      role: "assistant",
      content:
        "I have your profile loaded. Tell me the care need or symptoms, location, budget, travel priority, transport preference, pricing concerns, availability urgency, and booking needs. I will rank facilities with evidence, missing data, travel time, what to expect during the visit, and next-step planning.",
      citations: [analyticsSnapshot.source],
      trace: ["intake_check: profile loaded", "safety_check: waiting for care need"],
    },
  ]);

  const currentCareNeed = recommendations[0]?.careNeed ?? "Dialysis";
  const shortlistedRecommendations = recommendations.filter((item) => shortlist.includes(item.facility.id));

  const handleSend = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || codexBusy) return;
    const requestProfile = applyPromptProfileOverrides(profile, trimmed);

    let localResult = answerPrompt(trimmed, requestProfile, recommendations);
    let skipLiveResponse = false;

    if (isNearestPrompt(trimmed)) {
      const databricksResult = await callDatabricksNearest({
        profile: requestProfile,
        careNeed: localResult.recommendations[0]?.careNeed ?? currentCareNeed,
      });

      if (databricksResult.ok && databricksResult.recommendations.length > 0) {
        const top = databricksResult.recommendations[0];
        const selectedCareNeed = top.careNeed ?? localResult.recommendations[0]?.careNeed ?? currentCareNeed;
        skipLiveResponse = true;
        localResult = {
          text: buildDatabricksNearestAnswer(top, requestProfile, selectedCareNeed),
          recommendations: databricksResult.recommendations,
          journeyPlan: planJourney(top, requestProfile),
          trace: [],
          citations: [`Databricks: ${databricksResult.source}`],
        };
      } else {
        skipLiveResponse = true;
        localResult = {
          text: `I checked Databricks for nearest centers, but ${formatDatabricksError(
            databricksResult.error,
          )}. I am not showing the local demo centers as Databricks results.`,
          recommendations: [],
          trace: [],
          citations: ["Databricks connection"],
        };
      }
    }

    const userMessage: ChatMessage = {
      id: uid("msg"),
      role: "user",
      content: trimmed,
    };

    setMessages((previous) => [...previous, userMessage]);
    setRecommendations(localResult.recommendations);
    setJourneyPlan(localResult.journeyPlan ?? null);
    if (/save|shortlist/i.test(trimmed) && localResult.recommendations[0]) {
      setShortlist((previous) =>
        previous.includes(localResult.recommendations[0].facility.id)
          ? previous
          : [...previous, localResult.recommendations[0].facility.id],
      );
    }

    if (skipLiveResponse) {
      const assistantMessage: ChatMessage = {
        id: uid("msg"),
        role: "assistant",
        content: localResult.text,
        citations: localResult.citations,
      };
      setMessages((previous) => [...previous, assistantMessage]);
      speakIfEnabled(localResult.text, speaking);
      return;
    }

    setCodexBusy(true);
    try {
      const codexResult = await callCodexCli({
        message: trimmed,
        profile: requestProfile,
        history: messages.slice(-8),
        recommendations: localResult.recommendations,
      });
      const assistantMessage: ChatMessage = {
        id: uid("msg"),
        role: "assistant",
        content: codexResult.text,
        citations: localResult.citations,
        trace: [...codexResult.trace, ...localResult.trace],
      };
      setMessages((previous) => [...previous, assistantMessage]);
      speakIfEnabled(codexResult.text, speaking);
    } catch (error) {
      const assistantMessage: ChatMessage = {
        id: uid("msg"),
        role: "assistant",
        content: `${localResult.text}\n\nI had trouble preparing the live response, so I used Prism's local recommendation logic for this answer.`,
        citations: localResult.citations,
        trace: ["assistant_response: local fallback used", ...localResult.trace],
      };
      setMessages((previous) => [...previous, assistantMessage]);
      speakIfEnabled(localResult.text, speaking);
    } finally {
      setCodexBusy(false);
    }
  };

  const toggleShortlist = (facilityId: string) => {
    setShortlist((previous) =>
      previous.includes(facilityId) ? previous.filter((id) => id !== facilityId) : [...previous, facilityId],
    );
  };

  const makeJourneyPlan = (recommendation: Recommendation) => {
    setJourneyPlan(planJourney(recommendation, profile));
    setActiveTab("recommendations");
  };

  if (!entered) {
    return (
      <Landing
        onEnter={() => {
          window.scrollTo({ top: 0 });
          setEntered(true);
          setActiveTab("chat");
          setProfileOpen(true);
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <div className="brand-symbol">
            <HeartPulse size={22} />
          </div>
          <div>
            <p className="eyebrow">Prism</p>
            <h1>Health Concierge Copilot</h1>
            <span className="topbar-subtitle">Care routing dashboard</span>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="profile-pill">
            {profile.role === "patient" ? <UserRound size={16} /> : <UserCog size={16} />}
            <span>{profile.role === "patient" ? "Patient" : "Doctor / Coordinator"}</span>
          </div>
          <button type="button" className="icon-text-button" onClick={() => setProfileOpen(true)}>
            <UserCog size={16} />
            Profile
          </button>
        </div>
      </header>

      <DashboardSummary
        profile={profile}
        careNeed={currentCareNeed}
        recommendationCount={recommendations.length}
        shortlistCount={shortlist.length}
        onNavigate={setActiveTab}
      />

      <section className="patient-strip dashboard-context">
        <InfoPill icon={<MapPin size={16} />} label={profile.location} />
        <InfoPill icon={<Wallet size={16} />} label={`${profile.budgetType} budget`} />
        <InfoPill icon={<Route size={16} />} label={`${profile.travelTime} travel`} />
        <InfoPill icon={<Database size={16} />} label={analyticsSnapshot.source} />
      </section>

      <nav className="tabbar dashboard-tabs" aria-label="Main navigation">
        <TabButton
          active={activeTab === "insights"}
          icon={<BarChart3 size={18} />}
          label="Data and Insights"
          onClick={() => setActiveTab("insights")}
        />
        <TabButton
          active={activeTab === "chat"}
          icon={<MessageSquareText size={18} />}
          label="Chat"
          onClick={() => setActiveTab("chat")}
        />
        <TabButton
          active={activeTab === "recommendations"}
          icon={<ClipboardList size={18} />}
          label="Recommendation"
          onClick={() => setActiveTab("recommendations")}
        />
      </nav>

      <section className="workspace">
        {activeTab === "insights" && (
          <InsightsTab
            profile={profile}
            recommendations={recommendations}
            shortlistedRecommendations={shortlistedRecommendations}
            onOpenChat={() => setActiveTab("chat")}
          />
        )}
        {activeTab === "chat" && (
          <ChatTab
            profile={profile}
            messages={messages}
            recommendations={recommendations}
            speaking={speaking}
            setSpeaking={setSpeaking}
            codexBusy={codexBusy}
            onSend={handleSend}
            onOpenRecommendations={() => setActiveTab("recommendations")}
            onShortlist={toggleShortlist}
            shortlist={shortlist}
          />
        )}
        {activeTab === "recommendations" && (
          <RecommendationsTab
            profile={profile}
            careNeed={currentCareNeed}
            recommendations={recommendations}
            shortlist={shortlist}
            journeyPlan={journeyPlan}
            onShortlist={toggleShortlist}
            onPlanJourney={makeJourneyPlan}
            onAsk={(prompt) => {
              setActiveTab("chat");
              handleSend(prompt);
            }}
          />
        )}
      </section>

      {profileOpen && (
        <ProfileDialog
          profile={profile}
          setProfile={setProfile}
          onClose={() => {
            setProfileOpen(false);
          }}
        />
      )}
    </main>
  );
}

function DashboardSummary({
  profile,
  careNeed,
  recommendationCount,
  shortlistCount,
  onNavigate,
}: {
  profile: UserProfile;
  careNeed: CareNeed;
  recommendationCount: number;
  shortlistCount: number;
  onNavigate: (tab: Tab) => void;
}) {
  const roleLabel = profile.role === "patient" ? "Patient view" : "Coordinator view";

  return (
    <section className="dashboard-hero" aria-label="Dashboard summary">
      <div className="dashboard-hero-copy">
        <p className="eyebrow">Care Workspace</p>
        <h2>{profile.name}'s care dashboard</h2>
        <p>{profile.currentProblems}</p>
        <div className="dashboard-hero-actions">
          <button type="button" className="primary-button compact-button" onClick={() => onNavigate("chat")}>
            <MessageSquareText size={16} />
            Open chat
          </button>
          <button type="button" className="icon-text-button" onClick={() => onNavigate("recommendations")}>
            <ClipboardList size={16} />
            Review shortlist
          </button>
        </div>
      </div>
      <div className="dashboard-vitals">
        <DashboardMetric icon={<Stethoscope size={18} />} label="Care focus" value={careNeed} detail={roleLabel} tone="teal" />
        <DashboardMetric
          icon={<Building2 size={18} />}
          label="Ranked options"
          value={recommendationCount ? recommendationCount.toString() : "0"}
          detail="Current chat session"
          tone="blue"
        />
        <DashboardMetric
          icon={<BookmarkCheck size={18} />}
          label="Saved"
          value={shortlistCount.toString()}
          detail="Shortlist items"
          tone="amber"
        />
        <DashboardMetric
          icon={<ShieldCheck size={18} />}
          label="Evidence"
          value={`${analyticsSnapshot.evidenceConfidence}%`}
          detail={analyticsSnapshot.generatedAt}
          tone="rose"
        />
      </div>
    </section>
  );
}

function DashboardMetric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "teal" | "blue" | "amber" | "rose";
}) {
  return (
    <div className={cn("dashboard-metric", `dashboard-metric-${tone}`)}>
      <span className="dashboard-metric-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

async function callCodexCli({
  message,
  profile,
  history,
  recommendations,
}: {
  message: string;
  profile: UserProfile;
  history: ChatMessage[];
  recommendations: Recommendation[];
}) {
  const response = await fetch("/api/codex-chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message,
      profile,
      history,
      recommendations: recommendations.slice(0, 3),
    }),
  });
  const data = (await response.json()) as { text?: string; trace?: string[]; error?: string };
  if (!response.ok || !data.text) {
    throw new Error(data.error ?? "Prism response request failed.");
  }
  return {
    text: data.text,
    trace: data.trace ?? [],
  };
}

function isNearestPrompt(prompt: string) {
  return /\b(nearest|nearby|closest|near me|near|around|find|need|care|treatment|center|centre|hospital|clinic|facility|pricing|availability|booking|evidence|handle|expect)\b/i.test(
    prompt,
  );
}

function applyPromptProfileOverrides(profile: UserProfile, prompt: string): UserProfile {
  return {
    ...profile,
    budgetType: detectBudgetOverride(prompt) ?? profile.budgetType,
    travelTime: detectTravelOverride(prompt) ?? profile.travelTime,
    preferredTransportation: detectTransportOverride(prompt) ?? profile.preferredTransportation,
  };
}

function detectBudgetOverride(prompt: string): BudgetType | null {
  const normalized = prompt.toLowerCase();
  if (/\b(economy|cheap|cheapest|low cost|low-cost|low pricing|low price|affordable)\b/.test(normalized)) return "Economy";
  if (/\b(luxury|premium)\b/.test(normalized)) return "Luxury";
  if (/\b(elite|vip|best available)\b/.test(normalized)) return "Elite";
  if (/\bbalanced|moderate|mid range|mid-range\b/.test(normalized)) return "Balanced";
  return null;
}

function detectTravelOverride(prompt: string): UserProfile["travelTime"] | null {
  const normalized = prompt.toLowerCase();
  if (/\b(quickest|fastest|urgent|as soon as possible|asap)\b/.test(normalized)) return "Quickest";
  if (/\b(slow|lowest travel cost|can take time)\b/.test(normalized)) return "Slow";
  if (/\b(standard|normal)\b/.test(normalized)) return "Standard";
  return null;
}

function detectTransportOverride(prompt: string): TransportPreference | null {
  const normalized = prompt.toLowerCase();
  if (/\bambulance\b/.test(normalized)) return "Ambulance";
  if (/\bcab|taxi|ride\b/.test(normalized)) return "Cab";
  if (/\btrain|rail\b/.test(normalized)) return "Train";
  if (/\bown vehicle|drive|driving|car\b/.test(normalized)) return "Own vehicle";
  return null;
}

function formatDatabricksError(error?: string) {
  if (!error) return "the live data source did not return a usable response";
  if (/not configured|DATABRICKS_|PRISM_DATABRICKS_/i.test(error)) {
    return "the Databricks connection is not configured for this environment";
  }
  return error.replace(/[.\s]+$/, "");
}

async function callDatabricksNearest({
  profile,
  careNeed,
}: {
  profile: UserProfile;
  careNeed: CareNeed;
}): Promise<{ ok: boolean; source?: string; error?: string; recommendations: Recommendation[] }> {
  const response = await fetch("/api/databricks-nearest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      profile,
      careNeed,
      limit: 5,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as DatabricksNearestResponse;

  return {
    ok: Boolean(response.ok && data.ok),
    source: data.source ?? "Databricks",
    error: data.error ?? (response.ok ? undefined : "Databricks request failed."),
    recommendations: data.recommendations ?? [],
  };
}

function buildDatabricksNearestAnswer(recommendation: Recommendation, profile: UserProfile, careNeed: CareNeed) {
  const facility = recommendation.facility;
  const selectedTravelMinutes = facility.travelTimes[profile.preferredTransportation] ?? recommendation.estimatedTravelTime;
  const transportOptions = Object.entries(facility.travelTimes)
    .filter((entry): entry is [TransportPreference, number] => typeof entry[1] === "number" && entry[1] > 0)
    .map(([mode, minutes]) => `${mode.toLowerCase()} ${minutes} min`)
    .join(", ");
  const evidence = recommendation.supportingEvidence[0];
  const pricing =
    facility.averageVisitCost > 0
      ? `${formatCurrency(facility.averageVisitCost)} typical first-visit estimate`
      : "pricing is not listed in Databricks, so call before travel";
  const missingEvidence = recommendation.missingEvidence.length
    ? recommendation.missingEvidence.join("; ")
    : "same-day availability, final price, and booking rules still need phone confirmation";

  return [
    `I fetched the nearest matching centers from Databricks. **${facility.name}** is the best current match for **${careNeed.toLowerCase()}** near **${profile.location}**: ${facility.distanceKm.toFixed(
      1,
    )} km away, about ${selectedTravelMinutes} minutes by ${profile.preferredTransportation.toLowerCase()}.`,
    `**Care context checked:** care need ${careNeed}; location ${profile.location}; budget ${profile.budgetType}; travel priority ${profile.travelTime.toLowerCase()}; preferred transport ${profile.preferredTransportation.toLowerCase()}.`,
    `**Transport options:** ${transportOptions || "transport times are not available in Databricks yet"}.`,
    `**Pricing:** ${pricing}. **Availability:** ${facility.availability}. **Booking feasibility:** ${facility.booking}; call ${facility.phone} before travel.`,
    `**What to expect:** carry ID, insurance or government health card, recent reports, prescriptions, and any referral note. For ${careNeed.toLowerCase()}, ask the desk to confirm service availability, expected wait time, payment estimate, and required pre-visit documents.`,
    `**Evidence:** ${evidence?.label ?? "Databricks facility row"} from ${evidence?.source ?? "Databricks"}, freshness ${
      evidence?.freshness ?? "not listed"
    }, confidence ${recommendation.confidence}%. Missing or uncertain: ${missingEvidence}.`,
  ].join("\n\n");
}

function speakIfEnabled(text: string, speaking: boolean) {
  const spokenText = text
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (speaking && spokenText && canSpeakReplies()) {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(spokenText));
    return true;
  }

  return false;
}

function canSpeakReplies() {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="landing">
      <section className="hero">
        <WebGLShader />
        <div className="hero-overlay" />
        <nav className="hero-nav">
          <div className="brand-mark brand-mark-light">
            <div className="brand-symbol">
              <HeartPulse size={19} />
            </div>
            <span>Prism</span>
          </div>
        </nav>
        <div className="hero-inner">
          <div className="hero-content">
            <p className="eyebrow">Prism Health</p>
            <div className="hero-hover-title">
              <TextHoverEffect text="Prism" />
            </div>
            <p className="hero-copy">
              One calm place to understand care options, compare facilities, and coordinate the next step.
            </p>
            <div className="hero-actions">
              <button type="button" className="primary-button" onClick={onEnter}>
                <Sparkles size={18} />
                Start
              </button>
            </div>
          </div>
        </div>
      </section>

      <AnimatedVideoOnScroll />
    </main>
  );
}

function ProfileDialog({
  profile,
  setProfile,
  onClose,
}: {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  onClose: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="Edit profile">
      <div className="profile-dialog">
        <div className="dialog-header">
          <div>
            <p className="eyebrow">One-time setup</p>
            <h2>Care context</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close profile">
            <X size={18} />
          </button>
        </div>
        <ProfileForm profile={profile} setProfile={setProfile} onSubmit={onClose} submitLabel="Update profile" compact />
      </div>
    </div>
  );
}

function ProfileForm({
  profile,
  setProfile,
  onSubmit,
  submitLabel,
  compact,
}: {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  onSubmit: () => void;
  submitLabel: string;
  compact?: boolean;
}) {
  const setField = <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => {
    setProfile({ ...profile, [field]: value });
  };

  return (
    <form
      className={cn("profile-form", compact && "profile-form-compact")}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="role-toggle">
        <button
          type="button"
          className={cn(profile.role === "patient" && "selected")}
          onClick={() => setField("role", "patient")}
        >
          <UserRound size={17} />
          Patient
        </button>
        <button
          type="button"
          className={cn(profile.role === "coordinator" && "selected")}
          onClick={() => setField("role", "coordinator")}
        >
          <Stethoscope size={17} />
          Doctor / Care Coordinator
        </button>
      </div>

      <label>
        Name
        <input value={profile.name} onChange={(event) => setField("name", event.target.value)} />
      </label>
      <label>
        Date of birth
        <input
          type="date"
          value={profile.dateOfBirth}
          onChange={(event) => setField("dateOfBirth", event.target.value)}
        />
      </label>
      <label>
        Location
        <input value={profile.location} onChange={(event) => setField("location", event.target.value)} />
      </label>
      <label>
        Current medical problems
        <textarea
          value={profile.currentProblems}
          onChange={(event) => setField("currentProblems", event.target.value)}
        />
      </label>
      <label>
        Medical history
        <textarea
          value={profile.medicalHistory}
          onChange={(event) => setField("medicalHistory", event.target.value)}
        />
      </label>
      <label>
        Insurance number
        <input
          value={profile.insuranceNumber}
          onChange={(event) => setField("insuranceNumber", event.target.value)}
        />
      </label>
      <label>
        Government health card number
        <input
          value={profile.governmentHealthCard}
          onChange={(event) => setField("governmentHealthCard", event.target.value)}
        />
      </label>
      <label>
        Budget type
        <select value={profile.budgetType} onChange={(event) => setField("budgetType", event.target.value as BudgetType)}>
          {budgetOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label>
        Travel time
        <select
          value={profile.travelTime}
          onChange={(event) => setField("travelTime", event.target.value as UserProfile["travelTime"])}
        >
          {travelOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label>
        Preferred transportation
        <select
          value={profile.preferredTransportation}
          onChange={(event) => setField("preferredTransportation", event.target.value as TransportPreference)}
        >
          {transportOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="primary-button form-submit">
        <ShieldCheck size={18} />
        {submitLabel}
      </button>
    </form>
  );
}

function InsightsTab({
  profile,
  recommendations,
  shortlistedRecommendations,
  onOpenChat,
}: {
  profile: UserProfile;
  recommendations: Recommendation[];
  shortlistedRecommendations: Recommendation[];
  onOpenChat: () => void;
}) {
  const regionCounts = useMemo(() => {
    return facilities.reduce<Record<string, number>>((acc, facility) => {
      acc[facility.region] = (acc[facility.region] ?? 0) + 1;
      return acc;
    }, {});
  }, []);
  const maxRegionCount = Math.max(...Object.values(regionCounts));
  const regions = Object.keys(regionCounts);
  const priceGroups = budgetOptions.map((budget, index) => ({
    budget,
    count: facilities.filter((facility) => facility.priceIndex === index + 1).length,
  }));
  const activeRecommendations = recommendations.slice(0, 4);

  return (
    <div className="insights-layout">
      <section className="kpi-grid">
        <Kpi
          icon={<Building2 size={20} />}
          value={analyticsSnapshot.facilityCount.toString()}
          label="Facilities in registry"
          detail={`Actual, Jaipur region, ${analyticsSnapshot.generatedAt}`}
        />
        <Kpi
          icon={<ShieldCheck size={20} />}
          value={`${analyticsSnapshot.evidenceConfidence}%`}
          label="Evidence confidence"
          detail="Actual average after source-quality checks"
        />
        <Kpi
          icon={<AlertTriangle size={20} />}
          value={analyticsSnapshot.missingPriceFields.toString()}
          label="Missing price fields"
          detail="Actual count, lower is better"
        />
        <Kpi
          icon={<Activity size={20} />}
          value={`${analyticsSnapshot.referralCompletionRate}%`}
          label="Referral completion"
          detail="Prior 30-day demo referrals"
        />
      </section>

      <section className="chart-grid">
        <article className="data-panel panel-wide">
          <PanelHeader
            title="Facility distribution by region - actual count, demo snapshot"
            source={analyticsSnapshot.source}
          />
          <div className="bar-list">
            {Object.entries(regionCounts).map(([region, count]) => (
              <div className="bar-row" key={region}>
                <span>{region}</span>
                <div className="bar-track">
                  <div className="bar-fill teal" style={{ width: `${(count / maxRegionCount) * 100}%` }} />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="data-panel">
          <PanelHeader title="Care availability by region" source="Demo care service map" />
          <div className="availability-grid">
            <span />
            {careNeeds.slice(0, 5).map((need) => (
              <strong key={need}>{need}</strong>
            ))}
            {regions.map((region) => (
              <CareRegionRow key={region} region={region} />
            ))}
          </div>
        </article>

        <article className="data-panel">
          <PanelHeader title="Price ranges by budget tier" source="Demo price ranges" />
          <div className="price-stack">
            {priceGroups.map((group) => (
              <div key={group.budget} className="price-block">
                <span>{group.budget}</span>
                <div className="price-meter">
                  <div style={{ height: `${24 + group.count * 18}px` }} />
                </div>
                <strong>{group.count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="data-panel panel-wide">
          <PanelHeader title="Distance and travel-time comparison for current shortlist" source="Prism ranking output" />
          {activeRecommendations.length > 0 ? (
            <div className="comparison-table">
              <div className="table-head">
                <span>Facility</span>
                <span>Distance</span>
                <span>Travel</span>
                <span>Score</span>
              </div>
              {activeRecommendations.map((item) => (
                <div className="table-row" key={item.facility.id}>
                  <span>{item.facility.name}</span>
                  <span>{item.facility.distanceKm.toFixed(1)} km</span>
                  <span>{item.estimatedTravelTime} min</span>
                  <span>
                    <Meter value={item.score} />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No ranked facilities yet" action="Open chat" onAction={onOpenChat} />
          )}
        </article>

        <article className="data-panel">
          <PanelHeader title="Evidence confidence and missing-data indicators" source="Demo evidence quality" />
          <div className="quality-list">
            {facilities.slice(0, 5).map((facility) => (
              <div key={facility.id} className="quality-row">
                <span>{facility.name.replace("Prism Demo ", "")}</span>
                <Meter value={facility.evidenceConfidence} />
                <small>{facility.missingEvidence.length} missing</small>
              </div>
            ))}
          </div>
        </article>

        <article className="data-panel">
          <PanelHeader title="Shortlist comparison" source="Current session shortlist" />
          {shortlistedRecommendations.length ? (
            <div className="shortlist-chart">
              {shortlistedRecommendations.map((item) => (
                <div key={item.facility.id}>
                  <span>{item.facility.name.replace("Prism Demo ", "")}</span>
                  <Meter value={item.confidence} tone="amber" />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Shortlist is empty" action="Rank in chat" onAction={onOpenChat} />
          )}
        </article>
      </section>

      <section className="data-footnote">
        <Database size={16} />
        <span>
          {profile.role === "patient"
            ? "Numbers are simplified for patient guidance and include missing-data warnings."
            : "Analytics view preserves source freshness, confidence, and missingness for referral review."}
        </span>
      </section>
    </div>
  );
}

function ChatTab({
  profile,
  messages,
  recommendations,
  speaking,
  setSpeaking,
  codexBusy,
  onSend,
  onOpenRecommendations,
  onShortlist,
  shortlist,
}: {
  profile: UserProfile;
  messages: ChatMessage[];
  recommendations: Recommendation[];
  speaking: boolean;
  setSpeaking: (value: boolean) => void;
  codexBusy: boolean;
  onSend: (prompt: string) => void;
  onOpenRecommendations: () => void;
  onShortlist: (facilityId: string) => void;
  shortlist: string[];
}) {
  const [draft, setDraft] = useState("");
  const [speechError, setSpeechError] = useState("");
  const topRecommendation = recommendations[0];
  const quickPrompts = [
    "I need dialysis near Jaipur",
    "Why is this facility ranked higher?",
    "Which option is cheapest?",
    "Can you plan transport and hotel?",
  ];
  const latestAssistantReply = [...messages].reverse().find((message) => message.role === "assistant");

  const submit = () => {
    onSend(draft);
    setDraft("");
  };

  const toggleSpeakReplies = () => {
    const nextSpeaking = !speaking;

    if (nextSpeaking && !canSpeakReplies()) {
      setSpeechError("Speech replies are not supported in this browser");
      setSpeaking(false);
      return;
    }

    setSpeechError("");
    setSpeaking(nextSpeaking);

    if (nextSpeaking && latestAssistantReply) {
      speakIfEnabled(latestAssistantReply.content, true);
    } else if (!nextSpeaking && canSpeakReplies()) {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <div className="chat-layout">
      <section className="chat-main">
        <div className="chat-heading">
          <div>
            <p className="eyebrow">Concierge</p>
            <h2>{profile.role === "patient" ? "Step-by-step care guidance" : "Referral evidence workspace"}</h2>
          </div>
          <div className="chat-heading-actions">
            <OpenAIVoiceChat profile={profile} recommendations={recommendations} />
            <button
              type="button"
              className={cn("icon-text-button", speaking && "selected-soft", speechError && "error-soft")}
              onClick={toggleSpeakReplies}
              title={speechError || "Speak the latest and future Prism replies"}
            >
              <Volume2 size={16} />
              {speechError ? "Speech unavailable" : speaking ? "Stop replies" : "Speak replies"}
            </button>
          </div>
        </div>

        <div className="message-list" aria-live="polite">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {codexBusy && (
            <article className="message">
              <div className="message-avatar">
                <Bot size={18} />
              </div>
              <div className="message-content">
                <p>Prism is preparing your answer...</p>
              </div>
            </article>
          )}
        </div>

        <div className="quick-prompts">
          {quickPrompts.map((prompt) => (
            <button key={prompt} type="button" disabled={codexBusy} onClick={() => onSend(prompt)}>
              {prompt}
            </button>
          ))}
        </div>

        <PromptInputBox
          value={draft}
          onValueChange={setDraft}
          onSend={() => submit()}
          disabled={codexBusy}
          isLoading={codexBusy}
          placeholder="Describe symptoms, diagnosis, location, budget, or trip needs"
        />
      </section>

      <aside className="agent-rail">
        <GlowCard className="agent-panel" glowColor="purple">
          <PanelHeader title="Agent skills" source="Local Prism orchestration" />
          <div className="skill-list">
            {["data_fetch", "search_internet", "travel_planning", "booking_assistant", "evidence_ranker"].map((skill) => (
              <span key={skill}>
                <CheckCircle2 size={15} />
                {skill}
              </span>
            ))}
          </div>
        </GlowCard>

        {topRecommendation && (
          <GlowCard className="agent-panel" glowColor="green">
            <PanelHeader title="Current top option" source="Prism ranking output" />
            <h3>{topRecommendation.facility.name}</h3>
            <p>{topRecommendation.matchExplanation}</p>
            <div className="rail-actions">
              <button type="button" className="icon-text-button" onClick={onOpenRecommendations}>
                <ClipboardList size={16} />
                View recommendation
              </button>
              <button
                type="button"
                className="icon-text-button"
                onClick={() => onShortlist(topRecommendation.facility.id)}
              >
                {shortlist.includes(topRecommendation.facility.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                {shortlist.includes(topRecommendation.facility.id) ? "Saved" : "Save"}
              </button>
            </div>
          </GlowCard>
        )}
      </aside>
    </div>
  );
}

function RecommendationsTab({
  profile,
  careNeed,
  recommendations,
  shortlist,
  journeyPlan,
  onShortlist,
  onPlanJourney,
  onAsk,
}: {
  profile: UserProfile;
  careNeed: CareNeed;
  recommendations: Recommendation[];
  shortlist: string[];
  journeyPlan: JourneyPlan | null;
  onShortlist: (facilityId: string) => void;
  onPlanJourney: (recommendation: Recommendation) => void;
  onAsk: (prompt: string) => void;
}) {
  if (recommendations.length === 0) {
    return (
      <EmptyState
        title="No recommendation is ready"
        detail="Prism needs a diagnosis or symptom pattern before ranking care options."
        action="Ask in chat"
        onAction={() => onAsk("I need help finding a facility for dialysis near Jaipur")}
      />
    );
  }

  return (
    <div className="recommendation-layout">
      <section className="recommendation-header">
        <div>
          <p className="eyebrow">Recommendation</p>
          <h2>
            {careNeed} shortlist ranked for {profile.location}
          </h2>
        </div>
        <button type="button" className="icon-text-button" onClick={() => onAsk("Can you explain the ranking?")}>
          <Bot size={16} />
          Ask why
        </button>
      </section>

      <section className="recommendation-list">
        {recommendations.slice(0, 5).map((recommendation, index) => (
          <RecommendationCard
            key={recommendation.facility.id}
            index={index}
            recommendation={recommendation}
            saved={shortlist.includes(recommendation.facility.id)}
            onShortlist={() => onShortlist(recommendation.facility.id)}
            onPlanJourney={() => onPlanJourney(recommendation)}
            role={profile.role}
          />
        ))}
      </section>

      {journeyPlan && (
        <section className="journey-panel">
          <PanelHeader title="Care journey plan" source="Trip and booking demo" />
          <div className="journey-grid">
            <InfoPill icon={<Route size={16} />} label={`${journeyPlan.transportMode}, ${journeyPlan.travelMinutes} min`} />
            <InfoPill icon={<Wallet size={16} />} label={`${formatCurrency(journeyPlan.estimatedTransportCost)} transport`} />
            <InfoPill icon={<Hotel size={16} />} label={`${journeyPlan.hotel.name}, ${journeyPlan.hotel.distanceKm} km`} />
          </div>
          <div className="journey-columns">
            <div>
              <h3>Next actions</h3>
              {journeyPlan.instructions.map((instruction) => (
                <p key={instruction}>{instruction}</p>
              ))}
            </div>
            <div>
              <h3>Documents</h3>
              {journeyPlan.documents.map((document) => (
                <p key={document}>{document}</p>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function RecommendationCard({
  index,
  recommendation,
  saved,
  onShortlist,
  onPlanJourney,
  role,
}: {
  index: number;
  recommendation: Recommendation;
  saved: boolean;
  onShortlist: () => void;
  onPlanJourney: () => void;
  role: UserRole;
}) {
  const facility = recommendation.facility;
  return (
    <GlowCard className="recommendation-card" glowColor={index === 0 ? "green" : "blue"}>
      <div className="recommendation-rank">#{index + 1}</div>
      <div className="recommendation-body">
        <div className="recommendation-title">
          <div>
            <h3>{facility.name}</h3>
            <p>
              {facility.facilityType} - {facility.region}
            </p>
          </div>
          <div className="score-stack">
            <strong>{recommendation.score}</strong>
            <span>score</span>
          </div>
        </div>

        <p className="match-copy">
          {role === "patient"
            ? recommendation.matchExplanation
            : `${recommendation.matchExplanation} Post-penalty evidence confidence is ${recommendation.confidence}%.`}
        </p>

        <div className="signal-grid">
          <InfoPill icon={<MapPin size={16} />} label={`${facility.distanceKm.toFixed(1)} km away`} />
          <InfoPill icon={<Clock size={16} />} label={`${recommendation.estimatedTravelTime} min estimated`} />
          <InfoPill icon={<Wallet size={16} />} label={recommendation.pricingSignal} />
          <InfoPill icon={<Phone size={16} />} label={facility.booking} />
        </div>

        <div className="driver-grid">
          {recommendation.rankDrivers.map((driver) => (
            <div key={driver.label} className="driver">
              <span>{driver.label}</span>
              <Meter value={driver.value * 2} />
              <small>{driver.detail}</small>
            </div>
          ))}
        </div>

        <EvidenceSection recommendation={recommendation} />

        <div className="recommendation-actions">
          <button type="button" className="primary-button compact-button" onClick={onPlanJourney}>
            <TrainFront size={16} />
            Plan trip
          </button>
          <button type="button" className="icon-text-button" onClick={onShortlist}>
            {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            {saved ? "Saved" : "Save to shortlist"}
          </button>
        </div>
      </div>
    </GlowCard>
  );
}

function EvidenceSection({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="evidence-grid">
      <div className="evidence-block supported">
        <h4>Supporting evidence</h4>
        {recommendation.supportingEvidence.map((item) => (
          <p key={`${item.source}-${item.label}`}>
            <strong>{item.confidence}%</strong> {item.label}
            <span>{item.source} - {item.freshness}</span>
          </p>
        ))}
      </div>
      <div className="evidence-block missing">
        <h4>Missing evidence</h4>
        {recommendation.missingEvidence.length ? (
          recommendation.missingEvidence.map((item) => <p key={item}>{item}</p>)
        ) : (
          <p>No missing evidence in current snapshot.</p>
        )}
      </div>
      <div className="evidence-block suspicious">
        <h4>Suspicious or conflicting</h4>
        {recommendation.suspiciousEvidence.length ? (
          recommendation.suspiciousEvidence.map((item) => <p key={item}>{item}</p>)
        ) : (
          <p>No conflict flagged.</p>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <article className={cn("message", message.role)}>
      <div className="message-avatar">{message.role === "assistant" ? <Bot size={18} /> : <UserRound size={18} />}</div>
      <div className="message-content">
        {renderMessageContent(message.content)}
        {message.citations && (
          <div className="citation-row">
            {message.citations.map((citation) => (
              <span key={citation}>{citation}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function renderMessageContent(content: string) {
  return content
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim())
    .map((paragraph, index) => <p key={`${paragraph}-${index}`}>{renderInlineMarkdown(paragraph)}</p>);
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function Kpi({ icon, value, label, detail }: { icon: React.ReactNode; value: string; label: string; detail: string }) {
  return (
    <GlowCard className="kpi" glowColor="green">
      <div className="kpi-icon">{icon}</div>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </GlowCard>
  );
}

function CareRegionRow({ region }: { region: string }) {
  return (
    <>
      <span className="region-label">{region}</span>
      {careNeeds.slice(0, 5).map((need) => {
        const count = facilities.filter((facility) => facility.region === region && facility.services.includes(need)).length;
        return (
          <span key={`${region}-${need}`} className={cn("care-dot", count > 0 && "care-dot-active")}>
            {count}
          </span>
        );
      })}
    </>
  );
}

function PanelHeader({ title, source }: { title: string; source: string }) {
  return (
    <div className="panel-header">
      <h3>{title}</h3>
      <span>{source}</span>
    </div>
  );
}

function InfoPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="info-pill">
      {icon}
      {label}
    </span>
  );
}

function Meter({ value, tone = "teal" }: { value: number; tone?: "teal" | "amber" }) {
  return (
    <span className="meter" aria-label={`${value}%`}>
      <span className={tone} style={{ width: `${Math.min(value, 100)}%` }} />
    </span>
  );
}

function EmptyState({
  title,
  detail,
  action,
  onAction,
}: {
  title: string;
  detail?: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <Sparkles size={22} />
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
      <button type="button" className="icon-text-button" onClick={onAction}>
        {action}
      </button>
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={cn("tab-button", active && "active")} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}
