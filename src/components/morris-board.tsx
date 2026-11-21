import { captures, count, placing, points, targets, type Game, type Side } from "@/lib/morris";

export const sideName: Record<Side, string> = { mint: "มิ้นต์", rose: "โรส" };

export function Board({ game, active, selected, onPoint }: {
  game: Game;
  active: boolean;
  selected: number | null;
  onPoint: (at: number) => void;
}) {
  const available = game.capture ? captures(game) : selected === null ? [] : targets(game, selected);
  const isPlacing = placing(game);
  return (
    <div className="board" role="group" aria-label="กระดานมอร์ริส 24 จุด">
      <svg className="board-lines" viewBox="0 0 100 100" aria-hidden="true">
        <rect x="10" y="10" width="80" height="80" />
        <rect x="23.333" y="23.333" width="53.334" height="53.334" />
        <rect x="36.667" y="36.667" width="26.666" height="26.666" />
        <path d="M50 10V36.667 M50 63.333V90 M10 50H36.667 M63.333 50H90" />
      </svg>
      <svg className="board-mark" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 2 30 16 16 30 2 16Z M16 8l8 8-8 8-8-8Z" />
        <circle cx="16" cy="16" r="2" />
      </svg>
      {points.map(([x, y], at) => {
        const piece = game.board[at];
        const choice = active && available.includes(at);
        const playable = active && (game.capture ? choice : isPlacing ? !piece : piece === game.turn || choice);
        return (
          <button
            key={at}
            type="button"
            className={`point ${piece ?? "empty"} ${choice ? "choice" : ""} ${at === selected ? "selected" : ""} ${at === game.last && piece ? "last" : ""}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            disabled={!playable}
            aria-label={`จุด ${at + 1} ${piece ? `หมาก${sideName[piece]}` : "ว่าง"}${choice ? " เลือกได้" : ""}`}
            aria-pressed={at === selected}
            onClick={() => onPoint(at)}
          ><span key={piece && at === game.last ? `${piece}-latest` : piece ?? "empty"} /></button>
        );
      })}
    </div>
  );
}

export function Player({ side, game, current, you, waiting }: {
  side: Side;
  game: Game;
  current: boolean;
  you: boolean;
  waiting?: boolean;
}) {
  return (
    <div className={`player ${side} ${current ? "current" : ""}`}>
      <span className={`captain-avatar ${side}`} aria-hidden="true" />
      <div><strong>{waiting ? "รอผู้เล่น" : side === "mint" ? "มิ้นต์ · โฮสต์" : "โรส · ผู้เข้าร่วม"} {you && <span className="you">คุณ</span>}</strong>
        <small>{count(game, side)} บนกระดาน · {game.reserve[side]} ในมือ</small></div>
      {current && <span className="turn-dot" aria-label="กำลังเล่น" />}
    </div>
  );
}
