import { useRef, useState, type PointerEvent } from "react";
import type { PieceColor } from "@/lib/rooms";

export function PieceTray({ count, color, enabled, place }: {
  count: number;
  color: PieceColor;
  enabled: boolean;
  place: (at: number) => void;
}) {
  const pointer = useRef<number | null>(null);
  const ghost = useRef<HTMLSpanElement>(null);
  const [armed, setArmed] = useState(false);

  function move(event: PointerEvent<HTMLButtonElement>) {
    if (pointer.current !== event.pointerId || !ghost.current) return;
    ghost.current.style.translate = `${event.clientX}px ${event.clientY}px`;
    ghost.current.hidden = false;
  }

  function drop(event: PointerEvent<HTMLButtonElement>, commit: boolean) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    if (ghost.current) ghost.current.hidden = true;
    if (!commit || !enabled) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>(".point[data-point]");
    if (target && !target.disabled) place(Number(target.dataset.point));
  }

  return (
    <div className={`piece-tray color-${color}`} data-active={enabled} data-armed={enabled && armed} role="group" aria-label="หมากในมือของคุณ">
      <span className="tray-label">หมากในมือ</span>
      <div className="tray-slots">
        {Array.from({ length: 9 }, (_, i) => i < count ? (
          <button key={i} type="button" className="tray-piece" aria-label={`หมากในมือ ตัวที่ ${i + 1}`} disabled={!enabled}
            onClick={() => setArmed(true)}
            onPointerDown={(event) => {
              if (event.button !== 0 || pointer.current !== null) return;
              pointer.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
              move(event);
            }}
            onPointerMove={move}
            onPointerUp={(event) => drop(event, true)}
            onPointerCancel={(event) => drop(event, false)}
            onLostPointerCapture={(event) => drop(event, false)}
          ><i /></button>
        ) : <span className="tray-empty" key={i} aria-hidden="true" />)}
      </div>
      <span ref={ghost} className="drag-ghost" aria-hidden="true" hidden />
    </div>
  );
}
