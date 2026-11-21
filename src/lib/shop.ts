import type { Character, PieceColor } from "./rooms";

export const WIN_COINS = 30;
export const STARTER_CHARACTERS: readonly Character[] = ["kai", "momo"];
export const STARTER_COLORS: readonly PieceColor[] = ["mint", "rose"];

export const frames = { sunburst: "รัศมีทอง", tide: "คลื่นมรกต", comet: "ดาวหางฟ้า" } as const;
export type ProfileFrame = keyof typeof frames;
export type MatchProfile = { photo?: string; frame: ProfileFrame | null };

export function isProfileFrame(value: unknown): value is ProfileFrame {
  return typeof value === "string" && Object.hasOwn(frames, value);
}

export type ShopItem =
  | { kind: "character"; id: Character; price: number }
  | { kind: "color"; id: PieceColor; price: number }
  | { kind: "frame"; id: ProfileFrame; price: number };

export const SHOP_ITEMS: readonly ShopItem[] = [
  { kind: "character", id: "hikaru", price: 180 },
  { kind: "character", id: "akira", price: 180 },
  { kind: "character", id: "sai", price: 210 },
  { kind: "character", id: "matcha", price: 90 },
  { kind: "character", id: "sunny", price: 120 },
  { kind: "character", id: "rio", price: 120 },
  { kind: "character", id: "luna", price: 150 },
  { kind: "character", id: "pippin", price: 180 },
  { kind: "color", id: "sky", price: 60 },
  { kind: "color", id: "gold", price: 90 },
  { kind: "color", id: "aurora", price: 150 },
  { kind: "color", id: "flare", price: 180 },
  { kind: "frame", id: "sunburst", price: 90 },
  { kind: "frame", id: "tide", price: 120 },
  { kind: "frame", id: "comet", price: 150 },
];

export type ShopState = { coins: number; ownedCharacters: Character[]; ownedColors: PieceColor[]; ownedFrames: ProfileFrame[]; equippedFrame: ProfileFrame | null };
