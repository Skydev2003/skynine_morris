import type { Character, PieceColor } from "./rooms";

export const WIN_COINS = 30;
export const STARTER_CHARACTERS: readonly Character[] = ["kai", "momo"];
export const STARTER_COLORS: readonly PieceColor[] = ["mint", "rose"];

export type ShopItem =
  | { kind: "character"; id: Character; price: number }
  | { kind: "color"; id: PieceColor; price: number };

export const SHOP_ITEMS: readonly ShopItem[] = [
  { kind: "character", id: "matcha", price: 90 },
  { kind: "character", id: "sunny", price: 120 },
  { kind: "character", id: "rio", price: 120 },
  { kind: "character", id: "luna", price: 150 },
  { kind: "character", id: "pippin", price: 180 },
  { kind: "color", id: "sky", price: 60 },
  { kind: "color", id: "gold", price: 90 },
];

export type ShopState = { coins: number; ownedCharacters: Character[]; ownedColors: PieceColor[] };
