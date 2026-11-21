import type { Pool } from "pg";
import { SHOP_ITEMS, STARTER_CHARACTERS, STARTER_COLORS, type ShopItem, type ShopState } from "./shop";

type Wallet = { coins: number; items: string[] };

const itemKey = (item: ShopItem) => `${item.kind}:${item.id}`;

function shopState(wallet?: Wallet): ShopState {
  const ownedCharacters = [...STARTER_CHARACTERS];
  const ownedColors = [...STARTER_COLORS];
  const items = new Set(wallet?.items);
  for (const item of SHOP_ITEMS) {
    if (!items.has(itemKey(item))) continue;
    if (item.kind === "character") ownedCharacters.push(item.id);
    else ownedColors.push(item.id);
  }
  return { coins: wallet?.coins ?? 0, ownedCharacters, ownedColors };
}

export async function getShopState(db: Pool, userId: string) {
  const { rows: [wallet] } = await db.query<Wallet>(
    "select coins, items from public.morris_wallets where user_id = $1",
    [userId],
  );
  return shopState(wallet);
}

export async function buyShopItem(db: Pool, userId: string, item: ShopItem) {
  // The wallet row serializes all purchases and match rewards for this player.
  const { rows: [wallet] } = await db.query<Wallet>(
    `update public.morris_wallets set coins = coins - $3, items = array_append(items, $2)
     where user_id = $1 and coins >= $3 and not ($2 = any(items))
     returning coins, items`,
    [userId, itemKey(item), item.price],
  );
  return wallet ? shopState(wallet) : null;
}
