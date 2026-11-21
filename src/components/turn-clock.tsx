import { useEffect, useEffectEvent, useState } from "react";
import { Timer } from "lucide-react";

export function TurnClock({ deadline, expired, paused }: {
  deadline: string | null;
  expired: () => void;
  paused: boolean;
}) {
  const [display, setDisplay] = useState<{ deadline: string; seconds: number } | null>(null);
  const notifyExpired = useEffectEvent(() => { if (!paused) expired(); });

  useEffect(() => {
    if (!deadline) return;
    const end = Date.parse(deadline);
    if (!Number.isFinite(end)) return;
    let lastSeconds = -1;
    let lastClaim = 0;
    const update = () => {
      const now = Date.now();
      const seconds = Math.max(0, Math.ceil((end - now) / 1000));
      if (seconds !== lastSeconds) {
        lastSeconds = seconds;
        setDisplay({ deadline, seconds });
      }
      if (seconds === 0 && !document.hidden && now - lastClaim >= 1800) {
        lastClaim = now;
        notifyExpired();
      }
    };
    const frame = window.requestAnimationFrame(update);
    const tick = window.setInterval(update, 200);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", update);
    };
  }, [deadline]);

  const seconds = display?.deadline === deadline ? display?.seconds : undefined;
  const value = seconds === undefined ? "—" : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className="turn-clock" data-urgent={seconds !== undefined && seconds <= 10} role="timer" aria-label="เวลาที่เหลือในตานี้">
      <Timer aria-hidden="true" /><strong>{value}</strong>
    </div>
  );
}
