import type { Game } from "./morris";

export const emojis = ["👋", "🔥", "😮", "👏", "😎", "🤝"];
export const roomCode = /^[A-Z0-9]{6}$/;

export type Room = {
  code: string;
  host_id: string;
  guest_id: string | null;
  game: Game;
  revision: number;
  game_revision: number;
  reaction: { emoji: string; sender: string } | null;
  reacted_at: string | null;
  winner_id: string | null;
  finished_at: string | null;
};

export type Match = Pick<Room, "code" | "winner_id" | "finished_at">;
