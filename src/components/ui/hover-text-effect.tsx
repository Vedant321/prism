import { useEffect, useId, useRef, useState } from "react";

interface TextHoverEffectProps {
  text: string;
  className?: string;
}

export function TextHoverEffect({ text, className }: TextHoverEffectProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });
  const rawId = useId().replace(/:/g, "");
  const gradientId = `prism-text-gradient-${rawId}`;
  const maskGradientId = `prism-text-mask-gradient-${rawId}`;
  const maskId = `prism-text-mask-${rawId}`;

  useEffect(() => {
    if (!hovered) setMaskPosition({ cx: "50%", cy: "50%" });
  }, [hovered]);

  return (
    <svg
      ref={svgRef}
      className={className}
      width="100%"
      height="100%"
      viewBox="0 0 300 100"
      role="img"
      aria-label={text}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(event) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        setMaskPosition({
          cx: `${((event.clientX - rect.left) / rect.width) * 100}%`,
          cy: `${((event.clientY - rect.top) / rect.height) * 100}%`,
        });
      }}
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="34%" stopColor="#d4d4d4" />
          <stop offset="68%" stopColor="#8f8f8f" />
          <stop offset="100%" stopColor="#f5f5f5" />
        </linearGradient>
        <radialGradient id={maskGradientId} cx={maskPosition.cx} cy={maskPosition.cy} r="24%">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </radialGradient>
        <mask id={maskId}>
          <rect x="0" y="0" width="100%" height="100%" fill={`url(#${maskGradientId})`} />
        </mask>
      </defs>
      <text
        x="50%"
        y="51%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.55"
        className="hover-text-outline"
      >
        {text}
      </text>
      <text
        x="50%"
        y="51%"
        textAnchor="middle"
        dominantBaseline="middle"
        stroke={`url(#${gradientId})`}
        strokeWidth="0.7"
        mask={`url(#${maskId})`}
        className="hover-text-gradient"
      >
        {text}
      </text>
    </svg>
  );
}
