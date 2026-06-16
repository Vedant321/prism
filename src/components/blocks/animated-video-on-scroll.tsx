import { type CSSProperties, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import scrollJourney from "../../assets/prism-scroll-journey.png";
import scrollMatch from "../../assets/prism-scroll-match.png";
import scrollNeed from "../../assets/prism-scroll-need.png";

interface AnimatedVideoOnScrollProps {
  className?: string;
}

export function AnimatedVideoOnScroll({ className }: AnimatedVideoOnScrollProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const range = rect.height - window.innerHeight;
      const next = range <= 0 ? 0 : Math.min(Math.max(-rect.top / range, 0), 1);
      setProgress(next);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <section ref={sectionRef} className={cn("scroll-video-section", className)}>
      <div
        className="scroll-video-sticky"
        style={
          {
            "--scroll-progress": progress,
            "--image-scale": 0.9 + progress * 0.1,
            "--copy-y": `${(1 - progress) * 18}px`,
            "--copy-opacity": 0.68 + progress * 0.32,
          } as CSSProperties
        }
      >
        <div className="scroll-video-copy">
          <span>Designed Around The Patient</span>
          <h2>See the whole journey come into focus.</h2>
          <p>
            Prism turns an unclear care need into a guided path: understand, compare, coordinate, and arrive prepared.
          </p>
        </div>
        <div className="scroll-video-frame" aria-label="Animated Prism care journey image sequence">
          <div className="scroll-image-stage">
            <img className="scroll-frame-image frame-one" src={scrollNeed} alt="" aria-hidden="true" />
            <img className="scroll-frame-image frame-two" src={scrollMatch} alt="" aria-hidden="true" />
            <img className="scroll-frame-image frame-three" src={scrollJourney} alt="" aria-hidden="true" />
            <div className="scroll-device-glass" />
          </div>
          <div className="scroll-video-overlay">
            <span>Understand</span>
            <span>Compare</span>
            <span>Coordinate</span>
          </div>
        </div>
      </div>
    </section>
  );
}
