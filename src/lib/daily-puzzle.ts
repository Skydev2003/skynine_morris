import { createGame, isAction, placing, play, targets, type Action, type Game, type Side } from "./morris";

export const DAILY_PUZZLE_ENABLED = false;
export const DAILY_COINS = 20;
type Goal = "mill" | "block";
type Layout = { mint: number[]; rose: number[]; clue: number[]; goal: Goal; moving?: true };

const layouts: Layout[] = [
  { mint: [0, 1, 12], rose: [8, 11, 14], clue: [0, 1], goal: "mill" },
  { mint: [1, 9, 22], rose: [4, 10, 12], clue: [1, 9], goal: "mill" },
  { mint: [8, 10, 23], rose: [2, 6, 12], clue: [8, 10], goal: "mill" },
  { mint: [8, 12, 15], rose: [0, 1, 11], clue: [0, 1], goal: "block" },
  { mint: [0, 1, 3, 10], rose: [8, 12, 14, 18], clue: [0, 1], goal: "mill", moving: true },
  { mint: [3, 7, 11, 18], rose: [0, 12, 16, 20], clue: [3, 11], goal: "mill", moving: true },
  { mint: [8, 12, 22], rose: [1, 9, 14], clue: [1, 9], goal: "block" },
];

const bangkok = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });

export type DailyPuzzle = {
  day: string;
  game: Game;
  goal: Goal;
  clue: number[];
};

export function dailyPuzzle(now = new Date()): DailyPuzzle {
  const day = bangkok.format(now);
  const dayIndex = Math.floor(Date.parse(day) / 86_400_000);
  const layout = layouts[dayIndex % layouts.length];
  const symmetry = Math.floor(dayIndex / layouts.length) % 8;
  const transform = (point: number) => {
    const ring = Math.floor(point / 8) * 8;
    const slot = point % 8;
    return ring + ((symmetry >= 4 ? -slot : slot) + 2 * (symmetry % 4) + 8) % 8;
  };
  const game = createGame();
  for (const side of ["mint", "rose"] as const) {
    for (const point of layout[side]) game.board[transform(point)] = side;
    game.reserve[side] = layout.moving ? 0 : 9 - layout[side].length;
  }
  return { day, game, goal: layout.goal, clue: layout.clue.map(transform) };
}

function legalActions(game: Game, side: Side): Action[] {
  if (placing(game)) return game.board.flatMap((piece, at) => !piece ? [{ type: "place", at }] : []);
  return game.board.flatMap((piece, from) => piece === side
    ? targets(game, from).map((at) => ({ type: "move", from, at })) : []);
}

export function solveDailyPuzzle(puzzle: DailyPuzzle, action: unknown): Game | null {
  if (!isAction(action)) return null;
  try {
    const next = play(puzzle.game, "mint", action);
    if (puzzle.goal === "mill") return next.capture ? next : null;
    if (next.turn !== "rose" || next.winner) return null;
    return legalActions(next, "rose").some((reply) => play(next, "rose", reply).capture) ? null : next;
  } catch {
    return null;
  }
}
