import { captures, count, placing, points, targets, type Game, type Side } from "@/lib/morris";

import { characters, colors, type Character, type PieceColor } from "@/lib/rooms";

export function Board({ game, palette, active, selected, onPoint, revision }: {
  game: Game;
  palette: Record<Side, PieceColor>;
  revision: number;
  active: boolean;
  selected: number | null;
  onPoint: (at: number) => void;
}) {
  const available = game.capture ? captures(game) : selected === null ? [] : targets(game, selected);
  const isPlacing = placing(game);
  const impact = game.last !== null && game.board[game.last] === null ? points[game.last] : null;
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
            className={`point ${piece ? `piece color-${palette[piece]}` : "empty"} ${choice ? "choice" : ""} ${at === selected ? "selected" : ""} ${at === game.last && piece ? "last" : ""}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            disabled={!playable}
            aria-label={`จุด ${at + 1} ${piece ? `หมาก${colors[palette[piece]]}` : "ว่าง"}${choice ? " เลือกได้" : ""}`}
            aria-pressed={at === selected}
            onClick={() => onPoint(at)}
          ><span key={piece && at === game.last ? `${piece}-latest` : piece ?? "empty"} /></button>
        );
      })}
      {impact && <div className="capture-impact" key={revision} style={{ left: `${impact[0]}%`, top: `${impact[1]}%` }} aria-hidden="true">
        <span className="impact-ring" />
        {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ rotate: `${i * 45}deg` }} />)}
      </div>}
    </div>
  );
}

export function Player({ side, game, current, you, character, color }: {
  side: Side;
  game: Game;
  current: boolean;
  you: boolean;
  character: Character;
  color: PieceColor;
}) {
  const onBoard = count(game, side);
  const inHand = game.reserve[side];
  return (
    <section className={`duelist color-${color} ${you ? "duelist-you" : "duelist-rival"}${current ? " current" : ""}`} aria-label={you ? "หมากของคุณ" : "หมากคู่แข่ง"}>
      <span className="duelist-role">{you ? "คุณ" : "คู่แข่ง"}{current && <i className="color-chip" />}</span>
      <div className={`duelist-portrait portrait-${character}`} aria-hidden="true" />
      <h2>{characters[character]}</h2>
      <div className="piece-tallies">
        <div><strong>{onBoard}</strong><span>บนกระดาน</span></div>
        <div><strong>{inHand}</strong><span>ในมือ</span></div>
      </div>
      <div className="piece-rack" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} data-filled={i < onBoard + inHand} />)}</div>
    </section>
  );
}
