import { ArrowUp, FileText, LocateFixed, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

interface PromptInputBoxProps {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (message: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function PromptInputBox({
  value,
  onValueChange,
  onSend,
  disabled,
  isLoading,
  placeholder = "Ask Prism anything...",
  className,
}: PromptInputBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"voice" | "text">("text");

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 190)}px`;
  }, [value]);

  const submit = () => {
    if (disabled || !value.trim()) return;
    onSend(value);
  };

  return (
    <div className={cn("prompt-box", className)}>
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        rows={1}
        placeholder={mode === "voice" ? "Recording voice note..." : placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="prompt-box-footer">
        <div className="prompt-tools">
          <button type="button" aria-label="Attach referral document" disabled={disabled}>
            <FileText size={17} />
          </button>
          <button type="button" aria-label="Use current location" disabled={disabled}>
            <LocateFixed size={17} />
          </button>
          <button
            type="button"
            aria-label={mode === "voice" ? "Stop voice input" : "Start voice input"}
            disabled={disabled}
            className={cn(mode === "voice" && "active")}
            onClick={() => setMode((current) => (current === "voice" ? "text" : "voice"))}
          >
            {mode === "voice" ? <Square size={15} /> : <Mic size={17} />}
          </button>
        </div>
        <button
          type="button"
          className="prompt-send"
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
        >
          {isLoading ? <Square size={15} /> : <ArrowUp size={18} />}
        </button>
      </div>
    </div>
  );
}
