import type { Pool } from "pg";
import { SHOP_ITEMS, STARTER_CHARACTERS, STARTER_COLORS, isProfileFrame, type ProfileFrame, type ShopItem, type ShopState } from "./shop";

type Wallet = { coins: number; items: string[]; equipped_frame: string | null };

const itemKey = (item: ShopItem) => `${item.kind}:${item.id}`;

function shopState(wallet?: Wallet): ShopState {
  const ownedCharacters = [...STARTER_CHARACTERS];
  const ownedColors = [...STARTER_COLORS];
  const ownedFrames: ProfileFrame[] = [];
  const items = new Set(wallet?.items);
  for (const item of SHOP_ITEMS) {
    if (!items.has(itemKey(item))) continue;
    if (item.kind === "character") ownedCharacters.push(item.id);
    else if (item.kind === "color") ownedColors.push(item.id);
    else ownedFrames.push(item.id);
  }
  const frame = wallet?.equipped_frame;
  return { coins: wallet?.coins ?? 0, ownedCharacters, ownedColors, ownedFrames,
    equippedFrame: isProfileFrame(frame) && ownedFrames.includes(frame) ? frame : null };
}

export async function getShopState(db: Pool, userId: string) {
  const { rows: [wallet] } = await db.query<Wallet>(
    "select coins, items, equipped_frame from public.morris_wallets where user_id = $1",
    [userId],
  );
  return shopState(wallet);
}

export async function buyShopItem(db: Pool, userId: string, item: ShopItem) {
  // The wallet row serializes all purchases and match rewards for this player.
  const { rows: [wallet] } = await db.query<Wallet>(
    `update public.morris_wallets set coins = coins - $3, items = array_append(items, $2)
     where user_id = $1 and coins >= $3 and not ($2 = any(items))
     returning coins, items, equipped_frame`,
    [userId, itemKey(item), item.price],
  );
  return wallet ? shopState(wallet) : null;
}

export async function equipProfileFrame(db: Pool, userId: string, frame: ProfileFrame | null) {
  const { rows: [wallet] } = await db.query<Wallet>(
    `update public.morris_wallets set equipped_frame = $2
     where user_id = $1 and ($2::text is null or ('frame:' || $2) = any(items))
     returning coins, items, equipped_frame`,
    [userId, frame],
  );
  return wallet ? shopState(wallet) : frame === null ? getShopState(db, userId) : null;
}
