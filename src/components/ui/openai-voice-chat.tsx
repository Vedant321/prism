import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import type { Recommendation, UserProfile } from "../../types";

type VoiceState = "idle" | "connecting" | "live" | "error";

interface OpenAIVoiceChatProps {
  profile: UserProfile;
  recommendations: Recommendation[];
}

type RealtimeTokenResponse = {
  ok?: boolean;
  clientSecret?: string;
  error?: string;
};

export function OpenAIVoiceChat({ profile, recommendations }: OpenAIVoiceChatProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [status, setStatus] = useState("OpenAI voice");
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  useEffect(() => stopSession, []);

  const stopSession = () => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
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
    if (state === "connecting" || state === "live") {
      stopSession();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      setState("error");
      setStatus("Voice is not supported in this browser");
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

  return (
    <button
      type="button"
      className={cn("icon-text-button openai-voice-button", state === "live" && "selected-soft", state === "error" && "error-soft")}
      onClick={startSession}
      aria-pressed={state === "live"}
      title={status}
    >
      {state === "live" || state === "connecting" ? <MicOff size={16} /> : <Mic size={16} />}
      {state === "live" ? "End voice" : state === "connecting" ? "Connecting" : state === "error" ? "Voice unavailable" : "Voice chat"}
    </button>
  );
}

function parseRealtimeEvent(data: unknown): any {
  try {
    return typeof data === "string" ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}
