import { Mic, MicOff, PhoneOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import type { Recommendation, UserProfile } from "../../types";
import { VoicePoweredOrb } from "./voice-powered-orb";

type VoiceState = "idle" | "connecting" | "live" | "listening" | "error";

const ignoredInputTranscripts = new Set([
  "expect concise healthcare concierge requests, hospital names, care needs, booking, transport, and location details.",
]);

interface OpenAIVoiceChatProps {
  profile: UserProfile;
  recommendations: Recommendation[];
  externalPlaybackActive?: boolean;
  disabled?: boolean;
  onSpeechActivityChange?: (active: boolean) => void;
  onTranscript?: (transcript: string) => void;
  onAssistantTranscript?: (transcript: string, options: { id: string; final?: boolean }) => void;
}

type RealtimeTokenResponse = {
  ok?: boolean;
  clientSecret?: string;
  error?: string;
};

type BrowserSpeechRecognitionEvent = {
  readonly resultIndex?: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: {
      readonly 0: {
        readonly transcript: string;
      };
    };
  };
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart?: (() => void) | null;
  onend: (() => void) | null;
  onerror?: ((event: { error?: string; message?: string }) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
};

type BrowserWindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export function OpenAIVoiceChat({
  profile,
  recommendations,
  externalPlaybackActive = false,
  disabled = false,
  onSpeechActivityChange,
  onTranscript,
  onAssistantTranscript,
}: OpenAIVoiceChatProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [status, setStatus] = useState("OpenAI voice");
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [orbVoiceLevel, setOrbVoiceLevel] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const micLevelRafRef = useRef<number | null>(null);
  const micLevelAudioContextRef = useRef<AudioContext | null>(null);
  const micLevelAnalyserRef = useRef<AnalyserNode | null>(null);
  const micLevelSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micLevelDataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const submittedTranscriptKeysRef = useRef<Set<string>>(new Set());
  const assistantTranscriptBuffersRef = useRef<Map<string, string>>(new Map());
  const submittedAssistantTranscriptKeysRef = useRef<Set<string>>(new Set());
  const submittedAssistantTranscriptTextKeysRef = useRef<Set<string>>(new Set());
  const assistantSpeakingRef = useRef(false);
  const externalPlaybackActiveRef = useRef(false);
  const lastExternalPlaybackAtRef = useRef(0);
  const lastAssistantAudioAtRef = useRef(0);
  const microphoneResumeTimerRef = useRef<number | null>(null);

  useEffect(() => stopSession, []);

  useEffect(() => {
    externalPlaybackActiveRef.current = externalPlaybackActive;
    if (externalPlaybackActive) lastExternalPlaybackAtRef.current = Date.now();
  }, [externalPlaybackActive]);

  useEffect(() => {
    if (!popupOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeVoicePopup();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [popupOpen]);

  const setAssistantSpeechActive = (active: boolean) => {
    assistantSpeakingRef.current = active;
    if (active) lastAssistantAudioAtRef.current = Date.now();
    if (microphoneResumeTimerRef.current !== null) {
      window.clearTimeout(microphoneResumeTimerRef.current);
      microphoneResumeTimerRef.current = null;
    }
    if (active) {
      setMicrophoneTransmissionEnabled(false);
    } else {
      microphoneResumeTimerRef.current = window.setTimeout(() => {
        setMicrophoneTransmissionEnabled(true);
        microphoneResumeTimerRef.current = null;
      }, 900);
    }
    setAssistantSpeaking((previous) => (previous === active ? previous : active));
    onSpeechActivityChange?.(active);
  };

  const setMicrophoneTransmissionEnabled = (enabled: boolean) => {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  };

  const submitAssistantTranscript = (key: string, transcript: string) => {
    const trimmed = transcript.trim();
    const textKey = `${realtimeAssistantTranscriptResponseId(key)}:${normalizeTranscript(trimmed)}`;
    if (
      !trimmed ||
      !onAssistantTranscript ||
      submittedAssistantTranscriptKeysRef.current.has(key) ||
      submittedAssistantTranscriptTextKeysRef.current.has(textKey)
    ) {
      return;
    }

    submittedAssistantTranscriptKeysRef.current.add(key);
    submittedAssistantTranscriptTextKeysRef.current.add(textKey);
    assistantTranscriptBuffersRef.current.delete(key);
    onAssistantTranscript(trimmed, { id: key, final: true });
  };

  const startMicLevelMonitor = async (stream: MediaStream) => {
    const AudioContextConstructor =
      window.AudioContext ?? (window as BrowserWindowWithWebkitAudio).webkitAudioContext;
    if (!AudioContextConstructor) return;

    try {
      stopMicLevelMonitor();

      const audioContext = new AudioContextConstructor();
      if (audioContext.state === "suspended") await audioContext.resume();

      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      let lastUiUpdateAt = 0;
      let lastLevel = 0;

      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.42;
      const dataArray = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      source.connect(analyser);

      micLevelAudioContextRef.current = audioContext;
      micLevelAnalyserRef.current = analyser;
      micLevelSourceRef.current = source;
      micLevelDataArrayRef.current = dataArray;

      const tick = (timestamp: number) => {
        const activeAnalyser = micLevelAnalyserRef.current;
        const activeDataArray = micLevelDataArrayRef.current;
        if (!activeAnalyser || !activeDataArray) return;

        activeAnalyser.getByteTimeDomainData(activeDataArray);

        let sum = 0;
        for (let index = 0; index < activeDataArray.length; index += 1) {
          const centeredValue = (activeDataArray[index] - 128) / 128;
          sum += centeredValue * centeredValue;
        }

        const rms = Math.sqrt(sum / activeDataArray.length);
        const level = clamp01((rms - 0.015) * 8);
        const shouldUpdate = timestamp - lastUiUpdateAt > 50 || Math.abs(level - lastLevel) > 0.08;

        if (shouldUpdate) {
          lastUiUpdateAt = timestamp;
          lastLevel = level;
          setOrbVoiceLevel((previous) => {
            const next = previous + (level - previous) * 0.38;
            return Math.abs(next - previous) < 0.02 ? previous : next;
          });
        }

        micLevelRafRef.current = requestAnimationFrame(tick);
      };

      micLevelRafRef.current = requestAnimationFrame(tick);
    } catch {
      stopMicLevelMonitor();
    }
  };

  const stopMicLevelMonitor = () => {
    if (micLevelRafRef.current !== null) {
      cancelAnimationFrame(micLevelRafRef.current);
      micLevelRafRef.current = null;
    }

    micLevelSourceRef.current?.disconnect();
    micLevelSourceRef.current = null;
    micLevelAnalyserRef.current?.disconnect();
    micLevelAnalyserRef.current = null;
    micLevelDataArrayRef.current = null;

    if (micLevelAudioContextRef.current && micLevelAudioContextRef.current.state !== "closed") {
      void micLevelAudioContextRef.current.close();
    }
    micLevelAudioContextRef.current = null;
  };

  const stopSession = () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
    }
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    if (microphoneResumeTimerRef.current !== null) {
      window.clearTimeout(microphoneResumeTimerRef.current);
      microphoneResumeTimerRef.current = null;
    }
    submittedTranscriptKeysRef.current.clear();
    assistantTranscriptBuffersRef.current.clear();
    submittedAssistantTranscriptKeysRef.current.clear();
    submittedAssistantTranscriptTextKeysRef.current.clear();
    setAssistantSpeechActive(false);
    stopMicLevelMonitor();
    setOrbVoiceLevel(0);
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }
    setState("idle");
    setStatus("OpenAI voice");
  };

  const openVoicePopup = () => {
    if (disabled && !voiceActive) return;
    setPopupOpen(true);
  };

  const closeVoicePopup = () => {
    if (voiceActive) stopSession();
    setPopupOpen(false);
  };

  const handlePopupPrimaryAction = () => {
    if (voiceActive) {
      stopSession();
      setPopupOpen(false);
      return;
    }

    void startSession();
  };

  const startSession = async () => {
    if (state === "connecting" || state === "live" || state === "listening") {
      stopSession();
      return;
    }

    if (disabled) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      startBrowserSpeechFallback("OpenAI voice is not supported in this browser");
      return;
    }

    setState("connecting");
    setStatus("Connecting...");
    setOrbVoiceLevel(0.16);

    try {
      const tokenResponse = await fetch("/api/openai-realtime-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile,
          recommendations: recommendations.slice(0, 3),
        }),
      });
      const tokenData = (await tokenResponse.json().catch(() => ({}))) as RealtimeTokenResponse;
      if (!tokenResponse.ok || !tokenData.ok || !tokenData.clientSecret) {
        if (isConfigurationError(tokenData.error)) {
          startBrowserSpeechFallback(tokenData.error ?? "OpenAI voice is not configured.");
          return;
        }
        throw new Error(tokenData.error ?? "OpenAI voice is not configured.");
      }

      const peer = new RTCPeerConnection();
      peerRef.current = peer;

      const audio = document.createElement("audio");
      audio.autoplay = true;
      audioRef.current = audio;
      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0];
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      startMicLevelMonitor(stream);
      stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));

      const channel = peer.createDataChannel("oai-events");
      dataChannelRef.current = channel;
      channel.addEventListener("open", () => {
        setState("live");
        setStatus("Listening");
      });
      channel.addEventListener("message", (event) => {
        const payload = parseRealtimeEvent(event.data);
        if (payload?.type === "error") {
          setState("error");
          setStatus(payload.error?.message ?? "Voice session error");
          setAssistantSpeechActive(false);
          setOrbVoiceLevel(0);
          return;
        }

        if (payload?.type === "input_audio_buffer.speech_started") {
          setState("listening");
          setStatus("Listening");
          setAssistantSpeechActive(false);
          setOrbVoiceLevel((current) => Math.max(current, 0.48));
          return;
        }

        if (payload?.type === "input_audio_buffer.speech_stopped") {
          setState("live");
          setStatus("Transcribing...");
          setOrbVoiceLevel(0.2);
          return;
        }

        if (payload?.type === "conversation.item.input_audio_transcription.completed") {
          const transcript = typeof payload.transcript === "string" ? payload.transcript.trim() : "";
          if (!transcript || !onTranscript) {
            setStatus("I did not catch that");
            return;
          }
          if (isIgnoredInputTranscript(transcript)) {
            setState("live");
            setStatus("Listening");
            return;
          }
          if (
            assistantSpeakingRef.current ||
            externalPlaybackActiveRef.current ||
            Date.now() - lastAssistantAudioAtRef.current < 1800 ||
            Date.now() - lastExternalPlaybackAtRef.current < 1400
          ) {
            setState("live");
            setStatus("Listening");
            return;
          }

          const key = realtimeTranscriptKey(payload, transcript);
          if (submittedTranscriptKeysRef.current.has(key)) return;

          submittedTranscriptKeysRef.current.add(key);
          onTranscript(transcript);
          setState("live");
          setStatus(`Heard: ${transcript}`);
          return;
        }

        if (payload?.type === "response.output_audio.delta") {
          setAssistantSpeechActive(true);
          setOrbVoiceLevel(0.9);
          return;
        }

        if (payload?.type === "response.output_audio_transcript.delta") {
          const delta = typeof payload.delta === "string" ? payload.delta : "";
          if (delta && onAssistantTranscript) {
            const key = realtimeAssistantTranscriptKey(payload);
            const transcript = `${assistantTranscriptBuffersRef.current.get(key) ?? ""}${delta}`;
            assistantTranscriptBuffersRef.current.set(key, transcript);
            onAssistantTranscript(transcript, { id: key });
            setAssistantSpeechActive(true);
          }
          return;
        }

        if (payload?.type === "response.output_audio_transcript.done") {
          const key = realtimeAssistantTranscriptKey(payload);
          const transcript =
            typeof payload.transcript === "string" ? payload.transcript : assistantTranscriptBuffersRef.current.get(key) ?? "";
          submitAssistantTranscript(key, transcript);
          return;
        }

        if (
          payload?.type === "response.done"
        ) {
          const responseId = String(payload.response?.id ?? payload.response_id ?? "response");
          const hasBufferedTranscript = Array.from(assistantTranscriptBuffersRef.current.keys()).some((key) =>
            key.startsWith(`${responseId}:`),
          );
          if (!hasBufferedTranscript) {
            const transcript = extractRealtimeAssistantTranscript(payload);
            if (transcript) submitAssistantTranscript(`${responseId}:response:0:0`, transcript);
          }
          setAssistantSpeechActive(false);
          setOrbVoiceLevel(0.14);
          return;
        }

        if (
          payload?.type === "response.output_audio.done" ||
          payload?.type === "response.cancelled"
        ) {
          setAssistantSpeechActive(false);
          setOrbVoiceLevel(0.14);
          return;
        }

        if (payload?.type === "conversation.item.input_audio_transcription.failed") {
          setState("live");
          setStatus(payload.error?.message ?? "Speech unavailable");
          setOrbVoiceLevel(0.14);
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          authorization: `Bearer ${tokenData.clientSecret}`,
          "content-type": "application/sdp",
        },
      });
      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text().catch(() => "");
        throw new Error(errorText || "OpenAI voice connection failed.");
      }

      await peer.setRemoteDescription({
        type: "answer",
        sdp: await sdpResponse.text(),
      });
    } catch (error) {
      stopSession();
      setState("error");
      setStatus(error instanceof Error ? error.message : "OpenAI voice failed to start");
    }
  };

  const startBrowserSpeechFallback = (reason: string) => {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition || !onTranscript) {
      setState("error");
      setStatus(reason);
      setOrbVoiceLevel(0);
      return;
    }

    const recognition = new SpeechRecognition() as BrowserSpeechRecognition;
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState("listening");
      setStatus("Listening with Chrome speech");
      setOrbVoiceLevel(0.55);
    };
    recognition.onresult = (event) => {
      let transcript = "";
      const startIndex = event.resultIndex ?? 0;
      for (let index = startIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      transcript = transcript.trim();
      if (transcript) {
        if (isIgnoredInputTranscript(transcript)) {
          setStatus("Listening");
        } else {
          onTranscript(transcript);
          setStatus(`Heard: ${transcript}`);
        }
      } else {
        setStatus("I did not catch that");
      }
      setOrbVoiceLevel(0.2);
    };
    recognition.onerror = (event) => {
      setState("error");
      setStatus(formatSpeechRecognitionError(event.error ?? event.message));
      setOrbVoiceLevel(0);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setState((current) => (current === "error" ? current : "idle"));
      setOrbVoiceLevel(0);
    };

    try {
      recognition.start();
    } catch (error) {
      setState("error");
      setStatus(error instanceof Error ? error.message : reason);
      setOrbVoiceLevel(0);
    }
  };

  const voiceActive = state === "connecting" || state === "live" || state === "listening";
  const orbLevel = assistantSpeaking
    ? Math.max(orbVoiceLevel, 0.82)
    : state === "listening"
      ? Math.max(orbVoiceLevel, 0.36)
      : voiceActive
        ? Math.max(orbVoiceLevel, 0.14)
        : 0;
  const orbHue = assistantSpeaking ? 28 : state === "listening" ? 88 : voiceActive ? 58 : 38;
  const popupOrbLevel = popupOpen && !voiceActive && state !== "error" ? Math.max(orbLevel, 0.1) : orbLevel;
  const popupTitle = assistantSpeaking
    ? "Speaking"
    : state === "listening"
      ? "Listening"
      : state === "connecting"
        ? "Connecting"
        : state === "error"
          ? "Voice unavailable"
          : "Voice chat";
  const popupPrimaryLabel = voiceActive ? "End voice" : state === "error" ? "Try again" : "Start voice";

  return (
    <>
      <button
        type="button"
        className={cn(
          "icon-text-button openai-voice-button",
          (state === "live" || state === "listening") && "selected-soft",
          assistantSpeaking && "speaking-now",
          state === "error" && "error-soft",
        )}
        onClick={openVoicePopup}
        disabled={disabled && !voiceActive}
        aria-haspopup="dialog"
        aria-pressed={state === "live" || state === "listening"}
        title={voiceActive ? status : "Open voice chat"}
      >
        <span className="voice-orb-shell">
          <VoicePoweredOrb
            active={voiceActive}
            className="voice-orb"
            hue={orbHue}
            maxHoverIntensity={0.9}
            maxRotationSpeed={1.35}
            voiceLevel={orbLevel}
          />
          <span className="voice-orb-glyph">
            {voiceActive ? <MicOff size={14} /> : <Mic size={14} />}
          </span>
        </span>
        <span className="voice-button-label">
          {state === "live"
            ? "Voice live"
            : state === "listening"
              ? "Listening"
              : state === "connecting"
                ? "Connecting"
                : state === "error"
                  ? "Voice unavailable"
                  : "Voice chat"}
        </span>
      </button>

      {popupOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="voice-popup-backdrop" role="dialog" aria-modal="true" aria-labelledby="voice-popup-title">
            <div className={cn("voice-popup", voiceActive && "voice-popup-active", assistantSpeaking && "voice-popup-speaking")}>
              <button type="button" className="voice-popup-close" onClick={closeVoicePopup} title="Close voice chat">
                <X size={20} />
              </button>

              <div className="voice-popup-orb-stage">
                <VoicePoweredOrb
                  active={popupOpen}
                  className="voice-popup-orb"
                  hue={orbHue}
                  maxHoverIntensity={1}
                  maxRotationSpeed={1.65}
                  voiceLevel={popupOrbLevel}
                />
                <div className="voice-popup-core">
                  {voiceActive ? <MicOff size={30} /> : <Mic size={30} />}
                </div>
              </div>

              <div className="voice-popup-status">
                <span>OpenAI voice</span>
                <h2 id="voice-popup-title">{popupTitle}</h2>
                <p>{status}</p>
              </div>

              <button
                type="button"
                className={cn("voice-popup-primary", voiceActive && "voice-popup-primary-end")}
                onClick={handlePopupPrimaryAction}
                disabled={disabled && !voiceActive && state !== "error"}
              >
                {voiceActive ? <PhoneOff size={18} /> : <Mic size={18} />}
                {popupPrimaryLabel}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

function isConfigurationError(error?: string) {
  return /OPENAI_API_KEY|not configured|not set|missing/i.test(error ?? "");
}

function formatSpeechRecognitionError(error?: string) {
  if (error === "not-allowed" || error === "service-not-allowed") return "Microphone permission is blocked";
  if (error === "no-speech") return "I did not hear anything";
  if (error === "audio-capture") return "No microphone was found";
  return error ? `Speech recognition failed: ${error}` : "Speech recognition failed";
}

function isIgnoredInputTranscript(transcript: string) {
  return ignoredInputTranscripts.has(normalizeTranscript(transcript).toLowerCase());
}

function parseRealtimeEvent(data: unknown): any {
  try {
    return typeof data === "string" ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function realtimeTranscriptKey(payload: any, transcript: string) {
  return `${payload.item_id ?? "item"}:${payload.content_index ?? 0}:${transcript}`;
}

function realtimeAssistantTranscriptKey(payload: any) {
  return [
    payload.response_id ?? payload.response?.id ?? "response",
    payload.item_id ?? payload.item?.id ?? "item",
    payload.output_index ?? 0,
    payload.content_index ?? 0,
  ].join(":");
}

function realtimeAssistantTranscriptResponseId(key: string) {
  return key.split(":")[0] || "response";
}

function normalizeTranscript(transcript: string) {
  return transcript.replace(/\s+/g, " ").trim();
}

function extractRealtimeAssistantTranscript(payload: any) {
  const output = Array.isArray(payload.response?.output) ? payload.response.output : [];
  const transcripts: string[] = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.transcript === "string") transcripts.push(part.transcript);
      if (typeof part?.text === "string" && part?.type === "output_audio_transcript") transcripts.push(part.text);
    }
  }

  return transcripts.join(" ").trim();
}
