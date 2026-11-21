"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Radio, Sparkles } from "lucide-react";

const reducedMotion = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const preference = window.matchMedia(reducedMotion);
  preference.addEventListener("change", onChange);
  return () => preference.removeEventListener("change", onChange);
}

function WaitArt({ compact = false }: { compact?: boolean }) {
  const allowMotion = useSyncExternalStore(subscribe, () => !window.matchMedia(reducedMotion).matches, () => false);
  return <div className={`wait-art${compact ? " wait-art-compact" : ""}`} aria-hidden="true">
    {allowMotion && <video src="/arena-wait.mp4" autoPlay loop muted playsInline preload="auto" />}
    <span className="wait-token color-mint" />
    <span className="wait-token color-rose" />
    <Sparkles className="wait-sparkle" />
  </div>;
}

export function MatchSearch({ cancel }: { cancel: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  return <section className="wait-card" aria-labelledby="search-title">
    <WaitArt />
    <div className="wait-copy">
      <div className="wait-signal" aria-hidden="true"><Radio /><span /><span /><span /></div>
      <h1 id="search-title" ref={heading} tabIndex={-1}>กำลังหาคู่แข่ง</h1>
      <button className="outline" type="button" onClick={cancel}>ยกเลิกค้นหา</button>
    </div>
  </section>;
}

export function LobbyWait() {
  return <div className="lobby-wait-art"><WaitArt compact /></div>;
}
