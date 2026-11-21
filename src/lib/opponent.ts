import { captures, count, createGame, other, placing, play, targets, type Action, type Game } from "./morris";
import { characters, turnSeconds, type Character, type Room } from "./rooms";

function options(game: Game): Action[] {
  if (game.winner) return [];
  if (game.capture) return captures(game).map((at) => ({ type: "capture", at }));
  if (placing(game)) return game.board.flatMap((piece, at) => piece === null ? [{ type: "place", at }] : []);
  return game.board.flatMap((piece, from) => piece === game.turn
    ? targets(game, from).map((at) => ({ type: "move", from, at })) : []);
}

export function opponentMove(game: Game): Action | undefined {
  const side = game.turn;
  let best: Action | undefined;
  let bestScore = -Infinity;
  for (const action of options(game)) {
    const next = play(game, side, action);
    const threat = next.turn !== side && !next.winner && options(next)
      .some((reply) => play(next, next.turn, reply).capture);
    const mobility = (action.at % 2 ? 1 : 0) + (action.at >= 8 && action.at < 16 ? 1 : 0);
    const score = (next.winner === side ? 100 : 0) + (next.capture ? 12 : 0) -
      (threat ? 8 : 0) - count(next, other(side)) * 2 + mobility + Math.random() * 2;
    if (score > bestScore) { best = action; bestScore = score; }
  }
  return best;
}

const deadline = () => new Date(Date.now() + turnSeconds * 1000).toISOString();

export function createOpponentMatch(userId: string, name: string): Room {
  const roster = (Object.keys(characters) as Character[]).filter((character) => character !== "kai");
  const rival = roster[Math.floor(Math.random() * roster.length)];
  return {
    code: "local-" + crypto.randomUUID(), local_match: true, host_id: userId, host_name: name,
    guest_id: "arena-opponent", guest_name: characters[rival], host_character: "kai", guest_character: rival,
    host_color: "mint", guest_color: "rose", host_ready: true, guest_ready: true, started_at: new Date().toISOString(),
    game: createGame(), turn_deadline: deadline(), finish_reason: null, revision: 0, game_revision: 0,
    reaction: null, reacted_at: null, winner_id: null, finished_at: null, host_rematch: false, guest_rematch: false, rematch_closed: false,
  };
}

export function localTurn(room: Room, game: Game, timedOut = false): Room {
  return {
    ...room, game, revision: room.revision + 1, game_revision: room.game_revision + 1,
    turn_deadline: game.winner ? null : game.turn === room.game.turn ? room.turn_deadline : deadline(),
    winner_id: game.winner === "mint" ? room.host_id : game.winner === "rose" ? room.guest_id : null,
    finished_at: game.winner ? new Date().toISOString() : null, finish_reason: timedOut ? "timeout" : null,
  };
}

export function resetOpponentMatch(room: Room): Room {
  return {
    ...room, game: createGame(), revision: room.revision + 1, game_revision: room.game_revision + 1,
    started_at: new Date().toISOString(), turn_deadline: deadline(), finish_reason: null,
    winner_id: null, finished_at: null, host_rematch: false, guest_rematch: false, reaction: null, reacted_at: null,
  };
}

export function localTimeout(room: Room) {
  if (!room.turn_deadline || room.game.winner || Date.now() < Date.parse(room.turn_deadline)) return room;
  return localTurn(room, { ...room.game, winner: other(room.game.turn), capture: false, last: null }, true);
}
