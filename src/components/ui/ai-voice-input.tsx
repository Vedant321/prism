import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: {
    readonly transcript: string;
  };
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface AIVoiceInputProps {
  onStart?: () => void;
  onStop?: (duration: number) => void;
  onTranscript?: (transcript: string) => void;
  visualizerBars?: number;
  className?: string;
}

export function AIVoiceInput({
  onStart,
  onStop,
  onTranscript,
  visualizerBars = 36,
  className,
}: AIVoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [time, setTime] = useState(0);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const durationRef = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (isListening) {
      timer = setInterval(() => {
        setTime((value) => {
          durationRef.current = value + 1;
          return value + 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isListening]);

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    onStop?.(durationRef.current);
    setTime(0);
    durationRef.current = 0;
  };

  const startListening = () => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      setIsListening(true);
      onStart?.();
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      if (transcript.trim()) onTranscript?.(transcript.trim());
    };
    recognition.onend = () => {
      if (recognitionRef.current) stopListening();
    };
    recognitionRef.current = recognition;
    setSupported(true);
    setIsListening(true);
    onStart?.();
    recognition.start();
  };

  const handleClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const minutes = Math.floor(time / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (time % 60).toString().padStart(2, "0");

  return (
    <div className={cn("voice-input", className)}>
      <button
        type="button"
        className={cn("voice-button", isListening && "voice-button-active")}
        onClick={handleClick}
        aria-label={isListening ? "Stop voice input" : "Start voice input"}
      >
        {isListening ? <Square size={18} /> : <Mic size={20} />}
      </button>
      <div className="voice-meter" aria-hidden="true">
        {Array.from({ length: visualizerBars }).map((_, index) => (
          <span
            key={index}
            className={cn("voice-bar", isListening && "voice-bar-active")}
            style={{
              animationDelay: `${index * 34}ms`,
              height: isListening ? `${18 + ((index * 17) % 54)}px` : "6px",
            }}
          />
        ))}
      </div>
      <div className="voice-meta">
        <span>{minutes}:{seconds}</span>
        <span>{supported ? (isListening ? "Listening" : "Voice") : "Speech API unavailable"}</span>
      </div>
    </div>
  );
}
