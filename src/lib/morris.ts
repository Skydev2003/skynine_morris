export type Side = "mint" | "rose";
export type Action =
  | { type: "place" | "capture"; at: number }
  | { type: "move"; from: number; at: number };

export type Game = {
  board: (Side | null)[];
  reserve: Record<Side, number>;
  turn: Side;
  capture: boolean;
  winner: Side | null;
  last: number | null;
};

export const other = (side: Side): Side => side === "mint" ? "rose" : "mint";

export const points = [10, 23.333, 36.667].flatMap((low) => {
  const high = 100 - low;
  return [[low, low], [50, low], [high, low], [high, 50], [high, high], [50, high], [low, high], [low, 50]];
});

const mills = [
  ...[0, 8, 16].flatMap((base) => [0, 2, 4, 6].map((n) => [base + n, base + n + 1, base + (n + 2) % 8])),
  ...[1, 3, 5, 7].map((n) => [n, n + 8, n + 16]),
];

export function createGame(): Game {
  return { board: Array(24).fill(null), reserve: { mint: 9, rose: 9 }, turn: "mint", capture: false, winner: null, last: null };
}

export const count = (game: Game, side: Side) => game.board.filter((piece) => piece === side).length;
export function capturedCount(game: Game, side: Side) {
  const opponent = other(side);
  return 9 - game.reserve[opponent] - count(game, opponent);
}

export function lastCapture(game: Game) {
  // A placement or move records its occupied destination. A capture records the emptied point.
  if (game.last === null || game.board[game.last] !== null) return null;
  return { at: game.last, by: game.winner ?? other(game.turn) };
}

export const placing = (game: Game) => game.reserve.mint + game.reserve.rose > 0;
const inMill = (board: Game["board"], at: number, side: Side) =>
  mills.some((line) => line.includes(at) && line.every((point) => board[point] === side));

export function captures(game: Game): number[] {
  const enemy = other(game.turn);
  const pieces = game.board.flatMap((piece, at) => piece === enemy ? [at] : []);
  const unprotected = pieces.filter((at) => !inMill(game.board, at, enemy));
  return unprotected.length ? unprotected : pieces;
}

export function targets(game: Game, from: number): number[] {
  const side = game.board[from];
  if (!side || placing(game)) return [];
  if (count(game, side) === 3) return game.board.flatMap((piece, at) => piece === null ? [at] : []);
  const offset = from % 8;
  const base = from - offset;
  const nearby = [base + (offset + 1) % 8, base + (offset + 7) % 8];
  if (offset % 2 === 1) nearby.push(from - 8, from + 8);
  return nearby.filter((at) => game.board[at] === null);
}

export function isAction(value: unknown): value is Action {
  if (!value || typeof value !== "object" || !("type" in value) || !("at" in value)) return false;
  const validPoint = (at: unknown) => typeof at === "number" && Number.isInteger(at) && at >= 0 && at < 24;
  return validPoint(value.at) && (value.type === "place" || value.type === "capture" ||
    (value.type === "move" && "from" in value && validPoint(value.from)));
}

export function play(game: Game, side: Side, action: Action): Game {
  if (game.winner || game.turn !== side || !isAction(action)) throw new Error("ยังเล่นตานี้ไม่ได้");
  const { type, at } = action;
  const next = { ...game, board: [...game.board], reserve: { ...game.reserve }, last: at };
  if (game.capture) {
    if (type !== "capture" || !captures(game).includes(at)) throw new Error("เลือกหมากคู่แข่งที่จับได้");
    next.board[at] = null;
  } else if (type === "place" && placing(game) && game.reserve[side] > 0 && !game.board[at]) {
    next.board[at] = side;
    next.reserve[side]--;
  } else if (type === "move" && game.board[action.from] === side && targets(game, action.from).includes(at)) {
    next.board[action.from] = null;
    next.board[at] = side;
  } else {
    throw new Error("เลือกจุดที่เล่นได้บนกระดาน");
  }

  const enemy = other(side);
  next.capture = type !== "capture" && count(next, enemy) > 0 && inMill(next.board, at, side);
  if (next.capture) return next;
  if (!placing(next) && (count(next, enemy) < 3 ||
    !next.board.some((piece, point) => piece === enemy && targets(next, point).length > 0))) {
    next.winner = side;
  } else {
    next.turn = enemy;
  }
  return next;
}
