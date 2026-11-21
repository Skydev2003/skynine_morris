import type { Game } from "./morris";

export const emojis = ["👋", "🔥", "😮", "👏", "😎", "🤝"];
export const roomCode = /^[A-Z0-9]{6}$/;

export type Room = {
  code: string;
  host_id: string;
  guest_id: string | null;
  game: Game;
  host_character: Character;
  guest_character: Character;
  host_color: PieceColor;
  guest_color: PieceColor;
  host_ready: boolean;
  guest_ready: boolean;
  started_at: string | null;
  revision: number;
  game_revision: number;
  reaction: { emoji: string; sender: string } | null;
  reacted_at: string | null;
  winner_id: string | null;
  finished_at: string | null;
};

export type Match = Pick<Room, "code" | "winner_id" | "finished_at">;

export const characters = { kai: "ไค", momo: "โมโมะ" } as const;
export const colors = { mint: "มิ้นต์", rose: "ชมพู", sky: "ฟ้า", gold: "พีช" } as const;
export type Character = keyof typeof characters;
export type PieceColor = keyof typeof colors;

export function isCharacter(value: unknown): value is Character {
  return typeof value === "string" && Object.hasOwn(characters, value);
}

export function isPieceColor(value: unknown): value is PieceColor {
  return typeof value === "string" && Object.hasOwn(colors, value);
}
