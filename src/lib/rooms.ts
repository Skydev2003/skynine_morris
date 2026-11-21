import type { Game } from "./morris";

export const emojis = ["👋", "🔥", "😮", "👏", "😎", "🤝"];
export const roomCode = /^[A-Z0-9]{6}$/;

export type Room = {
  code: string;
  local_match?: true;
  host_id: string;
  host_name: string;
  guest_name: string;
  guest_id: string | null;
  game: Game;
  host_character: Character;
  guest_character: Character;
  host_color: PieceColor;
  guest_color: PieceColor;
  host_ready: boolean;
  guest_ready: boolean;
  started_at: string | null;
  turn_deadline: string | null;
  finish_reason: "timeout" | null;
  revision: number;
  game_revision: number;
  reaction: { emoji: string; sender: string } | null;
  reacted_at: string | null;
  winner_id: string | null;
  finished_at: string | null;
  host_rematch: boolean;
  guest_rematch: boolean;
  rematch_closed: boolean;
};

export type Match = { room_code: string; game_revision: number; winner_id: string; finished_at: string };

export const characters = {
  kai: "ไค", momo: "โมโมะ", matcha: "มัทฉะ", sunny: "ซันนี่",
  rio: "ริโอ", luna: "ลูน่า", pippin: "พิปปิน",
} as const;
export const turnSeconds = 60;

export function playerName(value: unknown) {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}]/u.test(value)) return "";
  const name = value.trim();
  return name.length >= 2 && name.length <= 24 ? name : "";
}
export const colors = { mint: "มิ้นต์", rose: "ชมพู", sky: "ฟ้า", gold: "พีช" } as const;
export type Character = keyof typeof characters;
export type PieceColor = keyof typeof colors;

export function isCharacter(value: unknown): value is Character {
  return typeof value === "string" && Object.hasOwn(characters, value);
}

export function isPieceColor(value: unknown): value is PieceColor {
  return typeof value === "string" && Object.hasOwn(colors, value);
}
