import { useEffect, useRef, type CSSProperties } from "react";
import { Check, Coins, DoorOpen, Hourglass, RotateCcw, Trophy } from "lucide-react";
import { capturedCount, lastCapture, other, type Side } from "@/lib/morris";
import type { Room } from "@/lib/rooms";
import { WIN_COINS } from "@/lib/shop";

const confettiColors = ["#b693e1", "#f2a7c8", "#8fcbb6", "#ffd487", "#a1cefa"];

export function MatchResult({ room, side, pending, error, rematch, end }: {
  room: Room;
  side: Side;
  pending: boolean;
  error: string;
  rematch: () => void;
  end: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const finalCapture = Boolean(lastCapture(room.game));
  const won = room.game.winner === side;
  const mine = side === "mint" ? room.host_rematch : room.guest_rematch;
  const theirs = side === "mint" ? room.guest_rematch : room.host_rematch;
  const title = won ? "คุณชนะ!" : "คู่แข่งชนะ!";
  const nextStep = room.rematch_closed ? "อีกฝ่ายจบการแข่งขันแล้ว"
    : mine ? "รออีกฝ่ายกดพร้อมเล่นต่อ"
    : theirs ? "อีกฝ่ายชวนเล่นต่อ" : "เล่นอีกตาในห้องเดิมได้เมื่อทั้งสองฝ่ายพร้อม";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (dialog.current && !dialog.current.open) dialog.current.showModal();
    }, finalCapture ? 750 : 0);
    return () => window.clearTimeout(timer);
  }, [finalCapture]);

  return (
    <dialog ref={dialog} className={`match-result ${won ? "result-won" : ""}`} aria-labelledby="result-title"
      onCancel={(event) => event.preventDefault()}>
      {won && <div className="victory-confetti" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => <i key={i} style={{
          "--confetti-color": confettiColors[i % confettiColors.length],
          "--confetti-x": `${Math.cos(i * Math.PI / 8) * (82 + i % 3 * 17)}px`,
          "--confetti-y": `${Math.sin(i * Math.PI / 8) * (65 + i % 4 * 14)}px`,
          "--confetti-turn": `${(i % 2 ? 1 : -1) * (80 + i * 17)}deg`,
        } as CSSProperties} />)}
      </div>}
      <div className="result-medal" aria-hidden="true"><Trophy /></div>
      <h2 id="result-title">{title}</h2>
      {room.finish_reason === "timeout" && <p className="result-reason">จบเกมเพราะหมดเวลา</p>}
      {won && !room.local_match && <p className="shop-balance match-coins"><Coins aria-hidden="true" /> <strong>+{WIN_COINS}</strong> เหรียญ</p>}
      <div className="result-score">
        <div><strong>{capturedCount(room.game, side)}</strong><span>คุณกินได้</span></div>
        <div><strong>{capturedCount(room.game, other(side))}</strong><span>คู่แข่งกินได้</span></div>
      </div>
      <p className="result-next" role="status">{nextStep}</p>
      <div className="result-actions">
        {!room.rematch_closed && <button type="button" className="primary" disabled={pending || mine} onClick={rematch}>
          {mine ? <Hourglass /> : theirs ? <Check /> : <RotateCcw />}
          {mine ? "รออีกฝ่าย" : theirs ? "พร้อมเล่นต่อ" : "เล่นต่อ"}
        </button>}
        <button type="button" className="outline" disabled={pending} onClick={end}><DoorOpen /> จบเกม</button>
      </div>
      {error && <p className="feedback" role="alert">{error}</p>}
    </dialog>
  );
}
