import { useEffect, useMemo, useRef, useState } from "react";
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
  BookingAutomationRequest,
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

type QueryLogEntry = {
  timestamp?: string;
  label?: string;
  query?: string;
  parameters?: Record<string, unknown>;
};

const budgetOptions: BudgetType[] = ["Economy", "Balanced", "Luxury", "Elite"];
const travelOptions: UserProfile["travelTime"][] = ["Quickest", "Standard", "Slow"];
const transportOptions: TransportPreference[] = ["Ambulance", "Cab", "Train", "Own vehicle"];
const pincodeOptions = ["302001", "302004", "302016", "302017", "302020", "302021", "302033"];

export default function App() {
  const [entered, setEntered] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [profileOpen, setProfileOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [journeyPlan, setJourneyPlan] = useState<JourneyPlan | null>(null);
  const [bookingRequest, setBookingRequest] = useState<BookingAutomationRequest | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [speechPlaybackActive, setSpeechPlaybackActive] = useState(false);
  const [codexBusy, setCodexBusy] = useState(false);
  const voiceAssistantMessageIdsRef = useRef<Map<string, string>>(new Map());
  const currentVoiceAssistantMessageIdRef = useRef<string | null>(null);
  const currentVoiceAssistantMessageFinalRef = useRef(false);
  const speechPlaybackActiveRef = useRef(false);
  const recentVoiceAssistantTranscriptRef = useRef("");
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: uid("msg"),
      role: "assistant",
      content:
        "I have your profile loaded. Let us take this one step at a time. First, tell me the confirmed diagnosis or symptoms, plus any reports or referral notes you already have. After that I can match hospitals by capability evidence, then optionally help with booking, transport, and hotel planning.",
      citations: [analyticsSnapshot.source],
      trace: ["intake_check: profile loaded", "safety_check: waiting for care need"],
    },
  ]);

  const currentCareNeed = recommendations[0]?.careNeed ?? "Unknown";
  const shortlistedRecommendations = recommendations.filter((item) => shortlist.includes(item.facility.id));
  const setRealtimeSpeechActive = (active: boolean) => {
    speechPlaybackActiveRef.current = active;
    setSpeechPlaybackActive((previous) => (previous === active ? previous : active));
  };

  const speakSkillBackedReply = async (text: string) => {
    const speakableText = makeVoiceSafeHealthcareText(text)
      .replace(/\*\*/g, "")
      .replace(/\[[^\]]+\]\([^)]+\)/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!speakableText) return;

    speechAudioRef.current?.pause();
    speechAudioRef.current = null;

    try {
      const response = await fetch("/api/openai-tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: speakableText.slice(0, 1800) }),
      });
      if (!response.ok) return;

      const audio = new Audio(URL.createObjectURL(await response.blob()));
      speechAudioRef.current = audio;
      setRealtimeSpeechActive(true);
      audio.onended = () => {
        setRealtimeSpeechActive(false);
        URL.revokeObjectURL(audio.src);
        if (speechAudioRef.current === audio) speechAudioRef.current = null;
      };
      audio.onerror = () => {
        setRealtimeSpeechActive(false);
        URL.revokeObjectURL(audio.src);
        if (speechAudioRef.current === audio) speechAudioRef.current = null;
      };
      await audio.play();
    } catch {
      setRealtimeSpeechActive(false);
    }
  };

  const handleVoiceUserTranscript = async (transcript: string) => {
    const trimmed = transcript.trim();
    if (!trimmed) return;
    if (
      isLikelyVoiceEchoTranscript({
        transcript: trimmed,
        recentAssistantTranscript: recentVoiceAssistantTranscriptRef.current,
        assistantSpeaking: speechPlaybackActiveRef.current,
      })
    ) {
      return;
    }

    const routedTranscript = normalizeVoiceRoutingTranscript(trimmed);
    const requestProfile = applyPromptProfileOverrides(profile, routedTranscript);
    setProfile(requestProfile);
    currentVoiceAssistantMessageIdRef.current = null;
    currentVoiceAssistantMessageFinalRef.current = false;
    voiceAssistantMessageIdsRef.current.clear();
    const reply = await handleSend(routedTranscript, { source: "voice" });
    if (reply?.content) await speakSkillBackedReply(reply.content);
  };

  const handleVoiceAssistantTranscript = (
    transcript: string,
    options: { id: string; final?: boolean },
  ) => {
    const content = transcript.trim();
    if (!content) return;
    recentVoiceAssistantTranscriptRef.current = content;

    setMessages((previous) => {
      const responseKey = voiceAssistantResponseKey(options.id);
      const mappedMessageId = voiceAssistantMessageIdsRef.current.get(options.id) ?? voiceAssistantMessageIdsRef.current.get(responseKey);
      const existingMessageId = mappedMessageId ?? currentVoiceAssistantMessageIdRef.current;
      if (!mappedMessageId && existingMessageId && currentVoiceAssistantMessageFinalRef.current) {
        return previous;
      }

      if (existingMessageId) {
        voiceAssistantMessageIdsRef.current.set(options.id, existingMessageId);
        voiceAssistantMessageIdsRef.current.set(responseKey, existingMessageId);
        if (options.final) currentVoiceAssistantMessageFinalRef.current = true;
        return previous.map((message) =>
          message.id === existingMessageId
            ? {
                ...message,
                content: shouldReplaceVoiceTranscript(message.content, content) ? content : message.content,
              }
            : message,
        );
      }

      const overlappingMessage = [...previous]
        .reverse()
        .find((message) => message.role === "assistant" && isVoiceAssistantMessage(message) && transcriptsOverlap(message.content, content));
      if (overlappingMessage) {
        voiceAssistantMessageIdsRef.current.set(options.id, overlappingMessage.id);
        voiceAssistantMessageIdsRef.current.set(responseKey, overlappingMessage.id);
        return previous.map((message) =>
          message.id === overlappingMessage.id
            ? {
                ...message,
                content: shouldReplaceVoiceTranscript(message.content, content) ? content : message.content,
              }
            : message,
        );
      }

      const messageId = uid("msg");
      voiceAssistantMessageIdsRef.current.set(options.id, messageId);
      voiceAssistantMessageIdsRef.current.set(responseKey, messageId);
      currentVoiceAssistantMessageIdRef.current = messageId;
      currentVoiceAssistantMessageFinalRef.current = Boolean(options.final);
      return [
        ...previous,
        {
          id: messageId,
          role: "assistant",
          content,
          trace: ["voice_assistant_transcript: openai_realtime"],
        },
      ];
    });

    if (options.final) {
      voiceAssistantMessageIdsRef.current.delete(options.id);
      voiceAssistantMessageIdsRef.current.delete(voiceAssistantResponseKey(options.id));
    }
  };

  const handleSend = async (prompt: string, options: { source?: "voice" | "typed" } = {}) => {
    const trimmed = prompt.trim();
    if (!trimmed || codexBusy) return null;
    const requestProfile = applyPromptProfileOverrides(profile, trimmed);
    setProfile(requestProfile);

    let localResult = answerPrompt(trimmed, requestProfile, recommendations);
    let skipLiveResponse = false;

    if (isIntercityTripPrompt(trimmed)) {
      skipLiveResponse = true;
      localResult = {
        text: buildIntercityTripAnswer(trimmed),
        recommendations,
        journeyPlan: journeyPlan ?? undefined,
        trace: ["travel_planning: intercity route comparison", "booking_assistant: transport options kept optional"],
        citations: ["Prism trip planner"],
      };
    } else if (isNearestPrompt(trimmed)) {
      const requestedCareNeed = detectCareNeedOverride(trimmed);
      const databricksResult = await callDatabricksNearest({
        profile: requestProfile,
        careNeed: requestedCareNeed ?? localResult.recommendations[0]?.careNeed ?? currentCareNeed,
      });

      if (databricksResult.ok && databricksResult.recommendations.length > 0) {
        const top = databricksResult.recommendations[0];
        const selectedCareNeed = requestedCareNeed ?? top.careNeed ?? localResult.recommendations[0]?.careNeed ?? currentCareNeed;
        skipLiveResponse = true;
        localResult = {
          text: buildDatabricksNearestAnswer(databricksResult.recommendations, requestProfile, selectedCareNeed, {
            exposeBackendName: options.source !== "voice",
          }),
          recommendations: databricksResult.recommendations,
          journeyPlan: planJourney(top, requestProfile),
          trace: [],
          citations: [`Databricks: ${databricksResult.source}`],
        };
      } else {
        skipLiveResponse = true;
        localResult = {
          text:
            options.source === "voice"
              ? `I checked the available facility data, but ${formatDatabricksError(
                  databricksResult.error,
                )
                  .replace(/\bDatabricks\b/g, "facility data")}. I am not showing local demo centers as verified results.`
              : `I checked Databricks for nearest centers, but ${formatDatabricksError(
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
      trace: options.source === "voice" ? ["voice_user_transcript: prism_skill_pipeline"] : undefined,
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
        trace: options.source === "voice" ? ["voice_response: databricks_skill_pipeline"] : undefined,
      };
      setMessages((previous) => [...previous, assistantMessage]);
      return assistantMessage;
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
      return assistantMessage;
    } catch (error) {
      const assistantMessage: ChatMessage = {
        id: uid("msg"),
        role: "assistant",
        content: `${localResult.text}\n\nI had trouble preparing the live response, so I used Prism's local recommendation logic for this answer.`,
        citations: localResult.citations,
        trace: ["assistant_response: local fallback used", ...localResult.trace],
      };
      setMessages((previous) => [...previous, assistantMessage]);
      return assistantMessage;
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

  const prepareComputerUseBooking = (recommendation: Recommendation) => {
    setBookingRequest(buildBookingAutomationRequest(recommendation, profile));
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
        topRecommendation={recommendations[0]}
        recommendationCount={recommendations.length}
        shortlistCount={shortlist.length}
        onNavigate={setActiveTab}
      />

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
            speechPlaybackActive={speechPlaybackActive}
            setRealtimeSpeechActive={setRealtimeSpeechActive}
            codexBusy={codexBusy}
            onSend={handleSend}
            onVoiceUserTranscript={handleVoiceUserTranscript}
            onVoiceAssistantTranscript={handleVoiceAssistantTranscript}
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
            bookingRequest={bookingRequest}
            onShortlist={toggleShortlist}
            onPlanJourney={makeJourneyPlan}
            onPrepareBooking={prepareComputerUseBooking}
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

function voiceAssistantResponseKey(id: string) {
  return String(id).split(":")[0] || id;
}

function isVoiceAssistantMessage(message: ChatMessage) {
  return message.trace?.some((item) => item.includes("voice_assistant_transcript")) ?? false;
}

function normalizeVoiceTranscript(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function transcriptsOverlap(previous: string, next: string) {
  const normalizedPrevious = normalizeVoiceTranscript(previous);
  const normalizedNext = normalizeVoiceTranscript(next);
  if (!normalizedPrevious || !normalizedNext) return false;
  return normalizedPrevious.includes(normalizedNext) || normalizedNext.includes(normalizedPrevious);
}

function shouldReplaceVoiceTranscript(previous: string, next: string) {
  const normalizedPrevious = normalizeVoiceTranscript(previous);
  const normalizedNext = normalizeVoiceTranscript(next);
  if (!normalizedNext) return false;
  return normalizedNext.length >= normalizedPrevious.length || !normalizedPrevious.includes(normalizedNext);
}

function isLikelyVoiceEchoTranscript({
  transcript,
  recentAssistantTranscript,
  assistantSpeaking,
}: {
  transcript: string;
  recentAssistantTranscript: string;
  assistantSpeaking: boolean;
}) {
  const normalized = normalizeVoiceTranscript(transcript);
  const recentAssistant = normalizeVoiceTranscript(recentAssistantTranscript);
  if (!normalized) return true;
  if (recentAssistant && (recentAssistant.includes(normalized) || normalized.includes(recentAssistant))) return true;

  const assistantEchoPhrases = [
    "how can i assist you today",
    "how can i assist you with your healthcare needs today",
    "how may i assist you today",
    "how can i help you today",
    "what can i help you with today",
  ];
  if (assistantEchoPhrases.some((phrase) => normalized === phrase || normalized.startsWith(`${phrase} `))) return true;

  const likelyGeneratedLogisticsLine =
    /^i need to book (?:a |an )?(?:transport|cab|taxi|ambulance|hotel|appointment)\b/.test(normalized) &&
    /\b(?:city hospital|hospital|check-?up|appointment)\b/.test(normalized);
  if (likelyGeneratedLogisticsLine) return true;

  return assistantSpeaking && normalized.length > 12 && !/\b(i am|i'm|my|near me|near|in|from|diagnosis|symptom|pain|surgery|hospital|doctor|book|need|want)\b/.test(normalized);
}

function DashboardSummary({
  profile,
  careNeed,
  topRecommendation,
  recommendationCount,
  shortlistCount,
  onNavigate,
}: {
  profile: UserProfile;
  careNeed: CareNeed;
  topRecommendation?: Recommendation;
  recommendationCount: number;
  shortlistCount: number;
  onNavigate: (tab: Tab) => void;
}) {
  const hasRecommendations = recommendationCount > 0;
  const hasShortlist = shortlistCount > 0;
  const hasCareNeed = careNeed !== "Unknown";
  const topFacility = topRecommendation?.facility;
  const confirmationCount =
    (topRecommendation?.missingEvidence.length ?? 0) + (topRecommendation?.suspiciousEvidence.length ?? 0);
  const supportingSourceCount = topRecommendation?.supportingEvidence.length ?? 0;
  const evidenceValue = topRecommendation
    ? confirmationCount
      ? "Confirm details"
      : topRecommendation.confidence < 50
        ? "Source check"
        : "Looks supported"
    : "Pending";
  const evidenceDetail = topRecommendation
    ? confirmationCount
      ? `${confirmationCount} item(s) need confirmation`
      : supportingSourceCount
        ? `${supportingSourceCount} supporting source(s); no flagged gaps`
        : "Facility returned; confirm by phone"
    : "Run a search to score evidence";
  const bestMatchValue = topFacility ? topFacility.name.replace("Prism Demo ", "") : "No facility yet";
  const bestMatchDetail = topRecommendation
    ? `${topFacility?.distanceKm.toFixed(1)} km, ${topRecommendation.estimatedTravelTime} min by ${profile.preferredTransportation.toLowerCase()}`
    : "Ask for a facility search in chat";
  const profileFields = [
    profile.name,
    profile.dateOfBirth,
    profile.location,
    profile.pincode,
    profile.currentProblems,
    profile.medicalHistory,
    profile.insuranceNumber,
    profile.governmentHealthCard,
    profile.budgetType,
    profile.travelTime,
    profile.preferredTransportation,
  ];
  const completedProfileFields = profileFields.filter(Boolean).length;

  return (
    <section className="dashboard-command" aria-label="Dashboard summary">
      <article className="case-record">
        <div className="case-record-header">
          <div>
            <p className="eyebrow">Active case</p>
            <h2>{profile.name}</h2>
          </div>
          <span className={cn("case-status", hasRecommendations && "case-status-ready")}>
            {hasRecommendations ? "Ranked" : "Intake needed"}
          </span>
        </div>

        <p className="case-problem">{profile.currentProblems}</p>

        <div className="case-detail-grid">
          <DashboardCaseDetail icon={<MapPin size={16} />} label="Location" value={formatProfileLocation(profile)} />
          <DashboardCaseDetail icon={<Wallet size={16} />} label="Budget" value={profile.budgetType} />
          <DashboardCaseDetail icon={<Route size={16} />} label="Travel" value={profile.travelTime} />
          <DashboardCaseDetail icon={<Database size={16} />} label="Source" value={analyticsSnapshot.source} />
        </div>
      </article>

      <article className="case-plan">
        <div className="case-plan-header">
          <div>
            <p className="eyebrow">Next move</p>
            <h3>{hasRecommendations ? "Review the ranked options" : "Start with care intake"}</h3>
          </div>
          <ShieldCheck size={20} />
        </div>
        <div className="case-step-list">
          <div className="case-step case-step-active">
            <span>01</span>
            <div>
              <strong>Care focus</strong>
              <small>{careNeed === "Unknown" ? "Awaiting diagnosis or symptoms" : careNeed}</small>
            </div>
          </div>
          <div className={cn("case-step", hasRecommendations && "case-step-active")}>
            <span>02</span>
            <div>
              <strong>Facility ranking</strong>
              <small>{hasRecommendations ? `${recommendationCount} option(s) ready` : "Waiting for chat request"}</small>
            </div>
          </div>
          <div className={cn("case-step", hasShortlist && "case-step-active")}>
            <span>03</span>
            <div>
              <strong>Shortlist and trip</strong>
              <small>{hasShortlist ? `${shortlistCount} saved` : "No saved facilities yet"}</small>
            </div>
          </div>
        </div>
        <div className="case-plan-actions">
          <button type="button" className="primary-button compact-button" onClick={() => onNavigate("chat")}>
            <MessageSquareText size={16} />
            Open chat
          </button>
          <button type="button" className="icon-text-button" onClick={() => onNavigate("recommendations")}>
            <ClipboardList size={16} />
            Recommendations
          </button>
        </div>
      </article>

      <div className="dashboard-vitals">
        {hasRecommendations ? (
          <>
            <DashboardMetric
              icon={<Stethoscope size={18} />}
              label="Care need"
              value={hasCareNeed ? careNeed : "Not clear yet"}
              detail={hasCareNeed ? `Searching near ${profile.location || "selected location"}` : "Share diagnosis or symptoms"}
              tone="teal"
            />
            <DashboardMetric
              icon={<Building2 size={18} />}
              label="Best match"
              value={bestMatchValue}
              detail={bestMatchDetail}
              tone="blue"
            />
            <DashboardMetric
              icon={<BookmarkCheck size={18} />}
              label="Next action"
              value="Review options"
              detail={`${recommendationCount} ranked option(s), ${shortlistCount} saved`}
              tone="amber"
            />
            <DashboardMetric
              icon={<ShieldCheck size={18} />}
              label="Evidence check"
              value={evidenceValue}
              detail={evidenceDetail}
              tone="rose"
            />
          </>
        ) : (
          <>
            <DashboardMetric
              icon={<UserRound size={18} />}
              label="Intake status"
              value="Profile loaded"
              detail={`${completedProfileFields}/${profileFields.length} profile fields ready`}
              tone="teal"
            />
            <DashboardMetric
              icon={<MapPin size={18} />}
              label="Location context"
              value={formatProfileLocation(profile)}
              detail={`${profile.preferredTransportation.toLowerCase()}, ${profile.travelTime.toLowerCase()} route`}
              tone="blue"
            />
            <DashboardMetric
              icon={<Wallet size={18} />}
              label="Care preferences"
              value={profile.budgetType}
              detail={`${profile.role === "patient" ? "Patient" : "Coordinator"} view is active`}
              tone="amber"
            />
            <DashboardMetric
              icon={<Database size={18} />}
              label="Data fetch"
              value="Ready"
              detail="Chat will query live facility data"
              tone="rose"
            />
          </>
        )}
      </div>
    </section>
  );
}

function DashboardCaseDetail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="case-detail">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
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
  return /\b(nearest|nearby|closest|near me|near|around|find|good|want|need|care|treatment|surgery|operation|procedure|surgeon|specialist|cardio|cardiac|cardiology|heart|centers?|centres?|hospitals?|clinics?|facilit(?:y|ies)|pricing|availability|booking|evidence|handle|expect)\b/i.test(
    prompt,
  );
}

function isIntercityTripPrompt(prompt: string) {
  const normalized = prompt.toLowerCase();
  return /\b(trip|travel|route|transport|train|bus|flight|cab)\b/.test(normalized) && /\bfrom\s+jaipur\b/.test(normalized) && /\bto\s+delhi\b/.test(normalized);
}

function detectCareNeedOverride(prompt: string): CareNeed | null {
  const normalized = prompt.toLowerCase();
  if (/\b(dialysis|renal|kidney|ckd|nephro)\b/.test(normalized)) return "Dialysis";
  if (/\b(cardio|cardiac|cardiology|heart|bypass|angioplasty|valve|ecg|echo)\b/.test(normalized)) return "Cardiology";
  if (/\bcareer\s+(?:facilit(?:y|ies)|hospitals?|clinics?|centers?|centres?|care|specialists?)\b/.test(normalized)) return "Cardiology";
  if (/\b(trauma|emergency|accident|icu|critical)\b/.test(normalized)) return "Trauma";
  if (/\b(maternity|pregnancy|obstetric|gynecology|gynaecology)\b/.test(normalized)) return "Maternity";
  if (/\b(oncology|cancer|chemo|radiation)\b/.test(normalized)) return "Oncology";
  return null;
}

function normalizeVoiceRoutingTranscript(transcript: string) {
  return transcript.replace(
    /\bcareer\s+(?=(?:facilit(?:y|ies)|hospitals?|clinics?|centers?|centres?|care|specialists?))/gi,
    "cardio ",
  );
}

function applyPromptProfileOverrides(profile: UserProfile, prompt: string): UserProfile {
  return {
    ...profile,
    location: detectLocationOverride(prompt) ?? profile.location,
    pincode: detectPincodeOverride(prompt) ?? profile.pincode,
    budgetType: detectBudgetOverride(prompt) ?? profile.budgetType,
    travelTime: detectTravelOverride(prompt) ?? profile.travelTime,
    preferredTransportation: detectTransportOverride(prompt) ?? profile.preferredTransportation,
  };
}

function buildBookingAutomationRequest(recommendation: Recommendation, profile: UserProfile): BookingAutomationRequest {
  const facility = recommendation.facility;
  const careNeed = recommendation.careNeed;
  const patientLocation = formatProfileLocation(profile);
  const handoffPrompt = [
    `Use Codex browser/computer control to help book or confirm an appointment for ${facility.name}.`,
    `Care need: ${careNeed}.`,
    `Patient: ${profile.name}, location ${patientLocation}.`,
    `Facility phone or booking detail: ${facility.phone}; ${facility.booking}.`,
    "First find the official hospital booking page or phone/appointment channel.",
    "Do not submit any form, place any call, send any message, or share patient identifiers until the user explicitly confirms the exact action and details.",
    "If an official online booking page is unavailable, prepare the phone script and stop for user confirmation.",
  ].join("\n");

  return {
    id: uid("booking"),
    facilityName: facility.name,
    facilityPhone: facility.phone,
    bookingInstruction: facility.booking,
    careNeed,
    patientName: profile.name,
    patientLocation: profile.location,
    patientPincode: profile.pincode,
    preferredDate: "Ask user",
    status: "needs_confirmation",
    checklist: [
      "Confirm patient name, phone number, appointment date, and care department.",
      "Use the official hospital site or listed phone channel only.",
      "Stop before submitting forms, placing calls, or sharing identifiers.",
      "After confirmation, record booking reference, appointment time, and required documents.",
    ],
    handoffPrompt,
  };
}

function formatProfileLocation(profile: UserProfile) {
  return [profile.location, profile.pincode].filter(Boolean).join(" - ");
}

function detectLocationOverride(prompt: string) {
  const knownLocations: Record<string, string> = {
    jaipur: "Jaipur, Rajasthan",
    delhi: "Delhi",
    mumbai: "Mumbai",
    patna: "Patna, Bihar",
    chennai: "Chennai, Tamil Nadu",
    surat: "Surat, Gujarat",
    noida: "Noida, Uttar Pradesh",
    bengaluru: "Bengaluru, Karnataka",
    bangalore: "Bengaluru, Karnataka",
  };
  const normalized = prompt.toLowerCase();
  for (const [needle, label] of Object.entries(knownLocations)) {
    if (new RegExp(`\\b(?:near|in|around|from)\\s+${needle}\\b`, "i").test(normalized)) return label;
  }

  const match = prompt.match(/\b(?:near|in|around|from)\s+([A-Z][A-Za-z\s]+?)(?:[,.;!?]|$|\s+(?:with|for|and|economy|balanced|luxury|elite|budget|cab|ambulance|train|quickest|fastest|nearby|hospital|clinic|center|centre))/);
  if (!match) return null;

  const location = match[1].trim().replace(/\s+/g, " ");
  if (!location || location.length < 2) return null;

  return location;
}

function detectPincodeOverride(prompt: string) {
  const match = prompt.match(/\b(?:pin\s*code|pincode|postal\s*code|zip)\s*(?:is|:)?\s*(\d{6})\b|\b(\d{6})\b/iu);
  return match?.[1] ?? match?.[2] ?? null;
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

function buildIntercityTripAnswer(prompt: string) {
  const wantsCheapest = /\b(cheap|cheapest|economy|budget|affordable)\b/i.test(prompt);
  const lead = wantsCheapest
    ? "The most affordable Jaipur-to-Delhi medical trip options are government bus or sleeper train."
    : "For a Jaipur-to-Delhi medical trip, choose the mode based on stability, comfort, and appointment timing.";
  return [
    `${lead} Government bus is usually around ₹350-₹550, and train sleeper class is around ₹200-₹350.`,
    "For comfort without jumping too high in cost, Volvo AC bus is roughly ₹700-₹1,200 and AC 3-tier train is roughly ₹500-₹900.",
    "For speed, flights can start around ₹1,500 and take about 45 minutes in the air, but airport time at both ends usually makes the total trip longer.",
    "For door-to-door convenience, a private outstation cab is usually around ₹2,500-₹4,500 for the vehicle; shared cab can be cheaper per person if available.",
    "If the patient has chest pain, severe breathlessness, fainting, confusion, or unstable vitals, do not use routine transport; use emergency care or ambulance support.",
    "Optional next step: tell me the Delhi hospital or area and travel date, and I can narrow this to one route.",
  ].join("\n\n");
}

function makeVoiceSafeHealthcareText(text: string) {
  return text
    .replace(/\bDatabricks claim score\b/gi, "facility evidence score")
    .replace(/\bDatabricks did not return\b/gi, "the facility data did not include")
    .replace(/\bDatabricks returned\b/gi, "the available facility data returned")
    .replace(/\breturned from Databricks\b/gi, "matched the available facility data")
    .replace(/\bfrom Databricks capability fields\b/gi, "from available capability fields")
    .replace(/\bDatabricks connection\b/gi, "facility data connection")
    .replace(/\bDatabricks results\b/gi, "verified facility results")
    .replace(/\bDatabricks row\b/gi, "facility data row")
    .replace(/\bDatabricks\b/gi, "the facility data")
    .replace(/\bSQL\b/g, "data")
    .replace(/\bquery logs?\b/gi, "data trace");
}

function buildDatabricksNearestAnswer(
  recommendations: Recommendation[],
  profile: UserProfile,
  careNeed: CareNeed,
  options: { exposeBackendName?: boolean } = {},
) {
  const topOptions = recommendations.slice(0, 3);
  const top = topOptions[0];
  const facility = top.facility;
  const exposeBackendName = options.exposeBackendName ?? true;
  const dataSourceLabel = exposeBackendName ? "Databricks" : "the available facility data";
  const selectedTravelMinutes = facility.travelTimes[profile.preferredTransportation] ?? top.estimatedTravelTime;
  const hasClaimScore = top.claimScore !== undefined && top.claimScore !== null && top.claimScore > 0;
  const confidenceText = hasClaimScore
    ? `${exposeBackendName ? "Databricks claim score" : "Facility evidence score"} ${top.claimScore?.toFixed(0)}${
        top.claimScoreBand ? ` (${top.claimScoreBand})` : ""
      }`
    : exposeBackendName
      ? "Databricks did not return a usable claim score for this row"
      : "The facility data did not include a usable evidence score for this row";
  const candidateLines = topOptions
    .map((item, index) => {
      const itemFacility = item.facility;
      const claim =
        item.claimScore !== undefined && item.claimScore !== null && item.claimScore > 0
          ? `claim ${item.claimScore.toFixed(0)}${item.claimScoreBand ? ` ${item.claimScoreBand}` : ""}`
          : "claim score not returned";
      return `${index + 1}. **${itemFacility.name}** - ${itemFacility.distanceKm.toFixed(1)} km, about ${
        item.estimatedTravelTime
      } minutes by cab, ${claim}`;
    })
    .join("\n\n");
  const missingEvidence = top.missingEvidence.length
    ? top.missingEvidence.join("; ")
    : "equipment list, same-day availability, final price, and booking rules still need phone confirmation";
  const missingEvidenceText = exposeBackendName ? missingEvidence : makeVoiceSafeHealthcareText(missingEvidence);

  return [
    `For **${careNeed.toLowerCase()}** near **${profile.location}**, ${dataSourceLabel} returned these candidate facilities:`,
    candidateLines,
    `The closest candidate is **${facility.name}**: ${facility.distanceKm.toFixed(
      1,
    )} km away, about ${selectedTravelMinutes} minutes by ${profile.preferredTransportation.toLowerCase()}. ${confidenceText}.`,
    `Capability evidence fields: ${facility.services.join(", ")}. Missing or uncertain: ${missingEvidenceText}.`,
    "Optional next step: would you like help confirming booking for this facility, or should we stop here? Transport comes after booking intent, and hotel stays last only if an overnight stay is needed.",
  ].join("\n\n");
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
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
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
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  onSubmit: () => void;
  submitLabel: string;
  compact?: boolean;
}) {
  const setField = <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => {
    setProfile((current) => ({ ...current, [field]: value }));
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
        Pincode
        <input
          list="profile-pincode-options"
          inputMode="numeric"
          pattern="[0-9]*"
          value={profile.pincode}
          onChange={(event) => setField("pincode", event.target.value)}
        />
        <datalist id="profile-pincode-options">
          {pincodeOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
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
  const regions = Object.keys(regionCounts);
  const activeRecommendations = recommendations;
  const activeFacilities = activeRecommendations.length
    ? activeRecommendations.map((recommendation) => recommendation.facility)
    : facilities;
  const activeRegionCounts = activeFacilities.reduce<Record<string, number>>((acc, facility) => {
    acc[facility.region] = (acc[facility.region] ?? 0) + 1;
    return acc;
  }, {});
  const activeMaxRegionCount = Math.max(...Object.values(activeRegionCounts), 1);
  const dashboardSource = activeRecommendations.length ? "Current findings" : analyticsSnapshot.source;
  const activeCareNeed = activeRecommendations[0]?.careNeed ?? "All care needs";
  const activeAverageConfidence = Math.round(
    activeFacilities.reduce((sum, facility) => sum + facility.evidenceConfidence, 0) / Math.max(activeFacilities.length, 1),
  );
  const activeMissingEvidence = activeFacilities.reduce((sum, facility) => sum + facility.missingEvidence.length, 0);
  const closestFindingDistance = activeRecommendations.length
    ? `${Math.min(...activeRecommendations.map((item) => item.facility.distanceKm)).toFixed(1)} km`
    : "n/a";
  const activeRegions = Object.keys(activeRegionCounts);
  const priceGroups = budgetOptions.map((budget, index) => ({
    budget,
    count: activeFacilities.filter((facility) => facility.priceIndex === index + 1).length,
  }));

  return (
    <div className="insights-layout">
      <section className="kpi-grid">
        <Kpi
          icon={<Building2 size={20} />}
          value={activeFacilities.length.toString()}
          label={activeRecommendations.length ? "Facilities in findings" : "Facilities in registry"}
          detail={`${activeCareNeed}, ${profile.location}`}
        />
        <Kpi
          icon={<ShieldCheck size={20} />}
          value={`${activeAverageConfidence}%`}
          label="Evidence confidence"
          detail={activeRecommendations.length ? "Average for current findings" : "Registry average after source-quality checks"}
        />
        <Kpi
          icon={<AlertTriangle size={20} />}
          value={activeMissingEvidence.toString()}
          label="Missing evidence"
          detail={activeRecommendations.length ? "Current findings requiring confirmation" : "Registry evidence gaps"}
        />
        <Kpi
          icon={<Activity size={20} />}
          value={closestFindingDistance}
          label="Closest option"
          detail={activeRecommendations.length ? `${profile.preferredTransportation}, ${profile.travelTime}` : "Run a finding to calculate"}
        />
      </section>

      <section className="chart-grid">
        <article className="data-panel panel-wide">
          <PanelHeader
            title={activeRecommendations.length ? "Current findings by region" : "Facility distribution by region"}
            source={dashboardSource}
          />
          <div className="bar-list">
            {Object.entries(activeRegionCounts).map(([region, count]) => (
              <div className="bar-row" key={region}>
                <span>{region}</span>
                <div className="bar-track">
                  <div className="bar-fill teal" style={{ width: `${(count / activeMaxRegionCount) * 100}%` }} />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="data-panel">
          <PanelHeader title="Care availability by region" source={dashboardSource} />
          <div className="availability-grid">
            <span />
            {careNeeds.slice(0, 5).map((need) => (
              <strong key={need}>{need}</strong>
            ))}
            {(activeRecommendations.length ? activeRegions : regions).map((region) => (
              <CareRegionRow key={region} region={region} facilitiesForRegion={activeFacilities} />
            ))}
          </div>
        </article>

        <article className="data-panel">
          <PanelHeader title="Price ranges by budget tier" source={dashboardSource} />
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
          <PanelHeader title="Distance and travel-time comparison for current findings" source="Prism ranking output" />
          {activeRecommendations.length > 0 ? (
            <div className="comparison-table">
              <div className="table-head">
                <span>Facility</span>
                <span>Distance</span>
                <span>Travel</span>
                <span>Score</span>
              </div>
              {activeRecommendations.slice(0, 4).map((item) => (
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
          <PanelHeader title="Evidence confidence and missing-data indicators" source={dashboardSource} />
          <div className="quality-list">
            {activeFacilities.slice(0, 5).map((facility) => (
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
  speechPlaybackActive,
  setRealtimeSpeechActive,
  codexBusy,
  onSend,
  onVoiceUserTranscript,
  onVoiceAssistantTranscript,
  onOpenRecommendations,
  onShortlist,
  shortlist,
}: {
  profile: UserProfile;
  messages: ChatMessage[];
  recommendations: Recommendation[];
  speechPlaybackActive: boolean;
  setRealtimeSpeechActive: (active: boolean) => void;
  codexBusy: boolean;
  onSend: (prompt: string) => void;
  onVoiceUserTranscript: (transcript: string) => void;
  onVoiceAssistantTranscript: (transcript: string, options: { id: string; final?: boolean }) => void;
  onOpenRecommendations: () => void;
  onShortlist: (facilityId: string) => void;
  shortlist: string[];
}) {
  const [draft, setDraft] = useState("");
  const topRecommendation = recommendations[0];
  const quickPrompts = [
    "My diagnosis is CKD and I may need dialysis",
    "Recommend a hospital by capability",
    "Help me with optional booking",
    "Plan optional transport",
  ];
  const latestAssistantReply = [...messages].reverse().find((message) => message.role === "assistant");

  const submit = () => {
    onSend(draft);
    setDraft("");
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
            <OpenAIVoiceChat
              profile={profile}
            recommendations={recommendations}
            externalPlaybackActive={speechPlaybackActive}
            disabled={codexBusy}
            onSpeechActivityChange={setRealtimeSpeechActive}
            onTranscript={onVoiceUserTranscript}
              onAssistantTranscript={onVoiceAssistantTranscript}
            />
          </div>
        </div>

        <div className="message-list" aria-live="polite">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isSpeaking={speechPlaybackActive && latestAssistantReply?.id === message.id}
            />
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
        <QueryLogPanel />

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

function QueryLogPanel() {
  const [entries, setEntries] = useState<QueryLogEntry[]>([]);
  const [streamStatus, setStreamStatus] = useState<"connecting" | "streaming" | "offline">("connecting");
  const latestEntry = entries[0];

  useEffect(() => {
    let cancelled = false;

    const loadEntries = () => {
      fetch("/api/query-logs?limit=25")
        .then((response) => response.json())
        .then((data: { entries?: QueryLogEntry[] }) => {
          if (!cancelled) setEntries(data.entries ?? []);
        })
        .catch(() => {
          if (!cancelled) setStreamStatus("offline");
        });
    };

    loadEntries();
    const refreshTimer = window.setInterval(loadEntries, 2500);

    if (!("EventSource" in window)) {
      setStreamStatus("offline");
      return () => {
        cancelled = true;
        window.clearInterval(refreshTimer);
      };
    }

    const source = new EventSource("/api/query-log-stream?replay=5");
    source.addEventListener("open", () => {
      if (!cancelled) setStreamStatus("streaming");
    });
    source.addEventListener("ready", () => {
      if (!cancelled) setStreamStatus("streaming");
    });
    source.addEventListener("entry", (event) => {
      if (cancelled) return;
      setStreamStatus("streaming");
      const entry = safeParseQueryLogEntry((event as MessageEvent).data);
      if (!entry) return;
      setEntries((current) => {
        const key = `${entry.timestamp}-${entry.label}-${entry.query}`;
        const withoutDuplicate = current.filter((item) => `${item.timestamp}-${item.label}-${item.query}` !== key);
        return [entry, ...withoutDuplicate].slice(0, 25);
      });
    });
    source.addEventListener("error", () => {
      if (cancelled) return;
      setStreamStatus(source.readyState === EventSource.CLOSED ? "offline" : "connecting");
    });

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      source.close();
    };
  }, []);

  return (
    <GlowCard className="agent-panel query-log-panel" glowColor="blue">
      <div className="query-log-header">
        <PanelHeader title="Query log" source="Main dashboard stream" />
        <span className={cn("stream-badge", streamStatus === "streaming" && "stream-badge-live")}>
          {streamStatus === "streaming" ? "Streaming" : streamStatus === "connecting" ? "Connecting" : "Offline"}
        </span>
      </div>

      <div className="query-log-live-box" aria-live="polite">
        {latestEntry ? (
          <>
            <div className="query-log-meta">
              <span>{formatLogTime(latestEntry.timestamp)}</span>
              <strong>{latestEntry.label ?? "query"}</strong>
            </div>
            <code>{latestEntry.query}</code>
            {latestEntry.parameters && (
              <pre>{JSON.stringify(latestEntry.parameters, null, 2)}</pre>
            )}
          </>
        ) : (
          <p>No query logs yet.</p>
        )}
      </div>

      {entries.length > 1 && (
        <div className="query-log-list">
          {entries.slice(1, 5).map((entry, index) => (
            <div key={`${entry.timestamp}-${entry.label}-${index}`} className="query-log-row">
              <span>{formatLogTime(entry.timestamp)}</span>
              <strong>{entry.label ?? "query"}</strong>
            </div>
          ))}
        </div>
      )}
    </GlowCard>
  );
}

function safeParseQueryLogEntry(value: string) {
  try {
    return JSON.parse(value) as QueryLogEntry;
  } catch {
    return null;
  }
}

function formatLogTime(value?: string) {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function RecommendationsTab({
  profile,
  careNeed,
  recommendations,
  shortlist,
  journeyPlan,
  bookingRequest,
  onShortlist,
  onPlanJourney,
  onPrepareBooking,
  onAsk,
}: {
  profile: UserProfile;
  careNeed: CareNeed;
  recommendations: Recommendation[];
  shortlist: string[];
  journeyPlan: JourneyPlan | null;
  bookingRequest: BookingAutomationRequest | null;
  onShortlist: (facilityId: string) => void;
  onPlanJourney: (recommendation: Recommendation) => void;
  onPrepareBooking: (recommendation: Recommendation) => void;
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
            onPrepareBooking={() => onPrepareBooking(recommendation)}
            role={profile.role}
          />
        ))}
      </section>

      {bookingRequest && <BookingAutomationPanel request={bookingRequest} />}

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

function BookingAutomationPanel({ request }: { request: BookingAutomationRequest }) {
  return (
    <section className="booking-automation-panel">
      <PanelHeader title="Computer booking handoff" source="Codex controlled action" />
      <div className="booking-automation-grid">
        <InfoPill icon={<Building2 size={16} />} label={request.facilityName} />
        <InfoPill icon={<Stethoscope size={16} />} label={request.careNeed} />
        <InfoPill icon={<MapPin size={16} />} label={`${request.patientLocation} - ${request.patientPincode}`} />
        <InfoPill icon={<Phone size={16} />} label={request.facilityPhone} />
      </div>
      <div className="booking-automation-columns">
        <div>
          <h3>Before Codex books</h3>
          {request.checklist.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
        <div>
          <h3>Handoff prompt</h3>
          <pre>{request.handoffPrompt}</pre>
        </div>
      </div>
      <div className="booking-automation-note">
        <AlertTriangle size={16} />
        <span>Codex can help navigate and prepare the booking, but submitting forms, making calls, or sharing patient identifiers needs your explicit confirmation.</span>
      </div>
    </section>
  );
}

function RecommendationCard({
  index,
  recommendation,
  saved,
  onShortlist,
  onPlanJourney,
  onPrepareBooking,
  role,
}: {
  index: number;
  recommendation: Recommendation;
  saved: boolean;
  onShortlist: () => void;
  onPlanJourney: () => void;
  onPrepareBooking: () => void;
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
          {recommendation.claimScore !== undefined && recommendation.claimScore !== null && (
            <InfoPill
              icon={<ShieldCheck size={16} />}
              label={`Claim ${recommendation.claimScore.toFixed(0)}${recommendation.claimScoreBand ? ` (${recommendation.claimScoreBand})` : ""}`}
            />
          )}
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
          <button type="button" className="icon-text-button" onClick={onPrepareBooking}>
            <Bot size={16} />
            Computer booking
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
      {recommendation.claimScoreBreakdown && (
        <div className="evidence-block score-breakdown">
          <h4>Claim score</h4>
          {scoreBreakdownRows(recommendation).map((item) => (
            <p key={item.label}>
              <strong>{item.value}</strong> {item.label}
              <span>{item.detail}</span>
            </p>
          ))}
        </div>
      )}
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

function scoreBreakdownRows(recommendation: Recommendation) {
  const breakdown = recommendation.claimScoreBreakdown;
  if (!breakdown) return [];

  return [
    {
      label: "Composite validity",
      value: recommendation.claimScore !== undefined && recommendation.claimScore !== null ? recommendation.claimScore.toFixed(0) : "n/a",
      detail: recommendation.claimScoreBand ? `${recommendation.claimScoreBand} credibility band` : "No score band returned",
    },
    {
      label: "Semantic corroboration",
      value: formatScorePart(breakdown.semanticCorroboration),
      detail: "Specialties backed by procedures, equipment, or capabilities",
    },
    {
      label: "Evidence density",
      value: formatScorePart(breakdown.evidenceDensity),
      detail: `${breakdown.evidenceItems ?? 0} procedure/equipment evidence item(s)`,
    },
    {
      label: "Consistency",
      value: formatScorePart(breakdown.consistency),
      detail:
        breakdown.doctorCapacityRatio !== undefined && breakdown.doctorCapacityRatio !== null
          ? `Doctor/capacity ratio ${breakdown.doctorCapacityRatio.toFixed(2)}`
          : "Doctor/capacity ratio not returned",
    },
    {
      label: "Digital footprint",
      value: formatScorePart(breakdown.digitalFootprint),
      detail: "Website, social presence, followers, and recent posting",
    },
  ];
}

function formatScorePart(value?: number | null) {
  if (value === undefined || value === null || !Number.isFinite(value)) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function MessageBubble({ message, isSpeaking = false }: { message: ChatMessage; isSpeaking?: boolean }) {
  return (
    <article className={cn("message", message.role, isSpeaking && "message-speaking")}>
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

function CareRegionRow({ region, facilitiesForRegion }: { region: string; facilitiesForRegion: Facility[] }) {
  return (
    <>
      <span className="region-label">{region}</span>
      {careNeeds.slice(0, 5).map((need) => {
        const count = facilitiesForRegion.filter((facility) => facility.region === region && facility.services.includes(need)).length;
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
