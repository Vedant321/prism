import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import type { Recommendation, UserProfile } from "../../types";

type VoiceState = "idle" | "connecting" | "live" | "listening" | "error";

interface OpenAIVoiceChatProps {
  profile: UserProfile;
  recommendations: Recommendation[];
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

export function OpenAIVoiceChat({
  profile,
  recommendations,
  disabled = false,
  onSpeechActivityChange,
  onTranscript,
  onAssistantTranscript,
}: OpenAIVoiceChatProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [status, setStatus] = useState("OpenAI voice");
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const submittedTranscriptKeysRef = useRef<Set<string>>(new Set());
  const assistantTranscriptBuffersRef = useRef<Map<string, string>>(new Map());
  const submittedAssistantTranscriptKeysRef = useRef<Set<string>>(new Set());
  const submittedAssistantTranscriptTextKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => stopSession, []);

  const setAssistantSpeechActive = (active: boolean) => {
    setAssistantSpeaking((previous) => (previous === active ? previous : active));
    onSpeechActivityChange?.(active);
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
    submittedTranscriptKeysRef.current.clear();
    assistantTranscriptBuffersRef.current.clear();
    submittedAssistantTranscriptKeysRef.current.clear();
    submittedAssistantTranscriptTextKeysRef.current.clear();
    setAssistantSpeechActive(false);
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

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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
          return;
        }

        if (payload?.type === "input_audio_buffer.speech_started") {
          setState("listening");
          setStatus("Listening");
          setAssistantSpeechActive(false);
          return;
        }

        if (payload?.type === "input_audio_buffer.speech_stopped") {
          setState("live");
          setStatus("Transcribing...");
          return;
        }

        if (payload?.type === "conversation.item.input_audio_transcription.completed") {
          const transcript = typeof payload.transcript === "string" ? payload.transcript.trim() : "";
          if (!transcript || !onTranscript) {
            setStatus("I did not catch that");
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
          return;
        }

        if (
          payload?.type === "response.output_audio.done" ||
          payload?.type === "response.cancelled"
        ) {
          setAssistantSpeechActive(false);
          return;
        }

        if (payload?.type === "conversation.item.input_audio_transcription.failed") {
          setState("live");
          setStatus(payload.error?.message ?? "Speech unavailable");
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
    };
    recognition.onresult = (event) => {
      let transcript = "";
      const startIndex = event.resultIndex ?? 0;
      for (let index = startIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      transcript = transcript.trim();
      if (transcript) {
        onTranscript(transcript);
        setStatus(`Heard: ${transcript}`);
      } else {
        setStatus("I did not catch that");
      }
    };
    recognition.onerror = (event) => {
      setState("error");
      setStatus(formatSpeechRecognitionError(event.error ?? event.message));
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setState((current) => (current === "error" ? current : "idle"));
    };

    try {
      recognition.start();
    } catch (error) {
      setState("error");
      setStatus(error instanceof Error ? error.message : reason);
    }
  };

  const voiceActive = state === "connecting" || state === "live" || state === "listening";

  return (
    <button
      type="button"
      className={cn(
        "icon-text-button openai-voice-button",
        (state === "live" || state === "listening") && "selected-soft",
        assistantSpeaking && "speaking-now",
        state === "error" && "error-soft",
      )}
      onClick={startSession}
      disabled={disabled && !voiceActive}
      aria-pressed={state === "live" || state === "listening"}
      title={status}
    >
      <span className="speech-icon-wrap">
        {voiceActive ? <MicOff size={16} /> : <Mic size={16} />}
      </span>
      <span>
        {state === "live"
          ? "End voice"
          : state === "listening"
            ? "Listening"
            : state === "connecting"
              ? "Connecting"
              : state === "error"
                ? "Voice unavailable"
                : "Voice chat"}
      </span>
      <span className="speech-wave" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} style={{ animationDelay: `${index * 90}ms` }} />
        ))}
      </span>
    </button>
  );
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
