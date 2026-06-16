import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: "blue" | "purple" | "green" | "red" | "orange";
}

const glowColorMap = {
  blue: { base: 210, spread: 140 },
  purple: { base: 272, spread: 180 },
  green: { base: 152, spread: 130 },
  red: { base: 350, spread: 100 },
  orange: { base: 28, spread: 120 },
};

export function GlowCard({ children, className, glowColor = "green" }: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { base, spread } = glowColorMap[glowColor];

  useEffect(() => {
    const syncPointer = (event: PointerEvent) => {
      const card = cardRef.current;
      if (!card) return;
      card.style.setProperty("--x", event.clientX.toFixed(2));
      card.style.setProperty("--y", event.clientY.toFixed(2));
      card.style.setProperty("--xp", (event.clientX / window.innerWidth).toFixed(2));
    };
    document.addEventListener("pointermove", syncPointer);
    return () => document.removeEventListener("pointermove", syncPointer);
  }, []);

  return (
    <div
      ref={cardRef}
      data-glow
      className={cn("glow-card", className)}
      style={
        {
          "--base": base,
          "--spread": spread,
        } as CSSProperties
      }
    >
      <div data-glow-inner />
      {children}
    </div>
  );
}
